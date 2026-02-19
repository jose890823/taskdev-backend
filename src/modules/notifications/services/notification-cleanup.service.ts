import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { NotificationsService } from './notifications.service';

@Injectable()
export class NotificationCleanupService {
  private readonly logger = new Logger(NotificationCleanupService.name);

  constructor(private readonly notificationsService: NotificationsService) {}

  /**
   * Limpia notificaciones expiradas diariamente a las 3 AM
   */
  @Cron('0 3 * * *')
  async handleCleanup(): Promise<void> {
    this.logger.log('Iniciando limpieza de notificaciones expiradas...');
    const deleted = await this.notificationsService.cleanExpired();
    this.logger.log(`Limpieza completada: ${deleted} notificaciones eliminadas`);
  }
}
