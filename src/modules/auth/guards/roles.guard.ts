import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '../entities/user.entity';
import { ROLES_KEY } from '../decorators/roles.decorator';

/**
 * Guard para verificar que el usuario tenga los roles requeridos
 * Uso: @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
 *
 * El usuario debe tener AL MENOS UNO de los roles especificados.
 * Soporta usuarios con múltiples roles.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Obtener los roles requeridos del decorator @Roles()
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles || requiredRoles.length === 0) {
      // Si no hay roles especificados, permitir acceso
      return true;
    }

    // Obtener el usuario del request (ya autenticado por JwtAuthGuard)
    const { user } = context.switchToHttp().getRequest();

    if (!user) {
      return false;
    }

    // Obtener los roles del usuario (soporta tanto 'roles' array como 'role' string para compatibilidad)
    const userRoles: UserRole[] = this.getUserRoles(user);

    // Verificar si el usuario tiene alguno de los roles requeridos
    return requiredRoles.some((requiredRole) =>
      userRoles.includes(requiredRole),
    );
  }

  /**
   * Obtiene los roles del usuario, soportando tanto el nuevo formato (roles array)
   * como el antiguo (role string) para compatibilidad durante la migración
   */
  private getUserRoles(user: any): UserRole[] {
    // Si tiene el nuevo campo 'roles' como array
    if (Array.isArray(user.roles)) {
      return user.roles;
    }

    // Si 'roles' es un string (viene de simple-array en DB), convertir a array
    if (typeof user.roles === 'string') {
      return user.roles.split(',').filter(Boolean) as UserRole[];
    }

    // Fallback al campo antiguo 'role' (string único)
    if (user.role) {
      return [user.role];
    }

    // Sin roles
    return [];
  }
}
