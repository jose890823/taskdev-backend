import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { FeatureFlagsService } from './feature-flags.service';
import { FeatureFlag } from './entities/feature-flag.entity';
import { CreateFeatureFlagDto } from './dto/create-feature-flag.dto';
import { UpdateFeatureFlagDto } from './dto/update-feature-flag.dto';

describe('FeatureFlagsService', () => {
  let service: FeatureFlagsService;
  let featureFlagRepository: jest.Mocked<Repository<FeatureFlag>>;

  const flagId = '550e8400-e29b-41d4-a716-446655440000';
  const flagId2 = '660e8400-e29b-41d4-a716-446655440001';

  const mockFlag: FeatureFlag = {
    id: flagId,
    systemCode: 'FLG-260301-A1B2',
    key: 'app.multi_vendor',
    name: 'Multi-vendedor',
    description: 'Habilita soporte para multiples vendedores',
    isEnabled: true,
    enabledForRoles: null,
    enabledForStores: null,
    config: null,
    dependsOn: null,
    createdAt: new Date('2026-03-01'),
    updatedAt: new Date('2026-03-01'),
    generateSystemCode: jest.fn(),
  } as unknown as FeatureFlag;

  const mockDisabledFlag: FeatureFlag = {
    id: flagId2,
    systemCode: 'FLG-260301-C3D4',
    key: 'app.dark_mode',
    name: 'Modo oscuro',
    description: 'Tema oscuro de la aplicacion',
    isEnabled: false,
    enabledForRoles: null,
    enabledForStores: null,
    config: null,
    dependsOn: null,
    createdAt: new Date('2026-03-01'),
    updatedAt: new Date('2026-03-01'),
    generateSystemCode: jest.fn(),
  } as unknown as FeatureFlag;

  beforeEach(async () => {
    const mockFeatureFlagRepository = {
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      remove: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FeatureFlagsService,
        {
          provide: getRepositoryToken(FeatureFlag),
          useValue: mockFeatureFlagRepository,
        },
      ],
    }).compile();

    service = module.get<FeatureFlagsService>(FeatureFlagsService);
    featureFlagRepository = module.get(getRepositoryToken(FeatureFlag));
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  // ──────────────────────────────────────────────
  // findAll
  // ──────────────────────────────────────────────

  describe('findAll', () => {
    it('debe retornar todos los feature flags ordenados por key', async () => {
      const flags = [mockFlag, mockDisabledFlag];
      featureFlagRepository.find.mockResolvedValue(flags);

      const result = await service.findAll();

      expect(featureFlagRepository.find).toHaveBeenCalledWith({
        order: { key: 'ASC' },
      });
      expect(result).toEqual(flags);
      expect(result).toHaveLength(2);
    });

    it('debe retornar array vacio si no hay flags', async () => {
      featureFlagRepository.find.mockResolvedValue([]);

      const result = await service.findAll();

      expect(result).toEqual([]);
    });
  });

  // ──────────────────────────────────────────────
  // findByKey
  // ──────────────────────────────────────────────

  describe('findByKey', () => {
    it('debe retornar el flag si existe', async () => {
      featureFlagRepository.findOne.mockResolvedValue(mockFlag);

      const result = await service.findByKey('app.multi_vendor');

      expect(result).toEqual(mockFlag);
      expect(featureFlagRepository.findOne).toHaveBeenCalledWith({
        where: { key: 'app.multi_vendor' },
      });
    });

    it('debe lanzar NotFoundException si el flag no existe', async () => {
      featureFlagRepository.findOne.mockResolvedValue(null);

      await expect(service.findByKey('non.existent')).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.findByKey('non.existent')).rejects.toThrow(
        'Feature flag con clave "non.existent" no encontrado',
      );
    });
  });

  // ──────────────────────────────────────────────
  // create
  // ──────────────────────────────────────────────

  describe('create', () => {
    const createDto: CreateFeatureFlagDto = {
      key: 'app.new_feature',
      name: 'Nueva funcionalidad',
      description: 'Una nueva funcionalidad',
      isEnabled: false,
    };

    it('debe crear un feature flag correctamente', async () => {
      const newFlag = { ...mockFlag, ...createDto, id: flagId };
      featureFlagRepository.findOne.mockResolvedValue(null); // no existing
      featureFlagRepository.create.mockReturnValue(newFlag as FeatureFlag);
      featureFlagRepository.save.mockResolvedValue(newFlag as FeatureFlag);

      const result = await service.create(createDto);

      expect(featureFlagRepository.findOne).toHaveBeenCalledWith({
        where: { key: createDto.key },
      });
      expect(featureFlagRepository.create).toHaveBeenCalledWith(createDto);
      expect(featureFlagRepository.save).toHaveBeenCalled();
      expect(result.key).toBe(createDto.key);
    });

    it('debe lanzar ConflictException si la clave ya existe', async () => {
      featureFlagRepository.findOne.mockResolvedValue(mockFlag);

      const duplicateDto: CreateFeatureFlagDto = {
        key: mockFlag.key,
        name: 'Otro nombre',
      };

      await expect(service.create(duplicateDto)).rejects.toThrow(
        ConflictException,
      );
      await expect(service.create(duplicateDto)).rejects.toThrow(
        `Ya existe un feature flag con la clave "${mockFlag.key}"`,
      );
    });

    it('debe crear un flag con todos los campos opcionales', async () => {
      const fullDto: CreateFeatureFlagDto = {
        key: 'app.full_feature',
        name: 'Feature completo',
        description: 'Con todas las opciones',
        isEnabled: true,
        enabledForRoles: ['admin', 'user'],
        enabledForStores: ['store-uuid-1'],
        config: { maxItems: 50 },
        dependsOn: 'app.base_feature',
      };

      const fullFlag = { ...mockFlag, ...fullDto };
      featureFlagRepository.findOne.mockResolvedValue(null);
      featureFlagRepository.create.mockReturnValue(fullFlag as FeatureFlag);
      featureFlagRepository.save.mockResolvedValue(fullFlag as FeatureFlag);

      const result = await service.create(fullDto);

      expect(featureFlagRepository.create).toHaveBeenCalledWith(fullDto);
      expect(result.enabledForRoles).toEqual(['admin', 'user']);
      expect(result.config).toEqual({ maxItems: 50 });
    });
  });

  // ──────────────────────────────────────────────
  // update
  // ──────────────────────────────────────────────

  describe('update', () => {
    const updateDto: UpdateFeatureFlagDto = {
      name: 'Multi-vendedor v2',
      isEnabled: false,
    };

    it('debe actualizar un feature flag correctamente', async () => {
      const updatedFlag = { ...mockFlag, ...updateDto };
      featureFlagRepository.findOne.mockResolvedValue({ ...mockFlag });
      featureFlagRepository.save.mockResolvedValue(
        updatedFlag as FeatureFlag,
      );

      const result = await service.update(flagId, updateDto);

      expect(featureFlagRepository.findOne).toHaveBeenCalledWith({
        where: { id: flagId },
      });
      expect(featureFlagRepository.save).toHaveBeenCalled();
      expect(result.name).toBe('Multi-vendedor v2');
      expect(result.isEnabled).toBe(false);
    });

    it('debe lanzar NotFoundException si el flag no existe', async () => {
      featureFlagRepository.findOne.mockResolvedValue(null);

      await expect(
        service.update('non-existent-uuid', updateDto),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.update('non-existent-uuid', updateDto),
      ).rejects.toThrow(
        'Feature flag con ID "non-existent-uuid" no encontrado',
      );
    });

    it('debe permitir cambiar la clave si no hay conflicto', async () => {
      const keyChangeDto: UpdateFeatureFlagDto = {
        key: 'app.renamed_feature',
      };
      featureFlagRepository.findOne
        .mockResolvedValueOnce({ ...mockFlag }) // find by id
        .mockResolvedValueOnce(null); // check for key conflict
      featureFlagRepository.save.mockResolvedValue({
        ...mockFlag,
        key: 'app.renamed_feature',
      } as FeatureFlag);

      const result = await service.update(flagId, keyChangeDto);

      expect(featureFlagRepository.findOne).toHaveBeenCalledTimes(2);
      expect(result.key).toBe('app.renamed_feature');
    });

    it('debe lanzar ConflictException si la nueva clave ya existe', async () => {
      const keyChangeDto: UpdateFeatureFlagDto = {
        key: 'app.dark_mode',
      };
      featureFlagRepository.findOne
        .mockResolvedValueOnce({ ...mockFlag }) // find by id
        .mockResolvedValueOnce(mockDisabledFlag); // existing flag with that key

      await expect(service.update(flagId, keyChangeDto)).rejects.toThrow(
        new ConflictException(
          'Ya existe un feature flag con la clave "app.dark_mode"',
        ),
      );
    });

    it('no debe verificar conflicto de clave si la clave no cambia', async () => {
      const sameName: UpdateFeatureFlagDto = { key: mockFlag.key };
      featureFlagRepository.findOne.mockResolvedValue({ ...mockFlag });
      featureFlagRepository.save.mockResolvedValue(mockFlag);

      await service.update(flagId, sameName);

      // findOne called only once (for finding the flag), not a second time for key check
      expect(featureFlagRepository.findOne).toHaveBeenCalledTimes(1);
    });

    it('no debe verificar conflicto de clave si no se proporciona key', async () => {
      const noKeyDto: UpdateFeatureFlagDto = { name: 'Nuevo nombre' };
      featureFlagRepository.findOne.mockResolvedValue({ ...mockFlag });
      featureFlagRepository.save.mockResolvedValue({
        ...mockFlag,
        name: 'Nuevo nombre',
      } as FeatureFlag);

      await service.update(flagId, noKeyDto);

      expect(featureFlagRepository.findOne).toHaveBeenCalledTimes(1);
    });
  });

  // ──────────────────────────────────────────────
  // remove
  // ──────────────────────────────────────────────

  describe('remove', () => {
    it('debe eliminar el feature flag correctamente', async () => {
      featureFlagRepository.findOne.mockResolvedValue(mockFlag);
      featureFlagRepository.remove.mockResolvedValue(mockFlag);

      await service.remove(flagId);

      expect(featureFlagRepository.findOne).toHaveBeenCalledWith({
        where: { id: flagId },
      });
      expect(featureFlagRepository.remove).toHaveBeenCalledWith(mockFlag);
    });

    it('debe lanzar NotFoundException si el flag no existe', async () => {
      featureFlagRepository.findOne.mockResolvedValue(null);

      await expect(service.remove('non-existent-uuid')).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.remove('non-existent-uuid')).rejects.toThrow(
        'Feature flag con ID "non-existent-uuid" no encontrado',
      );
    });
  });

  // ──────────────────────────────────────────────
  // isEnabled
  // ──────────────────────────────────────────────

  describe('isEnabled', () => {
    it('debe retornar true si el flag esta habilitado sin restricciones', async () => {
      featureFlagRepository.findOne.mockResolvedValue(mockFlag);

      const result = await service.isEnabled('app.multi_vendor');

      expect(result).toBe(true);
    });

    it('debe retornar false si el flag no existe', async () => {
      featureFlagRepository.findOne.mockResolvedValue(null);

      const result = await service.isEnabled('non.existent');

      expect(result).toBe(false);
    });

    it('debe retornar false si el flag esta deshabilitado globalmente', async () => {
      featureFlagRepository.findOne.mockResolvedValue(mockDisabledFlag);

      const result = await service.isEnabled('app.dark_mode');

      expect(result).toBe(false);
    });

    it('debe retornar true si el usuario tiene un rol permitido', async () => {
      const flagWithRoles = {
        ...mockFlag,
        enabledForRoles: ['admin', 'editor'],
      };
      featureFlagRepository.findOne.mockResolvedValue(
        flagWithRoles as FeatureFlag,
      );

      const result = await service.isEnabled('app.multi_vendor', {
        roles: ['admin'],
      });

      expect(result).toBe(true);
    });

    it('debe retornar false si el usuario no tiene un rol permitido', async () => {
      const flagWithRoles = {
        ...mockFlag,
        enabledForRoles: ['admin', 'editor'],
      };
      featureFlagRepository.findOne.mockResolvedValue(
        flagWithRoles as FeatureFlag,
      );

      const result = await service.isEnabled('app.multi_vendor', {
        roles: ['viewer'],
      });

      expect(result).toBe(false);
    });

    it('debe ignorar restriccion de roles si enabledForRoles esta vacio', async () => {
      const flagWithEmptyRoles = {
        ...mockFlag,
        enabledForRoles: [],
      };
      featureFlagRepository.findOne.mockResolvedValue(
        flagWithEmptyRoles as FeatureFlag,
      );

      const result = await service.isEnabled('app.multi_vendor', {
        roles: ['viewer'],
      });

      expect(result).toBe(true);
    });

    it('debe ignorar restriccion de roles si no se proporcionan roles en el contexto', async () => {
      const flagWithRoles = {
        ...mockFlag,
        enabledForRoles: ['admin'],
      };
      featureFlagRepository.findOne.mockResolvedValue(
        flagWithRoles as FeatureFlag,
      );

      const result = await service.isEnabled('app.multi_vendor', {});

      expect(result).toBe(true);
    });

    it('debe retornar true si la tienda esta en enabledForStores', async () => {
      const flagWithStores = {
        ...mockFlag,
        enabledForStores: ['store-uuid-1', 'store-uuid-2'],
      };
      featureFlagRepository.findOne.mockResolvedValue(
        flagWithStores as FeatureFlag,
      );

      const result = await service.isEnabled('app.multi_vendor', {
        storeId: 'store-uuid-1',
      });

      expect(result).toBe(true);
    });

    it('debe retornar false si la tienda no esta en enabledForStores', async () => {
      const flagWithStores = {
        ...mockFlag,
        enabledForStores: ['store-uuid-1', 'store-uuid-2'],
      };
      featureFlagRepository.findOne.mockResolvedValue(
        flagWithStores as FeatureFlag,
      );

      const result = await service.isEnabled('app.multi_vendor', {
        storeId: 'store-uuid-999',
      });

      expect(result).toBe(false);
    });

    it('debe ignorar restriccion de tiendas si enabledForStores esta vacio', async () => {
      const flagWithEmptyStores = {
        ...mockFlag,
        enabledForStores: [],
      };
      featureFlagRepository.findOne.mockResolvedValue(
        flagWithEmptyStores as FeatureFlag,
      );

      const result = await service.isEnabled('app.multi_vendor', {
        storeId: 'any-store',
      });

      expect(result).toBe(true);
    });

    it('debe ignorar restriccion de tiendas si no se proporciona storeId', async () => {
      const flagWithStores = {
        ...mockFlag,
        enabledForStores: ['store-uuid-1'],
      };
      featureFlagRepository.findOne.mockResolvedValue(
        flagWithStores as FeatureFlag,
      );

      const result = await service.isEnabled('app.multi_vendor', {});

      expect(result).toBe(true);
    });

    it('debe retornar true si la dependencia esta habilitada', async () => {
      const dependentFlag = {
        ...mockFlag,
        key: 'app.child_feature',
        dependsOn: 'app.parent_feature',
      };
      const parentFlag = {
        ...mockFlag,
        key: 'app.parent_feature',
        isEnabled: true,
        dependsOn: null,
      };

      featureFlagRepository.findOne
        .mockResolvedValueOnce(dependentFlag as FeatureFlag)
        .mockResolvedValueOnce(parentFlag as FeatureFlag);

      const result = await service.isEnabled('app.child_feature');

      expect(result).toBe(true);
      expect(featureFlagRepository.findOne).toHaveBeenCalledTimes(2);
    });

    it('debe retornar false si la dependencia esta deshabilitada', async () => {
      const dependentFlag = {
        ...mockFlag,
        key: 'app.child_feature',
        dependsOn: 'app.parent_feature',
      };
      const parentFlag = {
        ...mockFlag,
        key: 'app.parent_feature',
        isEnabled: false,
        dependsOn: null,
      };

      featureFlagRepository.findOne
        .mockResolvedValueOnce(dependentFlag as FeatureFlag)
        .mockResolvedValueOnce(parentFlag as FeatureFlag);

      const result = await service.isEnabled('app.child_feature');

      expect(result).toBe(false);
    });

    it('debe retornar false si la dependencia no existe', async () => {
      const dependentFlag = {
        ...mockFlag,
        key: 'app.child_feature',
        dependsOn: 'app.missing_parent',
      };

      featureFlagRepository.findOne
        .mockResolvedValueOnce(dependentFlag as FeatureFlag)
        .mockResolvedValueOnce(null); // dependency does not exist

      const result = await service.isEnabled('app.child_feature');

      expect(result).toBe(false);
    });

    it('debe verificar roles Y tiendas combinados', async () => {
      const flagBoth = {
        ...mockFlag,
        enabledForRoles: ['admin'],
        enabledForStores: ['store-1'],
      };
      featureFlagRepository.findOne.mockResolvedValue(
        flagBoth as FeatureFlag,
      );

      // Both match
      const result = await service.isEnabled('app.multi_vendor', {
        roles: ['admin'],
        storeId: 'store-1',
      });
      expect(result).toBe(true);
    });

    it('debe retornar false si roles coinciden pero tienda no', async () => {
      const flagBoth = {
        ...mockFlag,
        enabledForRoles: ['admin'],
        enabledForStores: ['store-1'],
      };
      featureFlagRepository.findOne.mockResolvedValue(
        flagBoth as FeatureFlag,
      );

      const result = await service.isEnabled('app.multi_vendor', {
        roles: ['admin'],
        storeId: 'store-999',
      });
      expect(result).toBe(false);
    });

    it('debe retornar true sin contexto cuando no hay restricciones', async () => {
      featureFlagRepository.findOne.mockResolvedValue(mockFlag);

      const result = await service.isEnabled('app.multi_vendor');

      expect(result).toBe(true);
    });

    it('debe manejar cadena de dependencias (dependencia recursiva)', async () => {
      const flagC = {
        ...mockFlag,
        key: 'app.level_c',
        dependsOn: 'app.level_b',
      };
      const flagB = {
        ...mockFlag,
        key: 'app.level_b',
        dependsOn: 'app.level_a',
      };
      const flagA = {
        ...mockFlag,
        key: 'app.level_a',
        isEnabled: true,
        dependsOn: null,
      };

      featureFlagRepository.findOne
        .mockResolvedValueOnce(flagC as FeatureFlag)
        .mockResolvedValueOnce(flagB as FeatureFlag)
        .mockResolvedValueOnce(flagA as FeatureFlag);

      const result = await service.isEnabled('app.level_c');

      expect(result).toBe(true);
      expect(featureFlagRepository.findOne).toHaveBeenCalledTimes(3);
    });
  });

  // ──────────────────────────────────────────────
  // getConfig
  // ──────────────────────────────────────────────

  describe('getConfig', () => {
    it('debe retornar la configuracion del flag', async () => {
      const flagWithConfig = {
        ...mockFlag,
        config: { maxProducts: 100, trialDays: 30 },
      };
      featureFlagRepository.findOne.mockResolvedValue(
        flagWithConfig as FeatureFlag,
      );

      const result = await service.getConfig('app.multi_vendor');

      expect(result).toEqual({ maxProducts: 100, trialDays: 30 });
    });

    it('debe retornar null si el flag no existe', async () => {
      featureFlagRepository.findOne.mockResolvedValue(null);

      const result = await service.getConfig('non.existent');

      expect(result).toBeNull();
    });

    it('debe retornar null si el flag no tiene config', async () => {
      const flagNoConfig = { ...mockFlag, config: null };
      featureFlagRepository.findOne.mockResolvedValue(
        flagNoConfig as FeatureFlag,
      );

      const result = await service.getConfig('app.multi_vendor');

      expect(result).toBeNull();
    });

    it('debe retornar config tipado correctamente', async () => {
      interface MyConfig {
        maxItems: number;
        enabled: boolean;
      }
      const flagWithTypedConfig = {
        ...mockFlag,
        config: { maxItems: 50, enabled: true },
      };
      featureFlagRepository.findOne.mockResolvedValue(
        flagWithTypedConfig as FeatureFlag,
      );

      const result = await service.getConfig<MyConfig>('app.multi_vendor');

      expect(result).toEqual({ maxItems: 50, enabled: true });
      expect(result?.maxItems).toBe(50);
      expect(result?.enabled).toBe(true);
    });
  });
});
