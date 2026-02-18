import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import type { Observable } from 'rxjs';
import { TranslationLocale } from '../entities/translation.entity';

const SUPPORTED_LOCALES: string[] = Object.values(TranslationLocale);

/**
 * Interceptor para detectar el locale del request.
 *
 * Prioridad:
 * 1. Query param ?lang=en
 * 2. Header Accept-Language (primer idioma)
 * 3. Default: 'es'
 *
 * El locale resultante se almacena en request.locale
 * y puede obtenerse con el decorator @CurrentLocale()
 *
 * NOTA: Este interceptor NO se registra globalmente.
 * Los modulos que lo necesiten deben aplicarlo donde corresponda.
 */
@Injectable()
export class LocaleInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();

    // Prioridad: 1) query param ?lang=en  2) Accept-Language header  3) default 'es'
    const lang =
      request.query?.lang ||
      request.headers['accept-language']?.split(',')[0]?.split('-')[0] ||
      'es';

    request.locale = SUPPORTED_LOCALES.includes(lang) ? lang : 'es';

    return next.handle();
  }
}
