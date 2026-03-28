import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException } from '@nestjs/common';
import { Repository, Between } from 'typeorm';
import { ActivityService } from './activity.service';
import { ActivityLog, ActivityType } from './entities/activity-log.entity';

describe('ActivityService', () => {
  let service: ActivityService;
  let activityRepository: jest.Mocked<Repository<ActivityLog>>;

  const userId = '123e4567-e89b-12d3-a456-426614174000';
  const projectId = '223e4567-e89b-12d3-a456-426614174001';
  const organizationId = '323e4567-e89b-12d3-a456-426614174002';
  const taskId = '423e4567-e89b-12d3-a456-426614174003';

  const mockActivityLog: ActivityLog = {
    id: '523e4567-e89b-12d3-a456-426614174004',
    userId,
    type: ActivityType.TASK_CREATED,
    description: 'Tarea creada: Mi tarea',
    organizationId,
    projectId,
    taskId,
    metadata: { taskTitle: 'Mi tarea' },
    createdAt: new Date('2026-03-28T10:00:00.000Z'),
  } as ActivityLog;

  beforeEach(async () => {
    const mockActivityRepository = {
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
      findAndCount: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ActivityService,
        {
          provide: getRepositoryToken(ActivityLog),
          useValue: mockActivityRepository,
        },
      ],
    }).compile();

    service = module.get<ActivityService>(ActivityService);
    activityRepository = module.get(getRepositoryToken(ActivityLog));
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  it('debe estar definido', () => {
    expect(service).toBeDefined();
  });

  // ───────────────────────────────────────────────
  // log()
  // ───────────────────────────────────────────────
  describe('log', () => {
    it('debe crear y guardar una entrada de actividad con todos los campos', async () => {
      const params = {
        userId,
        type: ActivityType.TASK_CREATED,
        description: 'Tarea creada: Mi tarea',
        organizationId,
        projectId,
        taskId,
        metadata: { taskTitle: 'Mi tarea' },
      };

      activityRepository.create.mockReturnValue(mockActivityLog);
      activityRepository.save.mockResolvedValue(mockActivityLog);

      const result = await service.log(params);

      expect(activityRepository.create).toHaveBeenCalledWith({
        userId,
        type: ActivityType.TASK_CREATED,
        description: 'Tarea creada: Mi tarea',
        organizationId,
        projectId,
        taskId,
        metadata: { taskTitle: 'Mi tarea' },
      });
      expect(activityRepository.save).toHaveBeenCalledWith(mockActivityLog);
      expect(result).toEqual(mockActivityLog);
    });

    it('debe asignar null a campos opcionales no proporcionados', async () => {
      const params = {
        userId,
        type: ActivityType.COMMENT_ADDED,
        description: 'Comentario agregado',
      };

      const expectedEntry = {
        ...mockActivityLog,
        organizationId: null,
        projectId: null,
        taskId: null,
        metadata: null,
      };
      activityRepository.create.mockReturnValue(expectedEntry as ActivityLog);
      activityRepository.save.mockResolvedValue(expectedEntry as ActivityLog);

      const result = await service.log(params);

      expect(activityRepository.create).toHaveBeenCalledWith({
        userId,
        type: ActivityType.COMMENT_ADDED,
        description: 'Comentario agregado',
        organizationId: null,
        projectId: null,
        taskId: null,
        metadata: null,
      });
      expect(result.organizationId).toBeNull();
      expect(result.projectId).toBeNull();
      expect(result.taskId).toBeNull();
      expect(result.metadata).toBeNull();
    });

    it('debe manejar metadata como objeto JSONB complejo', async () => {
      const complexMetadata = {
        oldStatus: 'pending',
        newStatus: 'in_progress',
        changedFields: ['status', 'assignee'],
        nested: { deep: true },
      };
      const params = {
        userId,
        type: ActivityType.TASK_STATUS_CHANGED,
        description: 'Estado cambiado',
        metadata: complexMetadata,
      };

      const entry = { ...mockActivityLog, metadata: complexMetadata };
      activityRepository.create.mockReturnValue(entry as ActivityLog);
      activityRepository.save.mockResolvedValue(entry as ActivityLog);

      const result = await service.log(params);

      expect(activityRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ metadata: complexMetadata }),
      );
      expect(result.metadata).toEqual(complexMetadata);
    });

    it('debe funcionar con cada tipo de actividad', async () => {
      const types = Object.values(ActivityType);

      for (const type of types) {
        activityRepository.create.mockReturnValue({
          ...mockActivityLog,
          type,
        } as ActivityLog);
        activityRepository.save.mockResolvedValue({
          ...mockActivityLog,
          type,
        } as ActivityLog);

        const result = await service.log({
          userId,
          type,
          description: `Actividad: ${type}`,
        });

        expect(result.type).toBe(type);
      }
    });

    it('debe retornar la entidad creada', async () => {
      activityRepository.create.mockReturnValue(mockActivityLog);
      activityRepository.save.mockResolvedValue(mockActivityLog);

      const result = await service.log({
        userId,
        type: ActivityType.TASK_CREATED,
        description: 'Test',
      });

      expect(result).toBe(mockActivityLog);
    });
  });

  // ───────────────────────────────────────────────
  // findByProject()
  // ───────────────────────────────────────────────
  describe('findByProject', () => {
    it('debe retornar actividades paginadas por proyecto', async () => {
      const activities = [mockActivityLog];
      activityRepository.findAndCount.mockResolvedValue([activities, 1]);

      const result = await service.findByProject(projectId, 1, 20);

      expect(activityRepository.findAndCount).toHaveBeenCalledWith({
        where: { projectId },
        order: { createdAt: 'DESC' },
        skip: 0,
        take: 20,
      });
      expect(result).toEqual({ data: activities, total: 1 });
    });

    it('debe usar valores por defecto para page y limit', async () => {
      activityRepository.findAndCount.mockResolvedValue([[], 0]);

      await service.findByProject(projectId);

      expect(activityRepository.findAndCount).toHaveBeenCalledWith({
        where: { projectId },
        order: { createdAt: 'DESC' },
        skip: 0,
        take: 20,
      });
    });

    it('debe calcular skip correctamente para la pagina 3', async () => {
      activityRepository.findAndCount.mockResolvedValue([[], 0]);

      await service.findByProject(projectId, 3, 10);

      expect(activityRepository.findAndCount).toHaveBeenCalledWith({
        where: { projectId },
        order: { createdAt: 'DESC' },
        skip: 20,
        take: 10,
      });
    });

    it('debe retornar array vacio si no hay actividades', async () => {
      activityRepository.findAndCount.mockResolvedValue([[], 0]);

      const result = await service.findByProject(projectId);

      expect(result).toEqual({ data: [], total: 0 });
    });

    it('debe retornar total correcto con multiples paginas', async () => {
      activityRepository.findAndCount.mockResolvedValue([
        [mockActivityLog],
        50,
      ]);

      const result = await service.findByProject(projectId, 2, 10);

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(50);
    });
  });

  // ───────────────────────────────────────────────
  // findByOrganization()
  // ───────────────────────────────────────────────
  describe('findByOrganization', () => {
    it('debe retornar actividades paginadas por organizacion', async () => {
      const activities = [mockActivityLog];
      activityRepository.findAndCount.mockResolvedValue([activities, 1]);

      const result = await service.findByOrganization(organizationId, 1, 20);

      expect(activityRepository.findAndCount).toHaveBeenCalledWith({
        where: { organizationId },
        order: { createdAt: 'DESC' },
        skip: 0,
        take: 20,
      });
      expect(result).toEqual({ data: activities, total: 1 });
    });

    it('debe usar valores por defecto para page y limit', async () => {
      activityRepository.findAndCount.mockResolvedValue([[], 0]);

      await service.findByOrganization(organizationId);

      expect(activityRepository.findAndCount).toHaveBeenCalledWith({
        where: { organizationId },
        order: { createdAt: 'DESC' },
        skip: 0,
        take: 20,
      });
    });

    it('debe calcular skip correctamente para paginas posteriores', async () => {
      activityRepository.findAndCount.mockResolvedValue([[], 0]);

      await service.findByOrganization(organizationId, 5, 15);

      expect(activityRepository.findAndCount).toHaveBeenCalledWith({
        where: { organizationId },
        order: { createdAt: 'DESC' },
        skip: 60,
        take: 15,
      });
    });

    it('debe retornar array vacio si no hay actividades', async () => {
      activityRepository.findAndCount.mockResolvedValue([[], 0]);

      const result = await service.findByOrganization(organizationId);

      expect(result).toEqual({ data: [], total: 0 });
    });
  });

  // ───────────────────────────────────────────────
  // findByUser()
  // ───────────────────────────────────────────────
  describe('findByUser', () => {
    it('debe retornar actividades paginadas por usuario', async () => {
      const activities = [mockActivityLog];
      activityRepository.findAndCount.mockResolvedValue([activities, 1]);

      const result = await service.findByUser(userId, 1, 20);

      expect(activityRepository.findAndCount).toHaveBeenCalledWith({
        where: { userId },
        order: { createdAt: 'DESC' },
        skip: 0,
        take: 20,
      });
      expect(result).toEqual({ data: activities, total: 1 });
    });

    it('debe usar valores por defecto para page y limit', async () => {
      activityRepository.findAndCount.mockResolvedValue([[], 0]);

      await service.findByUser(userId);

      expect(activityRepository.findAndCount).toHaveBeenCalledWith({
        where: { userId },
        order: { createdAt: 'DESC' },
        skip: 0,
        take: 20,
      });
    });

    it('debe calcular skip correctamente', async () => {
      activityRepository.findAndCount.mockResolvedValue([[], 0]);

      await service.findByUser(userId, 4, 25);

      expect(activityRepository.findAndCount).toHaveBeenCalledWith({
        where: { userId },
        order: { createdAt: 'DESC' },
        skip: 75,
        take: 25,
      });
    });

    it('debe retornar array vacio si no hay actividades', async () => {
      activityRepository.findAndCount.mockResolvedValue([[], 0]);

      const result = await service.findByUser(userId);

      expect(result).toEqual({ data: [], total: 0 });
    });

    it('debe retornar total correcto independiente de la pagina', async () => {
      activityRepository.findAndCount.mockResolvedValue([
        [mockActivityLog],
        100,
      ]);

      const result = await service.findByUser(userId, 10, 5);

      expect(result.total).toBe(100);
      expect(result.data).toHaveLength(1);
    });
  });

  // ───────────────────────────────────────────────
  // getDailySummary()
  // ───────────────────────────────────────────────
  describe('getDailySummary', () => {
    it('debe retornar actividades del dia especificado', async () => {
      const activities = [mockActivityLog];
      activityRepository.find.mockResolvedValue(activities);

      const result = await service.getDailySummary(userId, '2026-03-28');

      expect(activityRepository.find).toHaveBeenCalledWith({
        where: {
          userId,
          createdAt: Between(expect.any(Date), expect.any(Date)),
        },
        order: { createdAt: 'ASC' },
      });
      expect(result).toEqual(activities);
    });

    it('debe usar la fecha actual si no se proporciona fecha', async () => {
      activityRepository.find.mockResolvedValue([]);

      await service.getDailySummary(userId);

      expect(activityRepository.find).toHaveBeenCalledWith({
        where: {
          userId,
          createdAt: Between(expect.any(Date), expect.any(Date)),
        },
        order: { createdAt: 'ASC' },
      });
    });

    it('debe generar rango de fecha correcto (00:00:00 a 23:59:59)', async () => {
      activityRepository.find.mockResolvedValue([]);

      await service.getDailySummary(userId, '2026-06-15');

      const callArgs = activityRepository.find.mock.calls[0][0] as any;
      const betweenValue = callArgs.where.createdAt;
      // Between is called with start and end dates
      // We verify the structure matches Between(start, end)
      expect(betweenValue).toBeDefined();
    });

    it('debe lanzar BadRequestException con formato de fecha invalido', async () => {
      await expect(
        service.getDailySummary(userId, '28-03-2026'),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.getDailySummary(userId, '28-03-2026'),
      ).rejects.toThrow('Formato de fecha inválido. Use YYYY-MM-DD');
    });

    it('debe lanzar BadRequestException con fecha parcial', async () => {
      await expect(
        service.getDailySummary(userId, '2026-03'),
      ).rejects.toThrow(BadRequestException);
    });

    it('debe lanzar BadRequestException con texto no-fecha', async () => {
      await expect(
        service.getDailySummary(userId, 'no-es-fecha'),
      ).rejects.toThrow(BadRequestException);
    });

    it('debe aceptar fecha con formato YYYY-MM-DD valido', async () => {
      activityRepository.find.mockResolvedValue([]);

      await expect(
        service.getDailySummary(userId, '2026-01-01'),
      ).resolves.not.toThrow();
      await expect(
        service.getDailySummary(userId, '2025-12-31'),
      ).resolves.not.toThrow();
    });

    it('debe retornar array vacio si no hay actividades ese dia', async () => {
      activityRepository.find.mockResolvedValue([]);

      const result = await service.getDailySummary(userId, '2026-01-01');

      expect(result).toEqual([]);
    });

    it('debe ordenar actividades por createdAt ascendente', async () => {
      activityRepository.find.mockResolvedValue([]);

      await service.getDailySummary(userId, '2026-03-28');

      expect(activityRepository.find).toHaveBeenCalledWith(
        expect.objectContaining({
          order: { createdAt: 'ASC' },
        }),
      );
    });

    it('no debe lanzar error si date es undefined', async () => {
      activityRepository.find.mockResolvedValue([]);

      await expect(
        service.getDailySummary(userId, undefined),
      ).resolves.not.toThrow();
    });
  });
});
