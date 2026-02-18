import { Global, Module } from '@nestjs/common';
import { CacheService } from './cache.service';
import { CacheAdminController } from './cache-admin.controller';
import { CacheInterceptor } from './interceptors/cache.interceptor';

/**
 * Modulo global de cache Redis para MiChambita.
 *
 * Al estar marcado como @Global(), CacheService esta disponible
 * en todos los modulos sin necesidad de importar CacheModule.
 *
 * Provee:
 * - CacheService: Servicio principal de cache (get, set, del, getOrSet, etc.)
 * - CacheInterceptor: Interceptor para cacheo automatico con @Cacheable()
 * - CacheAdminController: Endpoints de administracion (stats, health, invalidate, flush)
 */
@Global()
@Module({
  controllers: [CacheAdminController],
  providers: [CacheService, CacheInterceptor],
  exports: [CacheService, CacheInterceptor],
})
export class CacheModule {}
