import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { ProjectModulesService } from './project-modules.service';
import { ProjectModule } from './entities/project-module.entity';
import { CreateProjectModuleDto } from './dto/create-project-module.dto';
import { UpdateProjectModuleDto } from './dto/update-project-module.dto';
import { ReorderModulesDto } from './dto/reorder-modules.dto';

describe('ProjectModulesService', () => {
  let service: ProjectModulesService;
  let moduleRepository: jest.Mocked<Repository<ProjectModule>>;

  const projectId = '550e8400-e29b-41d4-a716-446655440000';
  const moduleId = '660e8400-e29b-41d4-a716-446655440001';
  const parentModuleId = '770e8400-e29b-41d4-a716-446655440002';
  const childModuleId = '880e8400-e29b-41d4-a716-446655440003';

  const mockModule: ProjectModule = {
    id: moduleId,
    systemCode: 'MOD-260301-A1B2',
    projectId,
    parentId: null,
    parent: null,
    children: [],
    name: 'Frontend',
    description: 'Modulo de interfaz de usuario',
    color: '#8b5cf6',
    position: 0,
    isActive: true,
    createdAt: new Date('2026-03-01'),
    updatedAt: new Date('2026-03-01'),
    deletedAt: null,
    generateSystemCode: jest.fn(),
  } as unknown as ProjectModule;

  const mockParentModule: ProjectModule = {
    id: parentModuleId,
    systemCode: 'MOD-260301-C3D4',
    projectId,
    parentId: null,
    parent: null,
    children: [],
    name: 'Backend',
    description: 'Modulo del servidor',
    color: '#3b82f6',
    position: 1,
    isActive: true,
    createdAt: new Date('2026-03-01'),
    updatedAt: new Date('2026-03-01'),
    deletedAt: null,
    generateSystemCode: jest.fn(),
  } as unknown as ProjectModule;

  const mockChildModule: ProjectModule = {
    id: childModuleId,
    systemCode: 'MOD-260301-E5F6',
    projectId,
    parentId: parentModuleId,
    parent: null,
    children: [],
    name: 'Auth',
    description: 'Submodulo de autenticacion',
    color: '#ef4444',
    position: 0,
    isActive: true,
    createdAt: new Date('2026-03-01'),
    updatedAt: new Date('2026-03-01'),
    deletedAt: null,
    generateSystemCode: jest.fn(),
  } as unknown as ProjectModule;

  // Mock QueryBuilder for createQueryBuilder chains
  const createMockQueryBuilder = (rawResult: { max: number | null }) => ({
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    getRawOne: jest.fn().mockResolvedValue(rawResult),
  });

  beforeEach(async () => {
    const mockModuleRepository = {
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      softDelete: jest.fn(),
      createQueryBuilder: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectModulesService,
        {
          provide: getRepositoryToken(ProjectModule),
          useValue: mockModuleRepository,
        },
      ],
    }).compile();

    service = module.get<ProjectModulesService>(ProjectModulesService);
    moduleRepository = module.get(getRepositoryToken(ProjectModule));
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  // ──────────────────────────────────────────────
  // create
  // ──────────────────────────────────────────────

  describe('create', () => {
    const createDto: CreateProjectModuleDto = {
      name: 'Frontend',
      description: 'Modulo de interfaz',
      color: '#8b5cf6',
    };

    it('debe crear un modulo sin padre correctamente', async () => {
      const qb = createMockQueryBuilder({ max: 2 });
      moduleRepository.createQueryBuilder.mockReturnValue(qb as any);
      moduleRepository.create.mockReturnValue(mockModule);
      moduleRepository.save.mockResolvedValue(mockModule);

      const result = await service.create(projectId, createDto);

      expect(moduleRepository.createQueryBuilder).toHaveBeenCalledWith('m');
      expect(qb.where).toHaveBeenCalledWith('m.projectId = :projectId', {
        projectId,
      });
      expect(qb.andWhere).toHaveBeenCalledWith('m.parentId IS NULL', {
        parentId: null,
      });
      expect(moduleRepository.create).toHaveBeenCalledWith({
        ...createDto,
        projectId,
        parentId: null,
        position: 3,
      });
      expect(moduleRepository.save).toHaveBeenCalled();
      expect(result).toEqual(mockModule);
    });

    it('debe crear un modulo con position 0 cuando no hay modulos previos', async () => {
      const qb = createMockQueryBuilder({ max: null });
      moduleRepository.createQueryBuilder.mockReturnValue(qb as any);
      moduleRepository.create.mockReturnValue(mockModule);
      moduleRepository.save.mockResolvedValue(mockModule);

      await service.create(projectId, createDto);

      expect(moduleRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ position: 0 }),
      );
    });

    it('debe crear un submodulo bajo un padre valido', async () => {
      const dtoWithParent: CreateProjectModuleDto = {
        ...createDto,
        parentId: parentModuleId,
      };

      moduleRepository.findOne.mockResolvedValue(mockParentModule);

      const qb = createMockQueryBuilder({ max: 1 });
      moduleRepository.createQueryBuilder.mockReturnValue(qb as any);
      moduleRepository.create.mockReturnValue(mockChildModule);
      moduleRepository.save.mockResolvedValue(mockChildModule);

      const result = await service.create(projectId, dtoWithParent);

      expect(moduleRepository.findOne).toHaveBeenCalledWith({
        where: { id: parentModuleId },
      });
      expect(qb.andWhere).toHaveBeenCalledWith('m.parentId = :parentId', {
        parentId: parentModuleId,
      });
      expect(moduleRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          parentId: parentModuleId,
          position: 2,
        }),
      );
      expect(result).toEqual(mockChildModule);
    });

    it('debe lanzar NotFoundException si el modulo padre no existe', async () => {
      const dtoWithParent: CreateProjectModuleDto = {
        ...createDto,
        parentId: parentModuleId,
      };
      moduleRepository.findOne.mockResolvedValue(null);

      await expect(service.create(projectId, dtoWithParent)).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.create(projectId, dtoWithParent)).rejects.toThrow(
        'Modulo padre no encontrado',
      );
    });

    it('debe lanzar BadRequestException si el padre pertenece a otro proyecto', async () => {
      const dtoWithParent: CreateProjectModuleDto = {
        ...createDto,
        parentId: parentModuleId,
      };
      const parentFromAnotherProject = {
        ...mockParentModule,
        projectId: '990e8400-e29b-41d4-a716-446655440099',
      };
      moduleRepository.findOne.mockResolvedValue(
        parentFromAnotherProject as ProjectModule,
      );

      await expect(service.create(projectId, dtoWithParent)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.create(projectId, dtoWithParent)).rejects.toThrow(
        'El modulo padre no pertenece a este proyecto',
      );
    });

    it('debe lanzar BadRequestException si se alcanza el limite de profundidad (3 niveles)', async () => {
      const dtoWithParent: CreateProjectModuleDto = {
        ...createDto,
        parentId: parentModuleId,
      };

      // Parent at depth 0, grandparent at depth 1 → parent's depth = 2 → limit reached
      const parentAtDepth2 = {
        ...mockParentModule,
        id: parentModuleId,
        parentId: 'grandparent-uuid-0000-0000-000000000001',
      };

      const grandparent = {
        ...mockParentModule,
        id: 'grandparent-uuid-0000-0000-000000000001',
        parentId: 'great-grandparent-uuid-0000-000000000002',
      };

      const greatGrandparent = {
        ...mockParentModule,
        id: 'great-grandparent-uuid-0000-000000000002',
        parentId: null,
      };

      moduleRepository.findOne
        .mockResolvedValueOnce(parentAtDepth2 as ProjectModule) // findOne for parent existence check
        .mockResolvedValueOnce(grandparent as ProjectModule) // getModuleDepth — first parent
        .mockResolvedValueOnce(greatGrandparent as ProjectModule); // getModuleDepth — second parent

      await expect(service.create(projectId, dtoWithParent)).rejects.toThrow(
        new BadRequestException(
          'Se alcanzo el limite maximo de profundidad (3 niveles)',
        ),
      );
    });

    it('debe tratar parentId como null cuando no se proporciona', async () => {
      const dtoNoParent: CreateProjectModuleDto = {
        name: 'API',
      };

      const qb = createMockQueryBuilder({ max: 0 });
      moduleRepository.createQueryBuilder.mockReturnValue(qb as any);
      moduleRepository.create.mockReturnValue(mockModule);
      moduleRepository.save.mockResolvedValue(mockModule);

      await service.create(projectId, dtoNoParent);

      expect(moduleRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ parentId: null }),
      );
    });
  });

  // ──────────────────────────────────────────────
  // findByProject
  // ──────────────────────────────────────────────

  describe('findByProject', () => {
    it('debe retornar un arbol de modulos con children anidados', async () => {
      const flatModules = [
        { ...mockParentModule, parentId: null },
        { ...mockChildModule, parentId: parentModuleId },
      ] as ProjectModule[];

      moduleRepository.find.mockResolvedValue(flatModules);

      const result = await service.findByProject(projectId);

      expect(moduleRepository.find).toHaveBeenCalledWith({
        where: { projectId },
        order: { position: 'ASC' },
      });
      expect(result).toHaveLength(1);
      expect(result[0]).toHaveProperty('children');
      expect(
        (result[0].children as Array<Record<string, unknown>>).length,
      ).toBe(1);
    });

    it('debe retornar array vacio si no hay modulos', async () => {
      moduleRepository.find.mockResolvedValue([]);

      const result = await service.findByProject(projectId);

      expect(result).toEqual([]);
    });

    it('debe colocar modulos huerfanos como roots', async () => {
      // Module with parentId pointing to a non-existent parent
      const orphanModule = {
        ...mockChildModule,
        parentId: '999e8400-e29b-41d4-a716-446655449999',
      } as ProjectModule;

      moduleRepository.find.mockResolvedValue([orphanModule]);

      const result = await service.findByProject(projectId);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(childModuleId);
    });
  });

  // ──────────────────────────────────────────────
  // findAllFlat
  // ──────────────────────────────────────────────

  describe('findAllFlat', () => {
    it('debe retornar todos los modulos de un proyecto de forma plana', async () => {
      const flatModules = [mockModule, mockParentModule] as ProjectModule[];
      moduleRepository.find.mockResolvedValue(flatModules);

      const result = await service.findAllFlat(projectId);

      expect(moduleRepository.find).toHaveBeenCalledWith({
        where: { projectId },
        order: { position: 'ASC' },
      });
      expect(result).toEqual(flatModules);
    });

    it('debe retornar array vacio si el proyecto no tiene modulos', async () => {
      moduleRepository.find.mockResolvedValue([]);

      const result = await service.findAllFlat(projectId);

      expect(result).toEqual([]);
    });
  });

  // ──────────────────────────────────────────────
  // findById
  // ──────────────────────────────────────────────

  describe('findById', () => {
    it('debe retornar el modulo si existe', async () => {
      moduleRepository.findOne.mockResolvedValue(mockModule);

      const result = await service.findById(moduleId);

      expect(result).toEqual(mockModule);
      expect(moduleRepository.findOne).toHaveBeenCalledWith({
        where: { id: moduleId },
      });
    });

    it('debe lanzar NotFoundException si el modulo no existe', async () => {
      moduleRepository.findOne.mockResolvedValue(null);

      await expect(service.findById('non-existent-uuid')).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.findById('non-existent-uuid')).rejects.toThrow(
        'Modulo no encontrado',
      );
    });
  });

  // ──────────────────────────────────────────────
  // update
  // ──────────────────────────────────────────────

  describe('update', () => {
    const updateDto: UpdateProjectModuleDto = {
      name: 'Frontend v2',
      color: '#ef4444',
    };

    it('debe actualizar el modulo correctamente', async () => {
      const updatedModule = {
        ...mockModule,
        name: updateDto.name,
        color: updateDto.color,
      };
      moduleRepository.findOne.mockResolvedValue({ ...mockModule });
      moduleRepository.save.mockResolvedValue(updatedModule as ProjectModule);

      const result = await service.update(moduleId, updateDto);

      expect(moduleRepository.findOne).toHaveBeenCalledWith({
        where: { id: moduleId },
      });
      expect(moduleRepository.save).toHaveBeenCalled();
      expect(result.name).toBe('Frontend v2');
      expect(result.color).toBe('#ef4444');
    });

    it('debe lanzar NotFoundException si el modulo no existe', async () => {
      moduleRepository.findOne.mockResolvedValue(null);

      await expect(
        service.update('non-existent-uuid', updateDto),
      ).rejects.toThrow(NotFoundException);
    });

    it('debe actualizar solo los campos proporcionados', async () => {
      const partialDto: UpdateProjectModuleDto = { name: 'Solo Nombre' };
      const updatedModule = { ...mockModule, name: 'Solo Nombre' };
      moduleRepository.findOne.mockResolvedValue({ ...mockModule });
      moduleRepository.save.mockResolvedValue(updatedModule as ProjectModule);

      const result = await service.update(moduleId, partialDto);

      expect(result.name).toBe('Solo Nombre');
      expect(result.color).toBe(mockModule.color);
    });
  });

  // ──────────────────────────────────────────────
  // remove
  // ──────────────────────────────────────────────

  describe('remove', () => {
    it('debe eliminar el modulo y sus descendientes', async () => {
      const grandchild = {
        id: '110e8400-e29b-41d4-a716-446655440010',
      } as ProjectModule;
      const child = {
        id: childModuleId,
      } as ProjectModule;

      moduleRepository.findOne.mockResolvedValue(mockModule);
      moduleRepository.find
        .mockResolvedValueOnce([child]) // children of mockModule
        .mockResolvedValueOnce([grandchild]) // children of child
        .mockResolvedValueOnce([]); // children of grandchild
      moduleRepository.softDelete.mockResolvedValue({ affected: 3 } as any);

      await service.remove(moduleId);

      expect(moduleRepository.softDelete).toHaveBeenCalledWith([
        moduleId,
        childModuleId,
        '110e8400-e29b-41d4-a716-446655440010',
      ]);
    });

    it('debe eliminar un modulo sin hijos', async () => {
      moduleRepository.findOne.mockResolvedValue(mockModule);
      moduleRepository.find.mockResolvedValue([]); // no children
      moduleRepository.softDelete.mockResolvedValue({ affected: 1 } as any);

      await service.remove(moduleId);

      expect(moduleRepository.softDelete).toHaveBeenCalledWith([moduleId]);
    });

    it('debe lanzar NotFoundException si el modulo no existe', async () => {
      moduleRepository.findOne.mockResolvedValue(null);

      await expect(service.remove('non-existent-uuid')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ──────────────────────────────────────────────
  // reorder
  // ──────────────────────────────────────────────

  describe('reorder', () => {
    it('debe actualizar las posiciones de los modulos en el orden dado', async () => {
      const id1 = '110e8400-e29b-41d4-a716-446655440011';
      const id2 = '220e8400-e29b-41d4-a716-446655440022';
      const id3 = '330e8400-e29b-41d4-a716-446655440033';

      const reorderDto: ReorderModulesDto = { ids: [id3, id1, id2] };
      moduleRepository.update.mockResolvedValue({ affected: 1 } as any);

      await service.reorder(reorderDto);

      expect(moduleRepository.update).toHaveBeenCalledTimes(3);
      expect(moduleRepository.update).toHaveBeenCalledWith(id3, {
        position: 0,
      });
      expect(moduleRepository.update).toHaveBeenCalledWith(id1, {
        position: 1,
      });
      expect(moduleRepository.update).toHaveBeenCalledWith(id2, {
        position: 2,
      });
    });

    it('debe manejar un array vacio sin llamar a update', async () => {
      const reorderDto: ReorderModulesDto = { ids: [] };

      await service.reorder(reorderDto);

      expect(moduleRepository.update).not.toHaveBeenCalled();
    });

    it('debe manejar un solo modulo correctamente', async () => {
      const reorderDto: ReorderModulesDto = { ids: [moduleId] };
      moduleRepository.update.mockResolvedValue({ affected: 1 } as any);

      await service.reorder(reorderDto);

      expect(moduleRepository.update).toHaveBeenCalledTimes(1);
      expect(moduleRepository.update).toHaveBeenCalledWith(moduleId, {
        position: 0,
      });
    });
  });
});
