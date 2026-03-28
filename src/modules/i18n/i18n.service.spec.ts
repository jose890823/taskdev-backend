import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { Repository } from 'typeorm';
import { I18nService } from './i18n.service';
import {
  Translation,
  TranslationLocale,
  TranslationModule,
} from './entities/translation.entity';
import { CreateTranslationDto } from './dto/create-translation.dto';
import { UpdateTranslationDto } from './dto/update-translation.dto';
import { TranslationFilterDto } from './dto/translation-filter.dto';

// Mock seed translations to avoid loading the full seed file
jest.mock('./data/seed-translations', () => ({
  SEED_TRANSLATIONS: [
    {
      key: 'errors.not_found',
      locale: 'es',
      value: 'Recurso no encontrado',
      module: 'errors',
      context: 'Error generico',
    },
    {
      key: 'errors.not_found',
      locale: 'en',
      value: 'Resource not found',
      module: 'errors',
      context: 'Generic error',
    },
  ],
}));

describe('I18nService', () => {
  let service: I18nService;
  let translationRepository: jest.Mocked<Repository<Translation>>;

  // ── Mock data ──────────────────────────────────────────────

  const mockTranslationId = '123e4567-e89b-12d3-a456-426614174000';
  const mockTranslationId2 = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

  const createMockTranslation = (
    overrides: Partial<Translation> = {},
  ): Translation => {
    return {
      id: mockTranslationId,
      systemCode: 'TRN-260207-A3K7',
      key: 'errors.user_not_found',
      locale: TranslationLocale.ES,
      value: 'Usuario no encontrado',
      module: TranslationModule.ERRORS,
      context: null,
      isSystem: false,
      createdAt: new Date('2026-01-01'),
      updatedAt: new Date('2026-01-01'),
      generateSystemCode: jest.fn(),
      ...overrides,
    } as unknown as Translation;
  };

  // ── QueryBuilder helper ────────────────────────────────────

  const createMockQueryBuilder = (overrides: Record<string, any> = {}) => {
    const qb: Record<string, jest.Mock> = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
      getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      getCount: jest.fn().mockResolvedValue(0),
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([]),
      getRawOne: jest.fn().mockResolvedValue(null),
      delete: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue({ affected: 0 }),
      limit: jest.fn().mockReturnThis(),
      ...overrides,
    };
    for (const key of Object.keys(qb)) {
      if (
        !overrides[key] &&
        ![
          'getMany',
          'getManyAndCount',
          'getCount',
          'getRawMany',
          'getRawOne',
          'execute',
        ].includes(key)
      ) {
        qb[key] = jest.fn().mockReturnValue(qb);
      }
    }
    if (overrides.getMany) qb.getMany = overrides.getMany;
    if (overrides.getManyAndCount)
      qb.getManyAndCount = overrides.getManyAndCount;
    if (overrides.getCount) qb.getCount = overrides.getCount;
    if (overrides.getRawMany) qb.getRawMany = overrides.getRawMany;
    if (overrides.getRawOne) qb.getRawOne = overrides.getRawOne;
    if (overrides.execute) qb.execute = overrides.execute;
    return qb;
  };

  // ── Test module setup ──────────────────────────────────────

  beforeEach(async () => {
    const mockTranslationRepository = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn(),
      create: jest.fn().mockImplementation((dto) => ({ ...dto })),
      save: jest.fn().mockImplementation(async (entity) => entity),
      remove: jest.fn().mockResolvedValue(undefined),
      createQueryBuilder: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        I18nService,
        {
          provide: getRepositoryToken(Translation),
          useValue: mockTranslationRepository,
        },
      ],
    }).compile();

    service = module.get<I18nService>(I18nService);
    translationRepository = module.get(getRepositoryToken(Translation));
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ================================================================
  // onModuleInit
  // ================================================================

  describe('onModuleInit', () => {
    it('should seed default translations and load cache on init', async () => {
      // seedDefaultTranslations will call findOne for each seed item
      translationRepository.findOne.mockResolvedValue(null);
      translationRepository.create.mockImplementation(
        (dto) => dto as Translation,
      );
      translationRepository.save.mockImplementation(
        async (entity) => entity as Translation,
      );
      // loadTranslations will call find
      translationRepository.find.mockResolvedValue([]);

      await service.onModuleInit();

      // 2 seed translations → 2 findOne + 2 create + 2 save
      expect(translationRepository.findOne).toHaveBeenCalledTimes(2);
      expect(translationRepository.save).toHaveBeenCalledTimes(2);
      // find called once for loadTranslations
      expect(translationRepository.find).toHaveBeenCalledTimes(1);
    });

    it('should skip already existing seed translations', async () => {
      const existingTranslation = createMockTranslation({
        isSystem: false,
        key: 'errors.not_found',
        locale: TranslationLocale.ES,
      });

      translationRepository.findOne.mockResolvedValue(existingTranslation);
      translationRepository.find.mockResolvedValue([]);

      await service.onModuleInit();

      // findOne called for each seed, but create NOT called (existing + not isSystem)
      expect(translationRepository.findOne).toHaveBeenCalledTimes(2);
      // save not called for non-system existing translations during seed
      // (save is only called for system translations being updated)
      expect(translationRepository.create).not.toHaveBeenCalled();
    });

    it('should update value of existing system translations during seed', async () => {
      const existingSystemTranslation = createMockTranslation({
        isSystem: true,
        key: 'errors.not_found',
        locale: TranslationLocale.ES,
        value: 'Old value',
      });

      translationRepository.findOne.mockResolvedValue(
        existingSystemTranslation,
      );
      translationRepository.save.mockImplementation(
        async (entity) => entity as Translation,
      );
      translationRepository.find.mockResolvedValue([]);

      await service.onModuleInit();

      // save called for system translations being updated
      expect(translationRepository.save).toHaveBeenCalled();
    });

    it('should handle duplicate key errors during seed gracefully', async () => {
      translationRepository.findOne.mockResolvedValue(null);
      translationRepository.create.mockImplementation(
        (dto) => dto as Translation,
      );

      const duplicateError = new Error('duplicate key value');
      translationRepository.save.mockRejectedValue(duplicateError);
      translationRepository.find.mockResolvedValue([]);

      // Should not throw
      await expect(service.onModuleInit()).resolves.not.toThrow();
    });
  });

  // ================================================================
  // TRANSLATE (t)
  // ================================================================

  describe('t', () => {
    beforeEach(async () => {
      // Load some translations into cache
      const translations = [
        createMockTranslation({
          key: 'greeting',
          locale: TranslationLocale.ES,
          value: 'Hola {{name}}',
        }),
        createMockTranslation({
          key: 'greeting',
          locale: TranslationLocale.EN,
          value: 'Hello {{name}}',
        }),
        createMockTranslation({
          key: 'only_es',
          locale: TranslationLocale.ES,
          value: 'Solo en espanol',
        }),
        createMockTranslation({
          key: 'counter',
          locale: TranslationLocale.ES,
          value: 'Tienes {{count}} mensajes',
        }),
      ];
      translationRepository.find.mockResolvedValue(translations);
      await service.loadTranslations();
    });

    it('should return translated value for existing key and locale', () => {
      const result = service.t('greeting', 'es');
      expect(result).toBe('Hola {{name}}');
    });

    it('should return english translation when locale is en', () => {
      const result = service.t('greeting', 'en');
      expect(result).toBe('Hello {{name}}');
    });

    it('should fallback to Spanish when key not found in requested locale', () => {
      const result = service.t('only_es', 'en');
      expect(result).toBe('Solo en espanol');
    });

    it('should return the key itself when not found in any locale', () => {
      const result = service.t('nonexistent.key', 'es');
      expect(result).toBe('nonexistent.key');
    });

    it('should interpolate parameters in the translation', () => {
      const result = service.t('greeting', 'es', { name: 'Carlos' });
      expect(result).toBe('Hola Carlos');
    });

    it('should interpolate numeric parameters', () => {
      const result = service.t('counter', 'es', { count: 5 });
      expect(result).toBe('Tienes 5 mensajes');
    });

    it('should handle multiple occurrences of the same parameter', async () => {
      const translations = [
        createMockTranslation({
          key: 'repeat',
          locale: TranslationLocale.ES,
          value: '{{name}} dice hola, {{name}} saluda',
        }),
      ];
      translationRepository.find.mockResolvedValue(translations);
      await service.loadTranslations();

      const result = service.t('repeat', 'es', { name: 'Ana' });
      expect(result).toBe('Ana dice hola, Ana saluda');
    });

    it('should default to es locale when no locale is provided', () => {
      const result = service.t('greeting');
      expect(result).toBe('Hola {{name}}');
    });

    it('should return value without modification when no params provided', () => {
      const result = service.t('greeting', 'es');
      expect(result).toBe('Hola {{name}}');
    });
  });

  // ================================================================
  // CACHE
  // ================================================================

  describe('loadTranslations', () => {
    it('should load all translations into the cache', async () => {
      const translations = [
        createMockTranslation({
          key: 'key1',
          locale: TranslationLocale.ES,
          value: 'valor1',
        }),
        createMockTranslation({
          key: 'key2',
          locale: TranslationLocale.EN,
          value: 'value2',
        }),
      ];
      translationRepository.find.mockResolvedValue(translations);

      await service.loadTranslations();

      expect(service.t('key1', 'es')).toBe('valor1');
      expect(service.t('key2', 'en')).toBe('value2');
    });

    it('should clear previous cache before loading', async () => {
      // First load
      translationRepository.find.mockResolvedValue([
        createMockTranslation({
          key: 'old_key',
          locale: TranslationLocale.ES,
          value: 'old_value',
        }),
      ]);
      await service.loadTranslations();
      expect(service.t('old_key', 'es')).toBe('old_value');

      // Second load without old_key
      translationRepository.find.mockResolvedValue([]);
      await service.loadTranslations();
      expect(service.t('old_key', 'es')).toBe('old_key'); // returns key as fallback
    });
  });

  describe('reloadCache', () => {
    it('should reload translations from DB', async () => {
      translationRepository.find.mockResolvedValue([
        createMockTranslation({
          key: 'reloaded',
          locale: TranslationLocale.ES,
          value: 'valor recargado',
        }),
      ]);

      await service.reloadCache();

      expect(translationRepository.find).toHaveBeenCalled();
      expect(service.t('reloaded', 'es')).toBe('valor recargado');
    });
  });

  // ================================================================
  // PUBLIC QUERIES
  // ================================================================

  describe('getTranslationsByModule', () => {
    it('should return translations as key-value object for module and locale', async () => {
      const translations = [
        createMockTranslation({
          key: 'errors.not_found',
          locale: TranslationLocale.ES,
          value: 'No encontrado',
          module: TranslationModule.ERRORS,
        }),
        createMockTranslation({
          key: 'errors.unauthorized',
          locale: TranslationLocale.ES,
          value: 'No autorizado',
          module: TranslationModule.ERRORS,
        }),
      ];
      translationRepository.find.mockResolvedValue(translations);

      const result = await service.getTranslationsByModule(
        TranslationModule.ERRORS,
        'es',
      );

      expect(result).toEqual({
        'errors.not_found': 'No encontrado',
        'errors.unauthorized': 'No autorizado',
      });
      expect(translationRepository.find).toHaveBeenCalledWith({
        where: {
          module: TranslationModule.ERRORS,
          locale: TranslationLocale.ES,
        },
      });
    });

    it('should return empty object when no translations found', async () => {
      translationRepository.find.mockResolvedValue([]);

      const result = await service.getTranslationsByModule(
        TranslationModule.AUTH,
        'en',
      );

      expect(result).toEqual({});
    });
  });

  describe('getTranslationsByLocale', () => {
    it('should return all translations for a locale as key-value object', async () => {
      const translations = [
        createMockTranslation({
          key: 'auth.login',
          value: 'Iniciar sesion',
        }),
        createMockTranslation({
          key: 'common.save',
          value: 'Guardar',
        }),
      ];
      translationRepository.find.mockResolvedValue(translations);

      const result = await service.getTranslationsByLocale('es');

      expect(result).toEqual({
        'auth.login': 'Iniciar sesion',
        'common.save': 'Guardar',
      });
      expect(translationRepository.find).toHaveBeenCalledWith({
        where: { locale: TranslationLocale.ES },
      });
    });

    it('should return empty object when no translations exist for locale', async () => {
      translationRepository.find.mockResolvedValue([]);

      const result = await service.getTranslationsByLocale('en');

      expect(result).toEqual({});
    });
  });

  // ================================================================
  // CRUD - CREATE
  // ================================================================

  describe('create', () => {
    it('should create a new translation and update cache', async () => {
      const dto: CreateTranslationDto = {
        key: 'new.key',
        locale: TranslationLocale.ES,
        value: 'Nuevo valor',
        module: TranslationModule.COMMON,
      };

      translationRepository.findOne.mockResolvedValue(null);
      const savedEntity = createMockTranslation({
        ...dto,
        id: mockTranslationId,
      });
      translationRepository.create.mockReturnValue(savedEntity);
      translationRepository.save.mockResolvedValue(savedEntity);

      const result = await service.create(dto);

      expect(result).toEqual(savedEntity);
      expect(translationRepository.findOne).toHaveBeenCalledWith({
        where: { key: dto.key, locale: dto.locale },
      });
      expect(translationRepository.create).toHaveBeenCalledWith(dto);
      expect(translationRepository.save).toHaveBeenCalled();
      // Verify cache was updated
      expect(service.t('new.key', 'es')).toBe('Nuevo valor');
    });

    it('should throw ConflictException when key+locale already exists', async () => {
      const dto: CreateTranslationDto = {
        key: 'existing.key',
        locale: TranslationLocale.ES,
        value: 'Valor',
      };

      translationRepository.findOne.mockResolvedValue(
        createMockTranslation({ key: 'existing.key' }),
      );

      await expect(service.create(dto)).rejects.toThrow(ConflictException);
      await expect(service.create(dto)).rejects.toThrow(
        "Ya existe una traduccion con la clave 'existing.key' para el idioma 'es'",
      );
    });
  });

  // ================================================================
  // CRUD - UPDATE
  // ================================================================

  describe('update', () => {
    it('should update translation value and update cache', async () => {
      const existing = createMockTranslation({
        key: 'old.key',
        locale: TranslationLocale.ES,
        value: 'Valor viejo',
      });

      const dto: UpdateTranslationDto = { value: 'Valor nuevo' };

      translationRepository.findOne
        .mockResolvedValueOnce(existing) // findById
        .mockResolvedValueOnce(null); // no conflict check needed (no key/locale change)

      const updated = { ...existing, value: 'Valor nuevo' };
      translationRepository.save.mockResolvedValue(
        updated as unknown as Translation,
      );

      const result = await service.update(mockTranslationId, dto);

      expect(result.value).toBe('Valor nuevo');
      expect(translationRepository.save).toHaveBeenCalled();
    });

    it('should check for conflicts when key is changed', async () => {
      const existing = createMockTranslation({
        id: mockTranslationId,
        key: 'old.key',
        locale: TranslationLocale.ES,
      });

      const dto: UpdateTranslationDto = { key: 'new.key' };

      translationRepository.findOne
        .mockResolvedValueOnce(existing) // findById
        .mockResolvedValueOnce(null); // no conflict

      translationRepository.save.mockImplementation(
        async (entity) => entity as Translation,
      );

      await service.update(mockTranslationId, dto);

      // Second findOne checks for key+locale conflict
      expect(translationRepository.findOne).toHaveBeenCalledTimes(2);
    });

    it('should throw ConflictException when key+locale conflicts with another translation', async () => {
      const existing = createMockTranslation({
        id: mockTranslationId,
        key: 'key1',
        locale: TranslationLocale.ES,
      });

      const conflicting = createMockTranslation({
        id: mockTranslationId2,
        key: 'key2',
        locale: TranslationLocale.ES,
      });

      const dto: UpdateTranslationDto = { key: 'key2' };

      translationRepository.findOne
        .mockResolvedValueOnce(existing) // findById
        .mockResolvedValueOnce(conflicting); // conflict found

      await expect(
        service.update(mockTranslationId, dto),
      ).rejects.toThrow(ConflictException);
    });

    it('should allow updating when conflict is the same translation', async () => {
      const existing = createMockTranslation({
        id: mockTranslationId,
        key: 'same.key',
        locale: TranslationLocale.ES,
      });

      const dto: UpdateTranslationDto = { key: 'same.key' };

      translationRepository.findOne
        .mockResolvedValueOnce(existing) // findById
        .mockResolvedValueOnce(existing); // same record — no conflict

      translationRepository.save.mockImplementation(
        async (entity) => entity as Translation,
      );

      await expect(
        service.update(mockTranslationId, dto),
      ).resolves.not.toThrow();
    });

    it('should remove old cache entry and set new one on key change', async () => {
      const existing = createMockTranslation({
        key: 'old.key',
        locale: TranslationLocale.ES,
        value: 'Valor',
      });

      // Pre-load cache with old key
      translationRepository.find.mockResolvedValue([existing]);
      await service.loadTranslations();
      expect(service.t('old.key', 'es')).toBe('Valor');

      const dto: UpdateTranslationDto = { key: 'new.key' };

      translationRepository.findOne
        .mockResolvedValueOnce(existing) // findById
        .mockResolvedValueOnce(null); // no conflict

      const updated = {
        ...existing,
        key: 'new.key',
      };
      translationRepository.save.mockResolvedValue(
        updated as unknown as Translation,
      );

      await service.update(mockTranslationId, dto);

      // Old cache key is gone, new one is set
      expect(service.t('old.key', 'es')).toBe('old.key');
      expect(service.t('new.key', 'es')).toBe('Valor');
    });

    it('should throw NotFoundException when translation does not exist', async () => {
      translationRepository.findOne.mockResolvedValue(null);

      await expect(
        service.update('non-existent-id', { value: 'new' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ================================================================
  // CRUD - DELETE
  // ================================================================

  describe('delete', () => {
    it('should delete a non-system translation and remove from cache', async () => {
      const translation = createMockTranslation({
        isSystem: false,
        key: 'deletable.key',
        locale: TranslationLocale.ES,
        value: 'Valor a eliminar',
      });

      // Pre-load cache
      translationRepository.find.mockResolvedValue([translation]);
      await service.loadTranslations();
      expect(service.t('deletable.key', 'es')).toBe('Valor a eliminar');

      translationRepository.findOne.mockResolvedValue(translation);

      await service.delete(mockTranslationId);

      expect(translationRepository.remove).toHaveBeenCalledWith(translation);
      // Cache should be cleared for this key
      expect(service.t('deletable.key', 'es')).toBe('deletable.key');
    });

    it('should throw BadRequestException when trying to delete a system translation', async () => {
      const systemTranslation = createMockTranslation({
        isSystem: true,
      });

      translationRepository.findOne.mockResolvedValue(systemTranslation);

      await expect(service.delete(mockTranslationId)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.delete(mockTranslationId)).rejects.toThrow(
        'No se puede eliminar una traduccion del sistema',
      );
    });

    it('should throw NotFoundException when translation does not exist', async () => {
      translationRepository.findOne.mockResolvedValue(null);

      await expect(service.delete('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ================================================================
  // CRUD - FIND ALL
  // ================================================================

  describe('findAll', () => {
    it('should return paginated translations with default params', async () => {
      const translations = [createMockTranslation()];
      const mockQb = createMockQueryBuilder({
        getManyAndCount: jest.fn().mockResolvedValue([translations, 1]),
      });
      translationRepository.createQueryBuilder.mockReturnValue(mockQb as any);

      const result = await service.findAll({});

      expect(result.data).toEqual(translations);
      expect(result.pagination).toEqual({
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1,
      });
      expect(mockQb.orderBy).toHaveBeenCalledWith('t.module', 'ASC');
      expect(mockQb.addOrderBy).toHaveBeenCalledWith('t.key', 'ASC');
      expect(mockQb.skip).toHaveBeenCalledWith(0);
      expect(mockQb.take).toHaveBeenCalledWith(20);
    });

    it('should apply key filter with ILIKE', async () => {
      const mockQb = createMockQueryBuilder({
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      });
      translationRepository.createQueryBuilder.mockReturnValue(mockQb as any);

      await service.findAll({ key: 'errors.user' } as TranslationFilterDto);

      expect(mockQb.andWhere).toHaveBeenCalledWith('t.key ILIKE :key', {
        key: '%errors.user%',
      });
    });

    it('should apply locale filter', async () => {
      const mockQb = createMockQueryBuilder({
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      });
      translationRepository.createQueryBuilder.mockReturnValue(mockQb as any);

      await service.findAll({
        locale: TranslationLocale.EN,
      } as TranslationFilterDto);

      expect(mockQb.andWhere).toHaveBeenCalledWith('t.locale = :locale', {
        locale: TranslationLocale.EN,
      });
    });

    it('should apply module filter', async () => {
      const mockQb = createMockQueryBuilder({
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      });
      translationRepository.createQueryBuilder.mockReturnValue(mockQb as any);

      await service.findAll({
        module: TranslationModule.AUTH,
      } as TranslationFilterDto);

      expect(mockQb.andWhere).toHaveBeenCalledWith('t.module = :module', {
        module: TranslationModule.AUTH,
      });
    });

    it('should apply search filter on value', async () => {
      const mockQb = createMockQueryBuilder({
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      });
      translationRepository.createQueryBuilder.mockReturnValue(mockQb as any);

      await service.findAll({ search: 'usuario' } as TranslationFilterDto);

      expect(mockQb.andWhere).toHaveBeenCalledWith('t.value ILIKE :search', {
        search: '%usuario%',
      });
    });

    it('should apply isSystem filter', async () => {
      const mockQb = createMockQueryBuilder({
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      });
      translationRepository.createQueryBuilder.mockReturnValue(mockQb as any);

      await service.findAll({ isSystem: true } as TranslationFilterDto);

      expect(mockQb.andWhere).toHaveBeenCalledWith('t.isSystem = :isSystem', {
        isSystem: true,
      });
    });

    it('should NOT apply isSystem filter when undefined', async () => {
      const mockQb = createMockQueryBuilder({
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      });
      translationRepository.createQueryBuilder.mockReturnValue(mockQb as any);

      await service.findAll({} as TranslationFilterDto);

      // andWhere should not be called with isSystem
      const calls = (mockQb.andWhere as jest.Mock).mock.calls;
      const isSystemCalls = calls.filter(
        (c: any[]) => typeof c[0] === 'string' && c[0].includes('isSystem'),
      );
      expect(isSystemCalls).toHaveLength(0);
    });

    it('should handle pagination correctly', async () => {
      const mockQb = createMockQueryBuilder({
        getManyAndCount: jest.fn().mockResolvedValue([[], 50]),
      });
      translationRepository.createQueryBuilder.mockReturnValue(mockQb as any);

      const result = await service.findAll({
        page: 3,
        limit: 10,
      } as TranslationFilterDto);

      expect(mockQb.skip).toHaveBeenCalledWith(20); // (3-1) * 10
      expect(mockQb.take).toHaveBeenCalledWith(10);
      expect(result.pagination).toEqual({
        page: 3,
        limit: 10,
        total: 50,
        totalPages: 5,
      });
    });

    it('should combine multiple filters', async () => {
      const mockQb = createMockQueryBuilder({
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      });
      translationRepository.createQueryBuilder.mockReturnValue(mockQb as any);

      await service.findAll({
        key: 'errors',
        locale: TranslationLocale.ES,
        module: TranslationModule.ERRORS,
        search: 'not found',
        isSystem: false,
        page: 1,
        limit: 10,
      } as TranslationFilterDto);

      expect(mockQb.andWhere).toHaveBeenCalledTimes(5);
    });
  });

  // ================================================================
  // FIND BY ID
  // ================================================================

  describe('findById', () => {
    it('should return translation when found', async () => {
      const translation = createMockTranslation();
      translationRepository.findOne.mockResolvedValue(translation);

      const result = await service.findById(mockTranslationId);

      expect(result).toEqual(translation);
      expect(translationRepository.findOne).toHaveBeenCalledWith({
        where: { id: mockTranslationId },
      });
    });

    it('should throw NotFoundException when not found', async () => {
      translationRepository.findOne.mockResolvedValue(null);

      await expect(service.findById('non-existent')).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.findById('non-existent')).rejects.toThrow(
        "Traduccion con ID 'non-existent' no encontrada",
      );
    });
  });

  // ================================================================
  // BULK IMPORT
  // ================================================================

  describe('bulkImport', () => {
    it('should create new translations when they do not exist', async () => {
      translationRepository.findOne.mockResolvedValue(null);
      translationRepository.create.mockImplementation(
        (dto) => dto as Translation,
      );
      translationRepository.save.mockImplementation(
        async (entity) => entity as Translation,
      );
      translationRepository.find.mockResolvedValue([]);

      const items = [
        { key: 'new.key1', locale: 'es', value: 'Valor 1' },
        { key: 'new.key2', locale: 'en', value: 'Value 2' },
      ];

      const result = await service.bulkImport(items);

      expect(result).toEqual({ created: 2, updated: 0 });
      expect(translationRepository.create).toHaveBeenCalledTimes(2);
      expect(translationRepository.save).toHaveBeenCalledTimes(2);
    });

    it('should update existing translations', async () => {
      const existing = createMockTranslation({
        key: 'existing.key',
        locale: TranslationLocale.ES,
        value: 'Old value',
      });
      translationRepository.findOne.mockResolvedValue(existing);
      translationRepository.save.mockImplementation(
        async (entity) => entity as Translation,
      );
      translationRepository.find.mockResolvedValue([]);

      const items = [
        { key: 'existing.key', locale: 'es', value: 'New value' },
      ];

      const result = await service.bulkImport(items);

      expect(result).toEqual({ created: 0, updated: 1 });
      expect(existing.value).toBe('New value');
    });

    it('should update module of existing translation when provided', async () => {
      const existing = createMockTranslation({
        key: 'existing.key',
        locale: TranslationLocale.ES,
        module: TranslationModule.COMMON,
      });
      translationRepository.findOne.mockResolvedValue(existing);
      translationRepository.save.mockImplementation(
        async (entity) => entity as Translation,
      );
      translationRepository.find.mockResolvedValue([]);

      const items = [
        {
          key: 'existing.key',
          locale: 'es',
          value: 'Updated',
          module: 'errors',
        },
      ];

      const result = await service.bulkImport(items);

      expect(result).toEqual({ created: 0, updated: 1 });
      expect(existing.module).toBe('errors');
    });

    it('should default to COMMON module for new translations without module', async () => {
      translationRepository.findOne.mockResolvedValue(null);
      translationRepository.create.mockImplementation(
        (dto) => dto as Translation,
      );
      translationRepository.save.mockImplementation(
        async (entity) => entity as Translation,
      );
      translationRepository.find.mockResolvedValue([]);

      const items = [{ key: 'no.module', locale: 'es', value: 'Sin modulo' }];

      await service.bulkImport(items);

      expect(translationRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          module: TranslationModule.COMMON,
        }),
      );
    });

    it('should reload cache after import', async () => {
      translationRepository.findOne.mockResolvedValue(null);
      translationRepository.create.mockImplementation(
        (dto) => dto as Translation,
      );
      translationRepository.save.mockImplementation(
        async (entity) => entity as Translation,
      );
      translationRepository.find.mockResolvedValue([]);

      await service.bulkImport([
        { key: 'test', locale: 'es', value: 'test' },
      ]);

      // find is called during loadTranslations (cache reload)
      expect(translationRepository.find).toHaveBeenCalled();
    });

    it('should handle mixed create and update in a single import', async () => {
      const existing = createMockTranslation({
        key: 'existing.key',
        locale: TranslationLocale.ES,
        value: 'Old',
      });

      translationRepository.findOne
        .mockResolvedValueOnce(existing) // first item exists
        .mockResolvedValueOnce(null); // second item is new

      translationRepository.create.mockImplementation(
        (dto) => dto as Translation,
      );
      translationRepository.save.mockImplementation(
        async (entity) => entity as Translation,
      );
      translationRepository.find.mockResolvedValue([]);

      const items = [
        { key: 'existing.key', locale: 'es', value: 'Updated' },
        { key: 'new.key', locale: 'en', value: 'New' },
      ];

      const result = await service.bulkImport(items);

      expect(result).toEqual({ created: 1, updated: 1 });
    });
  });

  // ================================================================
  // EXPORT
  // ================================================================

  describe('exportByLocale', () => {
    it('should delegate to getTranslationsByLocale', async () => {
      const translations = [
        createMockTranslation({
          key: 'key1',
          value: 'val1',
        }),
      ];
      translationRepository.find.mockResolvedValue(translations);

      const result = await service.exportByLocale('es');

      expect(result).toEqual({ key1: 'val1' });
    });
  });

  // ================================================================
  // STATS
  // ================================================================

  describe('getStats', () => {
    it('should return statistics grouped by locale and module', async () => {
      const translations = [
        createMockTranslation({
          locale: TranslationLocale.ES,
          module: TranslationModule.ERRORS,
        }),
        createMockTranslation({
          locale: TranslationLocale.EN,
          module: TranslationModule.ERRORS,
        }),
        createMockTranslation({
          locale: TranslationLocale.ES,
          module: TranslationModule.AUTH,
        }),
      ];
      translationRepository.find.mockResolvedValue(translations);

      const result = await service.getStats();

      expect(result.total).toBe(3);
      expect(result.byLocale).toEqual({ es: 2, en: 1 });
      expect(result.byModule).toEqual({
        errors: { es: 1, en: 1, total: 2 },
        auth: { es: 1, en: 0, total: 1 },
      });
    });

    it('should return zero counts when no translations exist', async () => {
      translationRepository.find.mockResolvedValue([]);

      const result = await service.getStats();

      expect(result.total).toBe(0);
      expect(result.byLocale).toEqual({});
      expect(result.byModule).toEqual({});
    });
  });
});
