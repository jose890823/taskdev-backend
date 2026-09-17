import { ForbiddenException } from '@nestjs/common';
import type { ApiKeyRequest } from './api-key.types';

export function isProjectBindingAllowed(
  boundProjectId: string,
  requestedProjectIds: string[],
): boolean {
  return (
    requestedProjectIds.length === 1 &&
    requestedProjectIds[0] === boundProjectId
  );
}

/** Reject a resource resolved to a project other than the API key binding. */
export function assertApiKeyProject(
  request: ApiKeyRequest,
  projectId: string | null | undefined,
): void {
  if (
    request.identity?.authType === 'api-key' &&
    (!projectId || request.identity.projectId !== projectId)
  ) {
    throw new ForbiddenException({
      code: 'PROJECT_ACCESS_DENIED',
      message: 'Acceso al proyecto denegado',
    });
  }
}

const SAFE_METADATA_FIELDS = [
  'id',
  'ownerId',
  'projectId',
  'name',
  'publicId',
  'prefix',
  'scopes',
  'expiresAt',
  'revokedAt',
  'revokedById',
  'revokeReason',
  'replacedById',
  'lastUsedAt',
  'createdAt',
  'updatedAt',
  'status',
] as const;

export function sanitizeApiKeyMetadata(
  value: Record<string, unknown>,
): Record<string, unknown> {
  return Object.fromEntries(
    SAFE_METADATA_FIELDS.filter((field) => value[field] !== undefined).map(
      (field) => [field, value[field]],
    ),
  );
}

const SAFE_AUDIT_METADATA_FIELDS = new Set([
  'action',
  'actor',
  'auditRetentionDays',
  'expiresAt',
  'keyId',
  'limit',
  'limitDimension',
  'outcome',
  'ownerId',
  'projectId',
  'publicId',
  'replacementKeyId',
  'requiredScopes',
  'reason',
  'scopes',
  'targetOwnerId',
  'retryAfter',
]);

const SAFE_REASON_FALLBACK = 'unspecified';

function stripControlCharacters(value: string): string {
  return Array.from(value)
    .filter((character) => {
      const code = character.charCodeAt(0);
      return code >= 32 && code !== 127;
    })
    .join('');
}

function sanitizeApiKeyText(value: string): string {
  return stripControlCharacters(value)
    .replace(/\bthk_[a-z0-9_-]{8,}\b/gi, '[api-key]')
    .replace(/https?:\/\/[^\s]+/gi, '[url]')
    .replace(/[?#][^\s]*/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 128);
}

/** Keep audit fields bounded and free from URLs, query strings, and controls. */
export function sanitizeApiKeyAuditMetadata(
  value: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [field, rawValue] of Object.entries(value)) {
    if (!SAFE_AUDIT_METADATA_FIELDS.has(field)) continue;

    if (field === 'reason') {
      result[field] = sanitizeApiKeyReason(rawValue);
      continue;
    }

    if (field === 'scopes' || field === 'requiredScopes') {
      result[field] = Array.isArray(rawValue)
        ? rawValue
            .filter((item): item is string => typeof item === 'string')
            .slice(0, 6)
            .map((item) => item.slice(0, 64))
        : [];
      continue;
    }

    if (rawValue instanceof Date) {
      result[field] = rawValue.toISOString();
    } else if (typeof rawValue === 'string') {
      result[field] = sanitizeApiKeyText(rawValue);
    } else if (
      typeof rawValue === 'number' ||
      typeof rawValue === 'boolean' ||
      rawValue === null
    ) {
      result[field] = rawValue;
    }
  }

  return result;
}

export function sanitizeApiKeyReason(
  value: unknown,
  fallback = SAFE_REASON_FALLBACK,
): string {
  if (typeof value !== 'string') return fallback;

  const sanitized = sanitizeApiKeyText(value);

  return sanitized || fallback;
}

export function sanitizeAuditEndpoint(value: unknown): string {
  if (typeof value !== 'string') return 'unknown';
  const path = stripControlCharacters(value).split(/[?#]/, 1)[0];
  return path.slice(0, 200) || 'unknown';
}
