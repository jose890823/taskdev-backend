import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import {
  API_KEY_METADATA_ONLY_KEY,
  API_KEY_SCOPES_KEY,
} from '../decorators/api-key.decorator';
import { ApiKeyGuard } from './api-key.guard';
import { ApiKeyRequest } from '../api-key.types';

@Injectable()
export class CombinedAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtAuthGuard: JwtAuthGuard,
    private readonly apiKeyGuard: ApiKeyGuard,
  ) {}

  canActivate(context: ExecutionContext) {
    const scopes = this.reflector.getAllAndOverride<string[]>(
      API_KEY_SCOPES_KEY,
      [context.getHandler(), context.getClass()],
    );
    const metadataOnly = this.reflector.getAllAndOverride<boolean>(
      API_KEY_METADATA_ONLY_KEY,
      [context.getHandler(), context.getClass()],
    );
    const request = context.switchToHttp().getRequest<ApiKeyRequest>();
    const authorization = request.headers?.authorization || '';

    if (
      (scopes || metadataOnly) &&
      (!authorization || /^Bearer\s+thk_/i.test(authorization))
    ) {
      return this.apiKeyGuard.canActivate(context);
    }

    return this.jwtAuthGuard.canActivate(context);
  }
}
