import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SecurityConfigService } from './security-config.service';
import { SecurityConfig } from '../entities/security-config.entity';

describe('SecurityConfigService', () => {
  let service: SecurityConfigService;
  let securityConfigRepository: jest.Mocked<Repository<SecurityConfig>>;

  const mockAdminId = '123e4567-e89b-12d3-a456-426614174000';

  const mockConfig: SecurityConfig = {
    id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    key: 'rate_limit_login',
    value: '5',
    valueType: 'number' as const,
    description: 'Intentos de login permitidos por minuto por IP',
    category: 'rate_limiting',
    updatedAt: new Date('2026-03-28T10:00:00Z'),
    updatedById: null,
    updatedBy: null,
    getParsedValue: jest.fn().mockReturnValue(5),
  } as unknown as SecurityConfig;

  const mockBooleanConfig: SecurityConfig = {
    ...mockConfig,
    id: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
    key: 'require_email_verification',
    value: 'true',
    valueType: 'boolean' as const,
    description: 'Requerir verificacion de email',
    category: 'verification',
  } as unknown as SecurityConfig;

  const mockJsonConfig: SecurityConfig = {
    ...mockConfig,
    id: 'c3d4e5f6-a7b8-9012-cdef-123456789012',
    key: 'allowed_cors_origins',
    value: '["http://localhost:3000"]',
    valueType: 'json' as const,
    description: 'Origenes CORS permitidos',
    category: 'cors',
  } as unknown as SecurityConfig;

  beforeEach(async () => {
    const mockSecurityConfigRepository = {
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SecurityConfigService,
        {
          provide: getRepositoryToken(SecurityConfig),
          useValue: mockSecurityConfigRepository,
        },
      ],
    }).compile();

    service = module.get<SecurityConfigService>(SecurityConfigService);
    securityConfigRepository = module.get(getRepositoryToken(SecurityConfig));
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  describe('onModuleInit', () => {
    it('debe ejecutar seedDefaultConfigs y refreshCache al inicializar', async () => {
      // seedDefaultConfigs: each default config checks if exists
      securityConfigRepository.findOne.mockResolvedValue(null);
      securityConfigRepository.create.mockReturnValue(mockConfig as any);
      securityConfigRepository.save.mockResolvedValue(mockConfig as any);
      // refreshCache
      securityConfigRepository.find.mockResolvedValue([mockConfig as any]);

      await service.onModuleInit();

      // Should have called findOne for each default config to check existence
      expect(securityConfigRepository.findOne).toHaveBeenCalled();
      // Should have called find for refreshCache
      expect(securityConfigRepository.find).toHaveBeenCalled();
    });

    it('no debe crear configs que ya existen', async () => {
      // All configs already exist
      securityConfigRepository.findOne.mockResolvedValue(mockConfig as any);
      securityConfigRepository.find.mockResolvedValue([mockConfig as any]);

      await service.onModuleInit();

      // save should only have been called as part of seed for new configs (none in this case)
      // but create should not have been called at all
      expect(securityConfigRepository.create).not.toHaveBeenCalled();
    });
  });

  describe('refreshCache', () => {
    it('debe cargar configuraciones en el cache', async () => {
      securityConfigRepository.find.mockResolvedValue([
        mockConfig as any,
        mockBooleanConfig as any,
      ]);

      await service.refreshCache();

      // Verify cache works by calling getValue
      const result = await service.getValue('rate_limit_login', '0');
      expect(result).toBe('5');
    });

    it('debe limpiar cache anterior al refrescar', async () => {
      // First load
      securityConfigRepository.find.mockResolvedValueOnce([mockConfig as any]);
      await service.refreshCache();

      // Second load with different data
      const newConfig = {
        ...mockConfig,
        key: 'new_key',
        value: 'new_value',
      };
      securityConfigRepository.find.mockResolvedValueOnce([newConfig as any]);
      await service.refreshCache();

      // Old config should not be in cache
      securityConfigRepository.findOne.mockResolvedValue(null);
      const result = await service.getValue('rate_limit_login', 'default');
      expect(result).toBe('default');
    });
  });

  describe('getValue', () => {
    it('debe retornar valor desde cache si existe', async () => {
      securityConfigRepository.find.mockResolvedValue([mockConfig as any]);
      await service.refreshCache();

      const result = await service.getValue('rate_limit_login', '0');

      expect(result).toBe('5');
    });

    it('debe buscar en BD si no esta en cache', async () => {
      // Empty cache
      securityConfigRepository.find.mockResolvedValue([]);
      await service.refreshCache();

      // DB lookup
      securityConfigRepository.findOne.mockResolvedValue(mockConfig as any);

      const result = await service.getValue('rate_limit_login', '0');

      expect(securityConfigRepository.findOne).toHaveBeenCalledWith({
        where: { key: 'rate_limit_login' },
      });
      expect(result).toBe('5');
    });

    it('debe retornar defaultValue si no existe en cache ni BD', async () => {
      securityConfigRepository.find.mockResolvedValue([]);
      await service.refreshCache();
      securityConfigRepository.findOne.mockResolvedValue(null);

      const result = await service.getValue('non_existent_key', 'fallback');

      expect(result).toBe('fallback');
    });

    it('debe retornar string vacio como defaultValue si no se proporciona', async () => {
      securityConfigRepository.find.mockResolvedValue([]);
      await service.refreshCache();
      securityConfigRepository.findOne.mockResolvedValue(null);

      const result = await service.getValue('non_existent_key');

      expect(result).toBe('');
    });

    it('debe actualizar cache cuando encuentra en BD', async () => {
      securityConfigRepository.find.mockResolvedValue([]);
      await service.refreshCache();
      securityConfigRepository.findOne.mockResolvedValue(mockConfig as any);

      // First call fetches from DB
      await service.getValue('rate_limit_login', '0');

      // Second call should use cache (findOne shouldn't be called again for same key)
      const result = await service.getValue('rate_limit_login', '0');

      expect(result).toBe('5');
    });
  });

  describe('getNumberValue', () => {
    beforeEach(async () => {
      securityConfigRepository.find.mockResolvedValue([mockConfig as any]);
      await service.refreshCache();
    });

    it('debe retornar valor numerico', async () => {
      const result = await service.getNumberValue('rate_limit_login', 0);

      expect(result).toBe(5);
    });

    it('debe retornar defaultValue si el valor no es numerico', async () => {
      const stringConfig = { ...mockConfig, key: 'bad_number', value: 'abc' };
      securityConfigRepository.find.mockResolvedValue([stringConfig as any]);
      await service.refreshCache();

      const result = await service.getNumberValue('bad_number', 42);

      expect(result).toBe(42);
    });

    it('debe retornar 0 como defaultValue si no se especifica', async () => {
      securityConfigRepository.find.mockResolvedValue([]);
      await service.refreshCache();
      securityConfigRepository.findOne.mockResolvedValue(null);

      const result = await service.getNumberValue('non_existent');

      expect(result).toBe(0);
    });

    it('debe manejar valores decimales', async () => {
      const decimalConfig = {
        ...mockConfig,
        key: 'decimal_value',
        value: '3.14',
      };
      securityConfigRepository.find.mockResolvedValue([decimalConfig as any]);
      await service.refreshCache();

      const result = await service.getNumberValue('decimal_value', 0);

      expect(result).toBeCloseTo(3.14);
    });
  });

  describe('getBooleanValue', () => {
    it('debe retornar true para valor "true"', async () => {
      securityConfigRepository.find.mockResolvedValue([
        mockBooleanConfig as any,
      ]);
      await service.refreshCache();

      const result = await service.getBooleanValue(
        'require_email_verification',
        false,
      );

      expect(result).toBe(true);
    });

    it('debe retornar false para cualquier valor que no sea "true"', async () => {
      const falseConfig = {
        ...mockBooleanConfig,
        key: 'some_flag',
        value: 'false',
      };
      securityConfigRepository.find.mockResolvedValue([falseConfig as any]);
      await service.refreshCache();

      const result = await service.getBooleanValue('some_flag', true);

      expect(result).toBe(false);
    });

    it('debe retornar false para valor "yes"', async () => {
      const yesConfig = {
        ...mockBooleanConfig,
        key: 'yes_flag',
        value: 'yes',
      };
      securityConfigRepository.find.mockResolvedValue([yesConfig as any]);
      await service.refreshCache();

      const result = await service.getBooleanValue('yes_flag', true);

      expect(result).toBe(false);
    });

    it('debe retornar defaultValue false si no existe', async () => {
      securityConfigRepository.find.mockResolvedValue([]);
      await service.refreshCache();
      securityConfigRepository.findOne.mockResolvedValue(null);

      const result = await service.getBooleanValue('missing_key');

      expect(result).toBe(false);
    });
  });

  describe('getJsonValue', () => {
    it('debe parsear y retornar valor JSON', async () => {
      securityConfigRepository.find.mockResolvedValue([mockJsonConfig as any]);
      await service.refreshCache();

      const result = await service.getJsonValue<string[]>(
        'allowed_cors_origins',
        [],
      );

      expect(result).toEqual(['http://localhost:3000']);
    });

    it('debe retornar defaultValue si el JSON es invalido', async () => {
      const badJsonConfig = {
        ...mockJsonConfig,
        key: 'bad_json',
        value: '{invalid json',
      };
      securityConfigRepository.find.mockResolvedValue([badJsonConfig as any]);
      await service.refreshCache();

      const result = await service.getJsonValue<string[]>('bad_json', [
        'fallback',
      ]);

      expect(result).toEqual(['fallback']);
    });

    it('debe retornar defaultValue si el valor esta vacio', async () => {
      const emptyConfig = {
        ...mockJsonConfig,
        key: 'empty_json',
        value: '',
      };
      securityConfigRepository.find.mockResolvedValue([emptyConfig as any]);
      await service.refreshCache();

      const result = await service.getJsonValue<Record<string, number>>(
        'empty_json',
        { default: 1 },
      );

      expect(result).toEqual({ default: 1 });
    });

    it('debe retornar defaultValue si la clave no existe', async () => {
      securityConfigRepository.find.mockResolvedValue([]);
      await service.refreshCache();
      securityConfigRepository.findOne.mockResolvedValue(null);

      const result = await service.getJsonValue<number[]>('missing', [1, 2, 3]);

      expect(result).toEqual([1, 2, 3]);
    });
  });

  describe('updateValue', () => {
    it('debe actualizar valor existente', async () => {
      const updatedConfig = { ...mockConfig, value: '10' };
      securityConfigRepository.findOne.mockResolvedValue({
        ...mockConfig,
      } as any);
      securityConfigRepository.save.mockResolvedValue(updatedConfig as any);

      const result = await service.updateValue(
        'rate_limit_login',
        '10',
        mockAdminId,
      );

      expect(securityConfigRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          value: '10',
          updatedById: mockAdminId,
        }),
      );
      expect(result!.value).toBe('10');
    });

    it('debe retornar null si la clave no existe', async () => {
      securityConfigRepository.findOne.mockResolvedValue(null);

      const result = await service.updateValue('non_existent', 'value');

      expect(result).toBeNull();
      expect(securityConfigRepository.save).not.toHaveBeenCalled();
    });

    it('debe aceptar updatedById undefined y asignar null', async () => {
      securityConfigRepository.findOne.mockResolvedValue({
        ...mockConfig,
      } as any);
      securityConfigRepository.save.mockResolvedValue(mockConfig as any);

      await service.updateValue('rate_limit_login', '10');

      expect(securityConfigRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ updatedById: null }),
      );
    });

    it('debe actualizar el cache despues de guardar', async () => {
      const updatedConfig = { ...mockConfig, value: '20' };
      securityConfigRepository.findOne.mockResolvedValue({
        ...mockConfig,
      } as any);
      securityConfigRepository.save.mockResolvedValue(updatedConfig as any);

      await service.updateValue('rate_limit_login', '20', mockAdminId);

      // Verify cache was updated
      const cachedValue = await service.getValue('rate_limit_login', '0');
      expect(cachedValue).toBe('20');
    });

    it('debe establecer updatedAt con la fecha actual', async () => {
      securityConfigRepository.findOne.mockResolvedValue({
        ...mockConfig,
      } as any);
      securityConfigRepository.save.mockImplementation(
        async (entity) => entity as any,
      );

      await service.updateValue('rate_limit_login', '10', mockAdminId);

      expect(securityConfigRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          updatedAt: expect.any(Date),
        }),
      );
    });
  });

  describe('findAll', () => {
    it('debe retornar todas las configuraciones ordenadas', async () => {
      securityConfigRepository.find.mockResolvedValue([
        mockConfig as any,
        mockBooleanConfig as any,
      ]);

      const result = await service.findAll();

      expect(securityConfigRepository.find).toHaveBeenCalledWith({
        relations: ['updatedBy'],
        order: { category: 'ASC', key: 'ASC' },
      });
      expect(result).toHaveLength(2);
    });

    it('debe retornar array vacio si no hay configuraciones', async () => {
      securityConfigRepository.find.mockResolvedValue([]);

      const result = await service.findAll();

      expect(result).toEqual([]);
    });
  });

  describe('findByCategory', () => {
    it('debe retornar configuraciones de una categoria', async () => {
      securityConfigRepository.find.mockResolvedValue([mockConfig as any]);

      const result = await service.findByCategory('rate_limiting');

      expect(securityConfigRepository.find).toHaveBeenCalledWith({
        where: { category: 'rate_limiting' },
        relations: ['updatedBy'],
        order: { key: 'ASC' },
      });
      expect(result).toEqual([mockConfig]);
    });

    it('debe retornar array vacio si la categoria no existe', async () => {
      securityConfigRepository.find.mockResolvedValue([]);

      const result = await service.findByCategory('non_existent');

      expect(result).toEqual([]);
    });
  });

  describe('create', () => {
    it('debe crear una nueva configuracion', async () => {
      securityConfigRepository.create.mockReturnValue(mockConfig as any);
      securityConfigRepository.save.mockResolvedValue(mockConfig as any);

      const result = await service.create(
        'new_config_key',
        '100',
        'number',
        'Nueva configuracion',
        'general',
        mockAdminId,
      );

      expect(securityConfigRepository.create).toHaveBeenCalledWith({
        key: 'new_config_key',
        value: '100',
        valueType: 'number',
        description: 'Nueva configuracion',
        category: 'general',
        updatedById: mockAdminId,
      });
      expect(result).toEqual(mockConfig);
    });

    it('debe funcionar sin createdById', async () => {
      securityConfigRepository.create.mockReturnValue(mockConfig as any);
      securityConfigRepository.save.mockResolvedValue(mockConfig as any);

      await service.create('key', 'value', 'string', 'Description', 'general');

      expect(securityConfigRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ updatedById: undefined }),
      );
    });

    it('debe actualizar el cache despues de crear', async () => {
      const newConfig = {
        ...mockConfig,
        key: 'brand_new',
        value: 'test_value',
      };
      securityConfigRepository.create.mockReturnValue(newConfig as any);
      securityConfigRepository.save.mockResolvedValue(newConfig as any);

      await service.create(
        'brand_new',
        'test_value',
        'string',
        'Brand new config',
        'testing',
      );

      // Verify cache was updated
      const cachedValue = await service.getValue('brand_new', 'default');
      expect(cachedValue).toBe('test_value');
    });

    it('debe aceptar todos los tipos de valor', async () => {
      securityConfigRepository.create.mockReturnValue(mockConfig as any);
      securityConfigRepository.save.mockResolvedValue(mockConfig as any);

      const types: Array<'string' | 'number' | 'boolean' | 'json'> = [
        'string',
        'number',
        'boolean',
        'json',
      ];

      for (const type of types) {
        await service.create('key', 'value', type, 'desc', 'cat');
        expect(securityConfigRepository.create).toHaveBeenCalledWith(
          expect.objectContaining({ valueType: type }),
        );
      }
    });
  });
});
