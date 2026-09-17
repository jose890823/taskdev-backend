import {
  Controller,
  Get,
  Param,
  Query,
  ParseUUIDPipe,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { ActivityService } from './activity.service';
import { ProjectsService } from '../projects/projects.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../auth/entities/user.entity';
import { CombinedAuthGuard } from '../api-keys/guards';
import { ApiKeyProjectParam, ApiKeyScopes } from '../api-keys/decorators';

@ApiTags('Activity')
@ApiBearerAuth()
@UseGuards(CombinedAuthGuard)
@Controller('activity')
export class ActivityController {
  constructor(
    private readonly activityService: ActivityService,
    private readonly projectsService: ProjectsService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Actividad del usuario autenticado' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async findMy(
    @CurrentUser() user: User,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const safePage = Math.max(1, parseInt(page ?? '', 10) || 1);
    const safeLimit = Math.min(
      100,
      Math.max(1, parseInt(limit ?? '', 10) || 20),
    );
    return this.activityService.findByUser(user.id, safePage, safeLimit);
  }

  @Get('project/:projectId')
  @ApiKeyScopes('activity:read')
  @ApiKeyProjectParam('projectId')
  @ApiOperation({ summary: 'Actividad de un proyecto' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async findByProject(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @CurrentUser() user: User,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    await this.projectsService.verifyMemberAccess(
      projectId,
      user.id,
      user.isSuperAdmin(),
    );

    const safePage = Math.max(1, parseInt(page ?? '', 10) || 1);
    const safeLimit = Math.min(
      100,
      Math.max(1, parseInt(limit ?? '', 10) || 20),
    );
    return this.activityService.findByProject(projectId, safePage, safeLimit);
  }

  @Get('daily-summary')
  @ApiOperation({ summary: 'Resumen diario de actividad' })
  @ApiQuery({
    name: 'date',
    required: false,
    type: String,
    description: 'YYYY-MM-DD',
  })
  async getDailySummary(
    @CurrentUser() user: User,
    @Query('date') date?: string,
  ) {
    if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new BadRequestException('El formato de fecha debe ser YYYY-MM-DD');
    }

    return this.activityService.getDailySummary(user.id, date);
  }
}
