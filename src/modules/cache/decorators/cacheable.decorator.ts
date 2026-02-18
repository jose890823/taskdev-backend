import { SetMetadata } from '@nestjs/common';

export const CACHE_KEY_METADATA = 'cache:key';
export const CACHE_TTL_METADATA = 'cache:ttl';

/**
 * Opciones para el decorator @Cacheable()
 */
export interface CacheableOptions {
  /**
   * Prefijo de la clave de cache.
   * Soporta parametros dinamicos con la sintaxis :param
   * Ejemplo: 'products::id' reemplaza :id con el parametro de ruta 'id'
   */
  key: string;

  /**
   * Tiempo de vida en segundos. Por defecto 300 (5 minutos)
   */
  ttl?: number;
}

/**
 * Decorator para cachear automaticamente la respuesta de un endpoint.
 *
 * Funciona en conjunto con CacheInterceptor:
 * 1. Antes de ejecutar el handler, busca en cache la clave generada
 * 2. Si existe (hit), retorna el valor cacheado sin ejecutar el handler
 * 3. Si no existe (miss), ejecuta el handler y almacena el resultado
 *
 * @example
 * ```typescript
 * @Get(':id')
 * @Cacheable({ key: 'products::id', ttl: 600 })
 * async findOne(@Param('id') id: string) {
 *   return this.productsService.findOne(id);
 * }
 * ```
 *
 * @example
 * ```typescript
 * @Get()
 * @Cacheable({ key: 'categories:tree' })
 * async getTree() {
 *   return this.categoriesService.getTree();
 * }
 * ```
 */
export const Cacheable = (options: CacheableOptions): MethodDecorator => {
  return (
    target: any,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor,
  ) => {
    SetMetadata(CACHE_KEY_METADATA, options)(target, propertyKey, descriptor);
    return descriptor;
  };
};
