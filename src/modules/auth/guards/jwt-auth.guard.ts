import {
  Injectable,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import {
  API_KEY_METADATA_ONLY_KEY,
  API_KEY_SCOPES_KEY,
} from '../../api-keys/decorators/api-key.decorator';

/**
 * Guard para proteger rutas con JWT
 * Verifica que el usuario esté autenticado mediante un token válido
 * Respeta el decorator @Public() para rutas sin autenticación
 * En rutas públicas con token presente, intenta extraer el usuario sin fallar
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const request = context
      .switchToHttp()
      .getRequest<{ headers: Record<string, string | undefined> }>();
    const authHeader = request.headers?.authorization || '';
    const acceptsApiKey =
      this.reflector.getAllAndOverride<string[]>(API_KEY_SCOPES_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) !== undefined ||
      this.reflector.getAllAndOverride<boolean>(API_KEY_METADATA_ONLY_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) === true;

    // Let the route-level CombinedAuthGuard validate annotated thk_ tokens.
    if (acceptsApiKey && (!authHeader || /^Bearer\s+thk_/i.test(authHeader))) {
      return true;
    }

    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      if (authHeader?.startsWith('Bearer ')) {
        // Token present on public route — run Passport pipeline to attach user
        return super.canActivate(context) as Promise<boolean>;
      }
      return true;
    }

    return super.canActivate(context);
  }

  handleRequest<TUser = unknown>(
    err: Error | null,
    user: TUser | false,
    _info: unknown,
    context: ExecutionContext,
  ): TUser {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      // On public routes, return whatever user we got (or null) — never throw
      return (user || null) as TUser;
    }

    // On protected routes, throw if no valid user
    if (err || !user) {
      throw (
        err || new UnauthorizedException('Token de acceso inválido o expirado')
      );
    }
    return user as TUser;
  }
}
