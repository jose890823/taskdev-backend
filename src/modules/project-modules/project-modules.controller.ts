import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query, ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { ProjectModulesService } from './project-modules.service';
import { CreateProjectModuleDto, UpdateProjectModuleDto, ReorderModulesDto } from './dto';

@ApiTags('Project Modules')
@ApiBearerAuth()
@Controller()
export class ProjectModulesController {
  constructor(private readonly projectModulesService: ProjectModulesService) {}

  @Post('projects/:projectId/modules')
  @ApiOperation({ summary: 'Crear modulo de proyecto' })
  async create(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() dto: CreateProjectModuleDto,
  ) {
    return this.projectModulesService.create(projectId, dto);
  }

  @Get('projects/:projectId/modules')
  @ApiOperation({ summary: 'Listar modulos del proyecto (arbol o lista plana)' })
  @ApiQuery({ name: 'flat', required: false, type: Boolean, description: 'Si true, devuelve lista plana en vez de arbol' })
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
  ) {
    return this.projectModulesService.update(id, dto);
  }

  @Delete('project-modules/:id')
  @ApiOperation({ summary: 'Eliminar modulo (y sus submodulos)' })
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.projectModulesService.remove(id);
    return { message: 'Modulo eliminado' };
  }

  @Patch('project-modules/reorder')
  @ApiOperation({ summary: 'Reordenar modulos' })
  async reorder(@Body() dto: ReorderModulesDto) {
    await this.projectModulesService.reorder(dto);
    return { message: 'Modulos reordenados' };
  }
}
