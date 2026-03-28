import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { TaskStatusesService } from './task-statuses.service';
import { TaskStatus } from './entities/task-status.entity';
import { CreateTaskStatusDto } from './dto/create-task-status.dto';
import { UpdateTaskStatusDto } from './dto/update-task-status.dto';

describe('TaskStatusesService', () => {
  let service: TaskStatusesService;
  let statusRepository: jest.Mocked<Repository<TaskStatus>>;

  const mockStatus: TaskStatus = {
    id: 'status-uuid-1',
    projectId: 'project-uuid-1',
    name: 'En progreso',
    color: '#f59e0b',
    icon: null,
    position: 1,
    isDefault: false,
    isCompleted: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as unknown as TaskStatus;

  const mockDefaultStatuses: TaskStatus[] = [
    {
      id: 'status-1',
      projectId: 'project-uuid-1',
      name: 'Por hacer',
      color: '#6b7280',
      icon: null,
      position: 0,
      isDefault: true,
      isCompleted: false,
    } as unknown as TaskStatus,
    {
      id: 'status-2',
      projectId: 'project-uuid-1',
      name: 'En progreso',
      color: '#f59e0b',
      icon: null,
      position: 1,
      isDefault: false,
      isCompleted: false,
    } as unknown as TaskStatus,
    {
      id: 'status-3',
      projectId: 'project-uuid-1',
      name: 'Completado',
      color: '#22c55e',
      icon: null,
      position: 3,
      isDefault: false,
      isCompleted: true,
    } as unknown as TaskStatus,
  ];

  beforeEach(async () => {
    const mockStatusRepository = {
      findOne: jest.fn(),
      find: jest.fn(),
      findBy: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
      createQueryBuilder: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TaskStatusesService,
        {
          provide: getRepositoryToken(TaskStatus),
          useValue: mockStatusRepository,
        },
      ],
    }).compile();

    service = module.get<TaskStatusesService>(TaskStatusesService);
    statusRepository = module.get(getRepositoryToken(TaskStatus));
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  describe('findByProject', () => {
    it('debe retornar los estados de un proyecto ordenados por posición', async () => {
      statusRepository.find.mockResolvedValue(mockDefaultStatuses);

      const result = await service.findByProject('project-uuid-1');

      expect(statusRepository.find).toHaveBeenCalledWith({
        where: { projectId: 'project-uuid-1' },
        order: { position: 'ASC' },
      });
      expect(result).toEqual(mockDefaultStatuses);
    });

    it('debe retornar array vacío si no hay estados para el proyecto', async () => {
      statusRepository.find.mockResolvedValue([]);

      const result = await service.findByProject('empty-project');

      expect(result).toEqual([]);
    });
  });

  describe('findGlobal', () => {
    it('debe retornar los estados globales (projectId IS NULL)', async () => {
      const mockQb = {
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(mockDefaultStatuses),
      };
      statusRepository.createQueryBuilder.mockReturnValue(mockQb as any);

      const result = await service.findGlobal();

      expect(statusRepository.createQueryBuilder).toHaveBeenCalledWith('ts');
      expect(mockQb.where).toHaveBeenCalledWith('ts.projectId IS NULL');
      expect(mockQb.orderBy).toHaveBeenCalledWith('ts.position', 'ASC');
      expect(result).toEqual(mockDefaultStatuses);
    });
  });

  describe('findById', () => {
    it('debe retornar el estado si existe', async () => {
      statusRepository.findOne.mockResolvedValue(mockStatus);

      const result = await service.findById(mockStatus.id);

      expect(result).toEqual(mockStatus);
      expect(statusRepository.findOne).toHaveBeenCalledWith({
        where: { id: mockStatus.id },
      });
    });

    it('debe lanzar NotFoundException si el estado no existe', async () => {
      statusRepository.findOne.mockResolvedValue(null);

      await expect(service.findById('non-existent')).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.findById('non-existent')).rejects.toThrow(
        'Estado no encontrado',
      );
    });
  });

  describe('findByIds', () => {
    it('debe retornar los estados por un array de IDs', async () => {
      statusRepository.findBy.mockResolvedValue(mockDefaultStatuses);

      const ids = ['status-1', 'status-2', 'status-3'];
      const result = await service.findByIds(ids);

      expect(statusRepository.findBy).toHaveBeenCalled();
      expect(result).toEqual(mockDefaultStatuses);
    });

    it('debe retornar array vacío si el array de IDs está vacío', async () => {
      const result = await service.findByIds([]);

      expect(result).toEqual([]);
      expect(statusRepository.findBy).not.toHaveBeenCalled();
    });
  });

  describe('create', () => {
    const createDto: CreateTaskStatusDto = {
      name: 'Bloqueado',
      color: '#ef4444',
      isDefault: false,
      isCompleted: false,
    };

    it('debe crear un estado con la posición calculada correctamente', async () => {
      const mockQb = {
        where: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ max: 3 }),
      };
      statusRepository.createQueryBuilder.mockReturnValue(mockQb as any);

      const newStatus = {
        ...createDto,
        id: 'new-status-uuid',
        projectId: 'project-uuid-1',
        position: 4,
      };
      statusRepository.create.mockReturnValue(newStatus as any);
      statusRepository.save.mockResolvedValue(newStatus as any);

      const result = await service.create('project-uuid-1', createDto);

      expect(statusRepository.create).toHaveBeenCalledWith({
        ...createDto,
        projectId: 'project-uuid-1',
        position: 4,
      });
      expect(result).toEqual(newStatus);
    });

    it('debe asignar posición 0 si no hay estados previos', async () => {
      const mockQb = {
        where: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ max: null }),
      };
      statusRepository.createQueryBuilder.mockReturnValue(mockQb as any);

      const newStatus = {
        ...createDto,
        id: 'new-status-uuid',
        projectId: 'project-uuid-1',
        position: 0,
      };
      statusRepository.create.mockReturnValue(newStatus as any);
      statusRepository.save.mockResolvedValue(newStatus as any);

      const result = await service.create('project-uuid-1', createDto);

      expect(statusRepository.create).toHaveBeenCalledWith({
        ...createDto,
        projectId: 'project-uuid-1',
        position: 0,
      });
      expect(result).toEqual(newStatus);
    });
  });

  describe('update', () => {
    const updateDto: UpdateTaskStatusDto = {
      name: 'En revisión actualizado',
      color: '#a855f7',
    };

    it('debe actualizar el estado correctamente', async () => {
      statusRepository.findOne.mockResolvedValue(mockStatus);
      statusRepository.save.mockResolvedValue({
        ...mockStatus,
        ...updateDto,
      } as TaskStatus);

      const result = await service.update(mockStatus.id, updateDto);

      expect(result.name).toBe('En revisión actualizado');
      expect(result.color).toBe('#a855f7');
      expect(statusRepository.save).toHaveBeenCalled();
    });

    it('debe lanzar NotFoundException si el estado no existe', async () => {
      statusRepository.findOne.mockResolvedValue(null);

      await expect(service.update('non-existent', updateDto)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('remove', () => {
    it('debe eliminar el estado correctamente', async () => {
      statusRepository.findOne.mockResolvedValue(mockStatus);
      statusRepository.delete.mockResolvedValue({ affected: 1 } as any);

      await service.remove(mockStatus.id);

      expect(statusRepository.delete).toHaveBeenCalledWith(mockStatus.id);
    });

    it('debe lanzar NotFoundException si el estado no existe', async () => {
      statusRepository.findOne.mockResolvedValue(null);

      await expect(service.remove('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('createDefaultStatuses', () => {
    it('debe crear 4 estados por defecto para un proyecto', async () => {
      statusRepository.create.mockImplementation(
        (data) => data as unknown as TaskStatus,
      );
      statusRepository.save.mockResolvedValue([] as any);

      await service.createDefaultStatuses('project-uuid-1');

      expect(statusRepository.create).toHaveBeenCalledTimes(4);
      expect(statusRepository.save).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            name: 'Por hacer',
            position: 0,
            isDefault: true,
          }),
          expect.objectContaining({
            name: 'En progreso',
            position: 1,
          }),
          expect.objectContaining({
            name: 'En revision',
            position: 2,
          }),
          expect.objectContaining({
            name: 'Completado',
            position: 3,
            isCompleted: true,
          }),
        ]),
      );
    });
  });

  describe('handleProjectCreated', () => {
    it('debe crear statuses default al recibir evento project.created', async () => {
      statusRepository.create.mockImplementation(
        (data) => data as unknown as TaskStatus,
      );
      statusRepository.save.mockResolvedValue([] as any);

      await service.handleProjectCreated({ projectId: 'new-project-uuid' });

      expect(statusRepository.create).toHaveBeenCalledTimes(4);
      expect(statusRepository.save).toHaveBeenCalled();
    });

    it('debe manejar errores sin propagarlos (logging only)', async () => {
      statusRepository.create.mockImplementation(() => {
        throw new Error('DB error');
      });

      // Should not throw — error is caught and logged
      await expect(
        service.handleProjectCreated({ projectId: 'failing-project' }),
      ).resolves.not.toThrow();
    });
  });

  describe('createGlobalDefaults', () => {
    it('debe crear 3 estados globales si no existen', async () => {
      statusRepository.findOne.mockResolvedValue(null);
      statusRepository.create.mockImplementation(
        (data) => data as unknown as TaskStatus,
      );
      statusRepository.save.mockResolvedValue({} as any);

      await service.createGlobalDefaults();

      // 3 global statuses: Por hacer, En progreso, Completado
      expect(statusRepository.create).toHaveBeenCalledTimes(3);
      expect(statusRepository.save).toHaveBeenCalledTimes(3);
    });

    it('debe no crear nada si ya existen estados globales', async () => {
      statusRepository.findOne.mockResolvedValue(mockStatus);

      await service.createGlobalDefaults();

      expect(statusRepository.create).not.toHaveBeenCalled();
      expect(statusRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('getDefaultStatus', () => {
    it('debe retornar el estado por defecto de un proyecto', async () => {
      const defaultStatus = { ...mockStatus, isDefault: true };
      statusRepository.findOne.mockResolvedValue(defaultStatus as TaskStatus);

      const result = await service.getDefaultStatus('project-uuid-1');

      expect(statusRepository.findOne).toHaveBeenCalledWith({
        where: { projectId: 'project-uuid-1', isDefault: true },
      });
      expect(result).toEqual(defaultStatus);
    });

    it('debe retornar el estado global por defecto si projectId es null', async () => {
      const mockQb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(mockDefaultStatuses[0]),
      };
      statusRepository.createQueryBuilder.mockReturnValue(mockQb as any);

      const result = await service.getDefaultStatus(null);

      expect(statusRepository.createQueryBuilder).toHaveBeenCalledWith('ts');
      expect(mockQb.where).toHaveBeenCalledWith('ts.projectId IS NULL');
      expect(result).toEqual(mockDefaultStatuses[0]);
    });

    it('debe retornar null si no hay estado por defecto', async () => {
      statusRepository.findOne.mockResolvedValue(null);

      const result = await service.getDefaultStatus('project-no-default');

      expect(result).toBeNull();
    });
  });
});
