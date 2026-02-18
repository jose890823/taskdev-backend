import {
  Controller,
  Get,
  Post,
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
import { Notification } from '../entities/notification.entity';
import {
  CreateNotificationDto,
  NotificationQueryDto,
  SendBroadcastDto,
} from '../dto';

@ApiTags('Admin - Notifications')
@Controller('v1/admin/notifications')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN)
@ApiBearerAuth()
export class NotificationsAdminController {
  constructor(private readonly notificationsService: NotificationsService) {}

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
}
