import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  ForbiddenException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { CombinedAuthGuard } from '../../api-keys/guards';
import { ApiKeyProjectParam, ApiKeyScopes } from '../../api-keys/decorators';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { User } from '../../auth/entities/user.entity';
import type { ApiKeyRequest } from '../../api-keys/api-key.types';
import { NotificationsService } from '../services/notifications.service';
import { Notification } from '../entities/notification.entity';
import { NotificationPreference } from '../entities/notification-preference.entity';
import {
  NotificationQueryDto,
  UpdatePreferencesDto,
  MarkManyAsReadDto,
} from '../dto';

@ApiTags('Notifications')
@Controller('v1/notifications')
@UseGuards(CombinedAuthGuard)
@ApiBearerAuth()
@ApiKeyProjectParam('projectId')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  // ============================================
  // LISTAR NOTIFICACIONES
  // ============================================

  @Get()
  @ApiKeyScopes('notifications:read')
  @ApiQuery({
    name: 'projectId',
    required: false,
    description: 'Proyecto vinculado a la API key (obligatorio para API keys)',
  })
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
    @Req() request: ApiKeyRequest,
  ): Promise<{
    data: Notification[];
    unreadCount: number;
    pagination: {
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    };
  }> {
    return this.notificationsService.findByUser(user.id, {
      ...query,
      projectId: this.getProjectId(request, query.projectId),
    });
  }

  @Get('unread-count')
  @ApiKeyScopes('notifications:read')
  @ApiQuery({ name: 'projectId', required: false })
  @ApiOperation({
    summary: 'Obtener conteo de no leídas',
    description: 'Retorna el número de notificaciones no leídas',
  })
  @ApiResponse({
    status: 200,
    description: 'Conteo de notificaciones no leídas',
  })
  async getUnreadCount(
    @CurrentUser() user: User,
    @Req() request: ApiKeyRequest,
  ): Promise<{ count: number }> {
    const count = await this.notificationsService.getUnreadCount(
      user.id,
      this.getProjectId(request),
    );
    return { count };
  }

  // ============================================
  // DETALLE DE NOTIFICACIÓN
  // ============================================

  @Get(':id')
  @ApiKeyScopes('notifications:read')
  @ApiQuery({ name: 'projectId', required: false })
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
    @CurrentUser() user: User,
    @Req() request: ApiKeyRequest,
  ): Promise<Notification> {
    return this.notificationsService.findById(
      id,
      user.id,
      this.getProjectId(request),
    );
  }

  // ============================================
  // MARCAR COMO LEÍDA
  // ============================================

  @Post(':id/read')
  @ApiKeyScopes('notifications:write')
  @ApiQuery({ name: 'projectId', required: false })
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
    @Req() request: ApiKeyRequest,
  ): Promise<Notification> {
    return this.notificationsService.markAsRead(
      id,
      user.id,
      this.getProjectId(request),
    );
  }

  @Post('read-all')
  @ApiKeyScopes('notifications:write')
  @ApiQuery({ name: 'projectId', required: false })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Marcar todas como leídas',
    description: 'Marca todas las notificaciones como leídas',
  })
  @ApiResponse({
    status: 200,
    description: 'Notificaciones marcadas como leídas',
  })
  async markAllAsRead(
    @CurrentUser() user: User,
    @Req() request: ApiKeyRequest,
  ): Promise<{ marked: number }> {
    const marked = await this.notificationsService.markAllAsRead(
      user.id,
      this.getProjectId(request),
    );
    return { marked };
  }

  @Post('read-many')
  @ApiKeyScopes('notifications:write')
  @ApiQuery({ name: 'projectId', required: false })
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
    @Body() dto: MarkManyAsReadDto,
    @Req() request: ApiKeyRequest,
  ): Promise<{ marked: number }> {
    const marked = await this.notificationsService.markManyAsRead(
      dto.ids,
      user.id,
      this.getProjectId(request),
    );
    return { marked };
  }

  // ============================================
  // ELIMINAR
  // ============================================

  @Delete(':id')
  @ApiKeyScopes('notifications:write')
  @ApiQuery({ name: 'projectId', required: false })
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
    @Req() request: ApiKeyRequest,
  ): Promise<void> {
    await this.notificationsService.delete(
      id,
      user.id,
      this.getProjectId(request),
    );
  }

  @Delete('read/all')
  @ApiKeyScopes('notifications:write')
  @ApiQuery({ name: 'projectId', required: false })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Eliminar todas las leídas',
    description: 'Elimina todas las notificaciones leídas',
  })
  @ApiResponse({
    status: 200,
    description: 'Notificaciones eliminadas',
  })
  async deleteAllRead(
    @CurrentUser() user: User,
    @Req() request: ApiKeyRequest,
  ): Promise<{ deleted: number }> {
    const deleted = await this.notificationsService.deleteAllRead(
      user.id,
      this.getProjectId(request),
    );
    return { deleted };
  }

  // ============================================
  // PREFERENCIAS
  // ============================================

  @Get('preferences/my')
  @ApiKeyScopes('notifications:read')
  @ApiQuery({ name: 'projectId', required: false })
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
    @Req() request: ApiKeyRequest,
  ): Promise<NotificationPreference> {
    this.assertUserGlobalPreferencesAccess(request);
    return this.notificationsService.getOrCreatePreferences(user.id);
  }

  @Put('preferences/my')
  @ApiKeyScopes('notifications:write')
  @ApiQuery({ name: 'projectId', required: false })
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
    @Req() request: ApiKeyRequest,
  ): Promise<NotificationPreference> {
    this.assertUserGlobalPreferencesAccess(request);
    return this.notificationsService.updatePreferences(user.id, dto);
  }

  private assertUserGlobalPreferencesAccess(request: ApiKeyRequest): void {
    if (request.identity?.authType !== 'api-key') return;

    throw new ForbiddenException({
      code: 'PROJECT_ACCESS_DENIED',
      message:
        'Las preferencias globales del usuario no están disponibles para API keys vinculadas a proyectos',
    });
  }

  private getProjectId(
    request: ApiKeyRequest,
    jwtProjectId?: string,
  ): string | undefined {
    if (request.identity?.authType !== 'api-key') return jwtProjectId;

    const projectId = request.identity.projectId;
    if (!projectId) {
      throw new ForbiddenException({
        code: 'PROJECT_ACCESS_DENIED',
        message: 'Acceso al proyecto denegado',
      });
    }
    return projectId;
  }
}
