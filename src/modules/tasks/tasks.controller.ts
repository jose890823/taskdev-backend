import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { TasksService } from './tasks.service';
import { CreateTaskDto, UpdateTaskDto, BulkUpdatePositionsDto } from './dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../auth/entities/user.entity';
import { TaskType } from './entities/task.entity';

@ApiTags('Tasks')
@ApiBearerAuth()
@Controller('tasks')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Post()
  @ApiOperation({ summary: 'Crear tarea' })
  async create(@Body() dto: CreateTaskDto, @CurrentUser() user: User) {
    await this.tasksService.verifyTaskCreateAccess(dto.projectId || null, user.id, user.isSuperAdmin());
    if (dto.organizationId) {
      await this.tasksService.verifyOrganizationAccess(dto.organizationId, user.id, user.isSuperAdmin());
    }
    return this.tasksService.create(dto, user);
  }

  @Get()
  @ApiOperation({ summary: 'Listar tareas con filtros' })
  @ApiQuery({ name: 'projectId', required: false })
  @ApiQuery({ name: 'organizationId', required: false })
  @ApiQuery({ name: 'statusId', required: false })
  @ApiQuery({ name: 'assignedToId', required: false })
  @ApiQuery({ name: 'type', required: false, enum: TaskType })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  async findAll(
    @CurrentUser() user: User,
    @Query('projectId') projectId?: string,
    @Query('organizationId') organizationId?: string,
    @Query('statusId') statusId?: string,
    @Query('assignedToId') assignedToId?: string,
    @Query('type') type?: TaskType,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    if (projectId) {
      await this.tasksService.verifyProjectAccess(projectId, user.id, user.isSuperAdmin());
    }
    if (organizationId) {
      await this.tasksService.verifyOrganizationAccess(organizationId, user.id, user.isSuperAdmin());
    }
    return this.tasksService.findAll({
      projectId, organizationId, statusId, assignedToId, type,
      page: page ? parseInt(page) : undefined,
      limit: limit ? parseInt(limit) : undefined,
    }, user.id, user.isSuperAdmin());
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
  async findDailyTasks(@CurrentUser() user: User, @Query('date') date?: string) {
    return this.tasksService.findDailyTasks(user.id, date);
  }

  @Patch('bulk-positions')
  @ApiOperation({ summary: 'Actualizar posiciones y estados en bulk (drag & drop)' })
  async bulkUpdatePositions(@Body() dto: BulkUpdatePositionsDto, @CurrentUser() user: User) {
    for (const item of dto.items) {
      await this.tasksService.verifyTaskEditAccess(item.id, user.id, user.isSuperAdmin());
    }
    return this.tasksService.bulkUpdatePositions(dto.items);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener tarea por ID con asignados' })
  async findOne(@Param('id') id: string, @CurrentUser() user: User) {
    await this.tasksService.verifyTaskAccess(id, user.id, user.isSuperAdmin());
    return this.tasksService.findByIdWithAssignees(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar tarea' })
  async update(@Param('id') id: string, @Body() dto: UpdateTaskDto, @CurrentUser() user: User) {
    await this.tasksService.verifyTaskEditAccess(id, user.id, user.isSuperAdmin());
    return this.tasksService.update(id, dto, user);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar tarea' })
  async remove(@Param('id') id: string, @CurrentUser() user: User) {
    await this.tasksService.verifyTaskDeleteAccess(id, user.id, user.isSuperAdmin());
    await this.tasksService.remove(id);
    return { message: 'Tarea eliminada' };
  }

  @Get(':id/subtasks')
  @ApiOperation({ summary: 'Obtener subtareas' })
  async getSubtasks(@Param('id') id: string, @CurrentUser() user: User) {
    await this.tasksService.verifyTaskAccess(id, user.id, user.isSuperAdmin());
    return this.tasksService.getSubtasks(id);
  }

  @Post(':id/subtasks')
  @ApiOperation({ summary: 'Crear subtarea' })
  async createSubtask(
    @Param('id') id: string,
    @Body() dto: CreateTaskDto,
    @CurrentUser() user: User,
  ) {
    const parent = await this.tasksService.verifyTaskAccess(id, user.id, user.isSuperAdmin());
    await this.tasksService.verifyTaskCreateAccess(parent.projectId || null, user.id, user.isSuperAdmin());
    return this.tasksService.createSubtask(id, dto, user);
  }
}
