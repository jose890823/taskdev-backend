import {
  Controller, Get, Post, Patch, Delete, Body, Param, ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { TaskStatusesService } from './task-statuses.service';
import { CreateTaskStatusDto, UpdateTaskStatusDto } from './dto';

@ApiTags('Task Statuses')
@ApiBearerAuth()
@Controller()
export class TaskStatusesController {
  constructor(private readonly taskStatusesService: TaskStatusesService) {}

  @Get('projects/:projectId/statuses')
  @ApiOperation({ summary: 'Listar estados del proyecto' })
  async findByProject(@Param('projectId', ParseUUIDPipe) projectId: string) {
    return this.taskStatusesService.findByProject(projectId);
  }

  @Get('task-statuses/global')
  @ApiOperation({ summary: 'Listar estados globales (daily tasks)' })
  async findGlobal() {
    return this.taskStatusesService.findGlobal();
  }

  @Post('projects/:projectId/statuses')
  @ApiOperation({ summary: 'Crear estado para proyecto' })
  async create(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() dto: CreateTaskStatusDto,
  ) {
    return this.taskStatusesService.create(projectId, dto);
  }

  @Patch('task-statuses/:id')
  @ApiOperation({ summary: 'Actualizar estado' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTaskStatusDto,
  ) {
    return this.taskStatusesService.update(id, dto);
  }

  @Delete('task-statuses/:id')
  @ApiOperation({ summary: 'Eliminar estado' })
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.taskStatusesService.remove(id);
    return { message: 'Estado eliminado' };
  }
}
