import {
  Injectable, Logger, NotFoundException, BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { Task, TaskType } from './entities/task.entity';
import { TaskAssignee } from './entities/task-assignee.entity';
import { CreateTaskDto, UpdateTaskDto, BulkPositionItemDto } from './dto';
import { TaskStatusesService } from '../task-statuses/task-statuses.service';
import { User } from '../auth/entities/user.entity';
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
    private readonly dataSource: DataSource,
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
  }, currentUserId?: string): Promise<{ data: any[]; total: number }> {
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

  async findMyTasks(userId: string, type?: TaskType): Promise<Task[]> {
    const qb = this.taskRepository.createQueryBuilder('t')
      .where(
        '(t.id IN (SELECT ta."taskId" FROM task_assignees ta WHERE ta."userId" = :userId) OR t.assignedToId = :userId OR t.createdById = :userId)',
        { userId },
      )
      .andWhere('t.parentId IS NULL');

    if (type) qb.andWhere('t.type = :type', { type });

    return qb.orderBy('t.position', 'ASC').addOrderBy('t.createdAt', 'DESC').getMany();
  }

  async findDailyTasks(userId: string, date?: string): Promise<Task[]> {
    const targetDate = date || new Date().toISOString().split('T')[0];

    return this.taskRepository
      .createQueryBuilder('t')
      .where('t.type = :type', { type: TaskType.DAILY })
      .andWhere(
        '(t.id IN (SELECT ta."taskId" FROM task_assignees ta WHERE ta."userId" = :userId) OR t.assignedToId = :userId OR t.createdById = :userId)',
        { userId },
      )
      .andWhere('t.scheduledDate = :date', { date: targetDate })
      .orderBy('t.position', 'ASC')
      .getMany();
  }

  async findById(id: string): Promise<Task> {
    const task = await this.taskRepository.findOne({ where: { id } });
    if (!task) throw new NotFoundException('Tarea no encontrada');
    return task;
  }

  async findByIdWithAssignees(id: string): Promise<any> {
    const task = await this.findById(id);
    let assignees = await this.getTaskAssignees(id);

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

  async update(id: string, dto: UpdateTaskDto): Promise<any> {
    const task = await this.findById(id);

    if (dto.statusId && dto.statusId !== task.statusId) {
      const newStatus = await this.taskStatusesService.findById(dto.statusId);
      if (newStatus.isCompleted) {
        (task as any).completedAt = new Date();
      } else {
        (task as any).completedAt = null;
      }
    }

    // Handle assignedToIds
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
    return { ...savedTask, assignees };
  }

  async remove(id: string): Promise<void> {
    await this.findById(id);
    await this.taskRepository.softDelete(id);
  }

  async getSubtasks(parentId: string): Promise<any[]> {
    const subtasks = await this.taskRepository.find({
      where: { parentId },
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

  async createSubtask(parentId: string, dto: CreateTaskDto, user: User): Promise<Task> {
    const parent = await this.findById(parentId);

    // Validate subtask assignees
    const assignedToIds = dto.assignedToIds || (dto.assignedToId ? [dto.assignedToId] : []);
    if (assignedToIds.length > 0) {
      await this.validateSubtaskAssignees(parentId, assignedToIds);
    }

    return this.create({
      ...dto,
      parentId,
      projectId: dto.projectId ?? parent.projectId ?? undefined,
      organizationId: dto.organizationId ?? parent.organizationId ?? undefined,
    }, user);
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
