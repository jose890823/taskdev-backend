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
  Req,
  UseGuards,
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
import { CombinedAuthGuard } from '../api-keys/guards';
import { ApiKeyProjectParam, ApiKeyScopes } from '../api-keys/decorators';
import type { ApiKeyRequest } from '../api-keys/api-key.types';
import { assertApiKeyProject } from '../api-keys/api-key.policy';

@ApiTags('Project Modules')
@ApiBearerAuth()
@UseGuards(CombinedAuthGuard)
@Controller()
export class ProjectModulesController {
  constructor(
    private readonly projectModulesService: ProjectModulesService,
    private readonly projectsService: ProjectsService,
  ) {}

  @Post('projects/:projectId/modules')
  @ApiKeyScopes('project-modules:write')
  @ApiKeyProjectParam('projectId')
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
  @ApiKeyScopes('project-modules:read')
  @ApiKeyProjectParam('projectId')
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
    @CurrentUser() user: User,
    @Query('flat') flat?: string,
  ) {
    await this.projectsService.verifyMemberAccess(
      projectId,
      user.id,
      user.isSuperAdmin(),
    );
    if (flat === 'true') {
      return this.projectModulesService.findAllFlat(projectId);
    }
    return this.projectModulesService.findByProject(projectId);
  }

  @Patch('project-modules/reorder')
  @ApiKeyScopes('project-modules:write')
  @ApiKeyProjectParam('projectId')
  @ApiQuery({ name: 'projectId', required: false })
  @ApiOperation({ summary: 'Reordenar modulos' })
  async reorder(
    @Body() dto: ReorderModulesDto,
    @CurrentUser() user: User,
    @Req() request: ApiKeyRequest,
  ) {
    if (!dto.ids || dto.ids.length === 0) {
      throw new BadRequestException(
        'Se requiere al menos un ID para reordenar',
      );
    }

    // Verify all modules exist and belong to the same project
    const modules = await this.projectModulesService.findByIds(dto.ids);
    if (modules.length !== dto.ids.length) {
      throw new BadRequestException('Uno o mas modulos no fueron encontrados');
    }
    const uniqueProjects = new Set(modules.map((m) => m.projectId));
    if (uniqueProjects.size > 1) {
      throw new BadRequestException(
        'Todos los modulos deben pertenecer al mismo proyecto',
      );
    }

    const projectId = modules[0].projectId;
    assertApiKeyProject(request, projectId);
    await this.verifyProjectAdminAccess(projectId, user);
    await this.projectModulesService.reorder(dto);
    return { message: 'Modulos reordenados' };
  }

  @Patch('project-modules/:id')
  @ApiKeyScopes('project-modules:write')
  @ApiKeyProjectParam('projectId')
  @ApiQuery({ name: 'projectId', required: false })
  @ApiOperation({ summary: 'Actualizar modulo' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProjectModuleDto,
    @CurrentUser() user: User,
    @Req() request: ApiKeyRequest,
  ) {
    const mod = await this.projectModulesService.findById(id);
    assertApiKeyProject(request, mod.projectId);
    await this.verifyProjectAdminAccess(mod.projectId, user);
    return this.projectModulesService.update(id, dto);
  }

  @Delete('project-modules/:id')
  @ApiKeyScopes('project-modules:write')
  @ApiKeyProjectParam('projectId')
  @ApiQuery({ name: 'projectId', required: false })
  @ApiOperation({ summary: 'Eliminar modulo (y sus submodulos)' })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
    @Req() request: ApiKeyRequest,
  ) {
    const mod = await this.projectModulesService.findById(id);
    assertApiKeyProject(request, mod.projectId);
    await this.verifyProjectAdminAccess(mod.projectId, user);
    await this.projectModulesService.remove(id);
    return { message: 'Modulo eliminado' };
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
