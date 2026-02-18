import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Decorator para obtener el locale del request.
 * El locale es establecido por el LocaleInterceptor.
 *
 * Uso: @CurrentLocale() locale: string
 *
 * @returns El locale actual del request ('es' o 'en')
 */
export const CurrentLocale = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest();
    return request.locale || 'es';
  },
);
