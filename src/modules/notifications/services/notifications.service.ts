import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, LessThan, FindOptionsWhere } from 'typeorm';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';
import {
  Notification,
  NotificationType,
  NotificationChannel,
  NotificationPriority,
  NotificationStatus,
} from '../entities/notification.entity';
import { NotificationPreference } from '../entities/notification-preference.entity';
import {
  CreateNotificationDto,
  UpdatePreferencesDto,
  NotificationQueryDto,
  SendBroadcastDto,
  BroadcastAudience,
} from '../dto';
import { ErrorCodes } from '../../../common/dto';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepository: Repository<Notification>,
    @InjectRepository(NotificationPreference)
    private readonly preferenceRepository: Repository<NotificationPreference>,
    @InjectQueue('notifications')
    private readonly notificationQueue: Queue,
  ) {}

  // ============================================
  // CREAR NOTIFICACIÓN
  // ============================================

  /**
   * Crea una notificación
   * @returns La notificación creada o null si las preferencias la omiten
   */
  async create(dto: CreateNotificationDto): Promise<Notification | null> {
    // Verificar preferencias del usuario
    const preferences = await this.getOrCreatePreferences(dto.userId);

    // Verificar si el usuario acepta este tipo de notificación
    const shouldSend = this.shouldSendNotification(dto, preferences);
    if (!shouldSend.inApp && !shouldSend.email) {
      this.logger.debug(
        `Notificación omitida por preferencias del usuario ${dto.userId}`,
      );
      return null;
    }

    // Crear notificación in-app si está habilitada
    let notification: Notification | null = null;

    if (shouldSend.inApp) {
      notification = this.notificationRepository.create({
        userId: dto.userId,
        type: dto.type,
        channel: NotificationChannel.IN_APP,
        priority: dto.priority || NotificationPriority.NORMAL,
        status: NotificationStatus.DELIVERED,
        title: dto.title,
        message: dto.message,
        actionUrl: dto.actionUrl || null,
        actionText: dto.actionText || null,
        icon: dto.icon || this.getIconForType(dto.type),
        referenceId: dto.referenceId || null,
        referenceType: dto.referenceType || null,
        metadata: dto.metadata || null,
        sentAt: new Date(),
        deliveredAt: new Date(),
      });

      notification = await this.notificationRepository.save(notification);
      this.logger.log(`Notificación in-app creada: ${notification.id}`);
    }

    // Encolar email si está habilitado
    if (shouldSend.email) {
      await this.queueEmail(dto, preferences);
    }

    return notification;
  }

  /**
   * Crea múltiples notificaciones (para broadcast)
   */
  async createMany(
    userIds: string[],
    data: Omit<CreateNotificationDto, 'userId'>,
  ): Promise<number> {
    let created = 0;

    for (const userId of userIds) {
      const notification = await this.create({
        ...data,
        userId,
      });
      if (notification) created++;
    }

    return created;
  }

  // ============================================
  // CONSULTAS
  // ============================================

  /**
   * Obtener notificaciones de un usuario
   */
  async findByUser(
    userId: string,
    query: NotificationQueryDto,
  ): Promise<{
    data: Notification[];
    unreadCount: number;
    pagination: { total: number; page: number; limit: number; totalPages: number };
  }> {
    const { type, status, isRead, page = 1, limit = 20 } = query;

    const where: FindOptionsWhere<Notification> = { userId };

    if (type) where.type = type;
    if (status) where.status = status;
    if (isRead !== undefined) where.isRead = isRead;

    const [data, total] = await this.notificationRepository.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    const unreadCount = await this.notificationRepository.count({
      where: { userId, isRead: false },
    });

    return {
      data,
      unreadCount,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  /**
   * Obtener notificación por ID
   */
  async findById(id: string): Promise<Notification> {
    const notification = await this.notificationRepository.findOne({
      where: { id },
    });

    if (!notification) {
      throw new NotFoundException({
        code: ErrorCodes.NOTIFICATION_NOT_FOUND,
        message: 'La notificación no fue encontrada',
      });
    }

    return notification;
  }

  /**
   * Obtener conteo de no leídas
   */
  async getUnreadCount(userId: string): Promise<number> {
    return this.notificationRepository.count({
      where: { userId, isRead: false },
    });
  }

  // ============================================
  // MARCAR COMO LEÍDA
  // ============================================

  /**
   * Marcar notificación como leída
   */
  async markAsRead(id: string, userId: string): Promise<Notification> {
    const notification = await this.notificationRepository.findOne({
      where: { id, userId },
    });

    if (!notification) {
      throw new NotFoundException({
        code: ErrorCodes.NOTIFICATION_NOT_FOUND,
        message: 'La notificación no fue encontrada',
      });
    }

    notification.markAsRead();
    return this.notificationRepository.save(notification);
  }

  /**
   * Marcar todas como leídas
   */
  async markAllAsRead(userId: string): Promise<number> {
    const result = await this.notificationRepository.update(
      { userId, isRead: false },
      { isRead: true, readAt: new Date(), status: NotificationStatus.READ },
    );

    this.logger.log(
      `${result.affected} notificaciones marcadas como leídas para usuario ${userId}`,
    );
    return result.affected || 0;
  }

  /**
   * Marcar múltiples como leídas
   */
  async markManyAsRead(ids: string[], userId: string): Promise<number> {
    const result = await this.notificationRepository.update(
      { id: In(ids), userId, isRead: false },
      { isRead: true, readAt: new Date(), status: NotificationStatus.READ },
    );

    return result.affected || 0;
  }

  // ============================================
  // ELIMINAR
  // ============================================

  /**
   * Eliminar notificación
   */
  async delete(id: string, userId: string): Promise<void> {
    const result = await this.notificationRepository.delete({ id, userId });

    if (result.affected === 0) {
      throw new NotFoundException({
        code: ErrorCodes.NOTIFICATION_NOT_FOUND,
        message: 'La notificación no fue encontrada',
      });
    }
  }

  /**
   * Eliminar todas las leídas
   */
  async deleteAllRead(userId: string): Promise<number> {
    const result = await this.notificationRepository.delete({
      userId,
      isRead: true,
    });

    return result.affected || 0;
  }

  /**
   * Limpiar notificaciones expiradas
   */
  async cleanExpired(): Promise<number> {
    const result = await this.notificationRepository.delete({
      expiresAt: LessThan(new Date()),
    });

    this.logger.log(`${result.affected} notificaciones expiradas eliminadas`);
    return result.affected || 0;
  }

  // ============================================
  // PREFERENCIAS
  // ============================================

  /**
   * Obtener o crear preferencias
   */
  async getOrCreatePreferences(
    userId: string,
  ): Promise<NotificationPreference> {
    let preferences = await this.preferenceRepository.findOne({
      where: { userId },
    });

    if (!preferences) {
      preferences = this.preferenceRepository.create({ userId });
      preferences = await this.preferenceRepository.save(preferences);
      this.logger.log(
        `Preferencias de notificación creadas para usuario ${userId}`,
      );
    }

    return preferences;
  }

  /**
   * Actualizar preferencias
   */
  async updatePreferences(
    userId: string,
    dto: UpdatePreferencesDto,
  ): Promise<NotificationPreference> {
    const preferences = await this.getOrCreatePreferences(userId);

    Object.assign(preferences, dto);

    const updated = await this.preferenceRepository.save(preferences);
    this.logger.log(`Preferencias actualizadas para usuario ${userId}`);

    return updated;
  }

  // ============================================
  // BROADCAST (ADMIN)
  // ============================================

  /**
   * Enviar broadcast a múltiples usuarios
   */
  async sendBroadcast(dto: SendBroadcastDto): Promise<{
    queued: number;
    audience: string;
  }> {
    // Obtener lista de usuarios según audiencia
    const userIds = await this.getUsersForAudience(dto);

    // Encolar el broadcast
    await this.notificationQueue.add('broadcast', {
      userIds,
      title: dto.title,
      message: dto.message,
      priority: dto.priority || NotificationPriority.NORMAL,
      actionUrl: dto.actionUrl,
      actionText: dto.actionText,
      sendEmail: dto.sendEmail || false,
    });

    this.logger.log(`Broadcast encolado para ${userIds.length} usuarios`);

    return {
      queued: userIds.length,
      audience: dto.audience,
    };
  }

  // ============================================
  // MÉTODOS HELPER PRIVADOS
  // ============================================

  /**
   * Verifica si se debe enviar la notificación según preferencias
   */
  private shouldSendNotification(
    dto: CreateNotificationDto,
    preferences: NotificationPreference,
  ): { inApp: boolean; email: boolean } {
    const category = this.getCategoryForType(dto.type);

    // Verificar canales globales
    const inAppEnabled = preferences.inAppEnabled;
    const emailEnabled = preferences.emailEnabled;

    // Verificar preferencias por categoría
    const inAppCategory = this.getInAppPreference(preferences, category);
    const emailCategory = this.getEmailPreference(preferences, category);

    return {
      inApp: inAppEnabled && inAppCategory,
      email: emailEnabled && emailCategory,
    };
  }

  /**
   * Obtiene la categoría para un tipo de notificación
   */
  private getCategoryForType(type: NotificationType): string {
    const categoryMap: Record<string, string> = {
      enrollment_created: 'enrollments',
      enrollment_confirmed: 'enrollments',
      enrollment_expired: 'enrollments',
      enrollment_expiring_soon: 'enrollments',
      payment_received: 'payments',
      payment_failed: 'payments',
      payment_reminder: 'payments',
      refund_processed: 'payments',
      evaluation_available: 'evaluations',
      evaluation_graded: 'evaluations',
      evaluation_deadline: 'evaluations',
      certificate_issued: 'certificates',
      certificate_expiring: 'certificates',
      workshop_reminder: 'workshops',
      workshop_registration: 'workshops',
      workshop_cancelled: 'workshops',
      workshop_certificate: 'workshops',
      achievement_earned: 'progress',
      course_completed: 'progress',
      module_completed: 'progress',
      system_announcement: 'announcements',
      account_security: 'announcements',
      password_changed: 'announcements',
      referral_used: 'progress',
      referral_reward: 'progress',
      welcome: 'announcements',
      custom: 'announcements',
    };

    return categoryMap[type] || 'announcements';
  }

  /**
   * Obtiene preferencia in-app para una categoría
   */
  private getInAppPreference(
    prefs: NotificationPreference,
    category: string,
  ): boolean {
    const map: Record<string, boolean> = {
      enrollments: prefs.inAppEnrollments,
      payments: prefs.inAppPayments,
      evaluations: prefs.inAppEvaluations,
      certificates: prefs.inAppCertificates,
      workshops: prefs.inAppWorkshops,
      progress: prefs.inAppProgress,
      announcements: prefs.inAppAnnouncements,
    };
    return map[category] ?? true;
  }

  /**
   * Obtiene preferencia email para una categoría
   */
  private getEmailPreference(
    prefs: NotificationPreference,
    category: string,
  ): boolean {
    const map: Record<string, boolean> = {
      enrollments: prefs.emailEnrollments,
      payments: prefs.emailPayments,
      evaluations: prefs.emailEvaluations,
      certificates: prefs.emailCertificates,
      workshops: prefs.emailWorkshops,
      progress: prefs.emailProgress,
      announcements: prefs.emailAnnouncements,
    };
    return map[category] ?? true;
  }

  /**
   * Obtiene icono para tipo de notificación
   */
  private getIconForType(type: NotificationType): string {
    const iconMap: Record<string, string> = {
      enrollment_created: 'book-open',
      enrollment_confirmed: 'check-circle',
      enrollment_expired: 'clock',
      payment_received: 'credit-card',
      payment_failed: 'alert-circle',
      evaluation_available: 'clipboard-list',
      evaluation_graded: 'award',
      certificate_issued: 'award',
      workshop_reminder: 'calendar',
      workshop_registration: 'users',
      achievement_earned: 'trophy',
      course_completed: 'graduation-cap',
      system_announcement: 'megaphone',
      welcome: 'hand-wave',
    };

    return iconMap[type] || 'bell';
  }

  /**
   * Encola email para envío
   */
  private async queueEmail(
    dto: CreateNotificationDto,
    preferences: NotificationPreference,
  ): Promise<void> {
    // Si la frecuencia es instant, encolar inmediatamente
    if (preferences.emailFrequency === 'instant') {
      await this.notificationQueue.add('send-email', {
        userId: dto.userId,
        type: dto.type,
        title: dto.title,
        message: dto.message,
        actionUrl: dto.actionUrl,
        actionText: dto.actionText,
        referenceId: dto.referenceId,
        referenceType: dto.referenceType,
        metadata: dto.metadata,
      });
    } else {
      // Para digest, agregar a la cola de digest
      await this.notificationQueue.add('add-to-digest', {
        userId: dto.userId,
        notification: dto,
      });
    }
  }

  /**
   * Obtiene usuarios para una audiencia de broadcast
   */
  private async getUsersForAudience(dto: SendBroadcastDto): Promise<string[]> {
    switch (dto.audience) {
      case BroadcastAudience.SPECIFIC_USERS:
        return dto.userIds || [];

      case BroadcastAudience.ALL_USERS:
        // Esto se haría con una consulta a la BD
        // Por ahora retornamos vacío, se implementará con el User repository
        return [];

      case BroadcastAudience.ALL_OWNERS:
        // Todos los owners
        return [];

      case BroadcastAudience.ALL_EMPLOYEES:
        // Todos los empleados
        return [];

      case BroadcastAudience.BUSINESS_MEMBERS:
        // Miembros de un negocio específico
        return [];

      default:
        return [];
    }
  }
}
