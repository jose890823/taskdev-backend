import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '../../auth/entities/user.entity';
import { NotificationsService } from '../services/notifications.service';
import { NotificationConfigService } from '../services/notification-config.service';
import { Notification } from '../entities/notification.entity';
import { NotificationEventConfig } from '../entities/notification-event-config.entity';
import {
  CreateNotificationDto,
  NotificationQueryDto,
  SendBroadcastDto,
  UpdateEventConfigDto,
} from '../dto';

@ApiTags('Admin - Notifications')
@Controller('v1/admin/notifications')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN)
@ApiBearerAuth()
export class NotificationsAdminController {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly notificationConfigService: NotificationConfigService,
  ) {}

  // ============================================
  // CREAR NOTIFICACIÓN
  // ============================================

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Crear notificación',
    description: 'Crea una notificación para un usuario específico',
  })
  @ApiResponse({
    status: 201,
    description: 'Notificación creada',
    type: Notification,
  })
  @ApiResponse({
    status: 200,
    description: 'Notificación omitida por preferencias del usuario',
  })
  async create(
    @Body() dto: CreateNotificationDto,
  ): Promise<Notification | null> {
    return this.notificationsService.create(dto);
  }

  // ============================================
  // BROADCAST
  // ============================================

  @Post('broadcast')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: 'Enviar broadcast',
    description: 'Envía una notificación masiva a múltiples usuarios',
  })
  @ApiResponse({
    status: 202,
    description: 'Broadcast encolado',
  })
  async sendBroadcast(
    @Body() dto: SendBroadcastDto,
  ): Promise<{ queued: number; audience: string }> {
    return this.notificationsService.sendBroadcast(dto);
  }

  // ============================================
  // LISTAR
  // ============================================

  @Get('user/:userId')
  @ApiOperation({
    summary: 'Notificaciones de un usuario',
    description: 'Lista todas las notificaciones de un usuario específico',
  })
  @ApiParam({ name: 'userId', description: 'UUID del usuario' })
  @ApiResponse({
    status: 200,
    description: 'Lista de notificaciones',
  })
  async findByUser(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Query() query: NotificationQueryDto,
  ): Promise<{
    data: Notification[];
    unreadCount: number;
    pagination: { total: number; page: number; limit: number; totalPages: number };
  }> {
    return this.notificationsService.findByUser(userId, query);
  }

  // ============================================
  // LIMPIAR
  // ============================================

  @Post('clean-expired')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Limpiar expiradas',
    description: 'Elimina todas las notificaciones expiradas',
  })
  @ApiResponse({
    status: 200,
    description: 'Notificaciones eliminadas',
  })
  async cleanExpired(): Promise<{ deleted: number }> {
    const deleted = await this.notificationsService.cleanExpired();
    return { deleted };
  }

  // ============================================
  // EVENT CONFIGS
  // ============================================

  @Get('event-configs')
  @ApiOperation({
    summary: 'Listar configuraciones de eventos',
    description: 'Retorna todas las configuraciones de eventos de notificacion',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de configuraciones',
    type: [NotificationEventConfig],
  })
  async getEventConfigs(): Promise<NotificationEventConfig[]> {
    return this.notificationConfigService.findAll();
  }

  @Patch('event-configs/:id')
  @ApiOperation({
    summary: 'Actualizar configuracion de evento',
    description: 'Habilita o deshabilita un tipo de evento de notificacion',
  })
  @ApiParam({ name: 'id', description: 'UUID de la configuracion' })
  @ApiResponse({
    status: 200,
    description: 'Configuracion actualizada',
    type: NotificationEventConfig,
  })
  async updateEventConfig(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateEventConfigDto,
  ): Promise<NotificationEventConfig> {
    return this.notificationConfigService.update(id, dto);
  }
}
