import { SetMetadata } from '@nestjs/common';
import { UserRole } from '../entities/user.entity';

/**
 * Decorator para especificar los roles requeridos para acceder a una ruta
 * Uso: @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
 */
export const ROLES_KEY = 'roles';
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
