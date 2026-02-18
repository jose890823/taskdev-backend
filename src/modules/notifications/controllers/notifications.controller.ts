import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
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
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { User } from '../../auth/entities/user.entity';
import { NotificationsService } from '../services/notifications.service';
import { Notification } from '../entities/notification.entity';
import { NotificationPreference } from '../entities/notification-preference.entity';
import { NotificationQueryDto, UpdatePreferencesDto } from '../dto';

@ApiTags('Notifications')
@Controller('v1/notifications')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  // ============================================
  // LISTAR NOTIFICACIONES
  // ============================================

  @Get()
  @ApiOperation({
    summary: 'Obtener mis notificaciones',
    description: 'Retorna las notificaciones del usuario autenticado',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de notificaciones',
  })
  async findAll(
    @CurrentUser() user: User,
    @Query() query: NotificationQueryDto,
  ): Promise<{
    data: Notification[];
    unreadCount: number;
    pagination: { total: number; page: number; limit: number; totalPages: number };
  }> {
    return this.notificationsService.findByUser(user.id, query);
  }

  @Get('unread-count')
  @ApiOperation({
    summary: 'Obtener conteo de no leídas',
    description: 'Retorna el número de notificaciones no leídas',
  })
  @ApiResponse({
    status: 200,
    description: 'Conteo de notificaciones no leídas',
  })
  async getUnreadCount(@CurrentUser() user: User): Promise<{ count: number }> {
    const count = await this.notificationsService.getUnreadCount(user.id);
    return { count };
  }

  // ============================================
  // DETALLE DE NOTIFICACIÓN
  // ============================================

  @Get(':id')
  @ApiOperation({
    summary: 'Obtener notificación',
    description: 'Retorna los detalles de una notificación',
  })
  @ApiParam({ name: 'id', description: 'UUID de la notificación' })
  @ApiResponse({
    status: 200,
    description: 'Notificación encontrada',
    type: Notification,
  })
  async findById(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<Notification> {
    return this.notificationsService.findById(id);
  }

  // ============================================
  // MARCAR COMO LEÍDA
  // ============================================

  @Post(':id/read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Marcar como leída',
    description: 'Marca una notificación como leída',
  })
  @ApiParam({ name: 'id', description: 'UUID de la notificación' })
  @ApiResponse({
    status: 200,
    description: 'Notificación marcada como leída',
    type: Notification,
  })
  async markAsRead(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ): Promise<Notification> {
    return this.notificationsService.markAsRead(id, user.id);
  }

  @Post('read-all')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Marcar todas como leídas',
    description: 'Marca todas las notificaciones como leídas',
  })
  @ApiResponse({
    status: 200,
    description: 'Notificaciones marcadas como leídas',
  })
  async markAllAsRead(@CurrentUser() user: User): Promise<{ marked: number }> {
    const marked = await this.notificationsService.markAllAsRead(user.id);
    return { marked };
  }

  @Post('read-many')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Marcar varias como leídas',
    description: 'Marca múltiples notificaciones como leídas',
  })
  @ApiResponse({
    status: 200,
    description: 'Notificaciones marcadas como leídas',
  })
  async markManyAsRead(
    @CurrentUser() user: User,
    @Body() body: { ids: string[] },
  ): Promise<{ marked: number }> {
    const marked = await this.notificationsService.markManyAsRead(
      body.ids,
      user.id,
    );
    return { marked };
  }

  // ============================================
  // ELIMINAR
  // ============================================

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Eliminar notificación',
    description: 'Elimina una notificación',
  })
  @ApiParam({ name: 'id', description: 'UUID de la notificación' })
  @ApiResponse({ status: 204, description: 'Notificación eliminada' })
  async delete(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ): Promise<void> {
    await this.notificationsService.delete(id, user.id);
  }

  @Delete('read/all')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Eliminar todas las leídas',
    description: 'Elimina todas las notificaciones leídas',
  })
  @ApiResponse({
    status: 200,
    description: 'Notificaciones eliminadas',
  })
  async deleteAllRead(@CurrentUser() user: User): Promise<{ deleted: number }> {
    const deleted = await this.notificationsService.deleteAllRead(user.id);
    return { deleted };
  }

  // ============================================
  // PREFERENCIAS
  // ============================================

  @Get('preferences/my')
  @ApiOperation({
    summary: 'Obtener mis preferencias',
    description: 'Retorna las preferencias de notificación del usuario',
  })
  @ApiResponse({
    status: 200,
    description: 'Preferencias de notificación',
    type: NotificationPreference,
  })
  async getPreferences(
    @CurrentUser() user: User,
  ): Promise<NotificationPreference> {
    return this.notificationsService.getOrCreatePreferences(user.id);
  }

  @Put('preferences/my')
  @ApiOperation({
    summary: 'Actualizar mis preferencias',
    description: 'Actualiza las preferencias de notificación del usuario',
  })
  @ApiResponse({
    status: 200,
    description: 'Preferencias actualizadas',
    type: NotificationPreference,
  })
  async updatePreferences(
    @CurrentUser() user: User,
    @Body() dto: UpdatePreferencesDto,
  ): Promise<NotificationPreference> {
    return this.notificationsService.updatePreferences(user.id, dto);
  }
}
