import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  API_KEY_PROJECT_PARAM_KEY,
  API_KEY_SCOPES_KEY,
  API_KEY_METADATA_ONLY_KEY,
} from '../decorators/api-key.decorator';
import { ApiKeyService } from '../api-key.service';
import { ApiKeyRequest } from '../api-key.types';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly apiKeyService: ApiKeyService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredScopes = this.reflector.getAllAndOverride<string[]>(
      API_KEY_SCOPES_KEY,
      [context.getHandler(), context.getClass()],
    );
    const metadataOnly = this.reflector.getAllAndOverride<boolean>(
      API_KEY_METADATA_ONLY_KEY,
      [context.getHandler(), context.getClass()],
    );
    const request = context.switchToHttp().getRequest<ApiKeyRequest>();
    const token = this.getBearerToken(request.headers?.authorization);

    if (!token) {
      this.setAuthenticationHeader(request);
      throw new UnauthorizedException({
        code: 'API_KEY_INVALID',
        message: 'Se requiere una API key valida',
      });
    }

    try {
      const projectParam = this.reflector.getAllAndOverride<string>(
        API_KEY_PROJECT_PARAM_KEY,
        [context.getHandler(), context.getClass()],
      );
      const projectIds = metadataOnly
        ? []
        : this.readProjectIds(request, projectParam || 'projectId');
      const identity = await this.apiKeyService.authenticate(
        token,
        requiredScopes || [],
        projectIds,
        {
          ipAddress: request.ip,
          endpoint: request.path || request.originalUrl || request.url,
          method: request.method,
          userAgent: request.headers?.['user-agent'],
          metadataOnly,
          response: request.res,
        },
      );

      request.user = identity.user;
      request.identity = identity;
      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        this.setAuthenticationHeader(request);
      } else if (error instanceof ForbiddenException) {
        request.res?.setHeader(
          'WWW-Authenticate',
          'Bearer realm="taskhub", error="insufficient_scope"',
        );
      }
      throw error;
    }
  }

  private getBearerToken(header?: string): string | null {
    if (!header) return null;
    const match = /^Bearer\s+(thk_[^\s]+)$/i.exec(header);
    return match?.[1] || null;
  }

  private readProjectIds(request: ApiKeyRequest, parameter: string): string[] {
    const values = [
      request.params?.[parameter],
      request.query?.[parameter],
      request.body?.[parameter] as string | undefined,
    ].filter((value): value is string => Boolean(value));
    const projectIds = [
      ...values,
      request.query?.projectIds,
      request.body?.projectIds as string | undefined,
    ]
      .filter((value): value is string => Boolean(value))
      .flatMap((value) => value.split(',').map((id) => id.trim()))
      .filter(Boolean);
    return [...new Set(projectIds)];
  }

  private setAuthenticationHeader(request: ApiKeyRequest) {
    request.res?.setHeader(
      'WWW-Authenticate',
      'Bearer realm="taskhub", error="invalid_token"',
    );
  }
}
