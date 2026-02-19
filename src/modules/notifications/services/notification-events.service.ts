import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { NotificationsService } from './notifications.service';
import { NotificationConfigService } from './notification-config.service';
import { NotificationsGateway } from '../gateways/notifications.gateway';
import {
  NotificationType,
  NotificationPriority,
} from '../entities/notification.entity';

/**
 * Servicio que escucha eventos del sistema y crea notificaciones automaticas.
 * Verifica config admin antes de crear. Pushea via WebSocket.
 */
@Injectable()
export class NotificationEventsService {
  private readonly logger = new Logger(NotificationEventsService.name);

  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly configService: NotificationConfigService,
    private readonly gateway: NotificationsGateway,
  ) {}

  /**
   * Helper: mapear prioridad de tarea a etiqueta en espanol
   */
  private getPriorityLabel(priority?: string): string {
    const labels: Record<string, string> = {
      low: 'Baja',
      medium: 'Media',
      high: 'Alta',
      urgent: 'Urgente',
    };
    return priority ? labels[priority] || priority : '';
  }

  /**
   * Helper: verificar config → crear notificacion → push via WS
   */
  private async createAndPush(params: {
    eventType: string;
    userId: string;
    type: NotificationType;
    title: string;
    message: string;
    actionUrl?: string;
    referenceId?: string;
    referenceType?: string;
    priority?: NotificationPriority;
  }): Promise<void> {
    // Verificar si el evento esta habilitado por admin
    if (!this.configService.isEventEnabled(params.eventType)) {
      this.logger.debug(`Evento ${params.eventType} deshabilitado, omitiendo`);
      return;
    }

    const notification = await this.notificationsService.create({
      userId: params.userId,
      type: params.type,
      title: params.title,
      message: params.message,
      actionUrl: params.actionUrl,
      referenceId: params.referenceId,
      referenceType: params.referenceType,
      priority: params.priority,
    });

    if (notification) {
      // Push via WebSocket
      this.gateway.sendToUser(params.userId, notification);

      // Actualizar unread count
      const count = await this.notificationsService.getUnreadCount(params.userId);
      this.gateway.sendUnreadCount(params.userId, count);
    }
  }

  // ============================================
  // EVENTOS DE TAREAS
  // ============================================

  @OnEvent('task.assigned')
  async handleTaskAssigned(payload: {
    taskId: string;
    taskTitle: string;
    taskPriority?: string;
    assignedToId: string;
    assignedByName: string;
  }): Promise<void> {
    this.logger.debug(`Evento task.assigned: ${payload.taskTitle}`);

    const priorityTag = this.getPriorityLabel(payload.taskPriority);
    const msg = priorityTag
      ? `${payload.assignedByName} te asigno la tarea "${payload.taskTitle}" [${priorityTag}]`
      : `${payload.assignedByName} te asigno la tarea "${payload.taskTitle}"`;

    await this.createAndPush({
      eventType: 'task_assigned',
      userId: payload.assignedToId,
      type: NotificationType.TASK_ASSIGNED,
      title: 'Tarea asignada',
      message: msg,
      actionUrl: `/tasks/${payload.taskId}`,
      referenceId: payload.taskId,
      referenceType: 'task',
    });
  }

  @OnEvent('task.unassigned')
  async handleTaskUnassigned(payload: {
    taskId: string;
    taskTitle: string;
    taskPriority?: string;
    unassignedUserId: string;
    unassignedByName: string;
  }): Promise<void> {
    this.logger.debug(`Evento task.unassigned: ${payload.taskTitle}`);

    const priorityTag = this.getPriorityLabel(payload.taskPriority);
    const msg = priorityTag
      ? `${payload.unassignedByName} te removio de la tarea "${payload.taskTitle}" [${priorityTag}]`
      : `${payload.unassignedByName} te removio de la tarea "${payload.taskTitle}"`;

    await this.createAndPush({
      eventType: 'task_unassigned',
      userId: payload.unassignedUserId,
      type: NotificationType.TASK_UNASSIGNED,
      title: 'Tarea desasignada',
      message: msg,
      actionUrl: `/tasks/${payload.taskId}`,
      referenceId: payload.taskId,
      referenceType: 'task',
    });
  }

  @OnEvent('task.status_changed')
  async handleTaskStatusChanged(payload: {
    taskId: string;
    taskTitle: string;
    taskPriority?: string;
    oldStatusName: string;
    newStatusName: string;
    changedByName: string;
    assigneeIds: string[];
    changedById: string;
  }): Promise<void> {
    this.logger.debug(`Evento task.status_changed: ${payload.taskTitle}`);

    const priorityTag = this.getPriorityLabel(payload.taskPriority);
    const titleSuffix = priorityTag ? ` [${priorityTag}]` : '';

    for (const userId of payload.assigneeIds) {
      // No notificar al actor
      if (userId === payload.changedById) continue;

      await this.createAndPush({
        eventType: 'task_status_changed',
        userId,
        type: NotificationType.TASK_STATUS_CHANGED,
        title: 'Estado de tarea cambiado',
        message: `${payload.changedByName} cambio "${payload.taskTitle}"${titleSuffix} de ${payload.oldStatusName} a ${payload.newStatusName}`,
        actionUrl: `/tasks/${payload.taskId}`,
        referenceId: payload.taskId,
        referenceType: 'task',
      });
    }
  }

  @OnEvent('task.completed')
  async handleTaskCompleted(payload: {
    taskId: string;
    taskTitle: string;
    taskPriority?: string;
    completedByName: string;
    assigneeIds: string[];
    completedById: string;
  }): Promise<void> {
    this.logger.debug(`Evento task.completed: ${payload.taskTitle}`);

    const priorityTag = this.getPriorityLabel(payload.taskPriority);
    const titleSuffix = priorityTag ? ` [${priorityTag}]` : '';

    for (const userId of payload.assigneeIds) {
      if (userId === payload.completedById) continue;

      await this.createAndPush({
        eventType: 'task_completed',
        userId,
        type: NotificationType.TASK_COMPLETED,
        title: 'Tarea completada',
        message: `${payload.completedByName} completo la tarea "${payload.taskTitle}"${titleSuffix}`,
        actionUrl: `/tasks/${payload.taskId}`,
        referenceId: payload.taskId,
        referenceType: 'task',
      });
    }
  }

  @OnEvent('task.commented')
  async handleTaskCommented(payload: {
    taskId: string;
    taskTitle: string;
    taskPriority?: string;
    commentByName: string;
    commentById: string;
    assigneeIds: string[];
  }): Promise<void> {
    this.logger.debug(`Evento task.commented: ${payload.taskTitle}`);

    const priorityTag = this.getPriorityLabel(payload.taskPriority);
    const titleSuffix = priorityTag ? ` [${priorityTag}]` : '';

    for (const userId of payload.assigneeIds) {
      // No notificar al que comento
      if (userId === payload.commentById) continue;

      await this.createAndPush({
        eventType: 'task_commented',
        userId,
        type: NotificationType.TASK_COMMENTED,
        title: 'Comentario en tarea',
        message: `${payload.commentByName} comento en "${payload.taskTitle}"${titleSuffix}`,
        actionUrl: `/tasks/${payload.taskId}`,
        referenceId: payload.taskId,
        referenceType: 'task',
      });
    }
  }

  @OnEvent('subtask.created')
  async handleSubtaskCreated(payload: {
    parentTaskId: string;
    parentTaskTitle: string;
    subtaskTitle: string;
    taskPriority?: string;
    createdByName: string;
    createdById: string;
    assigneeIds: string[];
  }): Promise<void> {
    this.logger.debug(`Evento subtask.created: ${payload.subtaskTitle}`);

    const priorityTag = this.getPriorityLabel(payload.taskPriority);
    const titleSuffix = priorityTag ? ` [${priorityTag}]` : '';

    for (const userId of payload.assigneeIds) {
      if (userId === payload.createdById) continue;

      await this.createAndPush({
        eventType: 'subtask_created',
        userId,
        type: NotificationType.SUBTASK_CREATED,
        title: 'Subtarea creada',
        message: `${payload.createdByName} creo la subtarea "${payload.subtaskTitle}"${titleSuffix} en "${payload.parentTaskTitle}"`,
        actionUrl: `/tasks/${payload.parentTaskId}`,
        referenceId: payload.parentTaskId,
        referenceType: 'task',
      });
    }
  }

  // ============================================
  // EVENTOS DE PROYECTOS
  // ============================================

  @OnEvent('project.member_added')
  async handleProjectMemberAdded(payload: {
    projectId: string;
    projectSlug?: string;
    projectName: string;
    addedUserId: string;
    addedByName: string;
  }): Promise<void> {
    this.logger.debug(`Evento project.member_added: ${payload.projectName}`);

    await this.createAndPush({
      eventType: 'project_member_added',
      userId: payload.addedUserId,
      type: NotificationType.PROJECT_MEMBER_ADDED,
      title: 'Agregado a proyecto',
      message: `${payload.addedByName} te agrego al proyecto "${payload.projectName}"`,
      actionUrl: `/projects/${payload.projectSlug || payload.projectId}`,
      referenceId: payload.projectId,
      referenceType: 'project',
    });
  }

  @OnEvent('project.member_removed')
  async handleProjectMemberRemoved(payload: {
    projectId: string;
    projectName: string;
    removedUserId: string;
    removedByName: string;
  }): Promise<void> {
    this.logger.debug(`Evento project.member_removed: ${payload.projectName}`);

    await this.createAndPush({
      eventType: 'project_member_removed',
      userId: payload.removedUserId,
      type: NotificationType.PROJECT_MEMBER_REMOVED,
      title: 'Removido de proyecto',
      message: `${payload.removedByName} te removio del proyecto "${payload.projectName}"`,
      actionUrl: `/projects`,
      referenceId: payload.projectId,
      referenceType: 'project',
    });
  }

  // ============================================
  // EVENTOS DE ORGANIZACIONES
  // ============================================

  @OnEvent('org.member_added')
  async handleOrgMemberAdded(payload: {
    organizationId: string;
    organizationName: string;
    addedUserId: string;
  }): Promise<void> {
    this.logger.debug(`Evento org.member_added: ${payload.organizationName}`);

    await this.createAndPush({
      eventType: 'org_member_added',
      userId: payload.addedUserId,
      type: NotificationType.ORG_MEMBER_ADDED,
      title: 'Agregado a organizacion',
      message: `Te agregaron a la organizacion "${payload.organizationName}"`,
      actionUrl: `/organizations/${payload.organizationId}`,
      referenceId: payload.organizationId,
      referenceType: 'organization',
    });
  }

  @OnEvent('org.invitation_received')
  async handleOrgInvitationReceived(payload: {
    organizationName: string;
    invitedUserId: string;
    invitedByName: string;
    token: string;
  }): Promise<void> {
    this.logger.debug(`Evento org.invitation_received: ${payload.organizationName}`);

    await this.createAndPush({
      eventType: 'org_invitation_received',
      userId: payload.invitedUserId,
      type: NotificationType.ORG_INVITATION_RECEIVED,
      title: 'Invitacion recibida',
      message: `${payload.invitedByName} te invito a la organizacion "${payload.organizationName}"`,
      actionUrl: `/invite/${payload.token}`,
      referenceType: 'invitation',
    });
  }

  // ============================================
  // EVENTOS DE SEGURIDAD
  // ============================================

  @OnEvent('user.password.changed')
  async handlePasswordChanged(payload: { userId: string }): Promise<void> {
    this.logger.debug('Evento user.password.changed recibido');

    await this.createAndPush({
      eventType: 'password_changed',
      userId: payload.userId,
      type: NotificationType.PASSWORD_CHANGED,
      title: 'Contrasena actualizada',
      message: 'Tu contrasena ha sido cambiada exitosamente. Si no fuiste tu, contacta soporte.',
      priority: NotificationPriority.HIGH,
      actionUrl: '/support',
    });
  }
}
