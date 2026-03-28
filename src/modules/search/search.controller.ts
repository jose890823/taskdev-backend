import { Controller, Get, Query, ForbiddenException } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiQuery,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { SearchService } from './search.service';
import { ProjectsService } from '../projects/projects.service';
import { OrganizationsService } from '../organizations/organizations.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../auth/entities/user.entity';

@ApiTags('Search')
@ApiBearerAuth()
@Controller('search')
export class SearchController {
  constructor(
    private readonly searchService: SearchService,
    private readonly projectsService: ProjectsService,
    private readonly organizationsService: OrganizationsService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Buscar entidad por systemCode' })
  @ApiQuery({
    name: 'code',
    required: true,
    description:
      'SystemCode de la entidad (ej: TSK-260218-A3K7, ORG-260218-B2C3, PRJ-260218-D4F1)',
    example: 'TSK-260218-A3K7',
  })
  async findByCode(@Query('code') code: string, @CurrentUser() user: User) {
    const result = await this.searchService.findByCode(code);

    if (!user.isSuperAdmin()) {
      await this.verifyAccess(result.type, result.data, user.id);
    }

    return result;
  }

  /**
   * Verificar que el usuario tiene acceso a la entidad encontrada
   */
  private async verifyAccess(
    type: string,
    data: Record<string, unknown>,
    userId: string,
  ): Promise<void> {
    switch (type) {
      case 'task': {
        // Acceso si es creador, asignado, o miembro del proyecto
        const createdById = data.createdById as string | null;
        const assignedToId = data.assignedToId as string | null;
        if (createdById === userId || assignedToId === userId) return;

        const taskProjectId = data.projectId as string | null;
        if (taskProjectId) {
          const isMember = await this.projectsService.isMember(
            taskProjectId,
            userId,
          );
          if (isMember) return;
        }
        throw new ForbiddenException('No tienes acceso a esta tarea');
      }

      case 'project': {
        const projectId = data.id as string;
        const isMember = await this.projectsService.isMember(projectId, userId);
        if (!isMember) {
          throw new ForbiddenException('No tienes acceso a este proyecto');
        }
        break;
      }

      case 'organization': {
        const orgId = data.id as string;
        const isMember = await this.organizationsService.isMember(
          orgId,
          userId,
        );
        if (!isMember) {
          throw new ForbiddenException('No tienes acceso a esta organizacion');
        }
        break;
      }
    }
  }
}
