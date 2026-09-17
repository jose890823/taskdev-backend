import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { TasksService } from './tasks.service';
import { CreateTaskDto, UpdateTaskDto, BulkUpdatePositionsDto } from './dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../auth/entities/user.entity';
import { TaskType } from './entities/task.entity';
import { CombinedAuthGuard } from '../api-keys/guards';
import { ApiKeyProjectParam, ApiKeyScopes } from '../api-keys/decorators';
import type { ApiKeyRequest } from '../api-keys/api-key.types';
import { assertApiKeyProject } from '../api-keys/api-key.policy';

@ApiTags('Tasks')
@ApiBearerAuth()
@UseGuards(CombinedAuthGuard)
@Controller('tasks')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Post()
  @ApiKeyScopes('tasks:write')
  @ApiKeyProjectParam('projectId')
  @ApiOperation({ summary: 'Crear tarea' })
  async create(
    @Body() dto: CreateTaskDto,
    @CurrentUser() user: User,
    @Req() request: ApiKeyRequest,
  ) {
    assertApiKeyProject(request, dto.projectId);
    await this.tasksService.verifyTaskCreateAccess(
      dto.projectId || null,
      user.id,
      user.isSuperAdmin(),
    );
    if (dto.organizationId) {
      await this.tasksService.verifyOrganizationAccess(
        dto.organizationId,
        user.id,
        user.isSuperAdmin(),
      );
    }
    return this.tasksService.create(dto, user);
  }

  @Get()
  @ApiKeyScopes('tasks:read')
  @ApiKeyProjectParam('projectId')
  @ApiOperation({ summary: 'Listar tareas con filtros' })
  @ApiQuery({ name: 'projectId', required: false })
  @ApiQuery({
    name: 'projectIds',
    required: false,
    description:
      'UUIDs de proyectos separados por coma (ej: uuid1,uuid2,uuid3)',
  })
  @ApiQuery({ name: 'organizationId', required: false })
  @ApiQuery({ name: 'statusId', required: false })
  @ApiQuery({ name: 'assignedToId', required: false })
  @ApiQuery({ name: 'type', required: false, enum: TaskType })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  async findAll(
    @CurrentUser() user: User,
    @Query('projectId') projectId?: string,
    @Query('projectIds') projectIds?: string,
    @Query('organizationId') organizationId?: string,
    @Query('statusId') statusId?: string,
    @Query('assignedToId') assignedToId?: string,
    @Query('type') type?: TaskType,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    if (projectId) {
      await this.tasksService.verifyProjectAccess(
        projectId,
        user.id,
        user.isSuperAdmin(),
      );
    }
    const parsedProjectIds = projectIds
      ? projectIds
          .split(',')
          .map((id) => id.trim())
          .filter(Boolean)
      : undefined;
    if (parsedProjectIds && parsedProjectIds.length > 10) {
      throw new BadRequestException(
        'No se pueden consultar mas de 10 proyectos a la vez',
      );
    }
    if (parsedProjectIds && parsedProjectIds.length > 0) {
      for (const pid of parsedProjectIds) {
        await this.tasksService.verifyProjectAccess(
          pid,
          user.id,
          user.isSuperAdmin(),
        );
      }
    }
    if (organizationId) {
      await this.tasksService.verifyOrganizationAccess(
        organizationId,
        user.id,
        user.isSuperAdmin(),
      );
    }
    return this.tasksService.findAll(
      {
        projectId,
        projectIds: parsedProjectIds,
        organizationId,
        statusId,
        assignedToId,
        type,
        page: page ? Math.max(1, parseInt(page) || 1) : undefined,
        limit: limit
          ? Math.min(100, Math.max(1, parseInt(limit) || 20))
          : undefined,
      },
      user.id,
      user.isSuperAdmin(),
    );
  }

  @Get('my')
  @ApiOperation({ summary: 'Mis tareas' })
  @ApiQuery({ name: 'type', required: false, enum: TaskType })
  async findMyTasks(@CurrentUser() user: User, @Query('type') type?: TaskType) {
    return this.tasksService.findMyTasks(user.id, type);
  }

  @Get('daily')
  @ApiOperation({ summary: 'Tareas diarias' })
  @ApiQuery({ name: 'date', required: false })
  async findDailyTasks(
    @CurrentUser() user: User,
    @Query('date') date?: string,
  ) {
    return this.tasksService.findDailyTasks(user.id, date);
  }

  @Patch('bulk-positions')
  @ApiKeyScopes('tasks:write')
  @ApiKeyProjectParam('projectId')
  @ApiQuery({ name: 'projectId', required: false })
  @ApiOperation({
    summary: 'Actualizar posiciones y estados en bulk (drag & drop)',
  })
  async bulkUpdatePositions(
    @Body() dto: BulkUpdatePositionsDto,
    @CurrentUser() user: User,
    @Req() request: ApiKeyRequest,
  ) {
    const taskIds = dto.items.map((item) => item.id);
    await this.tasksService.verifyBulkEditAccess(
      taskIds,
      user.id,
      user.isSuperAdmin(),
      request.identity?.authType === 'api-key'
        ? request.identity.projectId
        : undefined,
    );
    return this.tasksService.bulkUpdatePositions(dto.items);
  }

  @Get(':id')
  @ApiKeyScopes('tasks:read')
  @ApiKeyProjectParam('projectId')
  @ApiQuery({ name: 'projectId', required: false })
  @ApiOperation({ summary: 'Obtener tarea por ID con asignados' })
  async findOne(
    @Param('id') id: string,
    @CurrentUser() user: User,
    @Req() request: ApiKeyRequest,
  ) {
    const task = await this.tasksService.verifyTaskAccess(
      id,
      user.id,
      user.isSuperAdmin(),
      request.identity?.authType === 'api-key'
        ? request.identity.projectId
        : undefined,
    );
    assertApiKeyProject(request, task.projectId);
    return this.tasksService.findByIdWithAssignees(id);
  }

  @Patch(':id')
  @ApiKeyScopes('tasks:write')
  @ApiKeyProjectParam('projectId')
  @ApiQuery({ name: 'projectId', required: false })
  @ApiOperation({ summary: 'Actualizar tarea' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateTaskDto,
    @CurrentUser() user: User,
    @Req() request: ApiKeyRequest,
  ) {
    const task = await this.tasksService.verifyTaskEditAccess(
      id,
      user.id,
      user.isSuperAdmin(),
      request.identity?.authType === 'api-key'
        ? request.identity.projectId
        : undefined,
    );
    assertApiKeyProject(request, task.projectId);
    return this.tasksService.update(id, dto, user);
  }

  @Delete(':id')
  @ApiKeyScopes('tasks:write')
  @ApiKeyProjectParam('projectId')
  @ApiQuery({ name: 'projectId', required: false })
  @ApiOperation({ summary: 'Eliminar tarea' })
  async remove(
    @Param('id') id: string,
    @CurrentUser() user: User,
    @Req() request: ApiKeyRequest,
  ) {
    const task = await this.tasksService.verifyTaskDeleteAccess(
      id,
      user.id,
      user.isSuperAdmin(),
      request.identity?.authType === 'api-key'
        ? request.identity.projectId
        : undefined,
    );
    assertApiKeyProject(request, task.projectId);
    await this.tasksService.remove(id);
    return { message: 'Tarea eliminada' };
  }

  @Get(':id/subtasks')
  @ApiKeyScopes('tasks:read')
  @ApiKeyProjectParam('projectId')
  @ApiQuery({ name: 'projectId', required: false })
  @ApiOperation({ summary: 'Obtener subtareas' })
  async getSubtasks(
    @Param('id') id: string,
    @CurrentUser() user: User,
    @Req() request: ApiKeyRequest,
  ) {
    const task = await this.tasksService.verifyTaskAccess(
      id,
      user.id,
      user.isSuperAdmin(),
      request.identity?.authType === 'api-key'
        ? request.identity.projectId
        : undefined,
    );
    assertApiKeyProject(request, task.projectId);
    return this.tasksService.getSubtasks(id);
  }

  @Post(':id/subtasks')
  @ApiKeyScopes('tasks:write')
  @ApiKeyProjectParam('projectId')
  @ApiQuery({ name: 'projectId', required: false })
  @ApiOperation({ summary: 'Crear subtarea' })
  async createSubtask(
    @Param('id') id: string,
    @Body() dto: CreateTaskDto,
    @CurrentUser() user: User,
    @Req() request: ApiKeyRequest,
  ) {
    const parent = await this.tasksService.verifyTaskAccess(
      id,
      user.id,
      user.isSuperAdmin(),
      request.identity?.authType === 'api-key'
        ? request.identity.projectId
        : undefined,
    );
    await this.tasksService.verifyTaskCreateAccess(
      parent.projectId || null,
      user.id,
      user.isSuperAdmin(),
    );
    assertApiKeyProject(request, parent.projectId);
    assertApiKeyProject(request, dto.projectId || parent.projectId);
    return this.tasksService.createSubtask(id, dto, user);
  }
}
