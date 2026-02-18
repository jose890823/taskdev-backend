import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { NotificationsService } from './notifications.service';
import {
  NotificationType,
  NotificationPriority,
} from '../entities/notification.entity';

/**
 * Servicio que escucha eventos del sistema y crea notificaciones automaticas.
 */
@Injectable()
export class NotificationEventsService {
  private readonly logger = new Logger(NotificationEventsService.name);

  constructor(private readonly notificationsService: NotificationsService) {}

  // ============================================
  // EVENTOS DE SEGURIDAD
  // ============================================

  @OnEvent('user.password.changed')
  async handlePasswordChanged(payload: { userId: string }): Promise<void> {
    this.logger.debug('Evento user.password.changed recibido');

    await this.notificationsService.create({
      userId: payload.userId,
      type: NotificationType.PASSWORD_CHANGED,
      title: 'Contrasena actualizada',
      message:
        'Tu contrasena ha sido cambiada exitosamente. Si no fuiste tu, contacta soporte inmediatamente.',
      priority: NotificationPriority.HIGH,
      actionUrl: `/support`,
      actionText: 'Contactar soporte',
    });
  }
}
