import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  ParseUUIDPipe,
  ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { TaskStatusesService } from './task-statuses.service';
import { CreateTaskStatusDto, UpdateTaskStatusDto } from './dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../auth/entities/user.entity';
import { ProjectsService } from '../projects/projects.service';
import { ProjectRole } from '../projects/entities/project-member.entity';

@ApiTags('Task Statuses')
@ApiBearerAuth()
@Controller()
export class TaskStatusesController {
  constructor(
    private readonly taskStatusesService: TaskStatusesService,
    private readonly projectsService: ProjectsService,
  ) {}

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
    @CurrentUser() user: User,
  ) {
    await this.verifyProjectAdminAccess(projectId, user);
    return this.taskStatusesService.create(projectId, dto);
  }

  @Patch('task-statuses/:id')
  @ApiOperation({ summary: 'Actualizar estado' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTaskStatusDto,
    @CurrentUser() user: User,
  ) {
    const status = await this.taskStatusesService.findById(id);
    if (status.projectId) {
      await this.verifyProjectAdminAccess(status.projectId, user);
    } else if (!user.isSuperAdmin()) {
      throw new ForbiddenException(
        'Solo super admins pueden modificar estados globales',
      );
    }
    return this.taskStatusesService.update(id, dto);
  }

  @Delete('task-statuses/:id')
  @ApiOperation({ summary: 'Eliminar estado' })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ) {
    const status = await this.taskStatusesService.findById(id);
    if (status.projectId) {
      await this.verifyProjectAdminAccess(status.projectId, user);
    } else if (!user.isSuperAdmin()) {
      throw new ForbiddenException(
        'Solo super admins pueden eliminar estados globales',
      );
    }
    await this.taskStatusesService.remove(id);
    return { message: 'Estado eliminado' };
  }

  private async verifyProjectAdminAccess(
    projectId: string,
    user: User,
  ): Promise<void> {
    if (user.isSuperAdmin()) return;
    const role = await this.projectsService.getMemberRole(projectId, user.id);
    if (role !== ProjectRole.OWNER && role !== ProjectRole.ADMIN) {
      throw new ForbiddenException(
        'No tienes permisos para modificar los estados de este proyecto',
      );
    }
  }
}
