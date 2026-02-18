import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query, ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { TasksService } from './tasks.service';
import { CreateTaskDto, UpdateTaskDto } from './dto';
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
    @Query('projectId') projectId?: string,
    @Query('organizationId') organizationId?: string,
    @Query('statusId') statusId?: string,
    @Query('assignedToId') assignedToId?: string,
    @Query('type') type?: TaskType,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.tasksService.findAll({
      projectId, organizationId, statusId, assignedToId, type,
      page: page ? parseInt(page) : undefined,
      limit: limit ? parseInt(limit) : undefined,
    });
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

  @Get(':id')
  @ApiOperation({ summary: 'Obtener tarea por ID' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.tasksService.findById(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar tarea' })
  async update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateTaskDto) {
    return this.tasksService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar tarea' })
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.tasksService.remove(id);
    return { message: 'Tarea eliminada' };
  }

  @Get(':id/subtasks')
  @ApiOperation({ summary: 'Obtener subtareas' })
  async getSubtasks(@Param('id', ParseUUIDPipe) id: string) {
    return this.tasksService.getSubtasks(id);
  }

  @Post(':id/subtasks')
  @ApiOperation({ summary: 'Crear subtarea' })
  async createSubtask(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateTaskDto,
    @CurrentUser() user: User,
  ) {
    return this.tasksService.createSubtask(id, dto, user);
  }
}
