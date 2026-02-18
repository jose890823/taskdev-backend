import {
  Injectable, Logger, NotFoundException, ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Comment } from './entities/comment.entity';
import { CreateCommentDto, UpdateCommentDto } from './dto';
import { User } from '../auth/entities/user.entity';

@Injectable()
export class CommentsService {
  private readonly logger = new Logger(CommentsService.name);

  constructor(
    @InjectRepository(Comment)
    private readonly commentRepository: Repository<Comment>,
  ) {}

  async create(dto: CreateCommentDto, user: User): Promise<Comment> {
    const comment = this.commentRepository.create({
      ...dto,
      userId: user.id,
    });
    await this.commentRepository.save(comment);
    this.logger.log(`Comentario creado por ${user.email} en tarea ${dto.taskId}`);
    return comment;
  }

  async findByTask(taskId: string): Promise<Comment[]> {
    return this.commentRepository.find({
      where: { taskId },
      order: { createdAt: 'ASC' },
    });
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
}
