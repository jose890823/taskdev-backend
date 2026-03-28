import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { DataSource, In } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { TasksService } from './tasks.service';
import { Task, TaskType, TaskPriority } from './entities/task.entity';
import { TaskAssignee } from './entities/task-assignee.entity';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { TaskStatusesService } from '../task-statuses/task-statuses.service';
import { ProjectsService } from '../projects/projects.service';
import { OrganizationsService } from '../organizations/organizations.service';
import { User, UserRole } from '../auth/entities/user.entity';
import { ProjectRole } from '../projects/entities/project-member.entity';

// ── Helpers ──

function createMockQueryBuilder(result: any, count = 0) {
  const qb: Record<string, jest.Mock> = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    setParameters: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockResolvedValue(Array.isArray(result) ? result : []),
    getOne: jest.fn().mockResolvedValue(result),
    getCount: jest.fn().mockResolvedValue(count),
    getManyAndCount: jest
      .fn()
      .mockResolvedValue([Array.isArray(result) ? result : [], count]),
    getRawMany: jest.fn().mockResolvedValue([]),
  };
  return qb;
}

function mockUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-1',
    email: 'test@example.com',
    firstName: 'Test',
    lastName: 'User',
    roles: [UserRole.USER],
    ...overrides,
  } as unknown as User;
}

function mockTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    systemCode: 'TSK-260218-A1B2',
    type: TaskType.PROJECT,
    title: 'Test Task',
    description: null,
    projectId: 'project-1',
    moduleId: null,
    parentId: null,
    statusId: 'status-1',
    assignedToId: null,
    createdById: 'user-1',
    organizationId: null,
    priority: TaskPriority.MEDIUM,
    scheduledDate: null,
    dueDate: null,
    completedAt: null,
    position: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    ...overrides,
  } as Task;
}

// ── Test Suite ──

describe('TasksService', () => {
  let service: TasksService;

  // Mocks
  const mockTaskRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    findBy: jest.fn(),
    softDelete: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const mockTaskAssigneeRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    delete: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const mockTaskStatusesService = {
    findById: jest.fn(),
    findByIds: jest.fn(),
    findByProject: jest.fn(),
    getDefaultStatus: jest.fn(),
  };

  const mockProjectsService = {
    findById: jest.fn(),
    getMemberRole: jest.fn(),
    verifyMemberAccess: jest.fn(),
    isMember: jest.fn(),
  };

  const mockOrganizationsService = {
    verifyMemberAccess: jest.fn(),
  };

  const mockQueryRunner = {
    connect: jest.fn(),
    startTransaction: jest.fn(),
    commitTransaction: jest.fn(),
    rollbackTransaction: jest.fn(),
    release: jest.fn(),
    manager: {
      update: jest.fn(),
      save: jest.fn(),
    },
  };

  // DataSource mock — needs getRepository for Comment / TaskCommentRead / User
  const mockCommentQb = createMockQueryBuilder([]);
  const mockTaskCommentReadQb = createMockQueryBuilder([]);
  const mockUserQb = createMockQueryBuilder([]);

  const mockDataSource = {
    createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner),
    getRepository: jest.fn().mockImplementation(() => ({
      createQueryBuilder: jest.fn().mockReturnValue(mockCommentQb),
    })),
  };

  const mockEventEmitter = {
    emit: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TasksService,
        {
          provide: getRepositoryToken(Task),
          useValue: mockTaskRepository,
        },
        {
          provide: getRepositoryToken(TaskAssignee),
          useValue: mockTaskAssigneeRepository,
        },
        {
          provide: TaskStatusesService,
          useValue: mockTaskStatusesService,
        },
        {
          provide: ProjectsService,
          useValue: mockProjectsService,
        },
        {
          provide: OrganizationsService,
          useValue: mockOrganizationsService,
        },
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
        {
          provide: EventEmitter2,
          useValue: mockEventEmitter,
        },
      ],
    }).compile();

    service = module.get<TasksService>(TasksService);
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  // ── create() ──

  describe('create', () => {
    const user = mockUser();

    it('debe crear una tarea de proyecto con status por defecto', async () => {
      const dto: CreateTaskDto = {
        title: 'Nueva tarea',
        projectId: 'project-1',
      };
      const defaultStatus = { id: 'status-default', name: 'Por hacer' };
      const createdTask = mockTask({ title: dto.title, statusId: defaultStatus.id });

      mockTaskStatusesService.getDefaultStatus.mockResolvedValue(defaultStatus);
      mockTaskRepository.create.mockReturnValue(createdTask);
      mockTaskRepository.save.mockResolvedValue(createdTask);

      const result = await service.create(dto, user);

      expect(mockTaskStatusesService.getDefaultStatus).toHaveBeenCalledWith('project-1');
      expect(mockTaskRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Nueva tarea',
          type: TaskType.PROJECT,
          createdById: 'user-1',
        }),
      );
      expect(mockTaskRepository.save).toHaveBeenCalledWith(createdTask);
      expect(result).toEqual(createdTask);
    });

    it('debe crear una tarea daily cuando no hay projectId', async () => {
      const dto: CreateTaskDto = { title: 'Tarea diaria' };
      const defaultStatus = { id: 'status-default' };
      const createdTask = mockTask({
        title: dto.title,
        type: TaskType.DAILY,
        projectId: null,
      });

      mockTaskStatusesService.getDefaultStatus.mockResolvedValue(defaultStatus);
      mockTaskRepository.create.mockReturnValue(createdTask);
      mockTaskRepository.save.mockResolvedValue(createdTask);

      await service.create(dto, user);

      expect(mockTaskRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ type: TaskType.DAILY }),
      );
    });

    it('debe guardar assignees cuando se proveen assignedToIds', async () => {
      const dto: CreateTaskDto = {
        title: 'Con asignados',
        projectId: 'project-1',
        assignedToIds: ['user-2', 'user-3'],
      };
      const createdTask = mockTask({ id: 'task-new', title: dto.title });

      mockTaskStatusesService.getDefaultStatus.mockResolvedValue({ id: 'status-1' });
      mockTaskRepository.create.mockReturnValue(createdTask);
      mockTaskRepository.save.mockResolvedValue(createdTask);
      mockTaskAssigneeRepository.delete.mockResolvedValue(undefined);
      mockTaskAssigneeRepository.create.mockImplementation((data) => data);
      mockTaskAssigneeRepository.save.mockResolvedValue(undefined);

      await service.create(dto, user);

      expect(mockTaskAssigneeRepository.delete).toHaveBeenCalledWith({
        taskId: 'task-new',
      });
      expect(mockTaskAssigneeRepository.create).toHaveBeenCalledTimes(2);
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'task.assigned',
        expect.objectContaining({
          taskId: 'task-new',
          assignedToId: 'user-2',
        }),
      );
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'task.assigned',
        expect.objectContaining({
          assignedToId: 'user-3',
        }),
      );
    });

    it('no debe emitir task.assigned si el asignado es el mismo creador', async () => {
      const dto: CreateTaskDto = {
        title: 'Auto-asignada',
        projectId: 'project-1',
        assignedToIds: ['user-1'],
      };
      const createdTask = mockTask({ id: 'task-new', title: dto.title });

      mockTaskStatusesService.getDefaultStatus.mockResolvedValue({ id: 's1' });
      mockTaskRepository.create.mockReturnValue(createdTask);
      mockTaskRepository.save.mockResolvedValue(createdTask);
      mockTaskAssigneeRepository.delete.mockResolvedValue(undefined);
      mockTaskAssigneeRepository.create.mockImplementation((data) => data);
      mockTaskAssigneeRepository.save.mockResolvedValue(undefined);

      await service.create(dto, user);

      expect(mockEventEmitter.emit).not.toHaveBeenCalledWith(
        'task.assigned',
        expect.anything(),
      );
    });

    it('debe usar el statusId proporcionado en lugar del default', async () => {
      const dto: CreateTaskDto = {
        title: 'Con status',
        projectId: 'project-1',
        statusId: 'custom-status',
      };
      const createdTask = mockTask({ title: dto.title, statusId: 'custom-status' });

      mockTaskRepository.create.mockReturnValue(createdTask);
      mockTaskRepository.save.mockResolvedValue(createdTask);

      await service.create(dto, user);

      expect(mockTaskStatusesService.getDefaultStatus).not.toHaveBeenCalled();
      expect(mockTaskRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ statusId: 'custom-status' }),
      );
    });

    it('debe soportar legacy assignedToId', async () => {
      const dto: CreateTaskDto = {
        title: 'Legacy assign',
        projectId: 'project-1',
        assignedToId: 'user-5',
      };
      const createdTask = mockTask({ id: 'task-legacy', title: dto.title });

      mockTaskStatusesService.getDefaultStatus.mockResolvedValue({ id: 's1' });
      mockTaskRepository.create.mockReturnValue(createdTask);
      mockTaskRepository.save.mockResolvedValue(createdTask);
      mockTaskAssigneeRepository.delete.mockResolvedValue(undefined);
      mockTaskAssigneeRepository.create.mockImplementation((data) => data);
      mockTaskAssigneeRepository.save.mockResolvedValue(undefined);

      await service.create(dto, user);

      // Should save assignee via saveAssignees
      expect(mockTaskAssigneeRepository.delete).toHaveBeenCalledWith({
        taskId: 'task-legacy',
      });
    });
  });

  // ── findById() ──

  describe('findById', () => {
    it('debe encontrar una tarea por UUID', async () => {
      const task = mockTask();
      mockTaskRepository.findOne.mockResolvedValue(task);

      const result = await service.findById(
        '123e4567-e89b-12d3-a456-426614174000',
      );

      expect(mockTaskRepository.findOne).toHaveBeenCalledWith({
        where: { id: '123e4567-e89b-12d3-a456-426614174000' },
      });
      expect(result).toEqual(task);
    });

    it('debe encontrar una tarea por systemCode', async () => {
      const task = mockTask();
      mockTaskRepository.findOne.mockResolvedValue(task);

      const result = await service.findById('TSK-260218-A1B2');

      expect(mockTaskRepository.findOne).toHaveBeenCalledWith({
        where: { systemCode: 'TSK-260218-A1B2' },
      });
      expect(result).toEqual(task);
    });

    it('debe lanzar NotFoundException si la tarea no existe', async () => {
      mockTaskRepository.findOne.mockResolvedValue(null);

      await expect(service.findById('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.findById('nonexistent')).rejects.toThrow(
        'Tarea no encontrada',
      );
    });
  });

  // ── findMyTasks() ──

  describe('findMyTasks', () => {
    it('debe retornar las tareas del usuario (creadas + asignadas)', async () => {
      const tasks = [mockTask({ id: 'task-1' }), mockTask({ id: 'task-2' })];
      const mainQb = createMockQueryBuilder(tasks);
      mockTaskRepository.createQueryBuilder.mockReturnValue(mainQb);

      // hydrateTasks: assignee QB
      const assigneeQb = createMockQueryBuilder([]);
      mockTaskAssigneeRepository.createQueryBuilder.mockReturnValue(assigneeQb);

      const result = await service.findMyTasks('user-1');

      expect(mainQb.where).toHaveBeenCalled();
      expect(result).toHaveLength(2);
      expect(result[0]).toHaveProperty('assignees');
    });

    it('debe filtrar por tipo cuando se provee', async () => {
      const mainQb = createMockQueryBuilder([]);
      mockTaskRepository.createQueryBuilder.mockReturnValue(mainQb);

      await service.findMyTasks('user-1', TaskType.DAILY);

      expect(mainQb.andWhere).toHaveBeenCalledWith('t.type = :type', {
        type: TaskType.DAILY,
      });
    });

    it('debe retornar array vacio si no hay tareas', async () => {
      const mainQb = createMockQueryBuilder([]);
      mockTaskRepository.createQueryBuilder.mockReturnValue(mainQb);

      const result = await service.findMyTasks('user-1');

      expect(result).toEqual([]);
    });
  });

  // ── findDailyTasks() ──

  describe('findDailyTasks', () => {
    it('debe retornar tareas diarias para una fecha', async () => {
      const tasks = [mockTask({ type: TaskType.DAILY })];
      const mainQb = createMockQueryBuilder(tasks);
      mockTaskRepository.createQueryBuilder.mockReturnValue(mainQb);

      const assigneeQb = createMockQueryBuilder([]);
      mockTaskAssigneeRepository.createQueryBuilder.mockReturnValue(assigneeQb);

      const result = await service.findDailyTasks('user-1', '2026-03-28');

      expect(mainQb.andWhere).toHaveBeenCalledWith(
        't.scheduledDate = :date',
        { date: '2026-03-28' },
      );
      expect(result).toHaveLength(1);
    });

    it('debe lanzar BadRequestException con fecha invalida', async () => {
      await expect(
        service.findDailyTasks('user-1', 'invalid-date'),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.findDailyTasks('user-1', '28/03/2026'),
      ).rejects.toThrow('Formato de fecha');
    });

    it('debe usar la fecha actual si no se proporciona', async () => {
      const mainQb = createMockQueryBuilder([]);
      mockTaskRepository.createQueryBuilder.mockReturnValue(mainQb);

      await service.findDailyTasks('user-1');

      expect(mainQb.andWhere).toHaveBeenCalledWith(
        't.scheduledDate = :date',
        expect.objectContaining({ date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) }),
      );
    });
  });

  // ── update() ──

  describe('update', () => {
    it('debe actualizar una tarea exitosamente', async () => {
      const existing = mockTask();
      const dto: UpdateTaskDto = { title: 'Titulo actualizado' };
      const savedTask = { ...existing, title: 'Titulo actualizado' };

      mockTaskRepository.findOne.mockResolvedValue(existing);
      mockTaskRepository.save.mockResolvedValue(savedTask);
      // getTaskAssignees
      mockTaskAssigneeRepository.find.mockResolvedValue([]);

      const result = await service.update('task-1', dto);

      expect(mockTaskRepository.save).toHaveBeenCalled();
      expect(result).toHaveProperty('assignees');
      expect(result.assignees).toEqual([]);
    });

    it('debe lanzar NotFoundException si la tarea no existe', async () => {
      mockTaskRepository.findOne.mockResolvedValue(null);

      await expect(
        service.update('nonexistent', { title: 'x' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('debe establecer completedAt cuando el nuevo status es completed', async () => {
      const existing = mockTask({ statusId: 'status-1', completedAt: null });
      const dto: UpdateTaskDto = { statusId: 'status-completed' };
      const completedStatus = {
        id: 'status-completed',
        name: 'Completado',
        isCompleted: true,
      };

      mockTaskRepository.findOne.mockResolvedValue(existing);
      mockTaskStatusesService.findById.mockResolvedValue(completedStatus);
      mockTaskRepository.save.mockImplementation(async (task) => task);
      mockTaskAssigneeRepository.find.mockResolvedValue([]);

      const result = await service.update('task-1', dto);

      expect(result.completedAt).toBeInstanceOf(Date);
    });

    it('debe resetear completedAt cuando el nuevo status NO es completed', async () => {
      const existing = mockTask({
        statusId: 'status-completed',
        completedAt: new Date(),
      });
      const dto: UpdateTaskDto = { statusId: 'status-inprogress' };
      const inProgressStatus = {
        id: 'status-inprogress',
        name: 'En progreso',
        isCompleted: false,
      };

      mockTaskRepository.findOne.mockResolvedValue(existing);
      mockTaskStatusesService.findById.mockResolvedValue(inProgressStatus);
      mockTaskRepository.save.mockImplementation(async (task) => task);
      mockTaskAssigneeRepository.find.mockResolvedValue([]);

      const result = await service.update('task-1', dto);

      expect(result.completedAt).toBeNull();
    });

    it('debe actualizar assignees cuando se proveen assignedToIds', async () => {
      const existing = mockTask({ parentId: null });
      const dto: UpdateTaskDto = { assignedToIds: ['user-2', 'user-3'] };

      mockTaskRepository.findOne.mockResolvedValue(existing);
      // First call: getTaskAssignees for old assignees (before update)
      // Second call: getTaskAssignees for final result
      mockTaskAssigneeRepository.find.mockResolvedValueOnce([
        { taskId: 'task-1', userId: 'user-old', user: { id: 'user-old', firstName: 'Old', lastName: 'User', email: 'old@test.com' } },
      ]).mockResolvedValueOnce([
        { taskId: 'task-1', userId: 'user-2', user: { id: 'user-2', firstName: 'A', lastName: 'B', email: 'a@test.com' } },
        { taskId: 'task-1', userId: 'user-3', user: { id: 'user-3', firstName: 'C', lastName: 'D', email: 'c@test.com' } },
      ]);
      mockTaskAssigneeRepository.delete.mockResolvedValue(undefined);
      mockTaskAssigneeRepository.create.mockImplementation((data) => data);
      mockTaskAssigneeRepository.save.mockResolvedValue(undefined);
      mockTaskRepository.save.mockImplementation(async (task) => task);

      const result = await service.update('task-1', dto);

      expect(mockTaskAssigneeRepository.delete).toHaveBeenCalledWith({
        taskId: 'task-1',
      });
      expect(result.assignees).toHaveLength(2);
    });

    it('debe emitir task.status_changed y task.completed cuando cambia status', async () => {
      const existing = mockTask({ statusId: 'status-old' });
      const dto: UpdateTaskDto = { statusId: 'status-completed' };
      const currentUser = mockUser();
      const completedStatus = {
        id: 'status-completed',
        name: 'Completado',
        isCompleted: true,
      };
      const oldStatus = { id: 'status-old', name: 'Por hacer' };

      mockTaskRepository.findOne.mockResolvedValue(existing);
      mockTaskStatusesService.findById
        .mockResolvedValueOnce(completedStatus) // first call in update for isCompleted check
        .mockResolvedValueOnce(oldStatus)       // old status in event emission
        .mockResolvedValueOnce(completedStatus); // new status in event emission
      mockTaskRepository.save.mockImplementation(async (task) => task);
      mockTaskAssigneeRepository.find.mockResolvedValue([]);

      await service.update('task-1', dto, currentUser);

      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'task.status_changed',
        expect.objectContaining({
          taskId: 'task-1',
          newStatusName: 'Completado',
        }),
      );
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'task.completed',
        expect.objectContaining({
          taskId: 'task-1',
          completedByName: 'Test User',
        }),
      );
    });
  });

  // ── remove() ──

  describe('remove', () => {
    it('debe hacer soft delete de una tarea', async () => {
      const task = mockTask();
      mockTaskRepository.findOne.mockResolvedValue(task);
      mockTaskRepository.softDelete.mockResolvedValue({ affected: 1 });

      await service.remove('task-1');

      expect(mockTaskRepository.softDelete).toHaveBeenCalledWith('task-1');
    });

    it('debe lanzar NotFoundException si la tarea no existe', async () => {
      mockTaskRepository.findOne.mockResolvedValue(null);

      await expect(service.remove('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ── createSubtask() ──

  describe('createSubtask', () => {
    const user = mockUser();

    it('debe crear una subtarea bajo una tarea padre', async () => {
      const parent = mockTask({ id: 'parent-1', projectId: 'project-1' });
      const dto: CreateTaskDto = { title: 'Subtarea 1' };
      const subtask = mockTask({
        id: 'subtask-1',
        parentId: 'parent-1',
        title: 'Subtarea 1',
      });

      // findById for parent
      mockTaskRepository.findOne.mockResolvedValueOnce(parent);
      // create() inside createSubtask calls getDefaultStatus + create + save
      mockTaskStatusesService.getDefaultStatus.mockResolvedValue({ id: 'status-1' });
      mockTaskRepository.create.mockReturnValue(subtask);
      mockTaskRepository.save.mockResolvedValue(subtask);
      // getTaskAssignees for parent (for event emission)
      mockTaskAssigneeRepository.find.mockResolvedValue([]);

      const result = await service.createSubtask('parent-1', dto, user);

      expect(result.parentId).toBe('parent-1');
    });

    it('debe lanzar NotFoundException si la tarea padre no existe', async () => {
      mockTaskRepository.findOne.mockResolvedValue(null);

      await expect(
        service.createSubtask('nonexistent', { title: 'x' }, user),
      ).rejects.toThrow(NotFoundException);
    });

    it('debe heredar projectId y organizationId del padre', async () => {
      const parent = mockTask({
        id: 'parent-1',
        projectId: 'proj-x',
        organizationId: 'org-y',
      });
      const dto: CreateTaskDto = { title: 'Subtarea hereda' };
      const subtask = mockTask({ id: 'sub-1', parentId: 'parent-1' });

      mockTaskRepository.findOne.mockResolvedValueOnce(parent);
      mockTaskStatusesService.getDefaultStatus.mockResolvedValue({ id: 's' });
      mockTaskRepository.create.mockReturnValue(subtask);
      mockTaskRepository.save.mockResolvedValue(subtask);
      mockTaskAssigneeRepository.find.mockResolvedValue([]);

      await service.createSubtask('parent-1', dto, user);

      expect(mockTaskRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          projectId: 'proj-x',
          organizationId: 'org-y',
          parentId: 'parent-1',
        }),
      );
    });

    it('debe validar que los asignados de la subtarea sean asignados del padre', async () => {
      const parent = mockTask({ id: 'parent-1' });
      const dto: CreateTaskDto = {
        title: 'Subtarea con asignados invalidos',
        assignedToIds: ['user-invalid'],
      };

      // Mock for both calls to rejects.toThrow
      mockTaskRepository.findOne.mockResolvedValue(parent);
      // validateSubtaskAssignees: parent assignees (each invocation consumes one)
      mockTaskAssigneeRepository.find
        .mockResolvedValueOnce([{ taskId: 'parent-1', userId: 'user-2' }])
        .mockResolvedValueOnce([{ taskId: 'parent-1', userId: 'user-2' }]);

      await expect(
        service.createSubtask('parent-1', dto, user),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.createSubtask('parent-1', dto, user),
      ).rejects.toThrow('asignados de la tarea padre');
    });

    it('debe emitir subtask.created a los asignados del padre', async () => {
      const parent = mockTask({ id: 'parent-1' });
      const dto: CreateTaskDto = { title: 'Subtarea con evento' };
      const subtask = mockTask({ id: 'sub-1', parentId: 'parent-1', title: 'Subtarea con evento' });

      mockTaskRepository.findOne.mockResolvedValueOnce(parent);
      mockTaskStatusesService.getDefaultStatus.mockResolvedValue({ id: 's' });
      mockTaskRepository.create.mockReturnValue(subtask);
      mockTaskRepository.save.mockResolvedValue(subtask);
      // getTaskAssignees for parent (subtask.created event)
      mockTaskAssigneeRepository.find.mockResolvedValue([
        { taskId: 'parent-1', userId: 'user-2', user: { id: 'user-2', firstName: 'A', lastName: 'B', email: 'a@test.com' } },
      ]);

      await service.createSubtask('parent-1', dto, user);

      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'subtask.created',
        expect.objectContaining({
          parentTaskId: 'parent-1',
          subtaskTitle: 'Subtarea con evento',
        }),
      );
    });
  });

  // ── bulkUpdatePositions() ──

  describe('bulkUpdatePositions', () => {
    it('debe actualizar posiciones en una transaccion', async () => {
      const items = [
        { id: 'task-1', position: 0 },
        { id: 'task-2', position: 1 },
      ];
      mockTaskStatusesService.findByIds.mockResolvedValue([]);
      mockQueryRunner.manager.update.mockResolvedValue({ affected: 1 });

      const result = await service.bulkUpdatePositions(items);

      expect(mockQueryRunner.connect).toHaveBeenCalled();
      expect(mockQueryRunner.startTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.manager.update).toHaveBeenCalledTimes(2);
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.release).toHaveBeenCalled();
      expect(result).toEqual({ updated: 2 });
    });

    it('debe actualizar completedAt cuando cambia a status completado', async () => {
      const items = [
        { id: 'task-1', position: 0, statusId: 'status-completed' },
      ];
      const completedStatus = {
        id: 'status-completed',
        name: 'Completado',
        isCompleted: true,
      };
      mockTaskStatusesService.findByIds.mockResolvedValue([completedStatus]);
      mockQueryRunner.manager.update.mockResolvedValue({ affected: 1 });

      await service.bulkUpdatePositions(items);

      expect(mockQueryRunner.manager.update).toHaveBeenCalledWith(
        Task,
        'task-1',
        expect.objectContaining({
          position: 0,
          statusId: 'status-completed',
          completedAt: expect.any(Date),
        }),
      );
    });

    it('debe hacer rollback en caso de error', async () => {
      const items = [{ id: 'task-1', position: 0 }];
      mockTaskStatusesService.findByIds.mockResolvedValue([]);
      mockQueryRunner.manager.update.mockRejectedValue(
        new Error('DB error'),
      );

      await expect(service.bulkUpdatePositions(items)).rejects.toThrow(
        'DB error',
      );
      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.release).toHaveBeenCalled();
    });

    it('debe lanzar NotFoundException si un status no existe', async () => {
      const items = [
        { id: 'task-1', position: 0, statusId: 'nonexistent-status' },
      ];
      // findByIds returns empty — status not found
      mockTaskStatusesService.findByIds.mockResolvedValue([]);
      mockQueryRunner.manager.update.mockResolvedValue({ affected: 1 });

      await expect(service.bulkUpdatePositions(items)).rejects.toThrow(
        NotFoundException,
      );
      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
    });

    it('debe resetear completedAt cuando mueve a status no-completado', async () => {
      const items = [
        { id: 'task-1', position: 0, statusId: 'status-inprogress' },
      ];
      const inProgressStatus = {
        id: 'status-inprogress',
        name: 'En progreso',
        isCompleted: false,
      };
      mockTaskStatusesService.findByIds.mockResolvedValue([inProgressStatus]);
      mockQueryRunner.manager.update.mockResolvedValue({ affected: 1 });

      await service.bulkUpdatePositions(items);

      expect(mockQueryRunner.manager.update).toHaveBeenCalledWith(
        Task,
        'task-1',
        expect.objectContaining({
          completedAt: null,
        }),
      );
    });
  });

  // ── verifyTaskAccess() ──

  describe('verifyTaskAccess', () => {
    it('debe permitir acceso al super admin', async () => {
      const task = mockTask();
      mockTaskRepository.findOne.mockResolvedValue(task);

      const result = await service.verifyTaskAccess('task-1', 'any-user', true);

      expect(result).toEqual(task);
    });

    it('debe permitir acceso al creador', async () => {
      const task = mockTask({ createdById: 'user-1' });
      mockTaskRepository.findOne.mockResolvedValue(task);

      const result = await service.verifyTaskAccess('task-1', 'user-1');

      expect(result).toEqual(task);
    });

    it('debe permitir acceso al asignado legacy (assignedToId)', async () => {
      const task = mockTask({
        createdById: 'other-user',
        assignedToId: 'user-1',
      });
      mockTaskRepository.findOne.mockResolvedValue(task);

      const result = await service.verifyTaskAccess('task-1', 'user-1');

      expect(result).toEqual(task);
    });

    it('debe permitir acceso a un assignee via TaskAssignee', async () => {
      const task = mockTask({
        createdById: 'other-user',
        assignedToId: null,
      });
      mockTaskRepository.findOne.mockResolvedValue(task);
      mockTaskAssigneeRepository.findOne.mockResolvedValue({
        taskId: 'task-1',
        userId: 'user-1',
      });

      const result = await service.verifyTaskAccess('task-1', 'user-1');

      expect(result).toEqual(task);
    });

    it('debe permitir acceso a miembro del proyecto', async () => {
      const task = mockTask({
        createdById: 'other-user',
        assignedToId: null,
        projectId: 'project-1',
      });
      mockTaskRepository.findOne.mockResolvedValue(task);
      mockTaskAssigneeRepository.findOne.mockResolvedValue(null);
      mockProjectsService.isMember.mockResolvedValue(true);

      const result = await service.verifyTaskAccess('task-1', 'user-1');

      expect(result).toEqual(task);
      expect(mockProjectsService.isMember).toHaveBeenCalledWith(
        'project-1',
        'user-1',
      );
    });

    it('debe lanzar ForbiddenException si no tiene acceso', async () => {
      const task = mockTask({
        createdById: 'other-user',
        assignedToId: null,
        projectId: 'project-1',
      });
      mockTaskRepository.findOne.mockResolvedValue(task);
      mockTaskAssigneeRepository.findOne.mockResolvedValue(null);
      mockProjectsService.isMember.mockResolvedValue(false);

      await expect(
        service.verifyTaskAccess('task-1', 'user-1'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('debe lanzar ForbiddenException para tarea sin proyecto y sin acceso', async () => {
      const task = mockTask({
        createdById: 'other-user',
        assignedToId: null,
        projectId: null,
      });
      mockTaskRepository.findOne.mockResolvedValue(task);
      mockTaskAssigneeRepository.findOne.mockResolvedValue(null);

      await expect(
        service.verifyTaskAccess('task-1', 'user-1'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('debe lanzar NotFoundException si la tarea no existe', async () => {
      mockTaskRepository.findOne.mockResolvedValue(null);

      await expect(
        service.verifyTaskAccess('nonexistent', 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── verifyTaskEditAccess() ──

  describe('verifyTaskEditAccess', () => {
    it('debe permitir edicion al super admin', async () => {
      const task = mockTask();
      mockTaskRepository.findOne.mockResolvedValue(task);

      const result = await service.verifyTaskEditAccess(
        'task-1',
        'any-user',
        true,
      );

      expect(result).toEqual(task);
    });

    it('debe permitir edicion al creador de tarea sin proyecto', async () => {
      const task = mockTask({ projectId: null, createdById: 'user-1' });
      mockTaskRepository.findOne.mockResolvedValue(task);

      const result = await service.verifyTaskEditAccess('task-1', 'user-1');

      expect(result).toEqual(task);
    });

    it('debe lanzar ForbiddenException si no es creador de tarea sin proyecto', async () => {
      const task = mockTask({ projectId: null, createdById: 'other-user' });
      mockTaskRepository.findOne.mockResolvedValue(task);

      await expect(
        service.verifyTaskEditAccess('task-1', 'user-1'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('debe permitir edicion a un admin del proyecto', async () => {
      const task = mockTask({
        projectId: 'project-1',
        createdById: 'other-user',
      });
      mockTaskRepository.findOne.mockResolvedValue(task);
      mockProjectsService.getMemberRole.mockResolvedValue(ProjectRole.ADMIN);

      const result = await service.verifyTaskEditAccess('task-1', 'user-1');

      expect(result).toEqual(task);
    });

    it('debe permitir edicion al creador con rol member', async () => {
      const task = mockTask({
        projectId: 'project-1',
        createdById: 'user-1',
      });
      mockTaskRepository.findOne.mockResolvedValue(task);
      mockProjectsService.getMemberRole.mockResolvedValue(ProjectRole.MEMBER);

      const result = await service.verifyTaskEditAccess('task-1', 'user-1');

      expect(result).toEqual(task);
    });

    it('debe denegar edicion a viewer', async () => {
      const task = mockTask({
        projectId: 'project-1',
        createdById: 'other-user',
      });
      mockTaskRepository.findOne.mockResolvedValue(task);
      mockProjectsService.getMemberRole.mockResolvedValue(ProjectRole.VIEWER);

      await expect(
        service.verifyTaskEditAccess('task-1', 'user-1'),
      ).rejects.toThrow(ForbiddenException);
      await expect(
        service.verifyTaskEditAccess('task-1', 'user-1'),
      ).rejects.toThrow('permisos para editar');
    });

    it('debe denegar edicion a member que no es creador', async () => {
      const task = mockTask({
        projectId: 'project-1',
        createdById: 'other-user',
      });
      mockTaskRepository.findOne.mockResolvedValue(task);
      mockProjectsService.getMemberRole.mockResolvedValue(ProjectRole.MEMBER);

      await expect(
        service.verifyTaskEditAccess('task-1', 'user-1'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ── verifyBulkEditAccess() ──

  describe('verifyBulkEditAccess', () => {
    it('debe permitir acceso al super admin sin verificar nada', async () => {
      await expect(
        service.verifyBulkEditAccess(['task-1', 'task-2'], 'user-1', true),
      ).resolves.not.toThrow();

      expect(mockTaskRepository.findBy).not.toHaveBeenCalled();
    });

    it('debe retornar inmediatamente si taskIds esta vacio', async () => {
      await expect(
        service.verifyBulkEditAccess([], 'user-1'),
      ).resolves.not.toThrow();
    });

    it('debe lanzar NotFoundException si alguna tarea no existe', async () => {
      mockTaskRepository.findBy.mockResolvedValue([
        mockTask({ id: 'task-1' }),
      ]);

      await expect(
        service.verifyBulkEditAccess(['task-1', 'task-2'], 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('debe verificar acceso por proyecto para tareas con projectId', async () => {
      const tasks = [
        mockTask({ id: 'task-1', projectId: 'project-1', createdById: 'other-user' }),
        mockTask({ id: 'task-2', projectId: 'project-1', createdById: 'other-user' }),
      ];
      mockTaskRepository.findBy.mockResolvedValue(tasks);
      mockProjectsService.getMemberRole.mockResolvedValue(ProjectRole.ADMIN);

      await expect(
        service.verifyBulkEditAccess(['task-1', 'task-2'], 'user-1'),
      ).resolves.not.toThrow();

      // Only called once for project-1 (grouped)
      expect(mockProjectsService.getMemberRole).toHaveBeenCalledTimes(1);
    });

    it('debe lanzar ForbiddenException para tarea personal de otro usuario', async () => {
      const tasks = [
        mockTask({ id: 'task-1', projectId: null, createdById: 'other-user' }),
      ];
      mockTaskRepository.findBy.mockResolvedValue(tasks);

      await expect(
        service.verifyBulkEditAccess(['task-1'], 'user-1'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('debe lanzar ForbiddenException si viewer intenta editar', async () => {
      const tasks = [
        mockTask({ id: 'task-1', projectId: 'project-1', createdById: 'other-user' }),
      ];
      mockTaskRepository.findBy.mockResolvedValue(tasks);
      mockProjectsService.getMemberRole.mockResolvedValue(ProjectRole.VIEWER);

      await expect(
        service.verifyBulkEditAccess(['task-1'], 'user-1'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ── verifyTaskDeleteAccess() ──

  describe('verifyTaskDeleteAccess', () => {
    it('debe permitir al super admin eliminar', async () => {
      const task = mockTask();
      mockTaskRepository.findOne.mockResolvedValue(task);

      const result = await service.verifyTaskDeleteAccess(
        'task-1',
        'any-user',
        true,
      );

      expect(result).toEqual(task);
    });

    it('debe permitir al creador eliminar tarea personal', async () => {
      const task = mockTask({ projectId: null, createdById: 'user-1' });
      mockTaskRepository.findOne.mockResolvedValue(task);

      const result = await service.verifyTaskDeleteAccess('task-1', 'user-1');

      expect(result).toEqual(task);
    });

    it('debe permitir al admin del proyecto eliminar', async () => {
      const task = mockTask({ projectId: 'project-1' });
      mockTaskRepository.findOne.mockResolvedValue(task);
      mockProjectsService.getMemberRole.mockResolvedValue(ProjectRole.ADMIN);

      const result = await service.verifyTaskDeleteAccess('task-1', 'user-1');

      expect(result).toEqual(task);
    });

    it('debe denegar eliminacion a member (no admin)', async () => {
      const task = mockTask({
        projectId: 'project-1',
        createdById: 'other-user',
      });
      mockTaskRepository.findOne.mockResolvedValue(task);
      mockProjectsService.getMemberRole.mockResolvedValue(ProjectRole.MEMBER);

      await expect(
        service.verifyTaskDeleteAccess('task-1', 'user-1'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('debe denegar a no-creador en tarea personal', async () => {
      const task = mockTask({ projectId: null, createdById: 'other-user' });
      mockTaskRepository.findOne.mockResolvedValue(task);

      await expect(
        service.verifyTaskDeleteAccess('task-1', 'user-1'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ── verifyTaskCreateAccess() ──

  describe('verifyTaskCreateAccess', () => {
    it('debe permitir al super admin crear en cualquier proyecto', async () => {
      await expect(
        service.verifyTaskCreateAccess('project-1', 'user-1', true),
      ).resolves.not.toThrow();

      expect(mockProjectsService.getMemberRole).not.toHaveBeenCalled();
    });

    it('debe permitir sin proyecto (tarea personal)', async () => {
      await expect(
        service.verifyTaskCreateAccess(null, 'user-1'),
      ).resolves.not.toThrow();
    });

    it('debe permitir a member crear', async () => {
      mockProjectsService.getMemberRole.mockResolvedValue(ProjectRole.MEMBER);

      await expect(
        service.verifyTaskCreateAccess('project-1', 'user-1'),
      ).resolves.not.toThrow();
    });

    it('debe denegar a viewer crear', async () => {
      mockProjectsService.getMemberRole.mockResolvedValue(ProjectRole.VIEWER);

      await expect(
        service.verifyTaskCreateAccess('project-1', 'user-1'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('debe denegar si no tiene rol (null)', async () => {
      mockProjectsService.getMemberRole.mockResolvedValue(null);

      await expect(
        service.verifyTaskCreateAccess('project-1', 'user-1'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ── verifyProjectAccess() ──

  describe('verifyProjectAccess', () => {
    it('debe delegar al projectsService.verifyMemberAccess', async () => {
      mockProjectsService.verifyMemberAccess.mockResolvedValue(undefined);

      await service.verifyProjectAccess('project-1', 'user-1', false);

      expect(mockProjectsService.verifyMemberAccess).toHaveBeenCalledWith(
        'project-1',
        'user-1',
        false,
      );
    });
  });

  // ── verifyOrganizationAccess() ──

  describe('verifyOrganizationAccess', () => {
    it('debe delegar al organizationsService.verifyMemberAccess', async () => {
      mockOrganizationsService.verifyMemberAccess.mockResolvedValue(undefined);

      await service.verifyOrganizationAccess('org-1', 'user-1', true);

      expect(mockOrganizationsService.verifyMemberAccess).toHaveBeenCalledWith(
        'org-1',
        'user-1',
        true,
      );
    });
  });

  // ── getSubtasks() ──

  describe('getSubtasks', () => {
    it('debe retornar subtareas con assignees', async () => {
      const parent = mockTask({ id: 'parent-1' });
      const subtasks = [
        mockTask({ id: 'sub-1', parentId: 'parent-1' }),
        mockTask({ id: 'sub-2', parentId: 'parent-1' }),
      ];

      mockTaskRepository.findOne.mockResolvedValue(parent);
      mockTaskRepository.find.mockResolvedValue(subtasks);
      mockTaskAssigneeRepository.find.mockResolvedValue([
        {
          taskId: 'sub-1',
          userId: 'user-2',
          user: { id: 'user-2', firstName: 'A', lastName: 'B', email: 'a@test.com' },
        },
      ]);

      const result = await service.getSubtasks('parent-1');

      expect(result).toHaveLength(2);
      expect(result[0].assignees).toHaveLength(1);
      expect(result[1].assignees).toHaveLength(0);
    });

    it('debe retornar array vacio si no hay subtareas', async () => {
      const parent = mockTask({ id: 'parent-1' });
      mockTaskRepository.findOne.mockResolvedValue(parent);
      mockTaskRepository.find.mockResolvedValue([]);

      const result = await service.getSubtasks('parent-1');

      expect(result).toEqual([]);
    });

    it('debe lanzar NotFoundException si la tarea padre no existe', async () => {
      mockTaskRepository.findOne.mockResolvedValue(null);

      await expect(service.getSubtasks('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ── findAll() ──

  describe('findAll', () => {
    it('debe retornar tareas paginadas con datos enriquecidos', async () => {
      const tasks = [mockTask({ id: 'task-1' })];
      const mainQb = createMockQueryBuilder(tasks, 1);
      mockTaskRepository.createQueryBuilder.mockReturnValue(mainQb);

      // Assignee QB
      const assigneeQb = createMockQueryBuilder([]);
      mockTaskAssigneeRepository.createQueryBuilder.mockReturnValue(assigneeQb);

      // Subtask count QB (second call to taskRepository.createQueryBuilder)
      const subtaskQb = createMockQueryBuilder([]);
      mockTaskRepository.createQueryBuilder
        .mockReturnValueOnce(mainQb)
        .mockReturnValueOnce(subtaskQb);

      // Comment count + unread: handled by mockDataSource.getRepository
      // Already mocked globally

      const result = await service.findAll(
        { projectId: 'project-1', page: 1, limit: 20 },
        'user-1',
      );

      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('total');
    });

    it('debe filtrar por statusId cuando se provee', async () => {
      const mainQb = createMockQueryBuilder([], 0);
      mockTaskRepository.createQueryBuilder.mockReturnValue(mainQb);

      await service.findAll({ projectId: 'project-1', statusId: 'status-1' });

      expect(mainQb.andWhere).toHaveBeenCalledWith(
        't.statusId = :statusId',
        { statusId: 'status-1' },
      );
    });

    it('debe retornar data vacia si no hay tareas', async () => {
      const mainQb = createMockQueryBuilder([], 0);
      mockTaskRepository.createQueryBuilder.mockReturnValue(mainQb);

      const result = await service.findAll({ projectId: 'project-1' });

      expect(result).toEqual({ data: [], total: 0 });
    });
  });

  // ── getTaskAssignees() ──

  describe('getTaskAssignees', () => {
    it('debe retornar asignados con datos de usuario', async () => {
      mockTaskAssigneeRepository.find.mockResolvedValue([
        {
          taskId: 'task-1',
          userId: 'user-2',
          user: {
            id: 'user-2',
            firstName: 'Jane',
            lastName: 'Doe',
            email: 'jane@test.com',
          },
        },
      ]);

      const result = await service.getTaskAssignees('task-1');

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        id: 'user-2',
        firstName: 'Jane',
        lastName: 'Doe',
        email: 'jane@test.com',
      });
    });

    it('debe filtrar asignados sin user (datos huerfanos)', async () => {
      mockTaskAssigneeRepository.find.mockResolvedValue([
        { taskId: 'task-1', userId: 'user-deleted', user: null },
      ]);

      const result = await service.getTaskAssignees('task-1');

      expect(result).toHaveLength(0);
    });
  });
});
