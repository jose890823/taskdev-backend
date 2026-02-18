import {
  Injectable, Logger, NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Task, TaskType } from './entities/task.entity';
import { CreateTaskDto, UpdateTaskDto } from './dto';
import { TaskStatusesService } from '../task-statuses/task-statuses.service';
import { User } from '../auth/entities/user.entity';

@Injectable()
export class TasksService {
  private readonly logger = new Logger(TasksService.name);

  constructor(
    @InjectRepository(Task)
    private readonly taskRepository: Repository<Task>,
    private readonly taskStatusesService: TaskStatusesService,
  ) {}

  async create(dto: CreateTaskDto, user: User): Promise<Task> {
    let statusId = dto.statusId;

    if (!statusId) {
      const defaultStatus = await this.taskStatusesService.getDefaultStatus(dto.projectId || null);
      statusId = defaultStatus?.id ?? undefined;
    }

    const task = this.taskRepository.create({
      ...dto,
      type: dto.type || (dto.projectId ? TaskType.PROJECT : TaskType.DAILY),
      statusId,
      createdById: user.id,
    });
    await this.taskRepository.save(task);
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
  }): Promise<{ data: Task[]; total: number }> {
    const { page = 1, limit = 50, ...where } = filters;
    const qb = this.taskRepository.createQueryBuilder('t')
      .where('t.parentId IS NULL');

    if (where.projectId) qb.andWhere('t.projectId = :projectId', { projectId: where.projectId });
    if (where.organizationId) qb.andWhere('t.organizationId = :organizationId', { organizationId: where.organizationId });
    if (where.statusId) qb.andWhere('t.statusId = :statusId', { statusId: where.statusId });
    if (where.assignedToId) qb.andWhere('t.assignedToId = :assignedToId', { assignedToId: where.assignedToId });
    if (where.type) qb.andWhere('t.type = :type', { type: where.type });

    const [data, total] = await qb
      .orderBy('t.position', 'ASC')
      .addOrderBy('t.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return { data, total };
  }

  async findMyTasks(userId: string, type?: TaskType): Promise<Task[]> {
    const qb = this.taskRepository.createQueryBuilder('t')
      .where('(t.assignedToId = :userId OR t.createdById = :userId)', { userId })
      .andWhere('t.parentId IS NULL');

    if (type) qb.andWhere('t.type = :type', { type });

    return qb.orderBy('t.position', 'ASC').addOrderBy('t.createdAt', 'DESC').getMany();
  }

  async findDailyTasks(userId: string, date?: string): Promise<Task[]> {
    const targetDate = date || new Date().toISOString().split('T')[0];

    return this.taskRepository
      .createQueryBuilder('t')
      .where('t.type = :type', { type: TaskType.DAILY })
      .andWhere('(t.assignedToId = :userId OR t.createdById = :userId)', { userId })
      .andWhere('t.scheduledDate = :date', { date: targetDate })
      .orderBy('t.position', 'ASC')
      .getMany();
  }

  async findById(id: string): Promise<Task> {
    const task = await this.taskRepository.findOne({ where: { id } });
    if (!task) throw new NotFoundException('Tarea no encontrada');
    return task;
  }

  async update(id: string, dto: UpdateTaskDto): Promise<Task> {
    const task = await this.findById(id);

    if (dto.statusId && dto.statusId !== task.statusId) {
      const newStatus = await this.taskStatusesService.findById(dto.statusId);
      if (newStatus.isCompleted) {
        (task as any).completedAt = new Date();
      } else {
        (task as any).completedAt = null;
      }
    }

    Object.assign(task, dto);
    return this.taskRepository.save(task);
  }

  async remove(id: string): Promise<void> {
    await this.findById(id);
    await this.taskRepository.softDelete(id);
  }

  async getSubtasks(parentId: string): Promise<Task[]> {
    return this.taskRepository.find({
      where: { parentId },
      order: { position: 'ASC' },
    });
  }

  async createSubtask(parentId: string, dto: CreateTaskDto, user: User): Promise<Task> {
    const parent = await this.findById(parentId);
    return this.create({
      ...dto,
      parentId,
      projectId: dto.projectId ?? parent.projectId ?? undefined,
      organizationId: dto.organizationId ?? parent.organizationId ?? undefined,
    }, user);
  }
}
