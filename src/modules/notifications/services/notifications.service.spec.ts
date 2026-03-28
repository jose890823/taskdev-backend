import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { getQueueToken } from '@nestjs/bull';
import { NotFoundException, NotImplementedException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { NotificationsService } from './notifications.service';
import {
  Notification,
  NotificationType,
  NotificationChannel,
  NotificationPriority,
  NotificationStatus,
} from '../entities/notification.entity';
import { NotificationPreference } from '../entities/notification-preference.entity';
import { User } from '../../auth/entities/user.entity';
import { CreateNotificationDto, BroadcastAudience } from '../dto';

describe('NotificationsService', () => {
  let service: NotificationsService;
  let notificationRepository: jest.Mocked<Repository<Notification>>;
  let preferenceRepository: jest.Mocked<Repository<NotificationPreference>>;
  let userRepository: jest.Mocked<Repository<User>>;
  let notificationQueue: Record<string, jest.Mock>;

  // ── Mock data ──────────────────────────────────────────────

  const mockUserId = '123e4567-e89b-12d3-a456-426614174000';
  const mockUserId2 = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
  const mockNotificationId = 'b2c3d4e5-f6a7-8901-bcde-f12345678901';

  const createMockPreference = (
    overrides: Partial<NotificationPreference> = {},
  ): NotificationPreference => {
    return {
      id: 'pref-0001-0001-0001-000000000001',
      userId: mockUserId,
      emailEnabled: true,
      inAppEnabled: true,
      pushEnabled: false,
      smsEnabled: false,
      inAppTasks: true,
      inAppProjects: true,
      inAppOrganizations: true,
      inAppAnnouncements: true,
      emailFrequency: 'instant' as const,
      digestTime: '09:00',
      timezone: 'America/New_York',
      quietHoursEnabled: false,
      quietHoursStart: '22:00',
      quietHoursEnd: '08:00',
      createdAt: new Date('2026-01-01'),
      updatedAt: new Date('2026-01-01'),
      ...overrides,
    } as NotificationPreference;
  };

  const createMockNotification = (
    overrides: Partial<Notification> = {},
  ): Notification => {
    const notification = {
      id: mockNotificationId,
      systemCode: 'NTF-260206-A3K7',
      userId: mockUserId,
      type: NotificationType.TASK_ASSIGNED,
      channel: NotificationChannel.IN_APP,
      priority: NotificationPriority.NORMAL,
      status: NotificationStatus.DELIVERED,
      title: 'Tarea asignada',
      message: 'Juan te asigno la tarea "Test"',
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
      createdAt: new Date('2026-01-01'),
      updatedAt: new Date('2026-01-01'),
      markAsRead: jest.fn(function (this: any) {
        this.isRead = true;
        this.readAt = new Date();
        this.status = NotificationStatus.READ;
      }),
      ...overrides,
    } as unknown as Notification;
    return notification;
  };

  // ── QueryBuilder helper ────────────────────────────────────

  const createMockQueryBuilder = (overrides: Record<string, any> = {}) => {
    const qb: Record<string, jest.Mock> = {
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
      ...overrides,
    };
    for (const key of Object.keys(qb)) {
      if (!overrides[key] && !['getMany'].includes(key)) {
        qb[key] = jest.fn().mockReturnValue(qb);
      }
    }
    if (overrides.getMany) qb.getMany = overrides.getMany;
    return qb;
  };

  // ── Test module setup ──────────────────────────────────────

  beforeEach(async () => {
    const mockNotificationRepository = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      findAndCount: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };

    const mockPreferenceRepository = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
    };

    const mockUserRepository = {
      createQueryBuilder: jest.fn(),
    };

    const mockQueue = {
      add: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        {
          provide: getRepositoryToken(Notification),
          useValue: mockNotificationRepository,
        },
        {
          provide: getRepositoryToken(NotificationPreference),
          useValue: mockPreferenceRepository,
        },
        {
          provide: getRepositoryToken(User),
          useValue: mockUserRepository,
        },
        {
          provide: getQueueToken('notifications'),
          useValue: mockQueue,
        },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
    notificationRepository = module.get(getRepositoryToken(Notification));
    preferenceRepository = module.get(getRepositoryToken(NotificationPreference));
    userRepository = module.get(getRepositoryToken(User));
    notificationQueue = module.get(getQueueToken('notifications'));
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ================================================================
  // CREATE NOTIFICATION
  // ================================================================

  describe('create', () => {
    const createDto: CreateNotificationDto = {
      userId: mockUserId,
      type: NotificationType.TASK_ASSIGNED,
      title: 'Tarea asignada',
      message: 'Juan te asigno la tarea "Test"',
      actionUrl: '/tasks/123',
    };

    it('should create an in-app notification when preferences allow', async () => {
      const mockPref = createMockPreference();
      const mockNotification = createMockNotification();

      preferenceRepository.findOne.mockResolvedValue(mockPref);
      notificationRepository.create.mockReturnValue(mockNotification);
      notificationRepository.save.mockResolvedValue(mockNotification);

      const result = await service.create(createDto);

      expect(result).toEqual(mockNotification);
      expect(notificationRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: mockUserId,
          type: NotificationType.TASK_ASSIGNED,
          channel: NotificationChannel.IN_APP,
          title: 'Tarea asignada',
          message: 'Juan te asigno la tarea "Test"',
          actionUrl: '/tasks/123',
        }),
      );
      expect(notificationRepository.save).toHaveBeenCalledWith(mockNotification);
    });

    it('should return null when user preferences disable all channels', async () => {
      const mockPref = createMockPreference({
        inAppEnabled: false,
        emailEnabled: false,
      });

      preferenceRepository.findOne.mockResolvedValue(mockPref);

      const result = await service.create(createDto);

      expect(result).toBeNull();
      expect(notificationRepository.create).not.toHaveBeenCalled();
    });

    it('should return null when user disables the category (tasks)', async () => {
      const mockPref = createMockPreference({ inAppTasks: false });

      preferenceRepository.findOne.mockResolvedValue(mockPref);

      const result = await service.create(createDto);

      // Email is always false from getEmailPreference, and inApp tasks disabled
      expect(result).toBeNull();
    });

    it('should create preferences if they do not exist', async () => {
      const newPref = createMockPreference();

      preferenceRepository.findOne.mockResolvedValue(null);
      preferenceRepository.create.mockReturnValue(newPref);
      preferenceRepository.save.mockResolvedValue(newPref);

      const mockNotification = createMockNotification();
      notificationRepository.create.mockReturnValue(mockNotification);
      notificationRepository.save.mockResolvedValue(mockNotification);

      const result = await service.create(createDto);

      expect(preferenceRepository.create).toHaveBeenCalledWith({
        userId: mockUserId,
      });
      expect(preferenceRepository.save).toHaveBeenCalled();
      expect(result).toEqual(mockNotification);
    });

    it('should use default icon when none provided', async () => {
      const dto: CreateNotificationDto = {
        ...createDto,
        icon: undefined,
      };

      const mockPref = createMockPreference();
      const mockNotification = createMockNotification();

      preferenceRepository.findOne.mockResolvedValue(mockPref);
      notificationRepository.create.mockReturnValue(mockNotification);
      notificationRepository.save.mockResolvedValue(mockNotification);

      await service.create(dto);

      expect(notificationRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          icon: 'user-plus', // icon for TASK_ASSIGNED
        }),
      );
    });

    it('should use provided priority or default to NORMAL', async () => {
      const dto: CreateNotificationDto = {
        ...createDto,
        priority: NotificationPriority.HIGH,
      };

      const mockPref = createMockPreference();
      const mockNotification = createMockNotification();

      preferenceRepository.findOne.mockResolvedValue(mockPref);
      notificationRepository.create.mockReturnValue(mockNotification);
      notificationRepository.save.mockResolvedValue(mockNotification);

      await service.create(dto);

      expect(notificationRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          priority: NotificationPriority.HIGH,
        }),
      );
    });

    it('should set expiresAt to 30 days from now', async () => {
      const mockPref = createMockPreference();
      const mockNotification = createMockNotification();

      preferenceRepository.findOne.mockResolvedValue(mockPref);
      notificationRepository.create.mockReturnValue(mockNotification);
      notificationRepository.save.mockResolvedValue(mockNotification);

      await service.create(createDto);

      const createCall = notificationRepository.create.mock.calls[0][0] as any;
      const expiresAt = createCall.expiresAt as Date;
      const now = new Date();
      const diffDays =
        (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
      expect(diffDays).toBeGreaterThan(29);
      expect(diffDays).toBeLessThanOrEqual(30);
    });

    it('should set optional fields to null when not provided', async () => {
      const dto: CreateNotificationDto = {
        userId: mockUserId,
        type: NotificationType.WELCOME,
        title: 'Bienvenido',
        message: 'Bienvenido a TaskHub',
      };

      const mockPref = createMockPreference();
      const mockNotification = createMockNotification();

      preferenceRepository.findOne.mockResolvedValue(mockPref);
      notificationRepository.create.mockReturnValue(mockNotification);
      notificationRepository.save.mockResolvedValue(mockNotification);

      await service.create(dto);

      expect(notificationRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          actionUrl: null,
          actionText: null,
          referenceId: null,
          referenceType: null,
          metadata: null,
        }),
      );
    });
  });

  // ================================================================
  // CREATE MANY
  // ================================================================

  describe('createMany', () => {
    it('should create notifications for multiple users', async () => {
      const mockPref = createMockPreference();
      const mockNotification = createMockNotification();

      preferenceRepository.findOne.mockResolvedValue(mockPref);
      notificationRepository.create.mockReturnValue(mockNotification);
      notificationRepository.save.mockResolvedValue(mockNotification);

      const result = await service.createMany(
        [mockUserId, mockUserId2],
        {
          type: NotificationType.SYSTEM_ANNOUNCEMENT,
          title: 'Anuncio',
          message: 'Mensaje global',
        },
      );

      expect(result).toBe(2);
    });

    it('should count only fulfilled results that returned a notification', async () => {
      const mockPref = createMockPreference({ inAppEnabled: false });

      preferenceRepository.findOne.mockResolvedValue(mockPref);

      const result = await service.createMany(
        [mockUserId, mockUserId2],
        {
          type: NotificationType.SYSTEM_ANNOUNCEMENT,
          title: 'Anuncio',
          message: 'Mensaje global',
        },
      );

      // Both should return null (preferences disabled), so created = 0
      expect(result).toBe(0);
    });

    it('should handle rejections gracefully and continue', async () => {
      const mockPref = createMockPreference();
      const mockNotification = createMockNotification();

      preferenceRepository.findOne
        .mockResolvedValueOnce(mockPref)
        .mockRejectedValueOnce(new Error('DB error'));

      notificationRepository.create.mockReturnValue(mockNotification);
      notificationRepository.save.mockResolvedValue(mockNotification);

      const result = await service.createMany(
        [mockUserId, mockUserId2],
        {
          type: NotificationType.SYSTEM_ANNOUNCEMENT,
          title: 'Anuncio',
          message: 'Test',
        },
      );

      expect(result).toBe(1);
    });

    it('should return 0 for empty user list', async () => {
      const result = await service.createMany([], {
        type: NotificationType.SYSTEM_ANNOUNCEMENT,
        title: 'Anuncio',
        message: 'Test',
      });

      expect(result).toBe(0);
    });
  });

  // ================================================================
  // FIND BY USER
  // ================================================================

  describe('findByUser', () => {
    it('should return paginated notifications with unread count', async () => {
      const mockNotification = createMockNotification();

      notificationRepository.findAndCount.mockResolvedValue([
        [mockNotification],
        1,
      ]);
      notificationRepository.count.mockResolvedValue(5);

      const result = await service.findByUser(mockUserId, {});

      expect(result.data).toEqual([mockNotification]);
      expect(result.unreadCount).toBe(5);
      expect(result.pagination).toEqual({
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
      });
    });

    it('should apply type filter', async () => {
      notificationRepository.findAndCount.mockResolvedValue([[], 0]);
      notificationRepository.count.mockResolvedValue(0);

      await service.findByUser(mockUserId, {
        type: NotificationType.TASK_ASSIGNED,
      });

      expect(notificationRepository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: mockUserId,
            type: NotificationType.TASK_ASSIGNED,
          }),
        }),
      );
    });

    it('should apply status filter', async () => {
      notificationRepository.findAndCount.mockResolvedValue([[], 0]);
      notificationRepository.count.mockResolvedValue(0);

      await service.findByUser(mockUserId, {
        status: NotificationStatus.READ,
      });

      expect(notificationRepository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: NotificationStatus.READ,
          }),
        }),
      );
    });

    it('should apply isRead filter', async () => {
      notificationRepository.findAndCount.mockResolvedValue([[], 0]);
      notificationRepository.count.mockResolvedValue(0);

      await service.findByUser(mockUserId, { isRead: false });

      expect(notificationRepository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            isRead: false,
          }),
        }),
      );
    });

    it('should handle pagination with custom page and limit', async () => {
      notificationRepository.findAndCount.mockResolvedValue([[], 50]);
      notificationRepository.count.mockResolvedValue(0);

      const result = await service.findByUser(mockUserId, {
        page: 3,
        limit: 10,
      });

      expect(notificationRepository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 20, // (3-1) * 10
          take: 10,
        }),
      );
      expect(result.pagination).toEqual({
        total: 50,
        page: 3,
        limit: 10,
        totalPages: 5,
      });
    });

    it('should order by createdAt DESC', async () => {
      notificationRepository.findAndCount.mockResolvedValue([[], 0]);
      notificationRepository.count.mockResolvedValue(0);

      await service.findByUser(mockUserId, {});

      expect(notificationRepository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          order: { createdAt: 'DESC' },
        }),
      );
    });
  });

  // ================================================================
  // FIND BY ID
  // ================================================================

  describe('findById', () => {
    it('should return notification when found', async () => {
      const mockNotification = createMockNotification();
      notificationRepository.findOne.mockResolvedValue(mockNotification);

      const result = await service.findById(mockNotificationId, mockUserId);

      expect(result).toEqual(mockNotification);
      expect(notificationRepository.findOne).toHaveBeenCalledWith({
        where: { id: mockNotificationId, userId: mockUserId },
      });
    });

    it('should throw NotFoundException when notification not found', async () => {
      notificationRepository.findOne.mockResolvedValue(null);

      await expect(
        service.findById('non-existent', mockUserId),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when notification belongs to different user (IDOR protection)', async () => {
      notificationRepository.findOne.mockResolvedValue(null);

      await expect(
        service.findById(mockNotificationId, 'different-user-id'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ================================================================
  // GET UNREAD COUNT
  // ================================================================

  describe('getUnreadCount', () => {
    it('should return count of unread notifications', async () => {
      notificationRepository.count.mockResolvedValue(7);

      const result = await service.getUnreadCount(mockUserId);

      expect(result).toBe(7);
      expect(notificationRepository.count).toHaveBeenCalledWith({
        where: { userId: mockUserId, isRead: false },
      });
    });

    it('should return 0 when no unread notifications', async () => {
      notificationRepository.count.mockResolvedValue(0);

      const result = await service.getUnreadCount(mockUserId);

      expect(result).toBe(0);
    });
  });

  // ================================================================
  // MARK AS READ
  // ================================================================

  describe('markAsRead', () => {
    it('should mark a notification as read', async () => {
      const mockNotification = createMockNotification({ isRead: false });
      notificationRepository.findOne.mockResolvedValue(mockNotification);
      notificationRepository.save.mockResolvedValue(mockNotification);

      const result = await service.markAsRead(mockNotificationId, mockUserId);

      expect(mockNotification.markAsRead).toHaveBeenCalled();
      expect(notificationRepository.save).toHaveBeenCalledWith(mockNotification);
      expect(result).toEqual(mockNotification);
    });

    it('should throw NotFoundException when notification not found', async () => {
      notificationRepository.findOne.mockResolvedValue(null);

      await expect(
        service.markAsRead('non-existent', mockUserId),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ================================================================
  // MARK ALL AS READ
  // ================================================================

  describe('markAllAsRead', () => {
    it('should mark all unread notifications as read', async () => {
      notificationRepository.update.mockResolvedValue({ affected: 5 } as any);

      const result = await service.markAllAsRead(mockUserId);

      expect(result).toBe(5);
      expect(notificationRepository.update).toHaveBeenCalledWith(
        { userId: mockUserId, isRead: false },
        expect.objectContaining({
          isRead: true,
          status: NotificationStatus.READ,
        }),
      );
    });

    it('should return 0 when no unread notifications exist', async () => {
      notificationRepository.update.mockResolvedValue({ affected: 0 } as any);

      const result = await service.markAllAsRead(mockUserId);

      expect(result).toBe(0);
    });
  });

  // ================================================================
  // MARK MANY AS READ
  // ================================================================

  describe('markManyAsRead', () => {
    it('should mark specified notifications as read', async () => {
      const ids = [mockNotificationId, 'c3d4e5f6-a7b8-9012-cdef-123456789012'];
      notificationRepository.update.mockResolvedValue({ affected: 2 } as any);

      const result = await service.markManyAsRead(ids, mockUserId);

      expect(result).toBe(2);
      expect(notificationRepository.update).toHaveBeenCalled();
    });

    it('should return 0 when none of the ids match', async () => {
      notificationRepository.update.mockResolvedValue({ affected: 0 } as any);

      const result = await service.markManyAsRead(
        ['non-existent-id'],
        mockUserId,
      );

      expect(result).toBe(0);
    });
  });

  // ================================================================
  // DELETE
  // ================================================================

  describe('delete', () => {
    it('should delete a notification', async () => {
      notificationRepository.delete.mockResolvedValue({ affected: 1 } as any);

      await expect(
        service.delete(mockNotificationId, mockUserId),
      ).resolves.toBeUndefined();

      expect(notificationRepository.delete).toHaveBeenCalledWith({
        id: mockNotificationId,
        userId: mockUserId,
      });
    });

    it('should throw NotFoundException when notification not found', async () => {
      notificationRepository.delete.mockResolvedValue({ affected: 0 } as any);

      await expect(
        service.delete('non-existent', mockUserId),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ================================================================
  // DELETE ALL READ
  // ================================================================

  describe('deleteAllRead', () => {
    it('should delete all read notifications for user', async () => {
      notificationRepository.delete.mockResolvedValue({ affected: 10 } as any);

      const result = await service.deleteAllRead(mockUserId);

      expect(result).toBe(10);
      expect(notificationRepository.delete).toHaveBeenCalledWith({
        userId: mockUserId,
        isRead: true,
      });
    });

    it('should return 0 when no read notifications exist', async () => {
      notificationRepository.delete.mockResolvedValue({ affected: 0 } as any);

      const result = await service.deleteAllRead(mockUserId);

      expect(result).toBe(0);
    });
  });

  // ================================================================
  // CLEAN EXPIRED
  // ================================================================

  describe('cleanExpired', () => {
    it('should delete expired notifications', async () => {
      notificationRepository.delete.mockResolvedValue({ affected: 3 } as any);

      const result = await service.cleanExpired();

      expect(result).toBe(3);
      expect(notificationRepository.delete).toHaveBeenCalledWith(
        expect.objectContaining({
          expiresAt: expect.anything(),
        }),
      );
    });

    it('should return 0 when no expired notifications', async () => {
      notificationRepository.delete.mockResolvedValue({ affected: 0 } as any);

      const result = await service.cleanExpired();

      expect(result).toBe(0);
    });
  });

  // ================================================================
  // PREFERENCES
  // ================================================================

  describe('getOrCreatePreferences', () => {
    it('should return existing preferences', async () => {
      const mockPref = createMockPreference();
      preferenceRepository.findOne.mockResolvedValue(mockPref);

      const result = await service.getOrCreatePreferences(mockUserId);

      expect(result).toEqual(mockPref);
      expect(preferenceRepository.create).not.toHaveBeenCalled();
    });

    it('should create new preferences when none exist', async () => {
      const newPref = createMockPreference();

      preferenceRepository.findOne.mockResolvedValue(null);
      preferenceRepository.create.mockReturnValue(newPref);
      preferenceRepository.save.mockResolvedValue(newPref);

      const result = await service.getOrCreatePreferences(mockUserId);

      expect(preferenceRepository.create).toHaveBeenCalledWith({
        userId: mockUserId,
      });
      expect(preferenceRepository.save).toHaveBeenCalledWith(newPref);
      expect(result).toEqual(newPref);
    });
  });

  describe('updatePreferences', () => {
    it('should update existing preferences', async () => {
      const mockPref = createMockPreference();
      const updatedPref = createMockPreference({ inAppTasks: false });

      preferenceRepository.findOne.mockResolvedValue(mockPref);
      preferenceRepository.save.mockResolvedValue(updatedPref);

      const result = await service.updatePreferences(mockUserId, {
        inAppTasks: false,
      });

      expect(preferenceRepository.save).toHaveBeenCalled();
      expect(result).toEqual(updatedPref);
    });

    it('should create preferences if they do not exist before updating', async () => {
      const newPref = createMockPreference();

      preferenceRepository.findOne.mockResolvedValue(null);
      preferenceRepository.create.mockReturnValue(newPref);
      preferenceRepository.save
        .mockResolvedValueOnce(newPref)     // from getOrCreatePreferences
        .mockResolvedValueOnce(newPref);    // from updatePreferences save

      await service.updatePreferences(mockUserId, { emailEnabled: false });

      expect(preferenceRepository.create).toHaveBeenCalledWith({
        userId: mockUserId,
      });
    });
  });

  // ================================================================
  // BROADCAST
  // ================================================================

  describe('sendBroadcast', () => {
    it('should queue broadcast for specific users', async () => {
      const dto = {
        title: 'Anuncio',
        message: 'Mantenimiento',
        audience: BroadcastAudience.SPECIFIC_USERS,
        userIds: [mockUserId, mockUserId2],
      };

      const result = await service.sendBroadcast(dto);

      expect(result.queued).toBe(2);
      expect(result.audience).toBe(BroadcastAudience.SPECIFIC_USERS);
      expect(notificationQueue.add).toHaveBeenCalledWith(
        'broadcast',
        expect.objectContaining({
          userIds: [mockUserId, mockUserId2],
          title: 'Anuncio',
          message: 'Mantenimiento',
        }),
      );
    });

    it('should return 0 for specific_users with empty userIds', async () => {
      const dto = {
        title: 'Anuncio',
        message: 'Test',
        audience: BroadcastAudience.SPECIFIC_USERS,
      };

      const result = await service.sendBroadcast(dto);

      expect(result.queued).toBe(0);
    });

    it('should query all active users for ALL_USERS audience', async () => {
      const mockQb = createMockQueryBuilder({
        getMany: jest.fn().mockResolvedValue([
          { id: mockUserId },
          { id: mockUserId2 },
        ]),
      });
      userRepository.createQueryBuilder.mockReturnValue(mockQb as any);

      const dto = {
        title: 'Anuncio global',
        message: 'Para todos',
        audience: BroadcastAudience.ALL_USERS,
      };

      const result = await service.sendBroadcast(dto);

      expect(result.queued).toBe(2);
      expect(userRepository.createQueryBuilder).toHaveBeenCalledWith('user');
    });

    it('should throw NotImplementedException for ORGANIZATION_MEMBERS audience', async () => {
      const dto = {
        title: 'Anuncio',
        message: 'Test',
        audience: BroadcastAudience.ORGANIZATION_MEMBERS,
      };

      await expect(service.sendBroadcast(dto)).rejects.toThrow(
        NotImplementedException,
      );
    });

    it('should use default priority NORMAL and sendEmail false when not provided', async () => {
      const dto = {
        title: 'Test',
        message: 'Test',
        audience: BroadcastAudience.SPECIFIC_USERS,
        userIds: [mockUserId],
      };

      await service.sendBroadcast(dto);

      expect(notificationQueue.add).toHaveBeenCalledWith(
        'broadcast',
        expect.objectContaining({
          priority: NotificationPriority.NORMAL,
          sendEmail: false,
        }),
      );
    });

    it('should return empty array for unknown audience', async () => {
      const dto = {
        title: 'Test',
        message: 'Test',
        audience: 'unknown_audience' as BroadcastAudience,
      };

      const result = await service.sendBroadcast(dto);

      expect(result.queued).toBe(0);
    });
  });
});
