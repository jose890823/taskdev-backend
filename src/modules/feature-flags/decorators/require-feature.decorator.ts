import { SetMetadata } from '@nestjs/common';

/**
 * Clave de metadata para el decorator @RequireFeature
 */
export const FEATURE_FLAG_KEY = 'feature_flag';

/**
 * Decorator para requerir que un feature flag esté habilitado
 * para acceder a una ruta.
 *
 * Uso: @RequireFeature('taskhub.content_generation')
 *
 * Debe usarse junto con FeatureFlagGuard:
 * @UseGuards(JwtAuthGuard, FeatureFlagGuard)
 * @RequireFeature('taskhub.content_generation')
 */
export const RequireFeature = (featureKey: string) =>
  SetMetadata(FEATURE_FLAG_KEY, featureKey);
