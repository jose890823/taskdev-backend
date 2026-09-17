export const API_KEY_PREFIX = 'thk_';
export const API_KEY_PUBLIC_ID_BYTES = 32;
export const API_KEY_SECRET_BYTES = 32;
export const API_KEY_HASH_ALGORITHM = 'sha256';
export const API_KEY_HASH_VERSION = 1;
export const API_KEY_PREVIOUS_HASH_VERSION = 0;
export const API_KEY_PEPPER_CURRENT_ENV = 'MCP_API_KEY_PEPPER_V1';
export const API_KEY_PEPPER_PREVIOUS_ENV = 'MCP_API_KEY_PEPPER_PREVIOUS';
export const API_KEY_PREVIOUS_PEPPER_RETIRE_AT_ENV =
  'MCP_API_KEY_PREVIOUS_PEPPER_RETIRE_AT';
export const API_KEY_EMERGENCY_DISABLE_ENV =
  'TASKHUB_MCP_API_KEY_EMERGENCY_DISABLE';
export const API_KEY_MANAGEMENT_FLAG = 'taskhub.mcp_api_key_management';
export const API_KEY_AUTHENTICATION_FLAG = 'taskhub.mcp_api_key_authentication';
export const API_KEY_SECRET_NOT_RECOVERABLE_CODE =
  'API_KEY_SECRET_NOT_RECOVERABLE';
export const API_KEY_SECRET_NOT_RECOVERABLE_MESSAGE =
  'El secreto de la API key no se puede recuperar. Revoca esta clave y crea una nueva.';
export const API_KEY_AUDIT_RETENTION_DAYS = 365;

export const API_KEY_SCOPES = [
  'tasks:read',
  'tasks:write',
  'comments:read',
  'comments:write',
  'notifications:read',
  'notifications:write',
  'activity:read',
  'search:read',
  'projects:read',
  'projects:write',
  'project-members:read',
  'project-members:write',
  'project-modules:read',
  'project-modules:write',
  'task-statuses:read',
  'task-statuses:write',
  'organizations:read',
  'invitations:read',
  'invitations:write',
] as const;

export type ApiKeyScope = (typeof API_KEY_SCOPES)[number];
export const DEFAULT_API_KEY_SCOPES: readonly ApiKeyScope[] = ['tasks:read'];
export const MAX_API_KEY_SCOPES = 6;
export const API_KEY_EXPIRATION_PRESETS = [30, 90, 180, 365] as const;

export const API_KEY_LIMITS = {
  maxActivePerUser: 10,
  maxActivePerUserProject: 3,
  maxActivePerProject: 50,
  requestsPerMinutePerKey: 60,
  requestsPerMinutePerUser: 300,
  requestsPerMinutePerProject: 1000,
  requestsPerTenSecondsPerKey: 10,
} as const;
