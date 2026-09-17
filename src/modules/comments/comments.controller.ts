import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  ParseUUIDPipe,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { CommentsService } from './comments.service';
import { CreateCommentDto, UpdateCommentDto } from './dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../auth/entities/user.entity';
import { CombinedAuthGuard } from '../api-keys/guards';
import { ApiKeyProjectParam, ApiKeyScopes } from '../api-keys/decorators';
import type { ApiKeyRequest } from '../api-keys/api-key.types';
import { assertApiKeyProject } from '../api-keys/api-key.policy';

@ApiTags('Comments')
@ApiBearerAuth()
@UseGuards(CombinedAuthGuard)
@Controller('comments')
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @Post()
  @ApiKeyScopes('comments:write')
  @ApiKeyProjectParam('projectId')
  @ApiQuery({ name: 'projectId', required: false })
  @ApiOperation({ summary: 'Crear comentario' })
  async create(
    @Body() dto: CreateCommentDto,
    @CurrentUser() user: User,
    @Req() request: ApiKeyRequest,
  ) {
    const task = await this.commentsService.verifyTaskAccess(
      dto.taskId,
      user.id,
      user.isSuperAdmin(),
      request.identity?.authType === 'api-key'
        ? request.identity.projectId
        : undefined,
    );
    assertApiKeyProject(request, task.projectId);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return -- CommentsService.create is typed as Promise<any> (to-do: improve service types)
    return this.commentsService.create(dto, user);
  }

  @Get('task/:taskId')
  @ApiKeyScopes('comments:read')
  @ApiKeyProjectParam('projectId')
  @ApiQuery({ name: 'projectId', required: false })
  @ApiOperation({ summary: 'Listar comentarios de una tarea' })
  async findByTask(
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @CurrentUser() user: User,
    @Req() request: ApiKeyRequest,
  ) {
    const task = await this.commentsService.verifyTaskAccess(
      taskId,
      user.id,
      user.isSuperAdmin(),
      request.identity?.authType === 'api-key'
        ? request.identity.projectId
        : undefined,
    );
    assertApiKeyProject(request, task.projectId);
    return this.commentsService.findByTask(taskId, user.id);
  }

  @Patch(':id')
  @ApiKeyScopes('comments:write')
  @ApiKeyProjectParam('projectId')
  @ApiQuery({ name: 'projectId', required: false })
  @ApiOperation({ summary: 'Editar comentario' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCommentDto,
    @CurrentUser() user: User,
    @Req() request: ApiKeyRequest,
  ) {
    const comment = await this.commentsService.findById(id);
    const task = await this.commentsService.verifyTaskAccess(
      comment.taskId,
      user.id,
      user.isSuperAdmin(),
      request.identity?.authType === 'api-key'
        ? request.identity.projectId
        : undefined,
    );
    assertApiKeyProject(request, task.projectId);
    return this.commentsService.update(id, dto, user.id, user.isSuperAdmin());
  }

  @Delete(':id')
  @ApiKeyScopes('comments:write')
  @ApiKeyProjectParam('projectId')
  @ApiQuery({ name: 'projectId', required: false })
  @ApiOperation({ summary: 'Eliminar comentario' })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
    @Req() request: ApiKeyRequest,
  ) {
    const comment = await this.commentsService.findById(id);
    const task = await this.commentsService.verifyTaskAccess(
      comment.taskId,
      user.id,
      user.isSuperAdmin(),
      request.identity?.authType === 'api-key'
        ? request.identity.projectId
        : undefined,
    );
    assertApiKeyProject(request, task.projectId);
    await this.commentsService.remove(id, user.id, user.isSuperAdmin());
    return { message: 'Comentario eliminado' };
  }
}
