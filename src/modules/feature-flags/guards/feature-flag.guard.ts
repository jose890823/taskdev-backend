import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { FeatureFlagsService } from '../feature-flags.service';
import { FEATURE_FLAG_KEY } from '../decorators/require-feature.decorator';

/**
 * Guard que verifica si un feature flag está habilitado.
 *
 * Lee la metadata @RequireFeature del handler y verifica
 * con el FeatureFlagsService si el feature está habilitado
 * para el usuario actual (roles y storeId).
 *
 * Uso:
 * @UseGuards(JwtAuthGuard, FeatureFlagGuard)
 * @RequireFeature('michambita.content_generation')
 */
@Injectable()
export class FeatureFlagGuard implements CanActivate {
  private readonly logger = new Logger(FeatureFlagGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly featureFlagsService: FeatureFlagsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const featureKey = this.reflector.getAllAndOverride<string>(
      FEATURE_FLAG_KEY,
      [context.getHandler(), context.getClass()],
    );

    // Si no hay feature flag requerido, permitir acceso
    if (!featureKey) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{
      user?: Record<string, any>;
      params?: Record<string, string>;
      query?: Record<string, string>;
    }>();
    const user = request.user;

    // Construir contexto para la verificación
    const featureContext: { roles?: string[]; storeId?: string } = {};

    if (user) {
      // Obtener roles del usuario
      if (Array.isArray(user.roles)) {
        featureContext.roles = user.roles;
      } else if (typeof user.roles === 'string') {
        featureContext.roles = user.roles.split(',').filter(Boolean);
      }

      // Obtener storeId del usuario (si existe en el request o en el usuario)
      if (user.storeId) {
        featureContext.storeId = user.storeId;
      } else if (request.params?.storeId) {
        featureContext.storeId = request.params.storeId;
      } else if (request.query?.storeId) {
        featureContext.storeId = request.query.storeId;
      }
    }

    const isEnabled = await this.featureFlagsService.isEnabled(
      featureKey,
      featureContext,
    );

    if (!isEnabled) {
      this.logger.warn(
        `Acceso denegado: feature flag "${featureKey}" está deshabilitado para el usuario ${user?.id || 'anónimo'}`,
      );

      throw new ForbiddenException({
        code: 'FEATURE_DISABLED',
        message: `La funcionalidad "${featureKey}" no está habilitada`,
      });
    }

    return true;
  }
}
