import {
  Injectable, Logger, NotFoundException, BadRequestException, ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Task, TaskType } from './entities/task.entity';
import { TaskAssignee } from './entities/task-assignee.entity';
import { CreateTaskDto, UpdateTaskDto, BulkPositionItemDto } from './dto';
import { TaskStatusesService } from '../task-statuses/task-statuses.service';
import { ProjectsService } from '../projects/projects.service';
import { OrganizationsService } from '../organizations/organizations.service';
import { User } from '../auth/entities/user.entity';
import { isUuid } from '../../common/utils/identifier.util';
import { canCreateTask, canEditTask, canDeleteTask } from '../../common/utils/task-permissions.util';
import { Comment } from '../comments/entities/comment.entity';
import { TaskCommentRead } from '../comments/entities/task-comment-read.entity';

@Injectable()
export class TasksService {
  private readonly logger = new Logger(TasksService.name);

  constructor(
    @InjectRepository(Task)
    private readonly taskRepository: Repository<Task>,
    @InjectRepository(TaskAssignee)
    private readonly taskAssigneeRepository: Repository<TaskAssignee>,
    private readonly taskStatusesService: TaskStatusesService,
    private readonly projectsService: ProjectsService,
    private readonly organizationsService: OrganizationsService,
    private readonly dataSource: DataSource,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async create(dto: CreateTaskDto, user: User): Promise<Task> {
    let statusId = dto.statusId;

    if (!statusId) {
      const defaultStatus = await this.taskStatusesService.getDefaultStatus(dto.projectId || null);
      statusId = defaultStatus?.id ?? undefined;
    }

    // Extract assignedToIds before saving
    const assignedToIds = dto.assignedToIds || (dto.assignedToId ? [dto.assignedToId] : []);

    const task = this.taskRepository.create({
      ...dto,
      type: dto.type || (dto.projectId ? TaskType.PROJECT : TaskType.DAILY),
      statusId,
      createdById: user.id,
      assignedToId: assignedToIds[0] || null,
    });
    await this.taskRepository.save(task);

    // Save assignees in join table
    if (assignedToIds.length > 0) {
      await this.saveAssignees(task.id, assignedToIds);

      // Emitir evento task.assigned para cada asignado (excepto el creador)
      const assignerName = `${user.firstName} ${user.lastName}`;
      for (const assigneeId of assignedToIds) {
        if (assigneeId !== user.id) {
          this.eventEmitter.emit('task.assigned', {
            taskId: task.id,
            taskTitle: task.title,
            taskPriority: task.priority,
            assignedToId: assigneeId,
            assignedByName: assignerName,
          });
        }
      }
    }

    this.logger.log(`Tarea creada: ${task.title} por ${user.email}`);
    return task;
  }

  async findAll(filters: {
    projectId?: string;
    organizationId?: string;
    statusId?: string;
    assignedToId?: string;
    type?: TaskType;
    page?: number;
    limit?: number;
  }, currentUserId?: string, isSuperAdmin = false): Promise<{ data: any[]; total: number }> {
    const { page = 1, limit = 50, ...where } = filters;
    const qb = this.taskRepository.createQueryBuilder('t')
      .where('t.parentId IS NULL');

    if (where.projectId) qb.andWhere('t.projectId = :projectId', { projectId: where.projectId });
    if (where.organizationId) qb.andWhere('t.organizationId = :organizationId', { organizationId: where.organizationId });
    if (where.statusId) qb.andWhere('t.statusId = :statusId', { statusId: where.statusId });
    if (where.assignedToId) {
      qb.andWhere(
        't.id IN (SELECT ta."taskId" FROM task_assignees ta WHERE ta."userId" = :assignedUserId)',
        { assignedUserId: where.assignedToId },
      );
    }
    if (where.type) qb.andWhere('t.type = :type', { type: where.type });

    // Scope filtering: limit to user's accessible tasks when no project/org filter
    if (!where.projectId && !where.organizationId && currentUserId && !isSuperAdmin) {
      qb.andWhere(
        '(t.createdById = :uid OR t.assignedToId = :uid OR t.id IN (SELECT ta."taskId" FROM task_assignees ta WHERE ta."userId" = :uid) OR t.projectId IN (SELECT pm."projectId" FROM project_members pm WHERE pm."userId" = :uid))',
        { uid: currentUserId },
      );
    }

    const [tasks, total] = await qb
      .orderBy('t.position', 'ASC')
      .addOrderBy('t.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    if (tasks.length === 0) return { data: [], total };

    const taskIds = tasks.map(t => t.id);

    // Batch query 1: assignees with user data
    const assignees = await this.taskAssigneeRepository
      .createQueryBuilder('ta')
      .leftJoinAndSelect('ta.user', 'u')
      .where('ta.taskId IN (:...taskIds)', { taskIds })
      .select(['ta.id', 'ta.taskId', 'ta.userId', 'u.id', 'u.firstName', 'u.lastName', 'u.email'])
      .getMany();

    const assigneesByTask: Record<string, { id: string; firstName: string; lastName: string; email: string }[]> = {};
    for (const a of assignees) {
      if (!assigneesByTask[a.taskId]) assigneesByTask[a.taskId] = [];
      if (a.user) {
        assigneesByTask[a.taskId].push({
          id: a.user.id,
          firstName: a.user.firstName,
          lastName: a.user.lastName,
          email: a.user.email,
        });
      }
    }

    // Batch query 2: subtask counts per task
    const subtaskCounts = await this.taskRepository
      .createQueryBuilder('s')
      .select('s.parentId', 'parentId')
      .addSelect('COUNT(*)::int', 'count')
      .where('s.parentId IN (:...taskIds)', { taskIds })
      .andWhere('s.deletedAt IS NULL')
      .groupBy('s.parentId')
      .getRawMany<{ parentId: string; count: number }>();

    const subtaskCountMap: Record<string, number> = {};
    for (const row of subtaskCounts) {
      subtaskCountMap[row.parentId] = Number(row.count);
    }

    // Batch query 3: comment counts per task
    const commentCounts = await this.dataSource
      .getRepository(Comment)
      .createQueryBuilder('c')
      .select('c.taskId', 'taskId')
      .addSelect('COUNT(*)::int', 'count')
      .where('c.taskId IN (:...taskIds)', { taskIds })
      .andWhere('c.deletedAt IS NULL')
      .groupBy('c.taskId')
      .getRawMany<{ taskId: string; count: number }>();

    const commentCountMap: Record<string, number> = {};
    for (const row of commentCounts) {
      commentCountMap[row.taskId] = Number(row.count);
    }

    // Batch query 4: unread comments (only if user is provided)
    let unreadMap: Record<string, boolean> = {};
    if (currentUserId) {
      // Get user's last read timestamps
      const reads = await this.dataSource
        .getRepository(TaskCommentRead)
        .createQueryBuilder('r')
        .where('r.userId = :userId', { userId: currentUserId })
        .andWhere('r.taskId IN (:...taskIds)', { taskIds })
        .getMany();

      const readMap: Record<string, Date> = {};
      for (const r of reads) {
        readMap[r.taskId] = r.lastReadAt;
      }

      // For tasks with comments, check if there are comments newer than lastReadAt
      for (const taskId of taskIds) {
        if (!commentCountMap[taskId]) continue;
        const lastRead = readMap[taskId];
        if (!lastRead) {
          // Never read → has unread
          unreadMap[taskId] = true;
        }
      }

      // Batch check for tasks that have been read before: are there newer comments?
      const readTaskIds = Object.keys(readMap).filter(tid => commentCountMap[tid]);
      if (readTaskIds.length > 0) {
        for (const tid of readTaskIds) {
          const newerCount = await this.dataSource
            .getRepository(Comment)
            .createQueryBuilder('c')
            .where('c.taskId = :taskId', { taskId: tid })
            .andWhere('c.deletedAt IS NULL')
            .andWhere('c.createdAt > :lastRead', { lastRead: readMap[tid] })
            .getCount();
          if (newerCount > 0) unreadMap[tid] = true;
        }
      }
    }

    // Fallback: also hydrate assignedTo from legacy field for compatibility
    const legacyAssigneeIds = [...new Set(
      tasks.filter(t => t.assignedToId && !assigneesByTask[t.id]?.length).map(t => t.assignedToId!),
    )];
    let legacyAssigneeMap: Record<string, { id: string; firstName: string; lastName: string; email: string }> = {};
    if (legacyAssigneeIds.length > 0) {
      const users = await this.dataSource
        .getRepository(User)
        .createQueryBuilder('u')
        .select(['u.id', 'u.firstName', 'u.lastName', 'u.email'])
        .where('u.id IN (:...ids)', { ids: legacyAssigneeIds })
        .getMany();
      legacyAssigneeMap = Object.fromEntries(users.map(u => [u.id, {
        id: u.id, firstName: u.firstName, lastName: u.lastName, email: u.email,
      }]));
    }

    const data = tasks.map(task => {
      const taskAssignees = assigneesByTask[task.id] || [];
      return {
        ...task,
        assignees: taskAssignees,
        // Legacy compatibility
        assignedTo: taskAssignees[0] || (task.assignedToId ? legacyAssigneeMap[task.assignedToId] || null : null),
        subtaskCount: subtaskCountMap[task.id] || 0,
        commentCount: commentCountMap[task.id] || 0,
        hasUnreadComments: !!unreadMap[task.id],
      };
    });

    return { data, total };
  }

  async findMyTasks(userId: string, type?: TaskType): Promise<any[]> {
    const qb = this.taskRepository.createQueryBuilder('t')
      .where(
        '(t.id IN (SELECT ta."taskId" FROM task_assignees ta WHERE ta."userId" = :userId) OR t.assignedToId = :userId OR t.createdById = :userId)',
        { userId },
      )
      .andWhere('t.parentId IS NULL');

    if (type) qb.andWhere('t.type = :type', { type });

    const tasks = await qb.orderBy('t.position', 'ASC').addOrderBy('t.createdAt', 'DESC').getMany();
    return this.hydrateTasks(tasks);
  }

  async findDailyTasks(userId: string, date?: string): Promise<any[]> {
    const targetDate = date || new Date().toISOString().split('T')[0];

    const tasks = await this.taskRepository
      .createQueryBuilder('t')
      .where('t.type = :type', { type: TaskType.DAILY })
      .andWhere(
        '(t.id IN (SELECT ta."taskId" FROM task_assignees ta WHERE ta."userId" = :userId) OR t.assignedToId = :userId OR t.createdById = :userId)',
        { userId },
      )
      .andWhere('t.scheduledDate = :date', { date: targetDate })
      .orderBy('t.position', 'ASC')
      .getMany();
    return this.hydrateTasks(tasks);
  }

  /** Hydrate assignees for a list of tasks (reused by findMyTasks, findDailyTasks) */
  private async hydrateTasks(tasks: Task[]): Promise<any[]> {
    if (tasks.length === 0) return [];

    const taskIds = tasks.map(t => t.id);

    const assignees = await this.taskAssigneeRepository
      .createQueryBuilder('ta')
      .leftJoinAndSelect('ta.user', 'u')
      .where('ta.taskId IN (:...taskIds)', { taskIds })
      .select(['ta.id', 'ta.taskId', 'ta.userId', 'u.id', 'u.firstName', 'u.lastName', 'u.email'])
      .getMany();

    const assigneesByTask: Record<string, { id: string; firstName: string; lastName: string; email: string }[]> = {};
    for (const a of assignees) {
      if (!assigneesByTask[a.taskId]) assigneesByTask[a.taskId] = [];
      if (a.user) {
        assigneesByTask[a.taskId].push({
          id: a.user.id,
          firstName: a.user.firstName,
          lastName: a.user.lastName,
          email: a.user.email,
        });
      }
    }

    return tasks.map(task => ({
      ...task,
      assignees: assigneesByTask[task.id] || [],
      assignedTo: assigneesByTask[task.id]?.[0] || null,
    }));
  }

  async findById(identifier: string): Promise<Task> {
    const where = isUuid(identifier) ? { id: identifier } : { systemCode: identifier };
    const task = await this.taskRepository.findOne({ where });
    if (!task) throw new NotFoundException('Tarea no encontrada');
    return task;
  }

  async findByIdWithAssignees(identifier: string): Promise<any> {
    const task = await this.findById(identifier);
    let assignees = await this.getTaskAssignees(task.id);

    // Fallback: if no assignees in join table but legacy field exists, hydrate from it
    if (assignees.length === 0 && task.assignedToId) {
      const user = await this.dataSource
        .getRepository(User)
        .createQueryBuilder('u')
        .select(['u.id', 'u.firstName', 'u.lastName', 'u.email'])
        .where('u.id = :id', { id: task.assignedToId })
        .getOne();
      if (user) {
        assignees = [{ id: user.id, firstName: user.firstName, lastName: user.lastName, email: user.email }];
      }
    }

    return { ...task, assignees };
  }

  async update(identifier: string, dto: UpdateTaskDto, currentUser?: User): Promise<any> {
    const task = await this.findById(identifier);
    const id = task.id;
    const originalTitle = task.title;
    const oldStatusId = task.statusId;

    if (dto.statusId && dto.statusId !== task.statusId) {
      const newStatus = await this.taskStatusesService.findById(dto.statusId);
      if (newStatus.isCompleted) {
        (task as any).completedAt = new Date();
      } else {
        (task as any).completedAt = null;
      }
    }

    // Handle assignedToIds
    const oldAssigneeIds = dto.assignedToIds !== undefined
      ? (await this.getTaskAssignees(id)).map(a => a.id)
      : [];

    if (dto.assignedToIds !== undefined) {
      // Validate subtask restriction
      if (task.parentId) {
        await this.validateSubtaskAssignees(task.parentId, dto.assignedToIds);
      }
      await this.saveAssignees(id, dto.assignedToIds);
      // Sync legacy field
      (dto as any).assignedToId = dto.assignedToIds[0] || null;
    }

    // Remove assignedToIds from dto before saving to task table
    const { assignedToIds: _, ...taskDto } = dto;
    Object.assign(task, taskDto);
    const savedTask = await this.taskRepository.save(task);

    const assignees = await this.getTaskAssignees(id);

    // Emit notification events
    const taskTitle = savedTask.title || originalTitle;
    if (currentUser) {
      const actorName = `${currentUser.firstName} ${currentUser.lastName}`;

      // Emit task.assigned / task.unassigned for assignee changes
      if (dto.assignedToIds !== undefined) {
        const oldSet = new Set(oldAssigneeIds);
        const newSet = new Set(dto.assignedToIds);

        // New assignees
        for (const uid of dto.assignedToIds) {
          if (!oldSet.has(uid) && uid !== currentUser.id) {
            this.eventEmitter.emit('task.assigned', {
              taskId: id,
              taskTitle,
              taskPriority: savedTask.priority || task.priority,
              assignedToId: uid,
              assignedByName: actorName,
            });
          }
        }

        // Removed assignees
        for (const uid of oldAssigneeIds) {
          if (!newSet.has(uid) && uid !== currentUser.id) {
            this.eventEmitter.emit('task.unassigned', {
              taskId: id,
              taskTitle,
              taskPriority: savedTask.priority || task.priority,
              unassignedUserId: uid,
              unassignedByName: actorName,
            });
          }
        }
      }

      // Emit task.status_changed / task.completed
      if (dto.statusId && dto.statusId !== oldStatusId) {
        const assigneeIds = assignees.map(a => a.id);
        const [oldStatus, newStatus] = await Promise.all([
          oldStatusId ? this.taskStatusesService.findById(oldStatusId).catch(() => null) : null,
          this.taskStatusesService.findById(dto.statusId),
        ]);

        this.eventEmitter.emit('task.status_changed', {
          taskId: id,
          taskTitle,
          taskPriority: savedTask.priority || task.priority,
          oldStatusName: oldStatus?.name || 'Sin estado',
          newStatusName: newStatus.name,
          changedByName: actorName,
          assigneeIds,
          changedById: currentUser.id,
        });

        if (newStatus.isCompleted) {
          this.eventEmitter.emit('task.completed', {
            taskId: id,
            taskTitle,
            taskPriority: savedTask.priority || task.priority,
            completedByName: actorName,
            assigneeIds,
            completedById: currentUser.id,
          });
        }
      }
    }

    return { ...savedTask, assignees };
  }

  async remove(identifier: string): Promise<void> {
    const task = await this.findById(identifier);
    await this.taskRepository.softDelete(task.id);
  }

  async getSubtasks(identifier: string): Promise<any[]> {
    const parent = await this.findById(identifier);
    const subtasks = await this.taskRepository.find({
      where: { parentId: parent.id },
      order: { position: 'ASC' },
    });

    if (subtasks.length === 0) return [];

    // Hydrate assignees for subtasks
    const subtaskIds = subtasks.map(s => s.id);
    const assignees = await this.taskAssigneeRepository.find({
      where: { taskId: In(subtaskIds) },
      relations: ['user'],
    });

    const assigneesByTask: Record<string, any[]> = {};
    for (const a of assignees) {
      if (!assigneesByTask[a.taskId]) assigneesByTask[a.taskId] = [];
      if (a.user) {
        assigneesByTask[a.taskId].push({
          id: a.user.id,
          firstName: a.user.firstName,
          lastName: a.user.lastName,
          email: a.user.email,
        });
      }
    }

    return subtasks.map(sub => ({
      ...sub,
      assignees: assigneesByTask[sub.id] || [],
    }));
  }

  async createSubtask(identifier: string, dto: CreateTaskDto, user: User): Promise<Task> {
    const parent = await this.findById(identifier);
    const parentId = parent.id;

    // Validate subtask assignees
    const assignedToIds = dto.assignedToIds || (dto.assignedToId ? [dto.assignedToId] : []);
    if (assignedToIds.length > 0) {
      await this.validateSubtaskAssignees(parentId, assignedToIds);
    }

    const subtask = await this.create({
      ...dto,
      parentId,
      projectId: dto.projectId ?? parent.projectId ?? undefined,
      organizationId: dto.organizationId ?? parent.organizationId ?? undefined,
    }, user);

    // Emit subtask.created to parent task assignees
    const parentAssignees = await this.getTaskAssignees(parentId);
    if (parentAssignees.length > 0) {
      this.eventEmitter.emit('subtask.created', {
        parentTaskId: parentId,
        parentTaskTitle: parent.title,
        subtaskTitle: subtask.title,
        taskPriority: subtask.priority,
        createdByName: `${user.firstName} ${user.lastName}`,
        createdById: user.id,
        assigneeIds: parentAssignees.map(a => a.id),
      });
    }

    return subtask;
  }

  async bulkUpdatePositions(items: BulkPositionItemDto[]): Promise<{ updated: number }> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      let updated = 0;
      for (const item of items) {
        const updateData: Partial<Task> = { position: item.position };

        if (item.statusId) {
          updateData.statusId = item.statusId;
          const newStatus = await this.taskStatusesService.findById(item.statusId);
          updateData.completedAt = newStatus.isCompleted ? new Date() : null;
        }

        await queryRunner.manager.update(Task, item.id, updateData);
        updated++;
      }

      await queryRunner.commitTransaction();
      this.logger.log(`Bulk update: ${updated} tareas actualizadas`);
      return { updated };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  // ── Access verification ──

  async verifyTaskAccess(taskId: string, userId: string, isSuperAdmin = false): Promise<Task> {
    const task = await this.findById(taskId);
    if (isSuperAdmin) return task;
    if (task.createdById === userId) return task;
    if (task.assignedToId === userId) return task;
    const isAssignee = await this.taskAssigneeRepository.findOne({ where: { taskId: task.id, userId } });
    if (isAssignee) return task;
    if (task.projectId) {
      const isMember = await this.projectsService.isMember(task.projectId, userId);
      if (isMember) return task;
    }
    throw new ForbiddenException('No tienes acceso a esta tarea');
  }

  async verifyProjectAccess(projectId: string, userId: string, isSuperAdmin = false): Promise<void> {
    await this.projectsService.verifyMemberAccess(projectId, userId, isSuperAdmin);
  }

  async verifyOrganizationAccess(organizationId: string, userId: string, isSuperAdmin = false): Promise<void> {
    await this.organizationsService.verifyMemberAccess(organizationId, userId, isSuperAdmin);
  }

  async verifyTaskCreateAccess(projectId: string | null, userId: string, isSuperAdmin = false): Promise<void> {
    if (isSuperAdmin || !projectId) return;
    const role = await this.projectsService.getMemberRole(projectId, userId);
    if (!canCreateTask(role)) {
      throw new ForbiddenException('No tienes permisos para crear tareas en este proyecto');
    }
  }

  async verifyTaskEditAccess(taskId: string, userId: string, isSuperAdmin = false): Promise<Task> {
    const task = await this.findById(taskId);
    if (isSuperAdmin) return task;
    if (!task.projectId) {
      if (task.createdById !== userId) throw new ForbiddenException('No tienes acceso a esta tarea');
      return task;
    }
    const role = await this.projectsService.getMemberRole(task.projectId, userId);
    const isCreator = task.createdById === userId;
    if (!canEditTask(role, isCreator)) {
      throw new ForbiddenException('No tienes permisos para editar esta tarea');
    }
    return task;
  }

  async verifyTaskDeleteAccess(taskId: string, userId: string, isSuperAdmin = false): Promise<Task> {
    const task = await this.findById(taskId);
    if (isSuperAdmin) return task;
    if (!task.projectId) {
      if (task.createdById !== userId) throw new ForbiddenException('No tienes acceso a esta tarea');
      return task;
    }
    const role = await this.projectsService.getMemberRole(task.projectId, userId);
    if (!canDeleteTask(role)) {
      throw new ForbiddenException('No tienes permisos para eliminar tareas en este proyecto');
    }
    return task;
  }

  // ── Helpers ──

  async getTaskAssignees(taskId: string): Promise<{ id: string; firstName: string; lastName: string; email: string }[]> {
    const assignees = await this.taskAssigneeRepository.find({
      where: { taskId },
      relations: ['user'],
    });

    return assignees
      .filter(a => a.user)
      .map(a => ({
        id: a.user!.id,
        firstName: a.user!.firstName,
        lastName: a.user!.lastName,
        email: a.user!.email,
      }));
  }

  private async saveAssignees(taskId: string, userIds: string[]): Promise<void> {
    // Delete existing and re-insert
    await this.taskAssigneeRepository.delete({ taskId });

    if (userIds.length > 0) {
      const entities = userIds.map(userId =>
        this.taskAssigneeRepository.create({ taskId, userId }),
      );
      await this.taskAssigneeRepository.save(entities);
    }
  }

  private async validateSubtaskAssignees(parentId: string, assigneeIds: string[]): Promise<void> {
    if (assigneeIds.length === 0) return;

    const parentAssignees = await this.taskAssigneeRepository.find({
      where: { taskId: parentId },
    });

    // If parent has no assignees, allow any assignment
    if (parentAssignees.length === 0) return;

    const parentUserIds = new Set(parentAssignees.map(a => a.userId));
    const invalid = assigneeIds.filter(id => !parentUserIds.has(id));

    if (invalid.length > 0) {
      throw new BadRequestException(
        'Los asignados de la subtarea deben ser asignados de la tarea padre',
      );
    }
  }
}
