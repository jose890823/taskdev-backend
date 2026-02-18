import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query, ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { ProjectsService } from './projects.service';
import { CreateProjectDto, UpdateProjectDto, AddProjectMemberDto } from './dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../auth/entities/user.entity';

@ApiTags('Projects')
@ApiBearerAuth()
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
  async findAll(
    @CurrentUser() user: User,
    @Query('organizationId') organizationId?: string,
    @Query('personal') personal?: string,
  ) {
    return this.projectsService.findAll(user.id, organizationId, personal === 'true');
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener proyecto por ID' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.projectsService.findById(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar proyecto' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProjectDto,
    @CurrentUser() user: User,
  ) {
    return this.projectsService.update(id, dto, user.id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar proyecto' })
  async remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    await this.projectsService.remove(id, user.id);
    return { message: 'Proyecto eliminado' };
  }

  @Get(':id/members')
  @ApiOperation({ summary: 'Listar miembros del proyecto' })
  async getMembers(@Param('id', ParseUUIDPipe) id: string) {
    return this.projectsService.getMembers(id);
  }

  @Post(':id/members')
  @ApiOperation({ summary: 'Agregar miembro al proyecto' })
  async addMember(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddProjectMemberDto,
    @CurrentUser() user: User,
  ) {
    return this.projectsService.addMember(id, dto, user.id);
  }

  @Delete(':id/members/:userId')
  @ApiOperation({ summary: 'Eliminar miembro del proyecto' })
  async removeMember(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @CurrentUser() user: User,
  ) {
    await this.projectsService.removeMember(id, userId, user.id);
    return { message: 'Miembro eliminado' };
  }
}
