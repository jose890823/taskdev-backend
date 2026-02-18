import {
  Controller, Get, Param, Query, ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { ActivityService } from './activity.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../auth/entities/user.entity';

@ApiTags('Activity')
@ApiBearerAuth()
@Controller('activity')
export class ActivityController {
  constructor(private readonly activityService: ActivityService) {}

  @Get()
  @ApiOperation({ summary: 'Actividad del usuario autenticado' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async findMy(
    @CurrentUser() user: User,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.activityService.findByUser(
      user.id,
      page ? +page : 1,
      limit ? +limit : 20,
    );
  }

  @Get('project/:projectId')
  @ApiOperation({ summary: 'Actividad de un proyecto' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async findByProject(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.activityService.findByProject(
      projectId,
      page ? +page : 1,
      limit ? +limit : 20,
    );
  }

  @Get('daily-summary')
  @ApiOperation({ summary: 'Resumen diario de actividad' })
  @ApiQuery({ name: 'date', required: false, type: String, description: 'YYYY-MM-DD' })
  async getDailySummary(
    @CurrentUser() user: User,
    @Query('date') date?: string,
  ) {
    return this.activityService.getDailySummary(user.id, date);
  }
}
