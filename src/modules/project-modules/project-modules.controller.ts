import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { ProjectModulesService } from './project-modules.service';
import {
  CreateProjectModuleDto,
  UpdateProjectModuleDto,
  ReorderModulesDto,
} from './dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../auth/entities/user.entity';
import { ProjectsService } from '../projects/projects.service';
import { ProjectRole } from '../projects/entities/project-member.entity';

@ApiTags('Project Modules')
@ApiBearerAuth()
@Controller()
export class ProjectModulesController {
  constructor(
    private readonly projectModulesService: ProjectModulesService,
    private readonly projectsService: ProjectsService,
  ) {}

  @Post('projects/:projectId/modules')
  @ApiOperation({ summary: 'Crear modulo de proyecto' })
  async create(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() dto: CreateProjectModuleDto,
    @CurrentUser() user: User,
  ) {
    await this.verifyProjectAdminAccess(projectId, user);
    return this.projectModulesService.create(projectId, dto);
  }

  @Get('projects/:projectId/modules')
  @ApiOperation({
    summary: 'Listar modulos del proyecto (arbol o lista plana)',
  })
  @ApiQuery({
    name: 'flat',
    required: false,
    type: Boolean,
    description: 'Si true, devuelve lista plana en vez de arbol',
  })
  async findByProject(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Query('flat') flat?: string,
  ) {
    if (flat === 'true') {
      return this.projectModulesService.findAllFlat(projectId);
    }
    return this.projectModulesService.findByProject(projectId);
  }

  @Patch('project-modules/:id')
  @ApiOperation({ summary: 'Actualizar modulo' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProjectModuleDto,
    @CurrentUser() user: User,
  ) {
    const mod = await this.projectModulesService.findById(id);
    await this.verifyProjectAdminAccess(mod.projectId, user);
    return this.projectModulesService.update(id, dto);
  }

  @Delete('project-modules/:id')
  @ApiOperation({ summary: 'Eliminar modulo (y sus submodulos)' })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ) {
    const mod = await this.projectModulesService.findById(id);
    await this.verifyProjectAdminAccess(mod.projectId, user);
    await this.projectModulesService.remove(id);
    return { message: 'Modulo eliminado' };
  }

  @Patch('project-modules/reorder')
  @ApiOperation({ summary: 'Reordenar modulos' })
  async reorder(@Body() dto: ReorderModulesDto, @CurrentUser() user: User) {
    if (!dto.ids || dto.ids.length === 0) {
      throw new BadRequestException(
        'Se requiere al menos un ID para reordenar',
      );
    }
    const firstModule = await this.projectModulesService.findById(dto.ids[0]);
    await this.verifyProjectAdminAccess(firstModule.projectId, user);
    await this.projectModulesService.reorder(dto);
    return { message: 'Modulos reordenados' };
  }

  private async verifyProjectAdminAccess(
    projectId: string,
    user: User,
  ): Promise<void> {
    if (user.isSuperAdmin()) return;
    const role = await this.projectsService.getMemberRole(projectId, user.id);
    if (role !== ProjectRole.OWNER && role !== ProjectRole.ADMIN) {
      throw new ForbiddenException(
        'No tienes permisos para modificar los modulos de este proyecto',
      );
    }
  }
}
