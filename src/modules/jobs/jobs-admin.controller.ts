import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole } from '../auth/entities/user.entity';

import { JobsService } from './jobs.service';
import { TriggerJobDto, JobFilterDto, JobExecutionResponseDto } from './dto';

/**
 * Controller de administracion de jobs en background
 * Permite monitorear, disparar y limpiar ejecuciones de jobs
 */
@ApiTags('Jobs - Admin')
@Controller('jobs')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class JobsAdminController {
  constructor(private readonly jobsService: JobsService) {}

  // ============================================
  // TRIGGER
  // ============================================

  @Post('trigger')
  @Roles(UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Disparar un job manualmente',
    description:
      'Permite a un administrador ejecutar un job de background de forma inmediata',
  })
  @ApiResponse({
    status: 201,
    description: 'Job agregado a la cola exitosamente',
    type: JobExecutionResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Nombre de job invalido' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 403, description: 'Sin permisos suficientes' })
  async triggerJob(@Body() dto: TriggerJobDto, @CurrentUser() user: any) {
    return this.jobsService.triggerJob(dto.jobName, user.id, dto.input);
  }

  // ============================================
  // EXECUTIONS
  // ============================================

  @Get('executions')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Listar historial de ejecuciones',
    description:
      'Obtiene el historial de ejecuciones de jobs con filtros y paginacion',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de ejecuciones con paginacion',
  })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 403, description: 'Sin permisos suficientes' })
  async getExecutions(@Query() filters: JobFilterDto) {
    return this.jobsService.getExecutions(filters);
  }

  @Get('executions/:id')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Obtener detalle de una ejecucion',
    description:
      'Obtiene informacion detallada de una ejecucion de job por su ID',
  })
  @ApiParam({
    name: 'id',
    description: 'ID de la ejecucion (UUID)',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  @ApiResponse({
    status: 200,
    description: 'Detalle de la ejecucion',
    type: JobExecutionResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Ejecucion no encontrada' })
  async getExecution(@Param('id') id: string) {
    return this.jobsService.getExecution(id);
  }

  // ============================================
  // STATUS
  // ============================================

  @Get('status')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Estado actual de todos los jobs',
    description:
      'Obtiene la ultima ejecucion de cada job para conocer su estado actual',
  })
  @ApiResponse({
    status: 200,
    description: 'Estado de cada job con su ultima ejecucion',
  })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 403, description: 'Sin permisos suficientes' })
  async getJobStatuses() {
    return this.jobsService.getJobStatuses();
  }

  // ============================================
  // CLEANUP
  // ============================================

  @Delete('executions/cleanup')
  @Roles(UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Limpiar ejecuciones antiguas',
    description:
      'Elimina registros de ejecuciones con mas de 30 dias de antiguedad. Solo super_admin.',
  })
  @ApiResponse({
    status: 200,
    description: 'Limpieza completada con cantidad de registros eliminados',
  })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 403, description: 'Sin permisos suficientes' })
  async cleanOldExecutions() {
    const deleted = await this.jobsService.cleanOldExecutions();
    return {
      success: true,
      deletedRecords: deleted,
      message: `Se eliminaron ${deleted} registros de ejecuciones antiguas`,
    };
  }
}
