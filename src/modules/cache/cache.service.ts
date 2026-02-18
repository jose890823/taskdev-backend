import {
  Injectable,
  Logger,
  OnModuleDestroy,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

/**
 * Servicio centralizado de cache con Redis (ioredis).
 *
 * Proporciona una capa de cache reutilizable para todos los modulos de MiChambita.
 * Usa el prefijo 'mchb:' para evitar colisiones con otros datos en Redis.
 */
@Injectable()
export class CacheService implements OnModuleDestroy {
  private readonly logger = new Logger(CacheService.name);
  private client: Redis;

  constructor(private readonly configService: ConfigService) {
    const password = configService.get<string>('REDIS_PASSWORD', '');

    this.client = new Redis({
      host: configService.get<string>('REDIS_HOST', 'localhost'),
      port: configService.get<number>('REDIS_PORT', 6379),
      password: password || undefined,
      db: configService.get<number>('REDIS_DB', 0),
      keyPrefix: 'mchb:',
      retryStrategy: (times: number) => Math.min(times * 50, 2000),
      maxRetriesPerRequest: 3,
      lazyConnect: false,
    });

    this.client.on('connect', () => {
      this.logger.log('Conexion a Redis establecida');
    });

    this.client.on('error', (err: Error) => {
      this.logger.warn(`Error de conexion Redis: ${err.message}`);
    });

    this.client.on('close', () => {
      this.logger.warn('Conexion a Redis cerrada');
    });
  }

  // ============================================
  // METODOS CORE
  // ============================================

  /**
   * Obtener un valor del cache por clave
   * @returns El valor parseado o null si no existe / hay error
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const data = await this.client.get(key);
      if (data === null) {
        return null;
      }
      return JSON.parse(data) as T;
    } catch (error) {
      this.logger.warn(
        `Error al obtener clave "${key}" del cache: ${error.message}`,
      );
      return null;
    }
  }

  /**
   * Almacenar un valor en el cache
   * @param key - Clave del cache
   * @param value - Valor a almacenar (se serializa a JSON)
   * @param ttlSeconds - Tiempo de vida en segundos (por defecto 300 = 5 min)
   */
  async set(key: string, value: any, ttlSeconds: number = 300): Promise<void> {
    try {
      const serialized = JSON.stringify(value);
      await this.client.set(key, serialized, 'EX', ttlSeconds);
    } catch (error) {
      this.logger.warn(
        `Error al establecer clave "${key}" en cache: ${error.message}`,
      );
    }
  }

  /**
   * Eliminar una clave del cache
   */
  async del(key: string): Promise<void> {
    try {
      await this.client.del(key);
    } catch (error) {
      this.logger.warn(
        `Error al eliminar clave "${key}" del cache: ${error.message}`,
      );
    }
  }

  /**
   * Eliminar todas las claves que coincidan con un patron usando SCAN + DEL.
   * El patron debe ser relativo al prefijo 'mchb:'. Ejemplo: 'categories:*'
   * @returns Cantidad de claves eliminadas
   */
  async delByPattern(pattern: string): Promise<number> {
    try {
      let deletedCount = 0;
      const fullPattern = `mchb:${pattern}`;
      let cursor = '0';

      do {
        const [nextCursor, keys] = await this.client.scan(
          cursor,
          'MATCH',
          fullPattern,
          'COUNT',
          100,
        );
        cursor = nextCursor;

        if (keys.length > 0) {
          // Las claves retornadas por SCAN incluyen el prefijo completo,
          // pero el cliente ioredis con keyPrefix agrega automaticamente el prefijo.
          // Necesitamos remover el prefijo para que ioredis no lo duplique.
          const keysWithoutPrefix = keys.map((k) =>
            k.startsWith('mchb:') ? k.substring(6) : k,
          );
          await this.client.del(...keysWithoutPrefix);
          deletedCount += keys.length;
        }
      } while (cursor !== '0');

      this.logger.log(
        `Eliminadas ${deletedCount} claves con patron "${pattern}"`,
      );
      return deletedCount;
    } catch (error) {
      this.logger.warn(
        `Error al eliminar por patron "${pattern}": ${error.message}`,
      );
      return 0;
    }
  }

  /**
   * Verificar si una clave existe en el cache
   */
  async exists(key: string): Promise<boolean> {
    try {
      const result = await this.client.exists(key);
      return result === 1;
    } catch (error) {
      this.logger.warn(
        `Error al verificar existencia de clave "${key}": ${error.message}`,
      );
      return false;
    }
  }

  /**
   * Obtener el tiempo de vida restante de una clave en segundos
   * @returns TTL en segundos, -1 si no tiene TTL, -2 si la clave no existe
   */
  async ttl(key: string): Promise<number> {
    try {
      return await this.client.ttl(key);
    } catch (error) {
      this.logger.warn(
        `Error al obtener TTL de clave "${key}": ${error.message}`,
      );
      return -2;
    }
  }

  // ============================================
  // METODOS DE CONVENIENCIA
  // ============================================

  /**
   * Obtener valor del cache o ejecutar factory y almacenar el resultado.
   * Patron cache-aside: intenta el cache primero, si falla ejecuta la factory.
   *
   * @param key - Clave del cache
   * @param factory - Funcion asincrona que genera el valor si no esta en cache
   * @param ttlSeconds - Tiempo de vida en segundos (por defecto 300 = 5 min)
   */
  async getOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    ttlSeconds: number = 300,
  ): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    const value = await factory();
    await this.set(key, value, ttlSeconds);
    return value;
  }

  /**
   * Invalidar todas las claves con un prefijo dado.
   * Ejemplo: invalidateByPrefix('products:') elimina todas las claves products:*
   * @returns Cantidad de claves eliminadas
   */
  async invalidateByPrefix(prefix: string): Promise<number> {
    return this.delByPattern(`${prefix}*`);
  }

  // ============================================
  // CONSTRUCTORES DE CLAVES (ESTATICOS)
  // ============================================

  static keys = {
    category: (id: string) => `categories:${id}`,
    categoryTree: () => 'categories:tree',
    product: (id: string) => `products:${id}`,
    productList: (hash: string) => `products:list:${hash}`,
    store: (id: string) => `stores:${id}`,
    featureFlag: (key: string) => `flags:${key}`,
    featureFlagsAll: () => 'flags:all',
    shippingZones: (storeId: string) => `shipping:zones:${storeId}`,
    commissionRule: (storeId: string) => `commissions:rule:${storeId}`,
  };

  // ============================================
  // ESTADISTICAS Y ADMINISTRACION
  // ============================================

  /**
   * Obtener estadisticas del cache Redis
   */
  async getStats(): Promise<{
    keys: number;
    memory: string;
    uptime: number;
    hitRate: string;
  }> {
    try {
      const info = await this.client.info();

      const dbKeys = this.extractInfoValue(info, 'db0');
      const keysMatch = dbKeys?.match(/keys=(\d+)/);
      const keysCount = keysMatch ? parseInt(keysMatch[1], 10) : 0;

      const memory = this.extractInfoValue(info, 'used_memory_human') || '0B';
      const uptime = parseInt(
        this.extractInfoValue(info, 'uptime_in_seconds') || '0',
        10,
      );

      const hits = parseInt(
        this.extractInfoValue(info, 'keyspace_hits') || '0',
        10,
      );
      const misses = parseInt(
        this.extractInfoValue(info, 'keyspace_misses') || '0',
        10,
      );
      const total = hits + misses;
      const hitRate =
        total > 0 ? `${((hits / total) * 100).toFixed(2)}%` : '0.00%';

      return { keys: keysCount, memory, uptime, hitRate };
    } catch (error) {
      this.logger.warn(
        `Error al obtener estadisticas de Redis: ${error.message}`,
      );
      return { keys: 0, memory: '0B', uptime: 0, hitRate: '0.00%' };
    }
  }

  /**
   * Listar claves que coincidan con un patron.
   * SCAN-based para no bloquear Redis.
   * @param pattern - Patron glob (ej: 'products:*')
   * @param limit - Limite maximo de claves a retornar (por defecto 100)
   * @returns Lista de claves (sin el prefijo mchb:)
   */
  async listKeys(pattern: string, limit: number = 100): Promise<string[]> {
    try {
      const fullPattern = `mchb:${pattern}`;
      const result: string[] = [];
      let cursor = '0';

      do {
        const [nextCursor, keys] = await this.client.scan(
          cursor,
          'MATCH',
          fullPattern,
          'COUNT',
          100,
        );
        cursor = nextCursor;

        for (const key of keys) {
          const cleanKey = key.startsWith('mchb:') ? key.substring(6) : key;
          result.push(cleanKey);
          if (result.length >= limit) {
            return result;
          }
        }
      } while (cursor !== '0');

      return result;
    } catch (error) {
      this.logger.warn(
        `Error al listar claves con patron "${pattern}": ${error.message}`,
      );
      return [];
    }
  }

  /**
   * Eliminar todas las claves del cache (solo en entornos no-produccion)
   * @throws InternalServerErrorException si se intenta en produccion
   */
  async flushAll(): Promise<void> {
    const nodeEnv = this.configService.get<string>('NODE_ENV', 'development');

    if (nodeEnv === 'production') {
      throw new InternalServerErrorException(
        'No se permite flush del cache en produccion',
      );
    }

    try {
      // flushdb solo limpia la BD actual, no todo Redis
      await this.client.flushdb();
      this.logger.log('Cache vaciado completamente (flushdb)');
    } catch (error) {
      this.logger.warn(`Error al vaciar el cache: ${error.message}`);
    }
  }

  /**
   * Verificar si la conexion con Redis esta activa
   */
  async isHealthy(): Promise<boolean> {
    try {
      const result = await this.client.ping();
      return result === 'PONG';
    } catch (error) {
      this.logger.warn(`Redis health check fallido: ${error.message}`);
      return false;
    }
  }

  // ============================================
  // CICLO DE VIDA
  // ============================================

  /**
   * Cerrar la conexion con Redis al destruir el modulo
   */
  async onModuleDestroy(): Promise<void> {
    try {
      await this.client.quit();
      this.logger.log('Conexion a Redis cerrada correctamente');
    } catch (error) {
      this.logger.warn(`Error al cerrar conexion Redis: ${error.message}`);
    }
  }

  // ============================================
  // UTILIDADES PRIVADAS
  // ============================================

  /**
   * Extraer un valor del output de INFO de Redis
   */
  private extractInfoValue(info: string, key: string): string | null {
    const regex = new RegExp(`^${key}:(.+)$`, 'm');
    const match = info.match(regex);
    return match ? match[1].trim() : null;
  }
}
