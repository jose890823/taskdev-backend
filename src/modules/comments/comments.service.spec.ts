import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { Repository, DataSource } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CommentsService } from './comments.service';
import { Comment } from './entities/comment.entity';
import { TaskCommentRead } from './entities/task-comment-read.entity';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';
import { User } from '../auth/entities/user.entity';
import { TasksService } from '../tasks/tasks.service';

describe('CommentsService', () => {
  let service: CommentsService;
  let commentRepository: jest.Mocked<Repository<Comment>>;
  let taskCommentReadRepository: jest.Mocked<Repository<TaskCommentRead>>;
  let _tasksService: jest.Mocked<TasksService>;
  let _eventEmitter: jest.Mocked<EventEmitter2>;

  const mockUser = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    email: 'test@example.com',
    firstName: 'Test',
    lastName: 'User',
  } as User;

  const mockComment: Comment = {
    id: 'comment-uuid-1',
    taskId: 'task-uuid-1',
    userId: mockUser.id,
    content: 'Este es un comentario de prueba',
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  } as unknown as Comment;

  const mockTaskCommentRead: TaskCommentRead = {
    id: 'read-uuid-1',
    userId: mockUser.id,
    taskId: 'task-uuid-1',
    lastReadAt: new Date(),
  } as unknown as TaskCommentRead;

  // Mock for DataSource.getRepository chain used by emitTaskCommented
  const mockTaskRepo = {
    findOne: jest.fn().mockResolvedValue(null),
  };
  const mockAssigneeRepo = {
    find: jest.fn().mockResolvedValue([]),
  };

  beforeEach(async () => {
    const mockCommentRepository = {
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      softDelete: jest.fn(),
      createQueryBuilder: jest.fn(),
    };

    const mockTaskCommentReadRepository = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };

    const mockTasksServiceObj = {
      verifyTaskAccess: jest.fn().mockResolvedValue(undefined),
    };

    const mockEventEmitter = {
      emit: jest.fn(),
    };

    const mockDataSource = {
      getRepository: jest.fn().mockImplementation((entity) => {
        const entityName =
          typeof entity === 'function' ? entity.name : entity;
        if (entityName === 'Task') return mockTaskRepo;
        if (entityName === 'TaskAssignee') return mockAssigneeRepo;
        return {};
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommentsService,
        {
          provide: getRepositoryToken(Comment),
          useValue: mockCommentRepository,
        },
        {
          provide: getRepositoryToken(TaskCommentRead),
          useValue: mockTaskCommentReadRepository,
        },
        {
          provide: TasksService,
          useValue: mockTasksServiceObj,
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

    service = module.get<CommentsService>(CommentsService);
    commentRepository = module.get(getRepositoryToken(Comment));
    taskCommentReadRepository = module.get(getRepositoryToken(TaskCommentRead));
    _tasksService = module.get(TasksService);
    _eventEmitter = module.get(EventEmitter2);
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  describe('create', () => {
    const createDto: CreateCommentDto = {
      taskId: 'task-uuid-1',
      content: 'Nuevo comentario',
    };

    it('debe crear un comentario correctamente', async () => {
      const newComment = { ...mockComment, content: createDto.content };
      commentRepository.create.mockReturnValue(newComment as Comment);
      commentRepository.save.mockResolvedValue(newComment as Comment);
      // markAsRead — existing read entry
      taskCommentReadRepository.findOne.mockResolvedValue(
        mockTaskCommentRead as TaskCommentRead,
      );
      taskCommentReadRepository.save.mockResolvedValue(
        mockTaskCommentRead as TaskCommentRead,
      );

      const result = await service.create(createDto, mockUser);

      expect(commentRepository.create).toHaveBeenCalledWith({
        ...createDto,
        userId: mockUser.id,
      });
      expect(commentRepository.save).toHaveBeenCalled();
      expect(result).toHaveProperty('author');
      expect(result.author.id).toBe(mockUser.id);
      expect(result.author.email).toBe(mockUser.email);
    });

    it('debe auto-marcar como leído para el autor al crear', async () => {
      commentRepository.create.mockReturnValue(mockComment as Comment);
      commentRepository.save.mockResolvedValue(mockComment as Comment);
      taskCommentReadRepository.findOne.mockResolvedValue(null);
      taskCommentReadRepository.create.mockReturnValue(
        mockTaskCommentRead as TaskCommentRead,
      );
      taskCommentReadRepository.save.mockResolvedValue(
        mockTaskCommentRead as TaskCommentRead,
      );

      await service.create(createDto, mockUser);

      expect(taskCommentReadRepository.findOne).toHaveBeenCalledWith({
        where: { taskId: createDto.taskId, userId: mockUser.id },
      });
    });
  });

  describe('findByTask', () => {
    it('debe retornar los comentarios de una tarea', async () => {
      const mockQb = {
        leftJoin: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([
          {
            ...mockComment,
            user: {
              id: mockUser.id,
              firstName: mockUser.firstName,
              lastName: mockUser.lastName,
              email: mockUser.email,
            },
          },
        ]),
      };
      commentRepository.createQueryBuilder.mockReturnValue(mockQb as any);
      // markAsRead when currentUserId provided
      taskCommentReadRepository.findOne.mockResolvedValue(
        mockTaskCommentRead as TaskCommentRead,
      );
      taskCommentReadRepository.save.mockResolvedValue(
        mockTaskCommentRead as TaskCommentRead,
      );

      const result = await service.findByTask('task-uuid-1', mockUser.id);

      expect(result).toHaveLength(1);
      expect(result[0]).toHaveProperty('author');
      expect(result[0].author).toHaveProperty('id');
      expect(result[0].author).toHaveProperty('email');
    });

    it('debe retornar comentarios sin marcar como leído si no hay currentUserId', async () => {
      const mockQb = {
        leftJoin: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };
      commentRepository.createQueryBuilder.mockReturnValue(mockQb as any);

      const result = await service.findByTask('task-uuid-1');

      expect(result).toEqual([]);
      expect(taskCommentReadRepository.findOne).not.toHaveBeenCalled();
    });
  });

  describe('findById', () => {
    it('debe retornar el comentario si existe', async () => {
      commentRepository.findOne.mockResolvedValue(mockComment);

      const result = await service.findById(mockComment.id);

      expect(result).toEqual(mockComment);
      expect(commentRepository.findOne).toHaveBeenCalledWith({
        where: { id: mockComment.id },
      });
    });

    it('debe lanzar NotFoundException si el comentario no existe', async () => {
      commentRepository.findOne.mockResolvedValue(null);

      await expect(service.findById('non-existent')).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.findById('non-existent')).rejects.toThrow(
        'Comentario no encontrado',
      );
    });
  });

  describe('update', () => {
    const updateDto: UpdateCommentDto = { content: 'Comentario editado' };

    it('debe actualizar el comentario si el usuario es el autor', async () => {
      commentRepository.findOne.mockResolvedValue(mockComment);
      commentRepository.save.mockResolvedValue({
        ...mockComment,
        content: updateDto.content,
      } as Comment);

      const result = await service.update(
        mockComment.id,
        updateDto,
        mockUser.id,
      );

      expect(result.content).toBe('Comentario editado');
      expect(commentRepository.save).toHaveBeenCalled();
    });

    it('debe lanzar NotFoundException si el comentario no existe', async () => {
      commentRepository.findOne.mockResolvedValue(null);

      await expect(
        service.update('non-existent', updateDto, mockUser.id),
      ).rejects.toThrow(NotFoundException);
    });

    it('debe lanzar ForbiddenException si el usuario no es el autor', async () => {
      commentRepository.findOne.mockResolvedValue(mockComment);

      await expect(
        service.update(mockComment.id, updateDto, 'another-user-id'),
      ).rejects.toThrow(ForbiddenException);
      await expect(
        service.update(mockComment.id, updateDto, 'another-user-id'),
      ).rejects.toThrow('Solo el autor puede editar el comentario');
    });
  });

  describe('remove', () => {
    it('debe eliminar el comentario si el usuario es el autor', async () => {
      commentRepository.findOne.mockResolvedValue(mockComment);
      commentRepository.softDelete.mockResolvedValue({ affected: 1 } as any);

      await service.remove(mockComment.id, mockUser.id);

      expect(commentRepository.softDelete).toHaveBeenCalledWith(
        mockComment.id,
      );
    });

    it('debe lanzar NotFoundException si el comentario no existe', async () => {
      commentRepository.findOne.mockResolvedValue(null);

      await expect(
        service.remove('non-existent', mockUser.id),
      ).rejects.toThrow(NotFoundException);
    });

    it('debe lanzar ForbiddenException si el usuario no es el autor', async () => {
      commentRepository.findOne.mockResolvedValue(mockComment);

      await expect(
        service.remove(mockComment.id, 'another-user-id'),
      ).rejects.toThrow(ForbiddenException);
      await expect(
        service.remove(mockComment.id, 'another-user-id'),
      ).rejects.toThrow('Solo el autor puede eliminar el comentario');
    });
  });

  describe('markAsRead', () => {
    it('debe actualizar lastReadAt si ya existe un registro de lectura', async () => {
      taskCommentReadRepository.findOne.mockResolvedValue(
        mockTaskCommentRead as TaskCommentRead,
      );
      taskCommentReadRepository.save.mockResolvedValue(
        mockTaskCommentRead as TaskCommentRead,
      );

      await service.markAsRead('task-uuid-1', mockUser.id);

      expect(taskCommentReadRepository.findOne).toHaveBeenCalledWith({
        where: { taskId: 'task-uuid-1', userId: mockUser.id },
      });
      expect(taskCommentReadRepository.save).toHaveBeenCalled();
    });

    it('debe crear un nuevo registro de lectura si no existe', async () => {
      taskCommentReadRepository.findOne.mockResolvedValue(null);
      taskCommentReadRepository.create.mockReturnValue(
        mockTaskCommentRead as TaskCommentRead,
      );
      taskCommentReadRepository.save.mockResolvedValue(
        mockTaskCommentRead as TaskCommentRead,
      );

      await service.markAsRead('task-uuid-1', mockUser.id);

      expect(taskCommentReadRepository.create).toHaveBeenCalledWith({
        taskId: 'task-uuid-1',
        userId: mockUser.id,
      });
      expect(taskCommentReadRepository.save).toHaveBeenCalled();
    });
  });

  describe('verifyTaskAccess', () => {
    it('debe delegar la verificación a TasksService', async () => {
      await service.verifyTaskAccess('task-uuid-1', mockUser.id, false);

      expect(_tasksService.verifyTaskAccess).toHaveBeenCalledWith(
        'task-uuid-1',
        mockUser.id,
        false,
      );
    });
  });
});
