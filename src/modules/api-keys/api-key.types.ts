import { User } from '../auth/entities/user.entity';
import { ApiKeyScope } from './api-key.constants';

export interface RequestIdentity {
  user: User;
  authType: 'api-key' | 'jwt';
  keyId: string;
  projectId: string;
  scopes: ApiKeyScope[];
}

export interface ApiKeyRequest {
  user?: User;
  identity?: RequestIdentity;
  params?: Record<string, string | undefined>;
  query?: Record<string, string | undefined>;
  body?: Record<string, unknown>;
  headers: Record<string, string | undefined>;
  res?: { setHeader(name: string, value: string): void };
  ip?: string;
  originalUrl?: string;
  url?: string;
  path?: string;
  method?: string;
}

export interface ApiKeyRequestContext {
  ipAddress?: string;
  endpoint?: string;
  method?: string;
  userAgent?: string;
  metadataOnly?: boolean;
  response?: { setHeader(name: string, value: string): void };
}
