import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  GoneException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  HttpException,
  HttpStatus,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import {
  DataSource,
  EntityManager,
  IsNull,
  MoreThan,
  Repository,
} from 'typeorm';
import { Request } from 'express';
import { User, UserRole } from '../auth/entities/user.entity';
import { ProjectMember } from '../projects/entities/project-member.entity';
import {
  API_KEY_AUDIT_RETENTION_DAYS,
  API_KEY_HASH_VERSION,
  API_KEY_LIMITS,
  API_KEY_PEPPER_CURRENT_ENV,
  API_KEY_PEPPER_PREVIOUS_ENV,
  API_KEY_PREVIOUS_PEPPER_RETIRE_AT_ENV,
  API_KEY_PREVIOUS_HASH_VERSION,
  API_KEY_SECRET_NOT_RECOVERABLE_CODE,
  API_KEY_SECRET_NOT_RECOVERABLE_MESSAGE,
  ApiKeyScope,
} from './api-key.constants';
import {
  generateApiKey,
  verifyApiKeySecret,
  parseApiKey,
} from './api-key.crypto';
import { McpApiKey } from './entities/mcp-api-key.entity';
import { ApiKeyRequestContext, RequestIdentity } from './api-key.types';
import { ApiKeyFeatureFlagService } from './api-key-feature-flag.service';
import {
  isProjectBindingAllowed,
  sanitizeApiKeyAuditMetadata,
  sanitizeApiKeyReason,
  sanitizeAuditEndpoint,
} from './api-key.policy';
import { CreateApiKeyDto, ReplaceApiKeyDto } from './dto';
import {
  SecurityEvent,
  SecurityEventSeverity,
  SecurityEventType,
} from '../security/entities';
import { SecurityEventService } from '../security/services';
import { CacheService } from '../cache/cache.service';

@Injectable()
export class ApiKeyService {
  private readonly logger = new Logger(ApiKeyService.name);

  constructor(
    @InjectRepository(McpApiKey)
    private readonly apiKeyRepository: Repository<McpApiKey>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(ProjectMember)
    private readonly memberRepository: Repository<ProjectMember>,
    private readonly configService: ConfigService,
    private readonly featureFlagService: ApiKeyFeatureFlagService,
    private readonly securityEventService: SecurityEventService,
    private readonly cacheService: CacheService,
    private readonly dataSource: DataSource,
  ) {}

  async authenticate(
    token: string,
    requiredScopes: string[],
    requestedProjectIds: string[],
    context: ApiKeyRequestContext = {},
  ): Promise<RequestIdentity> {
    if (!(await this.featureFlagService.isAuthenticationEnabled())) {
      throw this.invalidKey();
    }

    const parsed = parseApiKey(token);
    if (!parsed) {
      await this.auditAuthenticationFailure(
        context,
        SecurityEventType.API_KEY_INVALID,
        {
          reason: 'malformed',
        },
      );
      throw this.invalidKey();
    }

    const key = await this.apiKeyRepository.findOne({
      where: { publicId: parsed.publicId },
    });
    if (!key) {
      await this.auditAuthenticationFailure(
        context,
        SecurityEventType.API_KEY_INVALID,
        {
          publicId: parsed.publicId,
          reason: 'unknown_key',
        },
      );
      throw this.invalidKey();
    }

    const peppers = {
      [key.hashVersion]: this.getPepper(key.hashVersion),
    };
    if (
      !verifyApiKeySecret(parsed.secret, key.verifier, key.hashVersion, peppers)
    ) {
      await this.auditAuthenticationFailure(
        context,
        SecurityEventType.API_KEY_INVALID,
        {
          keyId: key.id,
          publicId: key.publicId,
          ownerId: key.ownerId,
          projectId: key.projectId,
          reason: 'verifier_mismatch',
        },
      );
      throw this.invalidKey();
    }

    if (key.revokedAt || key.expiresAt <= new Date()) {
      await this.auditAuthenticationFailure(
        context,
        key.revokedAt
          ? SecurityEventType.API_KEY_INVALID
          : SecurityEventType.API_KEY_EXPIRED,
        {
          keyId: key.id,
          publicId: key.publicId,
          ownerId: key.ownerId,
          projectId: key.projectId,
          reason: key.revokedAt ? 'revoked' : 'expired',
        },
      );
      throw this.invalidKey();
    }

    const user = await this.userRepository.findOne({
      where: { id: key.ownerId, isActive: true },
    });
    if (!user) {
      await this.auditAuthenticationFailure(
        context,
        SecurityEventType.API_KEY_INVALID,
        {
          keyId: key.id,
          publicId: key.publicId,
          ownerId: key.ownerId,
          projectId: key.projectId,
          reason: 'inactive_owner',
        },
      );
      throw this.invalidKey();
    }

    const member = await this.memberRepository.findOne({
      where: { projectId: key.projectId, userId: key.ownerId },
    });
    if (
      (!member && !this.isSuperAdmin(user)) ||
      (!context.metadataOnly &&
        !isProjectBindingAllowed(key.projectId, requestedProjectIds))
    ) {
      await this.auditAuthenticationFailure(
        context,
        SecurityEventType.API_KEY_PROJECT_DENIED,
        {
          keyId: key.id,
          publicId: key.publicId,
          ownerId: key.ownerId,
          projectId: key.projectId,
          reason:
            requestedProjectIds.length === 0
              ? 'missing_context'
              : 'project_mismatch',
        },
      );
      throw new ForbiddenException({
        code: 'PROJECT_ACCESS_DENIED',
        message: 'Acceso al proyecto denegado',
      });
    }

    if (
      !requiredScopes.every((scope) =>
        key.scopes.includes(scope as ApiKeyScope),
      )
    ) {
      await this.auditAuthenticationFailure(
        context,
        SecurityEventType.API_KEY_SCOPE_DENIED,
        {
          keyId: key.id,
          publicId: key.publicId,
          ownerId: key.ownerId,
          projectId: key.projectId,
          requiredScopes,
          reason: 'insufficient_scope',
        },
      );
      throw new ForbiddenException({
        code: 'INSUFFICIENT_SCOPE',
        message: 'La API key no tiene el scope requerido',
      });
    }

    await this.enforceRateLimits(key, user, context);
    await this.apiKeyRepository.update(key.id, { lastUsedAt: new Date() });
    this.logger.debug(`API key used: ${key.prefix}`);

    return {
      user,
      authType: 'api-key',
      keyId: key.id,
      projectId: key.projectId,
      scopes: key.scopes,
    };
  }

  async list(actor: User, ownerId?: string, request?: Request) {
    await this.ensureManagementEnabled();
    if (ownerId && ownerId !== actor.id && !this.isSuperAdmin(actor)) {
      await this.auditManagement(
        request,
        actor,
        SecurityEventType.UNAUTHORIZED_ACCESS,
        {
          action: 'list',
          targetOwnerId: ownerId,
          reason: 'owner_mismatch',
          outcome: 'denied',
        },
      );
      throw new ForbiddenException(
        'No tienes permiso para administrar esas API keys',
      );
    }

    const where = this.isSuperAdmin(actor)
      ? ownerId
        ? { ownerId }
        : {}
      : { ownerId: actor.id };
    const keys = await this.apiKeyRepository.find({
      where,
      order: { createdAt: 'DESC' },
    });
    for (const key of keys) {
      await this.auditManagement(
        request,
        actor,
        SecurityEventType.API_KEY_REVEALED,
        {
          action: 'inspect_list',
          keyId: key.id,
          ownerId: key.ownerId,
          projectId: key.projectId,
          outcome: 'success',
        },
      );
    }
    return keys.map((key) => this.toMetadata(key));
  }

  async create(dto: CreateApiKeyDto, actor: User, request?: Request) {
    await this.ensureManagementEnabled();
    const ownerId = dto.ownerId || actor.id;
    if (ownerId !== actor.id && !this.isSuperAdmin(actor)) {
      await this.auditManagement(
        request,
        actor,
        SecurityEventType.UNAUTHORIZED_ACCESS,
        {
          action: 'create',
          targetOwnerId: ownerId,
          reason: 'owner_mismatch',
          outcome: 'denied',
        },
      );
      throw new ForbiddenException(
        'Solo un superadmin puede asignar otra API key',
      );
    }

    const owner = await this.userRepository.findOne({
      where: { id: ownerId, isActive: true },
    });
    if (!owner)
      throw new NotFoundException('Propietario no encontrado o inactivo');
    await this.assertProjectMembership(ownerId, dto.projectId);

    const generated = this.generateCredential();
    let saved!: McpApiKey;

    await this.dataSource.transaction(async (manager) => {
      await this.lockCapacityScopes(manager, ownerId, dto.projectId);
      await this.assertCapacity(manager, ownerId, dto.projectId);

      const key = manager.create(McpApiKey, {
        ownerId,
        projectId: dto.projectId,
        name: dto.name,
        publicId: generated.publicId,
        prefix: generated.prefix,
        verifier: generated.verifier,
        hashVersion: API_KEY_HASH_VERSION,
        scopes: dto.scopes as ApiKeyScope[],
        expiresAt: this.expirationDate(dto.expirationDays),
        revokedAt: null,
        revokedById: null,
        revokeReason: null,
        replacedById: null,
        lastUsedAt: null,
      });
      saved = await manager.save(key);
    });

    await this.auditManagement(
      request,
      actor,
      SecurityEventType.API_KEY_CREATED,
      {
        action: 'create',
        keyId: saved.id,
        ownerId,
        projectId: saved.projectId,
        scopes: saved.scopes,
        expiresAt: saved.expiresAt,
        outcome: 'success',
      },
    );
    await this.auditManagement(
      request,
      actor,
      SecurityEventType.API_KEY_REVEALED,
      {
        action: 'create_reveal_once',
        keyId: saved.id,
        ownerId,
        projectId: saved.projectId,
        outcome: 'success',
      },
    );

    return { ...this.toMetadata(saved), secret: generated.token };
  }

  async findOne(id: string, actor: User, request?: Request) {
    await this.ensureManagementEnabled();
    const key = await this.getKey(id);
    await this.assertManagementAccess(key, actor, request, 'inspect');
    await this.auditManagement(
      request,
      actor,
      SecurityEventType.API_KEY_REVEALED,
      {
        action: 'inspect',
        keyId: key.id,
        ownerId: key.ownerId,
        projectId: key.projectId,
        outcome: 'success',
      },
    );
    return this.toMetadata(key);
  }

  async revoke(id: string, actor: User, reason?: string, request?: Request) {
    await this.ensureManagementEnabled();
    const key = await this.getKey(id);
    await this.assertManagementAccess(key, actor, request, 'revoke');
    if (key.revokedAt)
      throw new ConflictException('La API key ya esta revocada');

    key.revokedAt = new Date();
    key.revokedById = actor.id;
    key.revokeReason = sanitizeApiKeyReason(reason, 'revoked_by_owner');
    const saved = await this.apiKeyRepository.save(key);
    await this.auditManagement(
      request,
      actor,
      SecurityEventType.API_KEY_REVOKED,
      {
        action: 'revoke',
        keyId: key.id,
        ownerId: key.ownerId,
        projectId: key.projectId,
        reason: key.revokeReason,
        outcome: 'success',
      },
    );
    return this.toMetadata(saved);
  }

  async replace(
    id: string,
    dto: ReplaceApiKeyDto,
    actor: User,
    request?: Request,
  ) {
    await this.ensureManagementEnabled();
    const current = await this.getKey(id);
    await this.assertManagementAccess(current, actor, request, 'replace');
    if (current.revokedAt || current.expiresAt <= new Date()) {
      throw new ConflictException(
        'Solo se puede reemplazar una API key activa',
      );
    }
    if (dto.ownerId && dto.ownerId !== current.ownerId) {
      throw new BadRequestException(
        'La reemplazo debe conservar el propietario original',
      );
    }
    await this.assertProjectMembership(current.ownerId, dto.projectId);
    const generated = this.generateCredential();
    let replacement: McpApiKey;

    await this.dataSource.transaction(async (manager) => {
      await this.lockCapacityScopes(manager, current.ownerId, dto.projectId);
      const lockedCurrent = await manager.findOne(McpApiKey, {
        where: { id: current.id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!lockedCurrent) {
        throw new NotFoundException('API key no encontrada');
      }
      if (lockedCurrent.revokedAt || lockedCurrent.expiresAt <= new Date()) {
        throw new ConflictException(
          'Solo se puede reemplazar una API key activa',
        );
      }

      await manager.update(McpApiKey, current.id, {
        revokedAt: new Date(),
        revokedById: actor.id,
        revokeReason: 'replaced',
      });
      await this.assertCapacity(manager, current.ownerId, dto.projectId);
      replacement = manager.create(McpApiKey, {
        ownerId: current.ownerId,
        projectId: dto.projectId,
        name: dto.name,
        publicId: generated.publicId,
        prefix: generated.prefix,
        verifier: generated.verifier,
        hashVersion: API_KEY_HASH_VERSION,
        scopes: dto.scopes as ApiKeyScope[],
        expiresAt: this.expirationDate(dto.expirationDays),
        revokedAt: null,
        revokedById: null,
        revokeReason: null,
        replacedById: null,
        lastUsedAt: null,
      });
      replacement = await manager.save(replacement);
      await manager.update(McpApiKey, current.id, {
        replacedById: replacement.id,
      });
    });

    await this.auditManagement(
      request,
      actor,
      SecurityEventType.API_KEY_REPLACED,
      {
        action: 'replace',
        keyId: current.id,
        replacementKeyId: replacement!.id,
        ownerId: current.ownerId,
        projectId: replacement!.projectId,
        outcome: 'success',
      },
    );
    await this.auditManagement(
      request,
      actor,
      SecurityEventType.API_KEY_REVEALED,
      {
        action: 'replace_reveal_once',
        keyId: replacement!.id,
        ownerId: current.ownerId,
        projectId: replacement!.projectId,
        outcome: 'success',
      },
    );

    return { ...this.toMetadata(replacement!), secret: generated.token };
  }

  async recover(id: string, actor: User, request?: Request): Promise<never> {
    await this.ensureManagementEnabled();
    const key = await this.getKey(id);
    await this.assertManagementAccess(key, actor, request, 'recover');

    throw new GoneException({
      code: API_KEY_SECRET_NOT_RECOVERABLE_CODE,
      message: API_KEY_SECRET_NOT_RECOVERABLE_MESSAGE,
    });
  }

  private async ensureManagementEnabled() {
    if (!(await this.featureFlagService.isManagementEnabled())) {
      throw new ForbiddenException({
        code: 'API_KEY_MANAGEMENT_DISABLED',
        message: 'La gestion de API keys esta deshabilitada',
      });
    }
  }

  private generateCredential() {
    const pepper = this.configService.get<string>(API_KEY_PEPPER_CURRENT_ENV);
    if (!pepper) {
      throw new ServiceUnavailableException(
        'El servicio de API keys no esta disponible',
      );
    }
    return generateApiKey(pepper, API_KEY_HASH_VERSION);
  }

  private expirationDate(days: number) {
    return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  }

  private async getKey(id: string) {
    const key = await this.apiKeyRepository.findOne({ where: { id } });
    if (!key) throw new NotFoundException('API key no encontrada');
    return key;
  }

  private async assertProjectMembership(ownerId: string, projectId: string) {
    const projectMember = await this.memberRepository.findOne({
      where: { projectId, userId: ownerId },
    });
    if (!projectMember) {
      throw new ForbiddenException(
        'El propietario no tiene acceso al proyecto',
      );
    }
  }

  /**
   * PostgreSQL transaction-level advisory locks serialize all mutations that
   * can affect one of the active-key capacity dimensions. Hash collisions are
   * safe because they only add serialization, and every caller acquires locks
   * in the same order to avoid deadlocks.
   */
  private async lockCapacityScopes(
    manager: EntityManager,
    ownerId: string,
    projectId: string,
  ): Promise<void> {
    const lockKeys = [
      `api-key-capacity:user:${ownerId}`,
      `api-key-capacity:user-project:${ownerId}:${projectId}`,
      `api-key-capacity:project:${projectId}`,
    ];

    for (const lockKey of lockKeys) {
      await manager.query('SELECT pg_advisory_xact_lock(hashtext($1::text))', [
        lockKey,
      ]);
    }
  }

  private async assertCapacity(
    repository: Repository<McpApiKey> | EntityManager,
    ownerId: string,
    projectId: string,
  ) {
    const now = new Date();
    const isManager = 'getRepository' in repository;
    const count = (where: Record<string, unknown>) =>
      isManager
        ? repository.count(McpApiKey, { where })
        : repository.count({ where });
    const [userCount, userProjectCount, projectCount] = await Promise.all([
      count({ ownerId, revokedAt: IsNull(), expiresAt: MoreThan(now) }),
      count({
        ownerId,
        projectId,
        revokedAt: IsNull(),
        expiresAt: MoreThan(now),
      }),
      count({ projectId, revokedAt: IsNull(), expiresAt: MoreThan(now) }),
    ]);
    if (userCount >= API_KEY_LIMITS.maxActivePerUser) {
      throw new ConflictException(
        'El usuario alcanzo el limite de API keys activas',
      );
    }
    if (userProjectCount >= API_KEY_LIMITS.maxActivePerUserProject) {
      throw new ConflictException(
        'El usuario alcanzo el limite de API keys activas para el proyecto',
      );
    }
    if (projectCount >= API_KEY_LIMITS.maxActivePerProject) {
      throw new ConflictException(
        'El proyecto alcanzo el limite de API keys activas',
      );
    }
  }

  private async assertManagementAccess(
    key: McpApiKey,
    actor: User,
    request: Request | undefined,
    action: string,
  ): Promise<void> {
    if (key.ownerId === actor.id || this.isSuperAdmin(actor)) return;
    await this.auditManagement(
      request,
      actor,
      SecurityEventType.UNAUTHORIZED_ACCESS,
      {
        action,
        keyId: key.id,
        ownerId: key.ownerId,
        projectId: key.projectId,
        reason: 'owner_mismatch',
        outcome: 'denied',
      },
    );
    throw new ForbiddenException(
      'No tienes permiso para administrar esta API key',
    );
  }

  private isSuperAdmin(user: User): boolean {
    return Boolean(
      user.isSuperAdmin?.() || user.roles?.includes(UserRole.SUPER_ADMIN),
    );
  }

  private toMetadata(key: McpApiKey): Record<string, unknown> {
    const status = key.revokedAt
      ? 'revoked'
      : key.expiresAt <= new Date()
        ? 'expired'
        : 'active';
    return {
      id: key.id,
      ownerId: key.ownerId,
      projectId: key.projectId,
      name: key.name,
      publicId: key.publicId,
      prefix: key.prefix,
      scopes: key.scopes,
      expiresAt: key.expiresAt,
      revokedAt: key.revokedAt,
      revokedById: key.revokedById,
      revokeReason: key.revokeReason,
      replacedById: key.replacedById,
      lastUsedAt: key.lastUsedAt,
      createdAt: key.createdAt,
      updatedAt: key.updatedAt,
      status,
    };
  }

  private async enforceRateLimits(
    key: McpApiKey,
    user: User,
    context: ApiKeyRequestContext,
  ) {
    const counters = [
      {
        key: `api-key-rate:key:${key.id}:10s`,
        dimension: 'key_10_seconds',
        limit: API_KEY_LIMITS.requestsPerTenSecondsPerKey,
        ttl: 10,
      },
      {
        key: `api-key-rate:key:${key.id}:minute`,
        dimension: 'key_per_minute',
        limit: API_KEY_LIMITS.requestsPerMinutePerKey,
        ttl: 60,
      },
      {
        key: `api-key-rate:user:${user.id}:minute`,
        dimension: 'user_per_minute',
        limit: API_KEY_LIMITS.requestsPerMinutePerUser,
        ttl: 60,
      },
      {
        key: `api-key-rate:project:${key.projectId}:minute`,
        dimension: 'project_per_minute',
        limit: API_KEY_LIMITS.requestsPerMinutePerProject,
        ttl: 60,
      },
    ];
    for (const counter of counters) {
      const result = await this.cacheService.incrementWithTtl(
        counter.key,
        counter.ttl,
      );
      if (result.count > counter.limit) {
        await this.auditAuthenticationFailure(
          context,
          SecurityEventType.API_KEY_RATE_LIMITED,
          {
            keyId: key.id,
            ownerId: key.ownerId,
            projectId: key.projectId,
            limitDimension: counter.dimension,
            limit: counter.limit,
            retryAfter: result.retryAfter,
            reason: 'rate_limit_exceeded',
            outcome: 'denied',
          },
        );
        context.response?.setHeader('Retry-After', String(result.retryAfter));
        throw new HttpException(
          {
            code: 'API_KEY_RATE_LIMITED',
            message: 'Se excedio el limite de solicitudes de la API key',
            retryAfter: result.retryAfter,
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    }
  }

  private async auditAuthenticationFailure(
    context: ApiKeyRequestContext,
    eventType: SecurityEventType,
    metadata: Record<string, unknown>,
  ) {
    await this.securityEventService.create({
      eventType,
      severity:
        eventType === SecurityEventType.API_KEY_RATE_LIMITED
          ? SecurityEventSeverity.MEDIUM
          : SecurityEventSeverity.LOW,
      ipAddress: context.ipAddress || 'unknown',
      userAgent: context.userAgent || null,
      endpoint: sanitizeAuditEndpoint(context.endpoint),
      method: context.method || 'UNKNOWN',
      description: 'API key authentication denied',
      metadata: sanitizeApiKeyAuditMetadata({
        ...metadata,
        actor: 'api-key',
        action: 'authenticate',
        outcome: 'denied',
        reason: metadata.reason ?? 'unspecified',
        auditRetentionDays: API_KEY_AUDIT_RETENTION_DAYS,
      }),
    });
  }

  private async auditManagement(
    request: Request | undefined,
    actor: User,
    eventType: SecurityEventType,
    metadata: Record<string, unknown>,
  ): Promise<SecurityEvent> {
    return this.securityEventService.create({
      eventType,
      severity:
        eventType === SecurityEventType.UNAUTHORIZED_ACCESS
          ? SecurityEventSeverity.MEDIUM
          : SecurityEventSeverity.LOW,
      ipAddress: request?.ip || 'unknown',
      userAgent: request?.headers['user-agent'] || null,
      userId: actor.id,
      email: actor.email,
      endpoint: sanitizeAuditEndpoint(
        request?.path ||
          request?.originalUrl ||
          request?.url ||
          '/api/api-keys',
      ),
      method: request?.method || 'UNKNOWN',
      description: 'API key management action',
      metadata: sanitizeApiKeyAuditMetadata({
        ...metadata,
        auditRetentionDays: API_KEY_AUDIT_RETENTION_DAYS,
      }),
    });
  }

  private getPepper(version: number): string | undefined {
    if (version === API_KEY_HASH_VERSION) {
      return this.configService.get<string>(API_KEY_PEPPER_CURRENT_ENV);
    }
    if (version === API_KEY_PREVIOUS_HASH_VERSION) {
      const pepper = this.configService.get<string>(
        API_KEY_PEPPER_PREVIOUS_ENV,
      );
      const retireAtValue = this.configService.get<string>(
        API_KEY_PREVIOUS_PEPPER_RETIRE_AT_ENV,
      );
      if (!pepper || !retireAtValue) return undefined;

      const retireAt = new Date(retireAtValue);
      if (
        Number.isNaN(retireAt.getTime()) ||
        Date.now() >= retireAt.getTime()
      ) {
        return undefined;
      }
      return pepper;
    }
    return undefined;
  }

  private invalidKey(): UnauthorizedException {
    return new UnauthorizedException({
      code: 'API_KEY_INVALID',
      message: 'La API key no es valida o ya no esta activa',
    });
  }
}
