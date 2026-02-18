import { Injectable, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

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
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      const request = context.switchToHttp().getRequest();
      const authHeader = request.headers?.authorization;
      if (authHeader?.startsWith('Bearer ')) {
        // Token present on public route — run Passport pipeline to attach user
        return super.canActivate(context) as Promise<boolean>;
      }
      return true;
    }

    return super.canActivate(context);
  }

  handleRequest(err: any, user: any, info: any, context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      // On public routes, return whatever user we got (or null) — never throw
      return user || null;
    }

    // On protected routes, throw if no valid user
    if (err || !user) {
      throw err || new UnauthorizedException('Token de acceso inválido o expirado');
    }
    return user;
  }
}
