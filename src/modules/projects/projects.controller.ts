import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { ProjectsService } from './projects.service';
import { CreateProjectDto, UpdateProjectDto, AddProjectMemberDto } from './dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../auth/entities/user.entity';
import { CombinedAuthGuard } from '../api-keys/guards';
import { ApiKeyProjectParam, ApiKeyScopes } from '../api-keys/decorators';

@ApiTags('Projects')
@ApiBearerAuth()
@UseGuards(CombinedAuthGuard)
@Controller('projects')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Post()
  @ApiOperation({ summary: 'Crear proyecto' })
  async create(@Body() dto: CreateProjectDto, @CurrentUser() user: User) {
    return this.projectsService.create(dto, user);
  }

  @Get()
  @ApiOperation({ summary: 'Listar proyectos' })
  @ApiQuery({ name: 'organizationId', required: false })
  @ApiQuery({ name: 'personal', required: false, type: Boolean })
  @ApiQuery({
    name: 'includeChildren',
    required: false,
    type: Boolean,
    description: 'Incluir sub-proyectos en el listado (por defecto false)',
  })
  async findAll(
    @CurrentUser() user: User,
    @Query('organizationId') organizationId?: string,
    @Query('personal') personal?: string,
    @Query('includeChildren') includeChildren?: string,
  ) {
    return this.projectsService.findAll(
      user.id,
      organizationId,
      personal === 'true',
      includeChildren === 'true',
    );
  }

  @Get('by-slug/:slug')
  @ApiOperation({ summary: 'Obtener proyecto por slug' })
  async findBySlug(@Param('slug') slug: string, @CurrentUser() user: User) {
    const project = await this.projectsService.findBySlug(slug);
    if (!user.isSuperAdmin() && project.ownerId !== user.id) {
      await this.projectsService.verifyMemberAccess(project.id, user.id);
    }
    return project;
  }

  @Get(':id/children')
  @ApiKeyScopes('projects:read')
  @ApiKeyProjectParam('id')
  @ApiOperation({ summary: 'Listar sub-proyectos de un proyecto' })
  async findChildren(@Param('id') id: string, @CurrentUser() user: User) {
    const project = await this.projectsService.findById(id);
    if (!user.isSuperAdmin()) {
      await this.projectsService.verifyMemberAccess(project.id, user.id);
    }
    return this.projectsService.findChildren(id);
  }

  @Get(':id')
  @ApiKeyScopes('projects:read')
  @ApiKeyProjectParam('id')
  @ApiOperation({ summary: 'Obtener proyecto por ID' })
  async findOne(@Param('id') id: string, @CurrentUser() user: User) {
    const project = await this.projectsService.findById(id);
    if (!user.isSuperAdmin() && project.ownerId !== user.id) {
      await this.projectsService.verifyMemberAccess(project.id, user.id);
    }
    return project;
  }

  @Patch(':id')
  @ApiKeyScopes('projects:write')
  @ApiKeyProjectParam('id')
  @ApiOperation({ summary: 'Actualizar proyecto' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateProjectDto,
    @CurrentUser() user: User,
  ) {
    return this.projectsService.update(id, dto, user.id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar proyecto' })
  async remove(@Param('id') id: string, @CurrentUser() user: User) {
    await this.projectsService.remove(id, user.id, user.isSuperAdmin());
    return { message: 'Proyecto eliminado' };
  }

  @Get(':id/members')
  @ApiKeyScopes('project-members:read')
  @ApiKeyProjectParam('id')
  @ApiOperation({ summary: 'Listar miembros del proyecto' })
  async getMembers(@Param('id') id: string, @CurrentUser() user: User) {
    const project = await this.projectsService.findById(id);
    if (!user.isSuperAdmin() && project.ownerId !== user.id) {
      await this.projectsService.verifyMemberAccess(project.id, user.id);
    }
    return this.projectsService.getMembers(id);
  }

  @Post(':id/members')
  @ApiKeyScopes('project-members:write')
  @ApiKeyProjectParam('id')
  @ApiOperation({ summary: 'Agregar miembro al proyecto' })
  async addMember(
    @Param('id') id: string,
    @Body() dto: AddProjectMemberDto,
    @CurrentUser() user: User,
  ) {
    return this.projectsService.addMember(id, dto, user.id);
  }

  @Delete(':id/members/:userId')
  @ApiKeyScopes('project-members:write')
  @ApiKeyProjectParam('id')
  @ApiOperation({ summary: 'Eliminar miembro del proyecto' })
  async removeMember(
    @Param('id') id: string,
    @Param('userId') userId: string,
    @CurrentUser() user: User,
  ) {
    await this.projectsService.removeMember(id, userId, user.id);
    return { message: 'Miembro eliminado' };
  }
}
