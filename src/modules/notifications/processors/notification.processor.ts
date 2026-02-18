import { Processor, Process, InjectQueue } from '@nestjs/bull';
import { Logger, Inject, Optional } from '@nestjs/common';
import type { Job, Queue } from 'bull';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Notification,
  NotificationType,
  NotificationChannel,
  NotificationPriority,
  NotificationStatus,
} from '../entities/notification.entity';
import { User } from '../../auth/entities/user.entity';

/**
 * Procesador de cola de notificaciones
 */
@Processor('notifications')
export class NotificationProcessor {
  private readonly logger = new Logger(NotificationProcessor.name);

  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepository: Repository<Notification>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectQueue('notifications')
    private readonly notificationQueue: Queue,
    @Optional() @Inject('EmailService') private readonly emailService?: any,
  ) {}

  /**
   * Procesa envío de email individual
   */
  @Process('send-email')
  async handleSendEmail(
    job: Job<{
      userId: string;
      type: NotificationType;
      title: string;
      message: string;
      actionUrl?: string;
      actionText?: string;
      referenceId?: string;
      referenceType?: string;
      metadata?: Record<string, any>;
    }>,
  ): Promise<void> {
    const { data } = job;
    this.logger.debug(`Procesando email para usuario ${data.userId}`);

    try {
      // Obtener usuario
      const user = await this.userRepository.findOne({
        where: { id: data.userId },
      });

      if (!user) {
        this.logger.warn(`Usuario ${data.userId} no encontrado`);
        return;
      }

      // Crear registro de notificación email
      const notification = this.notificationRepository.create({
        userId: data.userId,
        type: data.type,
        channel: NotificationChannel.EMAIL,
        priority: NotificationPriority.NORMAL,
        status: NotificationStatus.PENDING,
        title: data.title,
        message: data.message,
        actionUrl: data.actionUrl || null,
        actionText: data.actionText || null,
        referenceId: data.referenceId || null,
        referenceType: data.referenceType || null,
        metadata: data.metadata || null,
      });

      await this.notificationRepository.save(notification);

      // Enviar email si el servicio está disponible
      if (this.emailService) {
        try {
          await this.emailService.sendNotificationEmail({
            to: user.email,
            subject: data.title,
            content: data.message,
            actionUrl: data.actionUrl,
            actionText: data.actionText,
            userName: user.firstName,
          });

          notification.status = NotificationStatus.SENT;
          notification.sentAt = new Date();
          this.logger.log(`Email enviado a ${user.email}`);
        } catch (emailError) {
          notification.status = NotificationStatus.FAILED;
          notification.failureReason = emailError.message;
          notification.retryCount += 1;
          this.logger.error(`Error enviando email: ${emailError.message}`);
        }
      } else {
        // Si no hay servicio de email, marcar como enviado (simulado)
        notification.status = NotificationStatus.SENT;
        notification.sentAt = new Date();
        this.logger.warn(
          'EmailService no disponible, notificación marcada como enviada',
        );
      }

      await this.notificationRepository.save(notification);
    } catch (error) {
      this.logger.error(`Error procesando email: ${error.message}`);
      throw error;
    }
  }

  /**
   * Procesa broadcast masivo
   */
  @Process('broadcast')
  async handleBroadcast(
    job: Job<{
      userIds: string[];
      title: string;
      message: string;
      priority: NotificationPriority;
      actionUrl?: string;
      actionText?: string;
      sendEmail?: boolean;
    }>,
  ): Promise<void> {
    const { data } = job;
    this.logger.log(
      `Procesando broadcast para ${data.userIds.length} usuarios`,
    );

    let processed = 0;
    let failed = 0;

    for (const userId of data.userIds) {
      try {
        // Crear notificación in-app
        const notification = this.notificationRepository.create({
          userId,
          type: NotificationType.SYSTEM_ANNOUNCEMENT,
          channel: NotificationChannel.IN_APP,
          priority: data.priority,
          status: NotificationStatus.DELIVERED,
          title: data.title,
          message: data.message,
          actionUrl: data.actionUrl || null,
          actionText: data.actionText || null,
          icon: 'megaphone',
          sentAt: new Date(),
          deliveredAt: new Date(),
        });

        await this.notificationRepository.save(notification);
        processed++;

        // Encolar email si está habilitado
        if (data.sendEmail) {
          await this.notificationQueue.add('send-email', {
            userId,
            type: NotificationType.SYSTEM_ANNOUNCEMENT,
            title: data.title,
            message: data.message,
            actionUrl: data.actionUrl,
            actionText: data.actionText,
          });
        }
      } catch (error) {
        failed++;
        this.logger.error(
          `Error en broadcast para usuario ${userId}: ${error.message}`,
        );
      }
    }

    this.logger.log(
      `Broadcast completado: ${processed} exitosos, ${failed} fallidos`,
    );
  }

  /**
   * Agrega notificación al digest diario/semanal
   */
  @Process('add-to-digest')
  async handleAddToDigest(
    job: Job<{
      userId: string;
      notification: any;
    }>,
  ): Promise<void> {
    const { data } = job;
    this.logger.debug(
      `Agregando notificación al digest de usuario ${data.userId}`,
    );

    // Por ahora, simplemente guardamos la notificación con un flag de "pending digest"
    // El digest real se procesará con un cron job separado
    const notification = this.notificationRepository.create({
      userId: data.userId,
      type: data.notification.type,
      channel: NotificationChannel.EMAIL,
      priority: NotificationPriority.LOW,
      status: NotificationStatus.PENDING,
      title: data.notification.title,
      message: data.notification.message,
      actionUrl: data.notification.actionUrl || null,
      actionText: data.notification.actionText || null,
      referenceId: data.notification.referenceId || null,
      referenceType: data.notification.referenceType || null,
      metadata: {
        ...data.notification.metadata,
        isDigest: true,
      },
    });

    await this.notificationRepository.save(notification);
  }

  /**
   * Procesa envío de digest (llamado por cron)
   */
  @Process('send-digest')
  async handleSendDigest(
    job: Job<{
      userId: string;
      frequency: 'daily' | 'weekly';
    }>,
  ): Promise<void> {
    const { data } = job;
    this.logger.log(
      `Procesando digest ${data.frequency} para usuario ${data.userId}`,
    );

    // Obtener notificaciones pendientes de digest
    const pendingNotifications = await this.notificationRepository.find({
      where: {
        userId: data.userId,
        channel: NotificationChannel.EMAIL,
        status: NotificationStatus.PENDING,
      },
      order: { createdAt: 'DESC' },
    });

    if (pendingNotifications.length === 0) {
      this.logger.debug(
        `No hay notificaciones pendientes para digest de ${data.userId}`,
      );
      return;
    }

    // Obtener usuario
    const user = await this.userRepository.findOne({
      where: { id: data.userId },
    });

    if (!user) return;

    // Enviar digest email
    if (this.emailService) {
      try {
        await this.emailService.sendDigestEmail({
          to: user.email,
          userName: user.firstName,
          notifications: pendingNotifications.map((n) => ({
            title: n.title,
            message: n.message,
            createdAt: n.createdAt,
            actionUrl: n.actionUrl,
          })),
          frequency: data.frequency,
        });

        // Marcar notificaciones como enviadas
        for (const notification of pendingNotifications) {
          notification.status = NotificationStatus.SENT;
          notification.sentAt = new Date();
        }

        await this.notificationRepository.save(pendingNotifications);
        this.logger.log(
          `Digest enviado a ${user.email} con ${pendingNotifications.length} notificaciones`,
        );
      } catch (error) {
        this.logger.error(`Error enviando digest: ${error.message}`);
      }
    }
  }
}
