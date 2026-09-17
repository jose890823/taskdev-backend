import {
  ConflictException,
  ForbiddenException,
  GoneException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { generateApiKey } from './api-key.crypto';
import { ApiKeyService } from './api-key.service';
import {
  API_KEY_PEPPER_CURRENT_ENV,
  API_KEY_PEPPER_PREVIOUS_ENV,
  API_KEY_PREVIOUS_PEPPER_RETIRE_AT_ENV,
  API_KEY_PREVIOUS_HASH_VERSION,
  API_KEY_LIMITS,
  API_KEY_SECRET_NOT_RECOVERABLE_CODE,
  API_KEY_SECRET_NOT_RECOVERABLE_MESSAGE,
  ApiKeyScope,
} from './api-key.constants';
import { McpApiKey } from './entities/mcp-api-key.entity';
import { SecurityEventType } from '../security/entities';

describe('ApiKeyService', () => {
  const owner = {
    id: 'owner-1',
    email: 'owner@example.test',
    isActive: true,
    roles: ['user'],
    isSuperAdmin: () => false,
  } as never;
  const projectMember = { projectId: 'project-1', userId: 'owner-1' };
  const keyRepository = {
    create: jest.fn((value) => value),
    save: jest.fn(async (value) => ({
      ...value,
      id: value.id || 'key-1',
      createdAt: new Date(),
      updatedAt: new Date(),
    })),
    findOne: jest.fn(),
    find: jest.fn(),
    count: jest.fn().mockResolvedValue(0),
    update: jest.fn().mockResolvedValue(undefined),
  };
  const userRepository = { findOne: jest.fn() };
  const memberRepository = { findOne: jest.fn() };
  const featureFlags = {
    isAuthenticationEnabled: jest.fn().mockResolvedValue(true),
    isManagementEnabled: jest.fn().mockResolvedValue(true),
  };
  const securityEvents = { create: jest.fn().mockResolvedValue({}) };
  const cache = {
    increment: jest.fn().mockResolvedValue(1),
    incrementWithTtl: jest.fn().mockResolvedValue({ count: 1, retryAfter: 10 }),
  };
  const config = {
    get: jest.fn((key: string) => {
      if (key === API_KEY_PEPPER_CURRENT_ENV) return 'unit-test-pepper';
      if (key === API_KEY_PEPPER_PREVIOUS_ENV) return 'previous-test-pepper';
      if (key === API_KEY_PREVIOUS_PEPPER_RETIRE_AT_ENV) {
        return new Date(Date.now() + 60_000).toISOString();
      }
      return undefined;
    }),
  };
  const dataSource = {
    transaction: jest.fn(async (callback) =>
      callback({
        getRepository: jest.fn(),
        query: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        update: jest.fn().mockResolvedValue(undefined),
        create: jest.fn((_, value) => value),
        save: jest.fn(async (value) => ({
          ...value,
          id: 'replacement-1',
          createdAt: new Date(),
          updatedAt: new Date(),
        })),
      }),
    ),
  };

  let service: ApiKeyService;

  beforeEach(() => {
    jest.clearAllMocks();
    userRepository.findOne.mockResolvedValue(owner);
    memberRepository.findOne.mockResolvedValue(projectMember);
    keyRepository.findOne.mockResolvedValue(null);
    keyRepository.find.mockResolvedValue([]);
    keyRepository.count.mockResolvedValue(0);
    cache.incrementWithTtl.mockResolvedValue({ count: 1, retryAfter: 10 });
    service = new ApiKeyService(
      keyRepository as never,
      userRepository as never,
      memberRepository as never,
      config as unknown as ConfigService,
      featureFlags as never,
      securityEvents as never,
      cache as never,
      dataSource as never,
    );
  });

  function expectAuthenticationFailureAudit(
    eventType: SecurityEventType,
    reason: string,
    secret?: string,
  ) {
    const calls = securityEvents.create.mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    const audit = calls[calls.length - 1][0] as {
      eventType: SecurityEventType;
      endpoint: string;
      metadata: Record<string, unknown>;
    };

    expect(audit.eventType).toBe(eventType);
    expect(audit.metadata).toEqual(
      expect.objectContaining({
        actor: 'api-key',
        action: 'authenticate',
        outcome: 'denied',
        reason,
      }),
    );
    expect(typeof audit.metadata.reason).toBe('string');
    expect((audit.metadata.reason as string).length).toBeLessThanOrEqual(128);
    expect(audit.metadata).not.toHaveProperty('verifier');
    expect(audit.metadata).not.toHaveProperty('pepper');
    expect(audit.metadata).not.toHaveProperty('authorization');
    expect(audit.metadata).not.toHaveProperty('token');
    expect(audit.endpoint).not.toContain('?');
    expect(audit.endpoint).not.toMatch(/^https?:\/\//i);

    const serialized = JSON.stringify(audit);
    for (const forbidden of [secret, 'Authorization', 'http://', 'https://']) {
      if (forbidden) expect(serialized).not.toContain(forbidden);
    }
  }

  it('creates a bound key and returns the secret only in the create result', async () => {
    const result = await service.create(
      {
        name: 'CI key',
        projectId: 'project-1',
        scopes: ['tasks:read'] as ApiKeyScope[],
        expirationDays: 90,
      },
      owner,
    );

    expect(result.secret).toMatch(/^thk_[a-f0-9]+_[a-f0-9]+$/);
    expect(result['verifier']).toBeUndefined();
    expect(result['prefix']).toMatch(/^thk_[a-f0-9]{8}$/);
    expect(securityEvents.create).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: SecurityEventType.API_KEY_CREATED }),
    );
    expect(securityEvents.create).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: SecurityEventType.API_KEY_REVEALED,
      }),
    );
  });

  it('serializes concurrent creates at the active user-project capacity', async () => {
    const activeKeys = Array.from(
      { length: API_KEY_LIMITS.maxActivePerUserProject - 1 },
      (_, index) => ({
        ownerId: owner.id,
        projectId: 'project-1',
        revokedAt: null,
        expiresAt: new Date(Date.now() + 60_000),
        id: `existing-${index}`,
      }),
    );
    const lockTails = new Map<string, Promise<void>>();
    const lockQueries: string[] = [];

    const acquireLock = async (lockKey: string) => {
      const previous = lockTails.get(lockKey) || Promise.resolve();
      let release!: () => void;
      const current = new Promise<void>((resolve) => {
        release = resolve;
      });
      lockTails.set(lockKey, current);
      await previous;
      return release;
    };

    const localDataSource = {
      transaction: jest.fn(async (callback) => {
        const releases: Array<() => void> = [];
        const manager = {
          getRepository: jest.fn(),
          query: jest.fn(async (_sql: string, [lockKey]: [string]) => {
            lockQueries.push(lockKey);
            releases.push(await acquireLock(lockKey));
          }),
          count: jest.fn(
            async (
              _entity: unknown,
              options: { where: Record<string, unknown> },
            ) => {
              const where = options.where;
              return activeKeys.filter(
                (key) =>
                  (!where.ownerId || key.ownerId === where.ownerId) &&
                  (!where.projectId || key.projectId === where.projectId),
              ).length;
            },
          ),
          create: jest.fn((_entity: unknown, value: unknown) => value),
          save: jest.fn(async (value) => {
            const saved = {
              ...(value as Record<string, unknown>),
              id: `created-${activeKeys.length}`,
            };
            activeKeys.push(saved as (typeof activeKeys)[number]);
            return saved;
          }),
        };

        try {
          return await callback(manager as never);
        } finally {
          releases.reverse().forEach((release) => release());
        }
      }),
    };
    const localService = new ApiKeyService(
      { create: jest.fn() } as never,
      { findOne: jest.fn().mockResolvedValue(owner) } as never,
      { findOne: jest.fn().mockResolvedValue(projectMember) } as never,
      config as unknown as ConfigService,
      featureFlags as never,
      securityEvents as never,
      cache as never,
      localDataSource as never,
    );

    const attempts = await Promise.allSettled([
      localService.create(
        {
          name: 'concurrent-1',
          projectId: 'project-1',
          scopes: ['tasks:read'] as ApiKeyScope[],
          expirationDays: 90,
        },
        owner,
      ),
      localService.create(
        {
          name: 'concurrent-2',
          projectId: 'project-1',
          scopes: ['tasks:read'] as ApiKeyScope[],
          expirationDays: 90,
        },
        owner,
      ),
    ]);

    expect(
      attempts.filter((attempt) => attempt.status === 'fulfilled'),
    ).toHaveLength(1);
    expect(
      attempts.filter(
        (attempt) =>
          attempt.status === 'rejected' &&
          attempt.reason instanceof ConflictException,
      ),
    ).toHaveLength(1);
    expect(activeKeys).toHaveLength(API_KEY_LIMITS.maxActivePerUserProject);
    expect(lockQueries).toHaveLength(6);
    expect(localDataSource.transaction).toHaveBeenCalledTimes(2);
  });

  it('authenticates the key only for its exact project and scope', async () => {
    const generated = generateApiKey('unit-test-pepper');
    const key = {
      id: 'key-1',
      ownerId: 'owner-1',
      projectId: 'project-1',
      publicId: generated.publicId,
      prefix: generated.prefix,
      verifier: generated.verifier,
      hashVersion: 1,
      scopes: ['tasks:read'],
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: null,
    } as unknown as McpApiKey;
    keyRepository.findOne.mockResolvedValue(key);

    const identity = await service.authenticate(
      generated.token,
      ['tasks:read'],
      ['project-1'],
      { ipAddress: '127.0.0.1', endpoint: '/api/tasks', method: 'GET' },
    );

    expect(identity).toMatchObject({
      authType: 'api-key',
      keyId: 'key-1',
      projectId: 'project-1',
    });
    await expect(
      service.authenticate(generated.token, ['tasks:read'], ['project-2']),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(securityEvents.create).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: SecurityEventType.API_KEY_PROJECT_DENIED,
      }),
    );
    expectAuthenticationFailureAudit(
      SecurityEventType.API_KEY_PROJECT_DENIED,
      'project_mismatch',
      generated.token,
    );
  });

  it('audits expired authentication with a dedicated redacted event', async () => {
    const generated = generateApiKey('unit-test-pepper');
    const key = {
      id: 'expired-key',
      ownerId: 'owner-1',
      projectId: 'project-1',
      publicId: generated.publicId,
      prefix: generated.prefix,
      verifier: generated.verifier,
      hashVersion: 1,
      scopes: ['tasks:read'],
      expiresAt: new Date(Date.now() - 60_000),
      revokedAt: null,
    } as unknown as McpApiKey;
    keyRepository.findOne.mockResolvedValue(key);
    const context = {
      ipAddress: '127.0.0.1',
      endpoint: '/api/tasks?projectId=project-1',
      method: 'GET',
      userAgent: 'unit-test',
    };

    await expect(
      service.authenticate(
        generated.token,
        ['tasks:read'],
        ['project-1'],
        context,
      ),
    ).rejects.toMatchObject({ response: { code: 'API_KEY_INVALID' } });

    expect(securityEvents.create).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: SecurityEventType.API_KEY_EXPIRED,
        metadata: expect.objectContaining({
          keyId: 'expired-key',
          publicId: generated.publicId,
          reason: 'expired',
        }),
      }),
    );
    expectAuthenticationFailureAudit(
      SecurityEventType.API_KEY_EXPIRED,
      'expired',
      generated.token,
    );
  });

  it('keeps revoked, malformed, and unknown keys classified as invalid', async () => {
    const generated = generateApiKey('unit-test-pepper');
    const revokedKey = {
      id: 'revoked-key',
      ownerId: 'owner-1',
      projectId: 'project-1',
      publicId: generated.publicId,
      prefix: generated.prefix,
      verifier: generated.verifier,
      hashVersion: 1,
      scopes: ['tasks:read'],
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: new Date(),
    } as unknown as McpApiKey;
    keyRepository.findOne.mockResolvedValue(revokedKey);

    await expect(
      service.authenticate(generated.token, ['tasks:read'], ['project-1']),
    ).rejects.toMatchObject({ response: { code: 'API_KEY_INVALID' } });
    expect(securityEvents.create).toHaveBeenLastCalledWith(
      expect.objectContaining({
        eventType: SecurityEventType.API_KEY_INVALID,
        metadata: expect.objectContaining({ reason: 'revoked' }),
      }),
    );
    expectAuthenticationFailureAudit(
      SecurityEventType.API_KEY_INVALID,
      'revoked',
      generated.token,
    );

    keyRepository.findOne.mockResolvedValue(null);
    await expect(
      service.authenticate('malformed', ['tasks:read'], ['project-1']),
    ).rejects.toMatchObject({ response: { code: 'API_KEY_INVALID' } });
    expect(securityEvents.create).toHaveBeenLastCalledWith(
      expect.objectContaining({
        eventType: SecurityEventType.API_KEY_INVALID,
        metadata: expect.objectContaining({ reason: 'malformed' }),
      }),
    );
    expectAuthenticationFailureAudit(
      SecurityEventType.API_KEY_INVALID,
      'malformed',
    );

    const unknown = generateApiKey('unit-test-pepper');
    await expect(
      service.authenticate(unknown.token, ['tasks:read'], ['project-1']),
    ).rejects.toMatchObject({ response: { code: 'API_KEY_INVALID' } });
    expect(securityEvents.create).toHaveBeenLastCalledWith(
      expect.objectContaining({
        eventType: SecurityEventType.API_KEY_INVALID,
        metadata: expect.objectContaining({
          publicId: unknown.publicId,
          reason: 'unknown_key',
        }),
      }),
    );
    expectAuthenticationFailureAudit(
      SecurityEventType.API_KEY_INVALID,
      'unknown_key',
      unknown.token,
    );
  });

  it('audits verifier, owner, scope, and rate-limit failures with complete attribution', async () => {
    const generated = generateApiKey('unit-test-pepper');
    const key = {
      id: 'failure-key',
      ownerId: 'owner-1',
      projectId: 'project-1',
      publicId: generated.publicId,
      prefix: generated.prefix,
      verifier: generated.verifier,
      hashVersion: 1,
      scopes: ['tasks:read'],
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: null,
    } as unknown as McpApiKey;
    keyRepository.findOne.mockResolvedValue(key);

    const mismatchedToken = `thk_${generated.publicId}_${'0'.repeat(64)}`;
    await expect(
      service.authenticate(mismatchedToken, ['tasks:read'], ['project-1'], {
        endpoint: '/api/tasks?projectId=project-1',
      }),
    ).rejects.toMatchObject({ response: { code: 'API_KEY_INVALID' } });
    expectAuthenticationFailureAudit(
      SecurityEventType.API_KEY_INVALID,
      'verifier_mismatch',
      mismatchedToken,
    );

    userRepository.findOne.mockResolvedValue(null);
    await expect(
      service.authenticate(generated.token, ['tasks:read'], ['project-1'], {
        endpoint: '/api/tasks',
      }),
    ).rejects.toMatchObject({ response: { code: 'API_KEY_INVALID' } });
    expectAuthenticationFailureAudit(
      SecurityEventType.API_KEY_INVALID,
      'inactive_owner',
      generated.token,
    );

    userRepository.findOne.mockResolvedValue(owner);
    await expect(
      service.authenticate(generated.token, ['tasks:write'], ['project-1'], {
        endpoint: '/api/tasks',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expectAuthenticationFailureAudit(
      SecurityEventType.API_KEY_SCOPE_DENIED,
      'insufficient_scope',
      generated.token,
    );

    cache.incrementWithTtl.mockResolvedValue({
      count: API_KEY_LIMITS.requestsPerTenSecondsPerKey + 1,
      retryAfter: 9,
    });
    await expect(
      service.authenticate(generated.token, ['tasks:read'], ['project-1'], {
        endpoint: '/api/tasks',
      }),
    ).rejects.toMatchObject({ response: { code: 'API_KEY_RATE_LIMITED' } });
    expectAuthenticationFailureAudit(
      SecurityEventType.API_KEY_RATE_LIMITED,
      'rate_limit_exceeded',
      generated.token,
    );
  });

  it('revokes a key and never includes verifier metadata in management responses', async () => {
    const key = {
      id: 'key-1',
      ownerId: 'owner-1',
      projectId: 'project-1',
      name: 'CI key',
      publicId: 'public-id',
      prefix: 'thk_public',
      verifier: 'verifier',
      scopes: ['tasks:read'],
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: null,
      revokedById: null,
      revokeReason: null,
      replacedById: null,
      lastUsedAt: null,
    } as unknown as McpApiKey;
    keyRepository.findOne.mockResolvedValue(key);
    keyRepository.save.mockImplementation(async (value) => value);

    const result = await service.revoke('key-1', owner, 'retired');

    expect(result.status).toBe('revoked');
    expect(result.verifier).toBeUndefined();
    expect(result.secret).toBeUndefined();
    expect(key.revokedById).toBe('owner-1');
    expect(key.revokeReason).toBe('retired');
  });

  it('rejects lost-secret recovery without mutating or exposing credential material', async () => {
    const key = {
      id: 'key-1',
      ownerId: 'owner-1',
      projectId: 'project-1',
      name: 'CI key',
      publicId: 'public-id',
      prefix: 'thk_public',
      verifier: 'verifier',
      scopes: ['tasks:read'],
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: null,
      revokedById: null,
      revokeReason: null,
      replacedById: null,
      lastUsedAt: null,
    } as unknown as McpApiKey;
    keyRepository.findOne.mockResolvedValue(key);
    const originalKey = { ...key };

    const error = await service.recover('key-1', owner).catch((value) => value);

    expect(error).toBeInstanceOf(GoneException);
    expect(error.getResponse()).toEqual({
      code: API_KEY_SECRET_NOT_RECOVERABLE_CODE,
      message: API_KEY_SECRET_NOT_RECOVERABLE_MESSAGE,
    });
    expect(JSON.stringify(error.getResponse())).not.toContain('verifier');
    expect(JSON.stringify(error.getResponse())).not.toContain('token');
    expect(JSON.stringify(error.getResponse())).not.toContain('thk_');
    expect(key).toEqual(originalKey);
    expect(keyRepository.save).not.toHaveBeenCalled();
    expect(keyRepository.update).not.toHaveBeenCalled();
  });

  it('denies lost-secret recovery to a different owner', async () => {
    const key = {
      id: 'key-1',
      ownerId: 'another-owner',
      projectId: 'project-1',
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: null,
    } as unknown as McpApiKey;
    keyRepository.findOne.mockResolvedValue(key);

    await expect(service.recover('key-1', owner)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(keyRepository.save).not.toHaveBeenCalled();
    expect(keyRepository.update).not.toHaveBeenCalled();
  });

  it('rejects lost-secret recovery when management is disabled', async () => {
    featureFlags.isManagementEnabled.mockResolvedValueOnce(false);

    await expect(service.recover('key-1', owner)).rejects.toMatchObject({
      response: { code: 'API_KEY_MANAGEMENT_DISABLED' },
    });
    expect(keyRepository.findOne).not.toHaveBeenCalled();
  });

  it('uses the previous pepper only for the previous supported hash version', async () => {
    const generated = generateApiKey(
      'previous-test-pepper',
      API_KEY_PREVIOUS_HASH_VERSION,
    );
    const key = {
      id: 'previous-key',
      ownerId: 'owner-1',
      projectId: 'project-1',
      publicId: generated.publicId,
      prefix: generated.prefix,
      verifier: generated.verifier,
      hashVersion: API_KEY_PREVIOUS_HASH_VERSION,
      scopes: ['tasks:read'],
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: null,
    } as unknown as McpApiKey;
    keyRepository.findOne.mockResolvedValue(key);

    await expect(
      service.authenticate(generated.token, ['tasks:read'], ['project-1']),
    ).resolves.toMatchObject({ keyId: 'previous-key' });

    key.hashVersion = 99;
    await expect(
      service.authenticate(generated.token, ['tasks:read'], ['project-1']),
    ).rejects.toMatchObject({ response: { code: 'API_KEY_INVALID' } });
  });

  it('retires the previous pepper at the configured deadline', async () => {
    const generated = generateApiKey(
      'previous-test-pepper',
      API_KEY_PREVIOUS_HASH_VERSION,
    );
    const key = {
      id: 'retired-previous-key',
      ownerId: 'owner-1',
      projectId: 'project-1',
      publicId: generated.publicId,
      prefix: generated.prefix,
      verifier: generated.verifier,
      hashVersion: API_KEY_PREVIOUS_HASH_VERSION,
      scopes: ['tasks:read'],
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: null,
    } as unknown as McpApiKey;
    keyRepository.findOne.mockResolvedValue(key);
    config.get.mockImplementation((keyName: string) => {
      if (keyName === API_KEY_PEPPER_CURRENT_ENV) return 'unit-test-pepper';
      if (keyName === API_KEY_PEPPER_PREVIOUS_ENV) {
        return 'previous-test-pepper';
      }
      if (keyName === API_KEY_PREVIOUS_PEPPER_RETIRE_AT_ENV) {
        return new Date(Date.now() - 1).toISOString();
      }
      return undefined;
    });

    await expect(
      service.authenticate(generated.token, ['tasks:read'], ['project-1']),
    ).rejects.toMatchObject({ response: { code: 'API_KEY_INVALID' } });
  });

  it('locks the source row before replacing it', async () => {
    const current = {
      id: 'source-key',
      ownerId: 'owner-1',
      projectId: 'project-1',
      name: 'source',
      scopes: ['tasks:read'],
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: null,
    } as unknown as McpApiKey;
    keyRepository.findOne.mockResolvedValue(current);
    const manager = {
      findOne: jest.fn().mockResolvedValue(current),
      count: jest.fn().mockResolvedValue(0),
      query: jest.fn().mockResolvedValue([]),
      update: jest.fn().mockResolvedValue(undefined),
      create: jest.fn((_, value) => value),
      save: jest.fn(async (value) => ({
        ...value,
        id: 'replacement-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      })),
      getRepository: jest.fn(),
    };
    dataSource.transaction.mockImplementationOnce(async (callback) =>
      callback(manager as never),
    );

    await service.replace(
      'source-key',
      {
        name: 'replacement',
        projectId: 'project-1',
        scopes: ['tasks:read'],
        expirationDays: 30,
      },
      owner,
    );

    expect(manager.findOne).toHaveBeenCalledWith(McpApiKey, {
      where: { id: 'source-key' },
      lock: { mode: 'pessimistic_write' },
    });
  });

  it('checks replacement capacity after revoking the source key', async () => {
    const current = {
      id: 'source-at-capacity',
      ownerId: 'owner-1',
      projectId: 'project-1',
      name: 'source',
      scopes: ['tasks:read'],
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: null,
    } as unknown as McpApiKey;
    const manager = {
      findOne: jest.fn().mockResolvedValue(current),
      query: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockImplementation(async () => {
        expect(current.revokedAt).not.toBeNull();
        return 0;
      }),
      update: jest.fn().mockImplementation(async (_entity, _id, values) => {
        if (values.revokedAt) current.revokedAt = values.revokedAt;
      }),
      create: jest.fn((_entity, value) => value),
      save: jest.fn(async (value) => ({
        ...value,
        id: 'replacement-at-capacity',
        createdAt: new Date(),
        updatedAt: new Date(),
      })),
      getRepository: jest.fn(),
    };
    keyRepository.findOne.mockResolvedValue(current);
    dataSource.transaction.mockImplementationOnce(async (callback) =>
      callback(manager as never),
    );

    await expect(
      service.replace(
        'source-at-capacity',
        {
          name: 'replacement',
          projectId: 'project-1',
          scopes: ['tasks:read'],
          expirationDays: 30,
        },
        owner,
      ),
    ).resolves.toHaveProperty('secret');
    expect(manager.count).toHaveBeenCalledTimes(3);
  });
});
