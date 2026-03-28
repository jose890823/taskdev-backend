import { Test, TestingModule } from '@nestjs/testing';
import { NotificationEventsService } from './notification-events.service';
import { NotificationsService } from './notifications.service';
import { NotificationConfigService } from './notification-config.service';
import { NotificationsGateway } from '../gateways/notifications.gateway';
import {
  Notification,
  NotificationType,
  NotificationPriority,
  NotificationChannel,
  NotificationStatus,
} from '../entities/notification.entity';

describe('NotificationEventsService', () => {
  let service: NotificationEventsService;
  let notificationsService: jest.Mocked<NotificationsService>;
  let configService: jest.Mocked<NotificationConfigService>;
  let gateway: jest.Mocked<NotificationsGateway>;

  // ── Mock data ──────────────────────────────────────────────

  const mockUserId = '123e4567-e89b-12d3-a456-426614174000';
  const mockUserId2 = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
  const mockUserId3 = 'c3d4e5f6-a7b8-9012-cdef-123456789012';
  const mockTaskId = 'd4e5f6a7-b8c9-0123-def0-123456789abc';
  const mockProjectId = 'e5f6a7b8-c9d0-1234-ef01-23456789abcd';
  const mockOrgId = 'f6a7b8c9-d0e1-2345-f012-3456789abcde';

  const createMockNotification = (
    overrides: Partial<Notification> = {},
  ): Notification => {
    return {
      id: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
      systemCode: 'NTF-260206-A3K7',
      userId: mockUserId,
      type: NotificationType.TASK_ASSIGNED,
      channel: NotificationChannel.IN_APP,
      priority: NotificationPriority.NORMAL,
      status: NotificationStatus.DELIVERED,
      title: 'Tarea asignada',
      message: 'Test message',
      actionUrl: '/tasks/123',
      actionText: null,
      icon: 'user-plus',
      isRead: false,
      readAt: null,
      sentAt: new Date(),
      deliveredAt: new Date(),
      failureReason: null,
      retryCount: 0,
      referenceId: null,
      referenceType: null,
      metadata: null,
      expiresAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      markAsRead: jest.fn(),
      ...overrides,
    } as unknown as Notification;
  };

  // ── Test module setup ──────────────────────────────────────

  beforeEach(async () => {
    const mockNotificationsService = {
      create: jest.fn(),
      getUnreadCount: jest.fn().mockResolvedValue(1),
    };

    const mockConfigService = {
      isEventEnabled: jest.fn().mockReturnValue(true),
    };

    const mockGateway = {
      sendToUser: jest.fn(),
      sendUnreadCount: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationEventsService,
        {
          provide: NotificationsService,
          useValue: mockNotificationsService,
        },
        {
          provide: NotificationConfigService,
          useValue: mockConfigService,
        },
        {
          provide: NotificationsGateway,
          useValue: mockGateway,
        },
      ],
    }).compile();

    service = module.get<NotificationEventsService>(NotificationEventsService);
    notificationsService = module.get(NotificationsService);
    configService = module.get(NotificationConfigService);
    gateway = module.get(NotificationsGateway);
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ================================================================
  // TASK EVENTS
  // ================================================================

  describe('handleTaskAssigned', () => {
    const payload = {
      taskId: mockTaskId,
      taskTitle: 'Disenar landing page',
      taskPriority: 'high',
      assignedToId: mockUserId,
      assignedByName: 'Juan Perez',
    };

    it('should create notification and push via WebSocket', async () => {
      const mockNotification = createMockNotification();
      notificationsService.create.mockResolvedValue(mockNotification);

      await service.handleTaskAssigned(payload);

      expect(notificationsService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: mockUserId,
          type: NotificationType.TASK_ASSIGNED,
          title: 'Tarea asignada',
          actionUrl: `/tasks/${mockTaskId}`,
          referenceId: mockTaskId,
          referenceType: 'task',
        }),
      );

      expect(gateway.sendToUser).toHaveBeenCalledWith(
        mockUserId,
        mockNotification,
      );
      expect(gateway.sendUnreadCount).toHaveBeenCalledWith(mockUserId, 1);
    });

    it('should include priority label in message', async () => {
      const mockNotification = createMockNotification();
      notificationsService.create.mockResolvedValue(mockNotification);

      await service.handleTaskAssigned(payload);

      const createCall = notificationsService.create.mock.calls[0][0];
      expect(createCall.message).toContain('[Alta]');
      expect(createCall.message).toContain('Juan Perez');
      expect(createCall.message).toContain('Disenar landing page');
    });

    it('should omit priority tag when taskPriority is undefined', async () => {
      const mockNotification = createMockNotification();
      notificationsService.create.mockResolvedValue(mockNotification);

      await service.handleTaskAssigned({
        ...payload,
        taskPriority: undefined,
      });

      const createCall = notificationsService.create.mock.calls[0][0];
      expect(createCall.message).not.toContain('[');
    });

    it('should skip when event is disabled', async () => {
      configService.isEventEnabled.mockReturnValue(false);

      await service.handleTaskAssigned(payload);

      expect(notificationsService.create).not.toHaveBeenCalled();
      expect(gateway.sendToUser).not.toHaveBeenCalled();
    });

    it('should not push via WS when notification creation returns null', async () => {
      notificationsService.create.mockResolvedValue(null);

      await service.handleTaskAssigned(payload);

      expect(gateway.sendToUser).not.toHaveBeenCalled();
      expect(gateway.sendUnreadCount).not.toHaveBeenCalled();
    });
  });

  describe('handleTaskUnassigned', () => {
    const payload = {
      taskId: mockTaskId,
      taskTitle: 'Disenar landing page',
      taskPriority: 'medium',
      unassignedUserId: mockUserId,
      unassignedByName: 'Carlos Lopez',
    };

    it('should create unassignment notification', async () => {
      const mockNotification = createMockNotification();
      notificationsService.create.mockResolvedValue(mockNotification);

      await service.handleTaskUnassigned(payload);

      expect(notificationsService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: mockUserId,
          type: NotificationType.TASK_UNASSIGNED,
          title: 'Tarea desasignada',
          referenceId: mockTaskId,
          referenceType: 'task',
        }),
      );
    });

    it('should include priority label [Media] in message', async () => {
      const mockNotification = createMockNotification();
      notificationsService.create.mockResolvedValue(mockNotification);

      await service.handleTaskUnassigned(payload);

      const createCall = notificationsService.create.mock.calls[0][0];
      expect(createCall.message).toContain('[Media]');
      expect(createCall.message).toContain('Carlos Lopez');
    });

    it('should skip when event is disabled', async () => {
      configService.isEventEnabled.mockReturnValue(false);

      await service.handleTaskUnassigned(payload);

      expect(notificationsService.create).not.toHaveBeenCalled();
    });
  });

  describe('handleTaskStatusChanged', () => {
    const payload = {
      taskId: mockTaskId,
      taskTitle: 'Implementar auth',
      taskPriority: 'urgent',
      oldStatusName: 'Por hacer',
      newStatusName: 'En progreso',
      changedByName: 'Juan Perez',
      assigneeIds: [mockUserId, mockUserId2, mockUserId3],
      changedById: mockUserId3,
    };

    it('should notify all assignees EXCEPT the one who changed it', async () => {
      const mockNotification = createMockNotification();
      notificationsService.create.mockResolvedValue(mockNotification);

      await service.handleTaskStatusChanged(payload);

      // mockUserId3 is changedById, so only mockUserId and mockUserId2 get notified
      expect(notificationsService.create).toHaveBeenCalledTimes(2);

      const firstCall = notificationsService.create.mock.calls[0][0];
      expect(firstCall.userId).toBe(mockUserId);
      expect(firstCall.type).toBe(NotificationType.TASK_STATUS_CHANGED);
      expect(firstCall.message).toContain('de Por hacer a En progreso');
      expect(firstCall.message).toContain('[Urgente]');
    });

    it('should not notify anyone when only assignee is the changer', async () => {
      const mockNotification = createMockNotification();
      notificationsService.create.mockResolvedValue(mockNotification);

      await service.handleTaskStatusChanged({
        ...payload,
        assigneeIds: [mockUserId3],
      });

      expect(notificationsService.create).not.toHaveBeenCalled();
    });

    it('should skip when event is disabled', async () => {
      configService.isEventEnabled.mockReturnValue(false);

      await service.handleTaskStatusChanged(payload);

      expect(notificationsService.create).not.toHaveBeenCalled();
    });

    it('should handle empty assigneeIds gracefully', async () => {
      await service.handleTaskStatusChanged({
        ...payload,
        assigneeIds: [],
      });

      expect(notificationsService.create).not.toHaveBeenCalled();
    });
  });

  describe('handleTaskCompleted', () => {
    const payload = {
      taskId: mockTaskId,
      taskTitle: 'Corregir bug login',
      taskPriority: 'low',
      completedByName: 'Ana Garcia',
      assigneeIds: [mockUserId, mockUserId2],
      completedById: mockUserId2,
    };

    it('should notify assignees except the completer', async () => {
      const mockNotification = createMockNotification();
      notificationsService.create.mockResolvedValue(mockNotification);

      await service.handleTaskCompleted(payload);

      expect(notificationsService.create).toHaveBeenCalledTimes(1);

      const createCall = notificationsService.create.mock.calls[0][0];
      expect(createCall.userId).toBe(mockUserId);
      expect(createCall.type).toBe(NotificationType.TASK_COMPLETED);
      expect(createCall.message).toContain('Ana Garcia');
      expect(createCall.message).toContain('Corregir bug login');
      expect(createCall.message).toContain('[Baja]');
    });

    it('should skip when event is disabled', async () => {
      configService.isEventEnabled.mockReturnValue(false);

      await service.handleTaskCompleted(payload);

      expect(notificationsService.create).not.toHaveBeenCalled();
    });
  });

  describe('handleTaskCommented', () => {
    const payload = {
      taskId: mockTaskId,
      taskTitle: 'Review PR',
      taskPriority: undefined as string | undefined,
      commentByName: 'Pedro Martinez',
      commentById: mockUserId,
      assigneeIds: [mockUserId, mockUserId2, mockUserId3],
    };

    it('should notify all assignees except the commenter', async () => {
      const mockNotification = createMockNotification();
      notificationsService.create.mockResolvedValue(mockNotification);

      await service.handleTaskCommented(payload);

      expect(notificationsService.create).toHaveBeenCalledTimes(2);

      const firstCall = notificationsService.create.mock.calls[0][0];
      expect(firstCall.userId).toBe(mockUserId2);
      expect(firstCall.type).toBe(NotificationType.TASK_COMMENTED);
      expect(firstCall.message).toContain('Pedro Martinez');
      expect(firstCall.message).toContain('Review PR');
    });

    it('should not include priority tag when priority is undefined', async () => {
      const mockNotification = createMockNotification();
      notificationsService.create.mockResolvedValue(mockNotification);

      await service.handleTaskCommented(payload);

      const firstCall = notificationsService.create.mock.calls[0][0];
      expect(firstCall.message).not.toContain('[');
    });

    it('should skip when event is disabled', async () => {
      configService.isEventEnabled.mockReturnValue(false);

      await service.handleTaskCommented(payload);

      expect(notificationsService.create).not.toHaveBeenCalled();
    });
  });

  describe('handleSubtaskCreated', () => {
    const payload = {
      parentTaskId: mockTaskId,
      parentTaskTitle: 'Tarea principal',
      subtaskTitle: 'Subtarea nueva',
      taskPriority: 'high',
      createdByName: 'Maria Lopez',
      createdById: mockUserId,
      assigneeIds: [mockUserId, mockUserId2],
    };

    it('should notify assignees except creator', async () => {
      const mockNotification = createMockNotification();
      notificationsService.create.mockResolvedValue(mockNotification);

      await service.handleSubtaskCreated(payload);

      expect(notificationsService.create).toHaveBeenCalledTimes(1);

      const createCall = notificationsService.create.mock.calls[0][0];
      expect(createCall.userId).toBe(mockUserId2);
      expect(createCall.type).toBe(NotificationType.SUBTASK_CREATED);
      expect(createCall.message).toContain('Subtarea nueva');
      expect(createCall.message).toContain('Tarea principal');
      expect(createCall.message).toContain('[Alta]');
      expect(createCall.referenceId).toBe(mockTaskId);
    });

    it('should skip when event is disabled', async () => {
      configService.isEventEnabled.mockReturnValue(false);

      await service.handleSubtaskCreated(payload);

      expect(notificationsService.create).not.toHaveBeenCalled();
    });
  });

  // ================================================================
  // PROJECT EVENTS
  // ================================================================

  describe('handleProjectMemberAdded', () => {
    const payload = {
      projectId: mockProjectId,
      projectSlug: 'my-project',
      projectName: 'Mi Proyecto',
      addedUserId: mockUserId,
      addedByName: 'Admin User',
    };

    it('should create notification for added user', async () => {
      const mockNotification = createMockNotification();
      notificationsService.create.mockResolvedValue(mockNotification);

      await service.handleProjectMemberAdded(payload);

      expect(notificationsService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: mockUserId,
          type: NotificationType.PROJECT_MEMBER_ADDED,
          title: 'Agregado a proyecto',
          actionUrl: '/projects/my-project',
          referenceId: mockProjectId,
          referenceType: 'project',
        }),
      );
    });

    it('should use projectId in URL when slug is not provided', async () => {
      const mockNotification = createMockNotification();
      notificationsService.create.mockResolvedValue(mockNotification);

      await service.handleProjectMemberAdded({
        ...payload,
        projectSlug: undefined,
      });

      const createCall = notificationsService.create.mock.calls[0][0];
      expect(createCall.actionUrl).toBe(`/projects/${mockProjectId}`);
    });

    it('should skip when event is disabled', async () => {
      configService.isEventEnabled.mockReturnValue(false);

      await service.handleProjectMemberAdded(payload);

      expect(notificationsService.create).not.toHaveBeenCalled();
    });
  });

  describe('handleProjectMemberRemoved', () => {
    const payload = {
      projectId: mockProjectId,
      projectName: 'Mi Proyecto',
      removedUserId: mockUserId,
      removedByName: 'Admin User',
    };

    it('should create notification for removed user', async () => {
      const mockNotification = createMockNotification();
      notificationsService.create.mockResolvedValue(mockNotification);

      await service.handleProjectMemberRemoved(payload);

      expect(notificationsService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: mockUserId,
          type: NotificationType.PROJECT_MEMBER_REMOVED,
          title: 'Removido de proyecto',
          actionUrl: '/projects',
          referenceId: mockProjectId,
          referenceType: 'project',
        }),
      );
    });

    it('should include project name in message', async () => {
      const mockNotification = createMockNotification();
      notificationsService.create.mockResolvedValue(mockNotification);

      await service.handleProjectMemberRemoved(payload);

      const createCall = notificationsService.create.mock.calls[0][0];
      expect(createCall.message).toContain('Mi Proyecto');
      expect(createCall.message).toContain('Admin User');
    });

    it('should skip when event is disabled', async () => {
      configService.isEventEnabled.mockReturnValue(false);

      await service.handleProjectMemberRemoved(payload);

      expect(notificationsService.create).not.toHaveBeenCalled();
    });
  });

  // ================================================================
  // ORGANIZATION EVENTS
  // ================================================================

  describe('handleOrgMemberAdded', () => {
    const payload = {
      organizationId: mockOrgId,
      organizationName: 'Mi Organizacion',
      addedUserId: mockUserId,
    };

    it('should create notification for added member', async () => {
      const mockNotification = createMockNotification();
      notificationsService.create.mockResolvedValue(mockNotification);

      await service.handleOrgMemberAdded(payload);

      expect(notificationsService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: mockUserId,
          type: NotificationType.ORG_MEMBER_ADDED,
          title: 'Agregado a organizacion',
          actionUrl: `/organizations/${mockOrgId}`,
          referenceId: mockOrgId,
          referenceType: 'organization',
        }),
      );
    });

    it('should include organization name in message', async () => {
      const mockNotification = createMockNotification();
      notificationsService.create.mockResolvedValue(mockNotification);

      await service.handleOrgMemberAdded(payload);

      const createCall = notificationsService.create.mock.calls[0][0];
      expect(createCall.message).toContain('Mi Organizacion');
    });

    it('should skip when event is disabled', async () => {
      configService.isEventEnabled.mockReturnValue(false);

      await service.handleOrgMemberAdded(payload);

      expect(notificationsService.create).not.toHaveBeenCalled();
    });
  });

  describe('handleOrgInvitationReceived', () => {
    const payload = {
      organizationName: 'Mi Organizacion',
      invitedUserId: mockUserId,
      invitedByName: 'Admin User',
      token: 'invite-token-123',
    };

    it('should create notification with invitation link', async () => {
      const mockNotification = createMockNotification();
      notificationsService.create.mockResolvedValue(mockNotification);

      await service.handleOrgInvitationReceived(payload);

      expect(notificationsService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: mockUserId,
          type: NotificationType.ORG_INVITATION_RECEIVED,
          title: 'Invitacion recibida',
          actionUrl: '/invite/invite-token-123',
          referenceType: 'invitation',
        }),
      );
    });

    it('should include inviter name and org name in message', async () => {
      const mockNotification = createMockNotification();
      notificationsService.create.mockResolvedValue(mockNotification);

      await service.handleOrgInvitationReceived(payload);

      const createCall = notificationsService.create.mock.calls[0][0];
      expect(createCall.message).toContain('Admin User');
      expect(createCall.message).toContain('Mi Organizacion');
    });

    it('should skip when event is disabled', async () => {
      configService.isEventEnabled.mockReturnValue(false);

      await service.handleOrgInvitationReceived(payload);

      expect(notificationsService.create).not.toHaveBeenCalled();
    });
  });

  // ================================================================
  // SECURITY EVENTS
  // ================================================================

  describe('handlePasswordChanged', () => {
    const payload = {
      userId: mockUserId,
    };

    it('should create high priority notification', async () => {
      const mockNotification = createMockNotification();
      notificationsService.create.mockResolvedValue(mockNotification);

      await service.handlePasswordChanged(payload);

      expect(notificationsService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: mockUserId,
          type: NotificationType.PASSWORD_CHANGED,
          title: 'Contrasena actualizada',
          priority: NotificationPriority.HIGH,
          actionUrl: '/support',
        }),
      );
    });

    it('should include security warning in message', async () => {
      const mockNotification = createMockNotification();
      notificationsService.create.mockResolvedValue(mockNotification);

      await service.handlePasswordChanged(payload);

      const createCall = notificationsService.create.mock.calls[0][0];
      expect(createCall.message).toContain('contrasena');
      expect(createCall.message).toContain('soporte');
    });

    it('should skip when event is disabled', async () => {
      configService.isEventEnabled.mockReturnValue(false);

      await service.handlePasswordChanged(payload);

      expect(notificationsService.create).not.toHaveBeenCalled();
    });
  });

  // ================================================================
  // HELPER: createAndPush — integration via event handlers
  // ================================================================

  describe('createAndPush (via event handlers)', () => {
    it('should push via WebSocket and send unread count after successful create', async () => {
      const mockNotification = createMockNotification();
      notificationsService.create.mockResolvedValue(mockNotification);
      notificationsService.getUnreadCount.mockResolvedValue(5);

      await service.handleTaskAssigned({
        taskId: mockTaskId,
        taskTitle: 'Test',
        assignedToId: mockUserId,
        assignedByName: 'Test User',
      });

      expect(gateway.sendToUser).toHaveBeenCalledWith(
        mockUserId,
        mockNotification,
      );
      expect(gateway.sendUnreadCount).toHaveBeenCalledWith(mockUserId, 5);
    });

    it('should NOT push via WebSocket when create returns null', async () => {
      notificationsService.create.mockResolvedValue(null);

      await service.handleTaskAssigned({
        taskId: mockTaskId,
        taskTitle: 'Test',
        assignedToId: mockUserId,
        assignedByName: 'Test User',
      });

      expect(gateway.sendToUser).not.toHaveBeenCalled();
      expect(gateway.sendUnreadCount).not.toHaveBeenCalled();
    });
  });
});
