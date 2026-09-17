import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import {
  cleanupTestData,
  closeE2EApp,
  createE2EApp,
  createTestUser,
  getDataSource,
  getServer,
  loginAsSuperAdmin,
} from './helpers/e2e-setup';

process.env.MCP_API_KEY_PEPPER_V1 = 'e2e-only-api-key-pepper';
process.env.TASKHUB_MCP_API_KEY_MANAGEMENT_ENABLED = 'true';
process.env.TASKHUB_MCP_API_KEY_AUTHENTICATION_ENABLED = 'true';
process.env.TASKHUB_MCP_API_KEY_EMERGENCY_DISABLE = 'false';

/**
 * These HTTP tests use the authorized local database configured for the
 * backend. The harness is not database-isolated; every created record is
 * removed deterministically in afterAll().
 */

describe('MCP API-key backend vertical slice (e2e)', () => {
  let app: INestApplication;
  let accessToken: string;
  let refreshToken: string;
  let ownerId: string;
  let projectId: string;
  let keyId: string;
  let secret: string;

  type PersistedSecurityEvent = {
    eventType: string;
    endpoint: string;
    metadata: Record<string, unknown>;
  };

  async function getAuthenticationAudit(
    eventType: string,
    since: Date,
    affectedKeyId?: string,
  ): Promise<PersistedSecurityEvent> {
    const events = await getDataSource().query(
      `SELECT "eventType", endpoint, metadata FROM security_events
       WHERE "eventType" = $1
       AND "createdAt" >= $2
       AND ($3::text IS NULL OR metadata->>'keyId' = $3)
       ORDER BY "createdAt" DESC, id DESC
       LIMIT 1`,
      [eventType, since, affectedKeyId ?? null],
    );
    expect(events).toHaveLength(1);
    return events[0] as PersistedSecurityEvent;
  }

  function expectSafeAuthenticationAudit(
    event: PersistedSecurityEvent,
    expected: Record<string, unknown>,
    secret?: string,
  ) {
    expect(event.metadata).toEqual(
      expect.objectContaining({
        actor: 'api-key',
        action: 'authenticate',
        outcome: 'denied',
        ...expected,
      }),
    );
    for (const field of ['actor', 'action', 'outcome', 'reason']) {
      expect(Object.prototype.hasOwnProperty.call(event.metadata, field)).toBe(
        true,
      );
    }
    expect(typeof event.metadata.reason).toBe('string');
    expect((event.metadata.reason as string).length).toBeLessThanOrEqual(128);
    expect(event.metadata).not.toHaveProperty('verifier');
    expect(event.metadata).not.toHaveProperty('pepper');
    expect(event.metadata).not.toHaveProperty('authorization');
    expect(event.metadata).not.toHaveProperty('token');
    expect(event.endpoint).not.toContain('?');
    expect(event.endpoint).not.toMatch(/^https?:\/\//i);

    const serialized = JSON.stringify(event);
    for (const forbidden of [
      secret,
      'Authorization',
      'http://',
      'https://',
      '?',
    ]) {
      if (forbidden) expect(serialized).not.toContain(forbidden);
    }
  }

  async function createProject(token: string, name: string): Promise<string> {
    const response = await request(getServer(app))
      .post('/api/projects')
      .set('Authorization', `Bearer ${token}`)
      .send({ name })
      .expect(201);
    return response.body.data.id as string;
  }

  async function createKey(
    token: string,
    boundProjectId: string,
    scopes: string[],
    name: string,
  ): Promise<{ id: string; secret: string }> {
    const response = await request(getServer(app))
      .post('/api/api-keys')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name,
        projectId: boundProjectId,
        scopes,
        expirationDays: 90,
      })
      .expect(201);
    return {
      id: response.body.data.id as string,
      secret: response.body.data.secret as string,
    };
  }

  beforeAll(async () => {
    app = await createE2EApp();
    const authenticated = await createTestUser(app);
    accessToken = authenticated.tokens.accessToken;
    refreshToken = authenticated.tokens.refreshToken;
    ownerId = authenticated.user.id;

    const projectResponse = await request(getServer(app))
      .post('/api/projects')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: `API key e2e project ${Date.now()}` })
      .expect(201);
    projectId = projectResponse.body.data.id as string;
  });

  afterAll(async () => {
    if (app) {
      await getDataSource().query('DELETE FROM mcp_api_keys');
      await cleanupTestData();
      await closeE2EApp();
    }
  });

  afterEach(async () => {
    if (app) {
      await getDataSource().query(
        `DELETE FROM mcp_api_keys WHERE name = 'E2E notification isolation key'`,
      );
    }
  });

  it('creates once-revealed metadata and authenticates the bound MCP route', async () => {
    const server = getServer(app);
    const createResponse = await request(server)
      .post('/api/api-keys')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        name: 'E2E automation',
        projectId,
        scopes: ['tasks:read'],
        expirationDays: 90,
      })
      .expect(201);

    keyId = createResponse.body.data.id as string;
    secret = createResponse.body.data.secret as string;
    expect(secret).toMatch(/^thk_[a-f0-9]+_[a-f0-9]+$/);
    expect(createResponse.body.data.verifier).toBeUndefined();

    const detailResponse = await request(server)
      .get(`/api/api-keys/${keyId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    expect(detailResponse.body.data.secret).toBeUndefined();
    expect(detailResponse.body.data.status).toBe('active');

    await request(server)
      .get('/api/tasks')
      .query({ projectId })
      .set('Authorization', `Bearer ${secret}`)
      .expect(200);

    await request(server)
      .get('/api/tasks')
      .query({ projectId })
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    await request(server)
      .get('/api/auth/whoami')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200)
      .expect((response) => {
        expect(response.body.data.authType).toBe('jwt');
      });

    const refreshResponse = await request(server)
      .post('/api/auth/refresh')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ refreshToken })
      .expect(200);
    expect(refreshResponse.body.data.accessToken).toEqual(expect.any(String));
    expect(refreshResponse.body.data.refreshToken).toEqual(expect.any(String));
  });

  it('returns a safe API-key 401 for missing and unusable bearer credentials', async () => {
    const server = getServer(app);
    const expectedError = {
      code: 'API_KEY_INVALID',
      message: 'La API key no es valida o ya no esta activa',
      details: null,
    };

    const missingBearer = await request(server)
      .get('/api/tasks')
      .query({ projectId })
      .expect(401);
    expect(missingBearer.body.error).toEqual({
      ...expectedError,
      message: 'Se requiere una API key valida',
    });
    expect(missingBearer.headers['www-authenticate']).toBe(
      'Bearer realm="taskhub", error="invalid_token"',
    );

    const unusableBearer = await request(server)
      .get('/api/tasks')
      .query({ projectId })
      .set('Authorization', 'Bearer thk_malformed')
      .expect(401);
    expect(unusableBearer.body.error).toEqual(expectedError);
    expect(unusableBearer.headers['www-authenticate']).toBe(
      'Bearer realm="taskhub", error="invalid_token"',
    );
    expect(JSON.stringify(unusableBearer.body)).not.toContain('thk_malformed');
    expect(JSON.stringify(unusableBearer.body)).not.toContain('verifier');
  });

  it('persists complete safe attribution for malformed, unknown, and mismatched keys', async () => {
    const server = getServer(app);

    const malformedSince = new Date();
    await request(server)
      .get('/api/tasks')
      .query({ projectId })
      .set('Authorization', 'Bearer thk_malformed')
      .expect(401);
    const malformedEvent = await getAuthenticationAudit(
      'api_key_invalid',
      malformedSince,
    );
    expectSafeAuthenticationAudit(malformedEvent, { reason: 'malformed' });

    const unknownPublicId = 'f'.repeat(64);
    const unknownToken = `thk_${unknownPublicId}_${'e'.repeat(64)}`;
    const unknownSince = new Date();
    await request(server)
      .get('/api/tasks')
      .query({ projectId })
      .set('Authorization', `Bearer ${unknownToken}`)
      .expect(401);
    const unknownEvent = await getAuthenticationAudit(
      'api_key_invalid',
      unknownSince,
    );
    expectSafeAuthenticationAudit(
      unknownEvent,
      {
        publicId: unknownPublicId,
        reason: 'unknown_key',
      },
      unknownToken,
    );

    const [, publicId] = secret.split('_');
    const mismatchedToken = `thk_${publicId}_${'0'.repeat(64)}`;
    const mismatchSince = new Date();
    await request(server)
      .get('/api/tasks')
      .query({ projectId })
      .set('Authorization', `Bearer ${mismatchedToken}`)
      .expect(401);
    const mismatchEvent = await getAuthenticationAudit(
      'api_key_invalid',
      mismatchSince,
      keyId,
    );
    expectSafeAuthenticationAudit(
      mismatchEvent,
      {
        keyId,
        ownerId,
        projectId,
        reason: 'verifier_mismatch',
      },
      mismatchedToken,
    );
  });

  it('denies missing project context and keeps management JWT-only', async () => {
    const server = getServer(app);
    const missingContextSince = new Date();
    await request(server)
      .get('/api/tasks')
      .set('Authorization', `Bearer ${secret}`)
      .expect(403);
    const missingContextEvent = await getAuthenticationAudit(
      'api_key_project_denied',
      missingContextSince,
      keyId,
    );
    expectSafeAuthenticationAudit(
      missingContextEvent,
      { keyId, ownerId, projectId, reason: 'missing_context' },
      secret,
    );

    await request(server)
      .get('/api/api-keys')
      .set('Authorization', `Bearer ${secret}`)
      .expect(401);
  });

  it('exposes only metadata through the explicit whoami route', async () => {
    const response = await request(getServer(app))
      .get('/api/auth/whoami')
      .set('Authorization', `Bearer ${secret}`)
      .expect(200);

    expect(response.body.data).toMatchObject({
      authType: 'api-key',
      key: { id: keyId, projectId, scopes: ['tasks:read'] },
    });
    expect(JSON.stringify(response.body.data)).not.toContain(secret);
  });

  it('denies cross-project and under-scoped HTTP operations', async () => {
    const otherProjectId = await createProject(
      accessToken,
      `API key cross-project ${Date.now()}`,
    );
    const server = getServer(app);

    const projectDeniedSince = new Date();
    const projectDeniedResponse = await request(server)
      .get('/api/tasks')
      .query({ projectId: otherProjectId })
      .set('Authorization', `Bearer ${secret}`)
      .expect(403);
    expect(projectDeniedResponse.body.error).toEqual({
      code: 'PROJECT_ACCESS_DENIED',
      message: 'Acceso al proyecto denegado',
      details: null,
    });
    expect(projectDeniedResponse.headers['www-authenticate']).toBe(
      'Bearer realm="taskhub", error="insufficient_scope"',
    );
    const projectDeniedEvent = await getAuthenticationAudit(
      'api_key_project_denied',
      projectDeniedSince,
      keyId,
    );
    expectSafeAuthenticationAudit(
      projectDeniedEvent,
      { keyId, ownerId, projectId, reason: 'project_mismatch' },
      secret,
    );

    const scopeDeniedSince = new Date();
    const scopeDeniedResponse = await request(server)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${secret}`)
      .send({ title: 'Should not be created', projectId })
      .expect(403);
    expect(scopeDeniedResponse.body.error).toEqual({
      code: 'INSUFFICIENT_SCOPE',
      message: 'La API key no tiene el scope requerido',
      details: null,
    });
    expect(scopeDeniedResponse.headers['www-authenticate']).toBe(
      'Bearer realm="taskhub", error="insufficient_scope"',
    );
    const scopeDeniedEvent = await getAuthenticationAudit(
      'api_key_scope_denied',
      scopeDeniedSince,
      keyId,
    );
    expectSafeAuthenticationAudit(
      scopeDeniedEvent,
      {
        keyId,
        ownerId,
        projectId,
        requiredScopes: ['tasks:write'],
        reason: 'insufficient_scope',
      },
      secret,
    );
  });

  it('isolates project-bound notification reads and mutations', async () => {
    const notificationKey = await createKey(
      accessToken,
      projectId,
      ['notifications:read', 'notifications:write'],
      'E2E notification isolation key',
    );
    const otherProjectId = await createProject(
      accessToken,
      `API key notification project B ${Date.now()}`,
    );
    const projectNotificationId = randomUUID();
    const otherProjectNotificationId = randomUUID();
    const systemNotificationId = randomUUID();
    const ds = getDataSource();

    await ds.query(
      `INSERT INTO notifications
        (id, "systemCode", "userId", "projectId", type, channel, priority,
         status, title, message, "isRead", "sentAt", "deliveredAt")
       VALUES
        ($1, $2, $3, $4, 'task_assigned', 'in_app', 'normal', 'delivered',
         'Project A notification', 'Project A data', false, NOW(), NOW()),
        ($5, $6, $3, $7, 'task_assigned', 'in_app', 'normal', 'delivered',
         'Project B notification', 'Project B data', false, NOW(), NOW()),
        ($8, $9, $3, NULL, 'system_announcement', 'in_app', 'normal', 'delivered',
         'System notification', 'System data', false, NOW(), NOW())`,
      [
        projectNotificationId,
        `NTF-${randomUUID().slice(0, 8)}-A`,
        ownerId,
        projectId,
        otherProjectNotificationId,
        `NTF-${randomUUID().slice(0, 8)}-B`,
        otherProjectId,
        systemNotificationId,
        `NTF-${randomUUID().slice(0, 8)}-S`,
      ],
    );

    const server = getServer(app);
    const authGet = (path: string) =>
      request(server)
        .get(path)
        .query({ projectId })
        .set('Authorization', `Bearer ${notificationKey.secret}`);
    const authPost = (path: string) =>
      request(server)
        .post(path)
        .query({ projectId })
        .set('Authorization', `Bearer ${notificationKey.secret}`);

    const listResponse = await authGet('/api/v1/notifications').expect(200);
    expect(listResponse.body.data.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: projectNotificationId,
          projectId,
        }),
      ]),
    );
    expect(listResponse.body.data.data).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: otherProjectNotificationId }),
        expect.objectContaining({ id: systemNotificationId }),
      ]),
    );
    expect(listResponse.body.data.unreadCount).toBe(1);

    await authGet(`/api/v1/notifications/${projectNotificationId}`).expect(200);
    await authGet(`/api/v1/notifications/${otherProjectNotificationId}`).expect(
      404,
    );

    await authPost(
      `/api/v1/notifications/${otherProjectNotificationId}/read`,
    ).expect(404);
    const untouched = await ds.query(
      `SELECT "isRead" FROM notifications WHERE id = $1`,
      [otherProjectNotificationId],
    );
    expect(untouched[0].isRead).toBe(false);

    const readAllResponse = await authPost(
      '/api/v1/notifications/read-all',
    ).expect(200);
    expect(readAllResponse.body.data.marked).toBe(1);
    const states = await ds.query(
      `SELECT id, "isRead" FROM notifications WHERE id IN ($1, $2, $3)`,
      [projectNotificationId, otherProjectNotificationId, systemNotificationId],
    );
    expect(states).toEqual(
      expect.arrayContaining([
        { id: projectNotificationId, isRead: true },
        { id: otherProjectNotificationId, isRead: false },
        { id: systemNotificationId, isRead: false },
      ]),
    );

    await authGet('/api/v1/notifications/unread-count').expect(200);
    await request(server)
      .get('/api/v1/notifications')
      .query({ projectId: otherProjectId })
      .set('Authorization', `Bearer ${notificationKey.secret}`)
      .expect(403);

    const preferencesBefore = await ds.query(
      `SELECT * FROM notification_preferences WHERE "userId" = $1`,
      [ownerId],
    );
    const deniedPreferences = expect.objectContaining({
      code: 'PROJECT_ACCESS_DENIED',
    });

    await request(server)
      .get('/api/v1/notifications/preferences/my')
      .query({ projectId })
      .set('Authorization', `Bearer ${notificationKey.secret}`)
      .expect(403)
      .expect((response) => {
        expect(response.body.error).toEqual(deniedPreferences);
      });
    await request(server)
      .put('/api/v1/notifications/preferences/my')
      .query({ projectId })
      .set('Authorization', `Bearer ${notificationKey.secret}`)
      .send({ emailEnabled: false })
      .expect(403)
      .expect((response) => {
        expect(response.body.error).toEqual(deniedPreferences);
      });

    expect(
      await ds.query(
        `SELECT * FROM notification_preferences WHERE "userId" = $1`,
        [ownerId],
      ),
    ).toEqual(preferencesBefore);

    await request(server)
      .get('/api/v1/notifications/preferences/my')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    await request(server)
      .put('/api/v1/notifications/preferences/my')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ emailEnabled: false })
      .expect(200);
  });

  it('allows a write-scoped key to perform a bound task mutation', async () => {
    const writeKey = await createKey(
      accessToken,
      projectId,
      ['tasks:write'],
      'E2E write key',
    );

    await request(getServer(app))
      .post('/api/tasks')
      .set('Authorization', `Bearer ${writeKey.secret}`)
      .send({ title: 'Created through API key', projectId })
      .expect(201);
  });

  it('enforces ownership and permits superadmin management', async () => {
    const otherUser = await createTestUser(app);
    const server = getServer(app);

    await request(server)
      .get(`/api/api-keys/${keyId}`)
      .set('Authorization', `Bearer ${otherUser.tokens.accessToken}`)
      .expect(403);

    const superadmin = await loginAsSuperAdmin(app);
    await request(server)
      .get(`/api/api-keys/${keyId}`)
      .set('Authorization', `Bearer ${superadmin.tokens.accessToken}`)
      .expect(200);
  });

  it('makes lost-secret recovery explicit without leaking or mutating the key', async () => {
    const server = getServer(app);
    const before = await getDataSource().query(
      `SELECT id, "ownerId", "projectId", name, "publicId", prefix, verifier,
              "hashVersion", scopes, "expiresAt", "revokedAt", "revokedById",
              "revokeReason", "replacedById", "lastUsedAt", "createdAt", "updatedAt"
       FROM mcp_api_keys WHERE id = $1`,
      [keyId],
    );

    const ownerResponse = await request(server)
      .post(`/api/api-keys/${keyId}/recover`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(410);

    expect(ownerResponse.body.error).toEqual({
      code: 'API_KEY_SECRET_NOT_RECOVERABLE',
      message:
        'El secreto de la API key no se puede recuperar. Revoca esta clave y crea una nueva.',
      details: null,
    });
    expect(JSON.stringify(ownerResponse.body)).not.toContain(secret);
    expect(JSON.stringify(ownerResponse.body)).not.toContain('verifier');
    expect(JSON.stringify(ownerResponse.body)).not.toContain('token');

    const otherUser = await createTestUser(app);
    const unauthorizedResponse = await request(server)
      .post(`/api/api-keys/${keyId}/recover`)
      .set('Authorization', `Bearer ${otherUser.tokens.accessToken}`)
      .expect(403);
    expect(JSON.stringify(unauthorizedResponse.body)).not.toContain(secret);
    expect(JSON.stringify(unauthorizedResponse.body)).not.toContain('verifier');

    await request(server)
      .post(`/api/api-keys/${keyId}/recover`)
      .set('Authorization', `Bearer ${secret}`)
      .expect(401);

    const after = await getDataSource().query(
      `SELECT id, "ownerId", "projectId", name, "publicId", prefix, verifier,
              "hashVersion", scopes, "expiresAt", "revokedAt", "revokedById",
              "revokeReason", "replacedById", "lastUsedAt", "createdAt", "updatedAt"
       FROM mcp_api_keys WHERE id = $1`,
      [keyId],
    );
    expect(after).toEqual(before);
  });

  it('enforces expiry and inactive-owner checks on every HTTP call', async () => {
    const expiringKey = await createKey(
      accessToken,
      projectId,
      ['tasks:read'],
      'E2E expiring key',
    );
    const ds = getDataSource();
    await ds.query(
      `UPDATE mcp_api_keys SET "expiresAt" = NOW() - INTERVAL '1 minute' WHERE id = $1`,
      [expiringKey.id],
    );

    const expirySince = new Date();
    await request(getServer(app))
      .get('/api/tasks')
      .query({ projectId })
      .set('Authorization', `Bearer ${expiringKey.secret}`)
      .expect(401);

    const expiryEvents = await ds.query(
      `SELECT "eventType", endpoint, metadata FROM security_events
       WHERE "eventType" = 'api_key_expired'
       AND metadata->>'keyId' = $1`,
      [expiringKey.id],
    );
    expect(expiryEvents).toHaveLength(1);
    expect(expiryEvents[0].eventType).toBe('api_key_expired');
    const expiryEvent = await getAuthenticationAudit(
      'api_key_expired',
      expirySince,
      expiringKey.id,
    );
    expectSafeAuthenticationAudit(
      expiryEvent,
      {
        keyId: expiringKey.id,
        ownerId,
        projectId,
        reason: 'expired',
      },
      expiringKey.secret,
    );

    const metadata = await request(getServer(app))
      .get(`/api/api-keys/${expiringKey.id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    expect(metadata.body.data.status).toBe('expired');

    const inactiveUser = await createTestUser(app);
    const inactiveProjectId = await createProject(
      inactiveUser.tokens.accessToken,
      `API key inactive owner ${Date.now()}`,
    );
    const inactiveKey = await createKey(
      inactiveUser.tokens.accessToken,
      inactiveProjectId,
      ['tasks:read'],
      'E2E inactive owner key',
    );
    await ds.query('UPDATE users SET "isActive" = false WHERE id = $1', [
      inactiveUser.user.id,
    ]);

    const inactiveSince = new Date();
    await request(getServer(app))
      .get('/api/tasks')
      .query({ projectId: inactiveProjectId })
      .set('Authorization', `Bearer ${inactiveKey.secret}`)
      .expect(401);
    const inactiveEvent = await getAuthenticationAudit(
      'api_key_invalid',
      inactiveSince,
      inactiveKey.id,
    );
    expectSafeAuthenticationAudit(
      inactiveEvent,
      {
        keyId: inactiveKey.id,
        ownerId: inactiveUser.user.id,
        projectId: inactiveProjectId,
        reason: 'inactive_owner',
      },
      inactiveKey.secret,
    );
  });

  it('honors feature flags and emergency disable without JWT fallback', async () => {
    const previousAuthentication =
      process.env.TASKHUB_MCP_API_KEY_AUTHENTICATION_ENABLED;
    const previousEmergency = process.env.TASKHUB_MCP_API_KEY_EMERGENCY_DISABLE;
    try {
      process.env.TASKHUB_MCP_API_KEY_AUTHENTICATION_ENABLED = 'false';
      const disabledResponse = await request(getServer(app))
        .get('/api/tasks')
        .query({ projectId })
        .set('Authorization', `Bearer ${secret}`)
        .expect(401);
      expect(disabledResponse.body.error.code).toBe('API_KEY_INVALID');
      expect(disabledResponse.headers['www-authenticate']).toBe(
        'Bearer realm="taskhub", error="invalid_token"',
      );

      process.env.TASKHUB_MCP_API_KEY_AUTHENTICATION_ENABLED = 'true';
      process.env.TASKHUB_MCP_API_KEY_EMERGENCY_DISABLE = 'true';
      const emergencyResponse = await request(getServer(app))
        .get('/api/tasks')
        .query({ projectId })
        .set('Authorization', `Bearer ${secret}`)
        .expect(401);
      expect(emergencyResponse.body.error.code).toBe('API_KEY_INVALID');
      expect(emergencyResponse.headers['www-authenticate']).toBe(
        'Bearer realm="taskhub", error="invalid_token"',
      );

      process.env.TASKHUB_MCP_API_KEY_EMERGENCY_DISABLE = 'false';
      const restoredResponse = await request(getServer(app))
        .get('/api/tasks')
        .query({ projectId })
        .set('Authorization', `Bearer ${secret}`)
        .expect(200);
      expect(restoredResponse.body.success).toBe(true);

      process.env.TASKHUB_MCP_API_KEY_MANAGEMENT_ENABLED = 'false';
      const managementDisabledResponse = await request(getServer(app))
        .get('/api/api-keys')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(403);
      expect(managementDisabledResponse.body.error).toEqual({
        code: 'API_KEY_MANAGEMENT_DISABLED',
        message: 'La gestion de API keys esta deshabilitada',
        details: null,
      });
    } finally {
      if (previousAuthentication === undefined) {
        delete process.env.TASKHUB_MCP_API_KEY_AUTHENTICATION_ENABLED;
      } else {
        process.env.TASKHUB_MCP_API_KEY_AUTHENTICATION_ENABLED =
          previousAuthentication;
      }
      if (previousEmergency === undefined) {
        delete process.env.TASKHUB_MCP_API_KEY_EMERGENCY_DISABLE;
      } else {
        process.env.TASKHUB_MCP_API_KEY_EMERGENCY_DISABLE = previousEmergency;
      }
      process.env.TASKHUB_MCP_API_KEY_MANAGEMENT_ENABLED = 'true';
    }
  });

  it('returns Retry-After and redacted audit data when the key rate limit is hit', async () => {
    const limitedKey = await createKey(
      accessToken,
      projectId,
      ['tasks:read'],
      'E2E rate limit key',
    );
    const server = getServer(app);

    for (let attempt = 0; attempt < 10; attempt++) {
      await request(server)
        .get('/api/tasks')
        .query({ projectId })
        .set('Authorization', `Bearer ${limitedKey.secret}`)
        .expect(200);
    }

    const rateLimitSince = new Date();
    const limitedResponse = await request(server)
      .get('/api/tasks')
      .query({ projectId })
      .set('Authorization', `Bearer ${limitedKey.secret}`)
      .expect(429);
    expect(Number(limitedResponse.headers['retry-after'])).toBeGreaterThan(0);
    expect(limitedResponse.body.error.code).toBe('API_KEY_RATE_LIMITED');

    const reason = `retired ${limitedKey.secret}`;
    await request(server)
      .post(`/api/api-keys/${limitedKey.id}/revoke`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ reason })
      .expect(200);

    const rateLimitEvent = await getAuthenticationAudit(
      'api_key_rate_limited',
      rateLimitSince,
      limitedKey.id,
    );
    expectSafeAuthenticationAudit(
      rateLimitEvent,
      {
        keyId: limitedKey.id,
        ownerId,
        projectId,
        limitDimension: 'key_10_seconds',
        reason: 'rate_limit_exceeded',
      },
      limitedKey.secret,
    );

    const events = await getDataSource().query(
      `SELECT "eventType", endpoint, metadata FROM security_events
       WHERE "eventType" = 'api_key_revoked'
       AND metadata->>'keyId' = $1`,
      [limitedKey.id],
    );
    expect(events).toHaveLength(1);
    const revokedAudit = events[0] as PersistedSecurityEvent;
    expect(revokedAudit.endpoint).not.toContain('?');
    expect(JSON.stringify(revokedAudit)).not.toContain(limitedKey.secret);
    expect(JSON.stringify(revokedAudit)).not.toMatch(/https?:\/\//i);
  });

  it('replaces atomically and invalidates the previous secret', async () => {
    const server = getServer(app);
    const previousSecret = secret;
    const previousKeyId = keyId;
    const replacementResponse = await request(server)
      .post(`/api/api-keys/${keyId}/replace`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        name: 'E2E replacement',
        projectId,
        scopes: ['tasks:read'],
        expirationDays: 30,
      })
      .expect(201);

    keyId = replacementResponse.body.data.id as string;
    secret = replacementResponse.body.data.secret as string;
    expect(secret).toMatch(/^thk_[a-f0-9]+_[a-f0-9]+$/);
    expect(replacementResponse.body.data.verifier).toBeUndefined();

    const linkage = await getDataSource().query(
      `SELECT "revokedAt", "replacedById" FROM mcp_api_keys WHERE id = $1`,
      [previousKeyId],
    );
    expect(linkage[0].replacedById).toBe(keyId);
    expect(linkage[0].revokedAt).not.toBeNull();

    await request(server)
      .get('/api/tasks')
      .query({ projectId })
      .set('Authorization', `Bearer ${previousSecret}`)
      .expect(401);
  });

  it('serializes concurrent replacement requests for one source key', async () => {
    const concurrentKey = await createKey(
      accessToken,
      projectId,
      ['tasks:read'],
      'E2E concurrent source',
    );
    const server = getServer(app);
    const replacementBody = {
      name: 'E2E concurrent replacement',
      projectId,
      scopes: ['tasks:read'],
      expirationDays: 30,
    };

    const responses = await Promise.all([
      request(server)
        .post(`/api/api-keys/${concurrentKey.id}/replace`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send(replacementBody),
      request(server)
        .post(`/api/api-keys/${concurrentKey.id}/replace`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send(replacementBody),
    ]);

    expect(responses.map((response) => response.status).sort()).toEqual([
      201, 409,
    ]);
    const activeReplacements = await getDataSource().query(
      `SELECT id FROM mcp_api_keys
       WHERE name = $1 AND "revokedAt" IS NULL`,
      [replacementBody.name],
    );
    expect(activeReplacements).toHaveLength(1);
  });

  it('revokes immediately and rejects subsequent use', async () => {
    const server = getServer(app);
    await request(server)
      .post(`/api/api-keys/${keyId}/revoke`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ reason: 'e2e retirement' })
      .expect(200);

    const revokedSince = new Date();
    const response = await request(server)
      .get('/api/tasks')
      .query({ projectId })
      .set('Authorization', `Bearer ${secret}`)
      .expect(401);
    expect(response.body.error.code).toBe('API_KEY_INVALID');
    const revokedEvent = await getAuthenticationAudit(
      'api_key_invalid',
      revokedSince,
      keyId,
    );
    expectSafeAuthenticationAudit(
      revokedEvent,
      { keyId, ownerId, projectId, reason: 'revoked' },
      secret,
    );
  });

  it('does not exceed active user-project capacity under concurrent creates', async () => {
    const server = getServer(app);
    const body = {
      name: 'E2E concurrent capacity',
      projectId,
      scopes: ['tasks:read'],
      expirationDays: 90,
    };
    const responses = await Promise.all([
      request(server)
        .post('/api/api-keys')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(body),
      request(server)
        .post('/api/api-keys')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(body),
    ]);

    expect(responses.map((response) => response.status).sort()).toEqual([
      201, 409,
    ]);
    const activeCount = await getDataSource().query(
      `SELECT COUNT(*)::int AS count FROM mcp_api_keys
       WHERE "ownerId" = $1 AND "projectId" = $2
       AND "revokedAt" IS NULL AND "expiresAt" > NOW()`,
      [ownerId, projectId],
    );
    expect(activeCount[0].count).toBeLessThanOrEqual(3);
  });
});
