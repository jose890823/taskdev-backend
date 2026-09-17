import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { InternalServerErrorException } from '@nestjs/common';
import { CacheService } from './cache.service';

/**
 * Mock completo del cliente ioredis.
 * Se inyecta en el constructor via ConfigService.
 */
const mockRedisClient = {
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
  scan: jest.fn(),
  exists: jest.fn(),
  ttl: jest.fn(),
  info: jest.fn(),
  flushdb: jest.fn(),
  ping: jest.fn(),
  quit: jest.fn(),
  on: jest.fn(),
  eval: jest.fn(),
};

// Mock del modulo ioredis — retorna nuestro mock client
jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => mockRedisClient);
});

describe('CacheService', () => {
  let service: CacheService;
  let configService: ConfigService;

  const mockConfigValues: Record<string, string | number> = {
    REDIS_HOST: 'localhost',
    REDIS_PORT: 6379,
    REDIS_PASSWORD: '',
    REDIS_DB: 0,
    NODE_ENV: 'development',
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CacheService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(
              (key: string, defaultValue?: string | number) =>
                mockConfigValues[key] ?? defaultValue,
            ),
          },
        },
      ],
    }).compile();

    service = module.get<CacheService>(CacheService);
    configService = module.get<ConfigService>(ConfigService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('debe estar definido', () => {
    expect(service).toBeDefined();
  });

  // ============================================
  // GET
  // ============================================

  describe('get', () => {
    it('debe retornar el valor parseado cuando la clave existe', async () => {
      const data = { id: '123e4567-e89b-12d3-a456-426614174000', name: 'test' };
      mockRedisClient.get.mockResolvedValue(JSON.stringify(data));

      const result = await service.get<typeof data>('test-key');

      expect(mockRedisClient.get).toHaveBeenCalledWith('test-key');
      expect(result).toEqual(data);
    });

    it('debe retornar null cuando la clave no existe', async () => {
      mockRedisClient.get.mockResolvedValue(null);

      const result = await service.get('non-existent-key');

      expect(result).toBeNull();
    });

    it('debe retornar null y logear warning cuando Redis falla', async () => {
      mockRedisClient.get.mockRejectedValue(new Error('Connection refused'));

      const result = await service.get('failing-key');

      expect(result).toBeNull();
    });

    it('debe retornar null cuando el valor no es JSON valido', async () => {
      mockRedisClient.get.mockResolvedValue('not-valid-json{{{');

      const result = await service.get('bad-json-key');

      // JSON.parse deberia lanzar, y el catch retorna null
      expect(result).toBeNull();
    });

    it('debe soportar valores primitivos serializados', async () => {
      mockRedisClient.get.mockResolvedValue(JSON.stringify(42));

      const result = await service.get<number>('number-key');

      expect(result).toBe(42);
    });

    it('debe soportar arrays serializados', async () => {
      const arr = [1, 2, 3];
      mockRedisClient.get.mockResolvedValue(JSON.stringify(arr));

      const result = await service.get<number[]>('array-key');

      expect(result).toEqual([1, 2, 3]);
    });

    it('debe retornar null cuando el error no es instancia de Error', async () => {
      mockRedisClient.get.mockRejectedValue('string error');

      const result = await service.get('key');

      expect(result).toBeNull();
    });
  });

  // ============================================
  // SET
  // ============================================

  describe('set', () => {
    it('debe almacenar un valor con TTL por defecto (300s)', async () => {
      mockRedisClient.set.mockResolvedValue('OK');

      await service.set('my-key', { foo: 'bar' });

      expect(mockRedisClient.set).toHaveBeenCalledWith(
        'my-key',
        JSON.stringify({ foo: 'bar' }),
        'EX',
        300,
      );
    });

    it('debe almacenar un valor con TTL personalizado', async () => {
      mockRedisClient.set.mockResolvedValue('OK');

      await service.set('custom-ttl', 'value', 600);

      expect(mockRedisClient.set).toHaveBeenCalledWith(
        'custom-ttl',
        JSON.stringify('value'),
        'EX',
        600,
      );
    });

    it('debe no lanzar error cuando Redis falla al guardar', async () => {
      mockRedisClient.set.mockRejectedValue(new Error('READONLY'));

      await expect(service.set('key', 'value')).resolves.toBeUndefined();
    });

    it('debe serializar valores nulos correctamente', async () => {
      mockRedisClient.set.mockResolvedValue('OK');

      await service.set('null-key', null);

      expect(mockRedisClient.set).toHaveBeenCalledWith(
        'null-key',
        'null',
        'EX',
        300,
      );
    });

    it('debe no lanzar cuando el error no es instancia de Error', async () => {
      mockRedisClient.set.mockRejectedValue('non-error-rejection');

      await expect(service.set('key', 'value')).resolves.toBeUndefined();
    });
  });

  describe('incrementWithTtl', () => {
    it('uses one atomic Redis script for the counter and TTL', async () => {
      mockRedisClient.eval.mockResolvedValue([3, 8]);

      await expect(service.incrementWithTtl('rate-key', 10)).resolves.toEqual({
        count: 3,
        retryAfter: 8,
      });

      expect(mockRedisClient.eval).toHaveBeenCalledWith(
        expect.stringContaining("redis.call('INCR', KEYS[1])"),
        1,
        'rate-key',
        10,
      );
    });
  });

  // ============================================
  // DEL
  // ============================================

  describe('del', () => {
    it('debe eliminar una clave del cache', async () => {
      mockRedisClient.del.mockResolvedValue(1);

      await service.del('delete-me');

      expect(mockRedisClient.del).toHaveBeenCalledWith('delete-me');
    });

    it('debe no lanzar error cuando Redis falla al eliminar', async () => {
      mockRedisClient.del.mockRejectedValue(new Error('Connection lost'));

      await expect(service.del('key')).resolves.toBeUndefined();
    });

    it('debe no lanzar cuando el error no es instancia de Error', async () => {
      mockRedisClient.del.mockRejectedValue(42);

      await expect(service.del('key')).resolves.toBeUndefined();
    });
  });

  // ============================================
  // DEL BY PATTERN
  // ============================================

  describe('delByPattern', () => {
    it('debe eliminar claves que coincidan con el patron', async () => {
      // Simular scan con una iteracion: retorna cursor '0' (fin) y 2 claves
      mockRedisClient.scan.mockResolvedValue([
        '0',
        ['taskhub:products:1', 'taskhub:products:2'],
      ]);
      mockRedisClient.del.mockResolvedValue(2);

      const count = await service.delByPattern('products:*');

      expect(mockRedisClient.scan).toHaveBeenCalledWith(
        '0',
        'MATCH',
        'taskhub:products:*',
        'COUNT',
        100,
      );
      // Las claves deben tener el prefijo removido
      expect(mockRedisClient.del).toHaveBeenCalledWith(
        'products:1',
        'products:2',
      );
      expect(count).toBe(2);
    });

    it('debe manejar multiples iteraciones de SCAN', async () => {
      // Primera iteracion: cursor='5', segunda: cursor='0' (fin)
      mockRedisClient.scan
        .mockResolvedValueOnce(['5', ['taskhub:cats:1']])
        .mockResolvedValueOnce(['0', ['taskhub:cats:2']]);
      mockRedisClient.del.mockResolvedValue(1);

      const count = await service.delByPattern('cats:*');

      expect(mockRedisClient.scan).toHaveBeenCalledTimes(2);
      expect(mockRedisClient.del).toHaveBeenCalledTimes(2);
      expect(count).toBe(2);
    });

    it('debe retornar 0 cuando no hay claves que coincidan', async () => {
      mockRedisClient.scan.mockResolvedValue(['0', []]);

      const count = await service.delByPattern('nonexistent:*');

      expect(count).toBe(0);
      expect(mockRedisClient.del).not.toHaveBeenCalled();
    });

    it('debe retornar 0 cuando Redis falla', async () => {
      mockRedisClient.scan.mockRejectedValue(new Error('SCAN failed'));

      const count = await service.delByPattern('any:*');

      expect(count).toBe(0);
    });

    it('debe manejar claves sin prefijo taskhub:', async () => {
      mockRedisClient.scan.mockResolvedValue(['0', ['other:key']]);
      mockRedisClient.del.mockResolvedValue(1);

      const count = await service.delByPattern('other:*');

      // La clave no empieza con 'taskhub:', se pasa tal cual
      expect(mockRedisClient.del).toHaveBeenCalledWith('other:key');
      expect(count).toBe(1);
    });
  });

  // ============================================
  // EXISTS
  // ============================================

  describe('exists', () => {
    it('debe retornar true cuando la clave existe', async () => {
      mockRedisClient.exists.mockResolvedValue(1);

      const result = await service.exists('existing-key');

      expect(result).toBe(true);
      expect(mockRedisClient.exists).toHaveBeenCalledWith('existing-key');
    });

    it('debe retornar false cuando la clave no existe', async () => {
      mockRedisClient.exists.mockResolvedValue(0);

      const result = await service.exists('missing-key');

      expect(result).toBe(false);
    });

    it('debe retornar false cuando Redis falla', async () => {
      mockRedisClient.exists.mockRejectedValue(new Error('Connection refused'));

      const result = await service.exists('any-key');

      expect(result).toBe(false);
    });

    it('debe retornar false cuando el error no es instancia de Error', async () => {
      mockRedisClient.exists.mockRejectedValue('string error');

      const result = await service.exists('any-key');

      expect(result).toBe(false);
    });
  });

  // ============================================
  // TTL
  // ============================================

  describe('ttl', () => {
    it('debe retornar el TTL en segundos', async () => {
      mockRedisClient.ttl.mockResolvedValue(245);

      const result = await service.ttl('my-key');

      expect(result).toBe(245);
      expect(mockRedisClient.ttl).toHaveBeenCalledWith('my-key');
    });

    it('debe retornar -1 si la clave no tiene TTL', async () => {
      mockRedisClient.ttl.mockResolvedValue(-1);

      const result = await service.ttl('persistent-key');

      expect(result).toBe(-1);
    });

    it('debe retornar -2 si la clave no existe', async () => {
      mockRedisClient.ttl.mockResolvedValue(-2);

      const result = await service.ttl('missing-key');

      expect(result).toBe(-2);
    });

    it('debe retornar -2 cuando Redis falla', async () => {
      mockRedisClient.ttl.mockRejectedValue(new Error('Connection lost'));

      const result = await service.ttl('any-key');

      expect(result).toBe(-2);
    });
  });

  // ============================================
  // GET OR SET (cache-aside)
  // ============================================

  describe('getOrSet', () => {
    it('debe retornar valor del cache si existe (cache hit)', async () => {
      const cached = { id: 1, name: 'cached' };
      mockRedisClient.get.mockResolvedValue(JSON.stringify(cached));
      const factory = jest.fn();

      const result = await service.getOrSet('hit-key', factory, 600);

      expect(result).toEqual(cached);
      expect(factory).not.toHaveBeenCalled();
      expect(mockRedisClient.set).not.toHaveBeenCalled();
    });

    it('debe ejecutar factory y guardar en cache si no existe (cache miss)', async () => {
      mockRedisClient.get.mockResolvedValue(null);
      mockRedisClient.set.mockResolvedValue('OK');
      const freshData = { id: 2, name: 'fresh' };
      const factory = jest.fn().mockResolvedValue(freshData);

      const result = await service.getOrSet('miss-key', factory, 120);

      expect(factory).toHaveBeenCalledTimes(1);
      expect(mockRedisClient.set).toHaveBeenCalledWith(
        'miss-key',
        JSON.stringify(freshData),
        'EX',
        120,
      );
      expect(result).toEqual(freshData);
    });

    it('debe usar TTL por defecto (300s) cuando no se especifica', async () => {
      mockRedisClient.get.mockResolvedValue(null);
      mockRedisClient.set.mockResolvedValue('OK');
      const factory = jest.fn().mockResolvedValue('data');

      await service.getOrSet('key', factory);

      expect(mockRedisClient.set).toHaveBeenCalledWith(
        'key',
        JSON.stringify('data'),
        'EX',
        300,
      );
    });

    it('debe propagar error de la factory', async () => {
      mockRedisClient.get.mockResolvedValue(null);
      const factory = jest.fn().mockRejectedValue(new Error('DB down'));

      await expect(service.getOrSet('key', factory)).rejects.toThrow('DB down');
    });

    it('debe ejecutar factory si Redis falla al leer (resiliente)', async () => {
      // get falla → retorna null, entonces ejecuta factory
      mockRedisClient.get.mockRejectedValue(new Error('Redis down'));
      mockRedisClient.set.mockResolvedValue('OK');
      const factory = jest.fn().mockResolvedValue('fallback');

      const result = await service.getOrSet('key', factory);

      expect(result).toBe('fallback');
      expect(factory).toHaveBeenCalledTimes(1);
    });
  });

  // ============================================
  // INVALIDATE BY PREFIX
  // ============================================

  describe('invalidateByPrefix', () => {
    it('debe delegar a delByPattern con asterisco', async () => {
      mockRedisClient.scan.mockResolvedValue(['0', []]);

      const count = await service.invalidateByPrefix('products:');

      // delByPattern recibe 'products:*'
      expect(mockRedisClient.scan).toHaveBeenCalledWith(
        '0',
        'MATCH',
        'taskhub:products:*',
        'COUNT',
        100,
      );
      expect(count).toBe(0);
    });

    it('debe retornar la cantidad de claves eliminadas', async () => {
      mockRedisClient.scan.mockResolvedValue([
        '0',
        ['taskhub:stores:a', 'taskhub:stores:b', 'taskhub:stores:c'],
      ]);
      mockRedisClient.del.mockResolvedValue(3);

      const count = await service.invalidateByPrefix('stores:');

      expect(count).toBe(3);
    });
  });

  // ============================================
  // STATIC KEYS
  // ============================================

  describe('static keys', () => {
    it('debe generar clave de tarea', () => {
      expect(CacheService.keys.task('abc')).toBe('tasks:abc');
    });

    it('debe generar clave de lista de tareas', () => {
      expect(CacheService.keys.taskList('hash123')).toBe('tasks:list:hash123');
    });

    it('debe generar clave de proyecto', () => {
      expect(CacheService.keys.project('proj-1')).toBe('projects:proj-1');
    });

    it('debe generar clave de lista de proyectos', () => {
      expect(CacheService.keys.projectList('hash456')).toBe(
        'projects:list:hash456',
      );
    });

    it('debe generar clave de organizacion', () => {
      expect(CacheService.keys.organization('org-1')).toBe(
        'organizations:org-1',
      );
    });

    it('debe generar clave de usuario', () => {
      expect(CacheService.keys.user('user-1')).toBe('users:user-1');
    });

    it('debe generar clave de feature flag', () => {
      expect(CacheService.keys.featureFlag('dark-mode')).toBe(
        'flags:dark-mode',
      );
    });

    it('debe generar clave de estado de tarea', () => {
      expect(CacheService.keys.taskStatus('proj-1')).toBe('statuses:proj-1');
    });

    it('debe generar clave de notificacion', () => {
      expect(CacheService.keys.notification('user-1')).toBe(
        'notifications:user-1',
      );
    });
  });

  // ============================================
  // GET STATS
  // ============================================

  describe('getStats', () => {
    const mockInfoResponse = [
      '# Server',
      'uptime_in_seconds:86400',
      '',
      '# Memory',
      'used_memory_human:2.5M',
      '',
      '# Stats',
      'keyspace_hits:1000',
      'keyspace_misses:250',
      '',
      '# Keyspace',
      'db0:keys=150,expires=50,avg_ttl=300000',
    ].join('\r\n');

    it('debe retornar estadisticas completas de Redis', async () => {
      mockRedisClient.info.mockResolvedValue(mockInfoResponse);

      const stats = await service.getStats();

      expect(stats).toEqual({
        keys: 150,
        memory: '2.5M',
        uptime: 86400,
        hitRate: '80.00%',
      });
    });

    it('debe retornar valores por defecto cuando no hay informacion', async () => {
      mockRedisClient.info.mockResolvedValue('');

      const stats = await service.getStats();

      expect(stats).toEqual({
        keys: 0,
        memory: '0B',
        uptime: 0,
        hitRate: '0.00%',
      });
    });

    it('debe retornar hit rate 0.00% cuando no hay hits ni misses', async () => {
      const infoNoStats = [
        'uptime_in_seconds:100',
        'used_memory_human:1M',
        'keyspace_hits:0',
        'keyspace_misses:0',
      ].join('\r\n');
      mockRedisClient.info.mockResolvedValue(infoNoStats);

      const stats = await service.getStats();

      expect(stats.hitRate).toBe('0.00%');
    });

    it('debe retornar valores por defecto cuando Redis falla', async () => {
      mockRedisClient.info.mockRejectedValue(new Error('Connection refused'));

      const stats = await service.getStats();

      expect(stats).toEqual({
        keys: 0,
        memory: '0B',
        uptime: 0,
        hitRate: '0.00%',
      });
    });

    it('debe calcular hit rate correctamente con solo hits', async () => {
      const infoHitsOnly = [
        'uptime_in_seconds:50',
        'used_memory_human:500K',
        'keyspace_hits:200',
        'keyspace_misses:0',
        'db0:keys=10,expires=5,avg_ttl=60000',
      ].join('\r\n');
      mockRedisClient.info.mockResolvedValue(infoHitsOnly);

      const stats = await service.getStats();

      expect(stats.hitRate).toBe('100.00%');
      expect(stats.keys).toBe(10);
    });
  });

  // ============================================
  // LIST KEYS
  // ============================================

  describe('listKeys', () => {
    it('debe retornar claves que coincidan con el patron', async () => {
      mockRedisClient.scan.mockResolvedValue([
        '0',
        ['taskhub:products:1', 'taskhub:products:2'],
      ]);

      const keys = await service.listKeys('products:*');

      expect(keys).toEqual(['products:1', 'products:2']);
      expect(mockRedisClient.scan).toHaveBeenCalledWith(
        '0',
        'MATCH',
        'taskhub:products:*',
        'COUNT',
        100,
      );
    });

    it('debe respetar el limite maximo de claves', async () => {
      // Retorna 3 claves pero limite es 2
      mockRedisClient.scan.mockResolvedValue([
        '5',
        ['taskhub:items:1', 'taskhub:items:2', 'taskhub:items:3'],
      ]);

      const keys = await service.listKeys('items:*', 2);

      expect(keys).toHaveLength(2);
    });

    it('debe retornar lista vacia cuando no hay coincidencias', async () => {
      mockRedisClient.scan.mockResolvedValue(['0', []]);

      const keys = await service.listKeys('nonexistent:*');

      expect(keys).toEqual([]);
    });

    it('debe manejar multiples iteraciones de SCAN', async () => {
      mockRedisClient.scan
        .mockResolvedValueOnce(['5', ['taskhub:k:1']])
        .mockResolvedValueOnce(['0', ['taskhub:k:2']]);

      const keys = await service.listKeys('k:*');

      expect(keys).toHaveLength(2);
      expect(mockRedisClient.scan).toHaveBeenCalledTimes(2);
    });

    it('debe retornar lista vacia cuando Redis falla', async () => {
      mockRedisClient.scan.mockRejectedValue(new Error('SCAN error'));

      const keys = await service.listKeys('any:*');

      expect(keys).toEqual([]);
    });

    it('debe usar limite por defecto de 100', async () => {
      const manyKeys = Array.from({ length: 100 }, (_, i) => `taskhub:x:${i}`);
      mockRedisClient.scan.mockResolvedValue(['0', manyKeys]);

      const keys = await service.listKeys('x:*');

      expect(keys).toHaveLength(100);
    });

    it('debe manejar claves sin prefijo taskhub:', async () => {
      mockRedisClient.scan.mockResolvedValue(['0', ['raw:key']]);

      const keys = await service.listKeys('raw:*');

      expect(keys).toEqual(['raw:key']);
    });
  });

  // ============================================
  // FLUSH ALL
  // ============================================

  describe('flushAll', () => {
    it('debe vaciar el cache en entorno de desarrollo', async () => {
      mockRedisClient.flushdb.mockResolvedValue('OK');

      await expect(service.flushAll()).resolves.toBeUndefined();

      expect(mockRedisClient.flushdb).toHaveBeenCalled();
    });

    it('debe lanzar InternalServerErrorException en produccion', async () => {
      // Reconfigurar el mock de configService para produccion
      jest
        .spyOn(configService, 'get')
        .mockImplementation((key: string, defaultValue?: string | number) => {
          if (key === 'NODE_ENV') return 'production';
          return (mockConfigValues[key] ?? defaultValue) as any;
        });

      await expect(service.flushAll()).rejects.toThrow(
        InternalServerErrorException,
      );
      await expect(service.flushAll()).rejects.toThrow(
        'No se permite flush del cache en produccion',
      );
      expect(mockRedisClient.flushdb).not.toHaveBeenCalled();
    });

    it('debe no lanzar error cuando flushdb falla en dev', async () => {
      mockRedisClient.flushdb.mockRejectedValue(new Error('flushdb error'));

      await expect(service.flushAll()).resolves.toBeUndefined();
    });

    it('debe permitir flush en entorno de test', async () => {
      jest
        .spyOn(configService, 'get')
        .mockImplementation((key: string, defaultValue?: string | number) => {
          if (key === 'NODE_ENV') return 'test';
          return (mockConfigValues[key] ?? defaultValue) as any;
        });

      mockRedisClient.flushdb.mockResolvedValue('OK');

      await expect(service.flushAll()).resolves.toBeUndefined();
      expect(mockRedisClient.flushdb).toHaveBeenCalled();
    });
  });

  // ============================================
  // IS HEALTHY
  // ============================================

  describe('isHealthy', () => {
    it('debe retornar true cuando Redis responde PONG', async () => {
      mockRedisClient.ping.mockResolvedValue('PONG');

      const result = await service.isHealthy();

      expect(result).toBe(true);
    });

    it('debe retornar false cuando Redis responde algo diferente a PONG', async () => {
      mockRedisClient.ping.mockResolvedValue('LOADING');

      const result = await service.isHealthy();

      expect(result).toBe(false);
    });

    it('debe retornar false cuando Redis esta caido', async () => {
      mockRedisClient.ping.mockRejectedValue(new Error('Connection refused'));

      const result = await service.isHealthy();

      expect(result).toBe(false);
    });

    it('debe retornar false cuando el error no es instancia de Error', async () => {
      mockRedisClient.ping.mockRejectedValue('timeout');

      const result = await service.isHealthy();

      expect(result).toBe(false);
    });
  });

  // ============================================
  // ON MODULE DESTROY
  // ============================================

  describe('onModuleDestroy', () => {
    it('debe cerrar la conexion con Redis', async () => {
      mockRedisClient.quit.mockResolvedValue('OK');

      await service.onModuleDestroy();

      expect(mockRedisClient.quit).toHaveBeenCalled();
    });

    it('debe no lanzar error cuando quit falla', async () => {
      mockRedisClient.quit.mockRejectedValue(new Error('Already closed'));

      await expect(service.onModuleDestroy()).resolves.toBeUndefined();
    });
  });
});
