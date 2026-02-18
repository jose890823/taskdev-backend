import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import type { Request } from 'express';
import { CacheService } from '../cache.service';
import { CACHE_KEY_METADATA } from '../decorators/cacheable.decorator';
import type { CacheableOptions } from '../decorators/cacheable.decorator';

/**
 * Interceptor que implementa cache automatico basado en el decorator @Cacheable().
 *
 * Flujo:
 * 1. Lee los metadatos CACHE_KEY_METADATA del handler
 * 2. Si no hay metadatos, pasa sin modificar la ejecucion
 * 3. Construye la clave de cache reemplazando :param con los parametros de ruta
 * 4. Si la clave existe en cache (hit), retorna el valor cacheado
 * 5. Si no existe (miss), ejecuta el handler y almacena el resultado en cache
 *
 * Solo intercepta peticiones GET por seguridad (no cachea POST, PUT, DELETE).
 */
@Injectable()
export class CacheInterceptor implements NestInterceptor {
  private readonly logger = new Logger(CacheInterceptor.name);

  constructor(
    private readonly cacheService: CacheService,
    private readonly reflector: Reflector,
  ) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<any>> {
    const options = this.reflector.get<CacheableOptions | undefined>(
      CACHE_KEY_METADATA,
      context.getHandler(),
    );

    // Si no hay metadatos de cache, ejecutar normalmente
    if (!options) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<Request>();

    // Solo cachear peticiones GET
    if (request.method !== 'GET') {
      return next.handle();
    }

    const cacheKey = this.buildCacheKey(options.key, request.params);
    const ttl = options.ttl ?? 300;

    try {
      // Intentar obtener del cache
      const cached = await this.cacheService.get<any>(cacheKey);

      if (cached !== null) {
        this.logger.debug(`Cache HIT: ${cacheKey}`);
        return of(cached);
      }

      this.logger.debug(`Cache MISS: ${cacheKey}`);
    } catch (error) {
      // Si falla la lectura del cache, continuar sin cache
      this.logger.warn(
        `Error al leer cache para "${cacheKey}": ${error.message}`,
      );
      return next.handle();
    }

    // Cache miss: ejecutar handler y almacenar resultado
    return next.handle().pipe(
      tap(async (response) => {
        try {
          await this.cacheService.set(cacheKey, response, ttl);
          this.logger.debug(`Cache SET: ${cacheKey} (TTL: ${ttl}s)`);
        } catch (error) {
          this.logger.warn(
            `Error al almacenar en cache "${cacheKey}": ${error.message}`,
          );
        }
      }),
    );
  }

  /**
   * Construir la clave de cache reemplazando :param con valores reales.
   *
   * @example
   * buildCacheKey('products::id', { id: '123' }) => 'products:123'
   * buildCacheKey('categories:tree', {}) => 'categories:tree'
   */
  private buildCacheKey(
    keyTemplate: string,
    params: Record<string, string>,
  ): string {
    let key = keyTemplate;

    for (const [paramName, paramValue] of Object.entries(params)) {
      key = key.replace(`:${paramName}`, paramValue);
    }

    return key;
  }
}
