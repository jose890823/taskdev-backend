import {
  Injectable, Logger, NotFoundException, ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Comment } from './entities/comment.entity';
import { TaskCommentRead } from './entities/task-comment-read.entity';
import { CreateCommentDto, UpdateCommentDto } from './dto';
import { User } from '../auth/entities/user.entity';
import { Task } from '../tasks/entities/task.entity';
import { TaskAssignee } from '../tasks/entities/task-assignee.entity';

@Injectable()
export class CommentsService {
  private readonly logger = new Logger(CommentsService.name);

  constructor(
    @InjectRepository(Comment)
    private readonly commentRepository: Repository<Comment>,
    @InjectRepository(TaskCommentRead)
    private readonly taskCommentReadRepository: Repository<TaskCommentRead>,
    private readonly dataSource: DataSource,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async create(dto: CreateCommentDto, user: User): Promise<any> {
    const comment = this.commentRepository.create({
      ...dto,
      userId: user.id,
    });
    await this.commentRepository.save(comment);

    // Auto-mark as read for the comment author
    await this.markAsRead(dto.taskId, user.id);

    this.logger.log(`Comentario creado por ${user.email} en tarea ${dto.taskId}`);

    // Emit task.commented event
    this.emitTaskCommented(dto.taskId, user).catch(err =>
      this.logger.error(`Error emitting task.commented: ${err.message}`),
    );

    return {
      ...comment,
      author: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
      },
    };
  }

  private async emitTaskCommented(taskId: string, user: User): Promise<void> {
    const task = await this.dataSource.getRepository(Task).findOne({ where: { id: taskId } });
    if (!task) return;

    const assignees = await this.dataSource.getRepository(TaskAssignee).find({ where: { taskId } });
    const assigneeIds = assignees.map(a => a.userId);

    // Also include task creator if not in assignees
    if (task.createdById && !assigneeIds.includes(task.createdById)) {
      assigneeIds.push(task.createdById);
    }

    if (assigneeIds.length > 0) {
      this.eventEmitter.emit('task.commented', {
        taskId,
        taskTitle: task.title,
        taskPriority: task.priority,
        commentByName: `${user.firstName} ${user.lastName}`,
        commentById: user.id,
        assigneeIds,
      });
    }
  }

  async findByTask(taskId: string, currentUserId?: string): Promise<any[]> {
    const comments = await this.commentRepository
      .createQueryBuilder('c')
      .leftJoin('c.user', 'u')
      .addSelect(['u.id', 'u.firstName', 'u.lastName', 'u.email'])
      .where('c.taskId = :taskId', { taskId })
      .andWhere('c.deletedAt IS NULL')
      .orderBy('c.createdAt', 'ASC')
      .getMany();

    // Auto-mark as read when user views comments
    if (currentUserId) {
      await this.markAsRead(taskId, currentUserId);
    }

    return comments.map(c => ({
      id: c.id,
      taskId: c.taskId,
      userId: c.userId,
      content: c.content,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      author: c.user ? {
        id: c.user.id,
        firstName: c.user.firstName,
        lastName: c.user.lastName,
        email: c.user.email,
      } : null,
    }));
  }

  async findById(id: string): Promise<Comment> {
    const comment = await this.commentRepository.findOne({ where: { id } });
    if (!comment) throw new NotFoundException('Comentario no encontrado');
    return comment;
  }

  async update(id: string, dto: UpdateCommentDto, userId: string): Promise<Comment> {
    const comment = await this.findById(id);
    if (comment.userId !== userId) {
      throw new ForbiddenException('Solo el autor puede editar el comentario');
    }
    comment.content = dto.content;
    return this.commentRepository.save(comment);
  }

  async remove(id: string, userId: string): Promise<void> {
    const comment = await this.findById(id);
    if (comment.userId !== userId) {
      throw new ForbiddenException('Solo el autor puede eliminar el comentario');
    }
    await this.commentRepository.softDelete(id);
  }

  async markAsRead(taskId: string, userId: string): Promise<void> {
    const existing = await this.taskCommentReadRepository.findOne({
      where: { taskId, userId },
    });

    if (existing) {
      existing.lastReadAt = new Date();
      await this.taskCommentReadRepository.save(existing);
    } else {
      const read = this.taskCommentReadRepository.create({ taskId, userId });
      await this.taskCommentReadRepository.save(read);
    }
  }
}
