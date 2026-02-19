import {
  Controller, Get, Post, Patch, Delete, Body, Param, ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CommentsService } from './comments.service';
import { CreateCommentDto, UpdateCommentDto } from './dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../auth/entities/user.entity';

@ApiTags('Comments')
@ApiBearerAuth()
@Controller('comments')
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @Post()
  @ApiOperation({ summary: 'Crear comentario' })
  async create(@Body() dto: CreateCommentDto, @CurrentUser() user: User) {
    return this.commentsService.create(dto, user);
  }

  @Get('task/:taskId')
  @ApiOperation({ summary: 'Listar comentarios de una tarea' })
  async findByTask(
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @CurrentUser() user: User,
  ) {
    return this.commentsService.findByTask(taskId, user.id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Editar comentario' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCommentDto,
    @CurrentUser() user: User,
  ) {
    return this.commentsService.update(id, dto, user.id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar comentario' })
  async remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    await this.commentsService.remove(id, user.id);
    return { message: 'Comentario eliminado' };
  }
}
