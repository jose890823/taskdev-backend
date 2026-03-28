import { Test, TestingModule } from '@nestjs/testing';
import { NotificationCleanupService } from './notification-cleanup.service';
import { NotificationsService } from './notifications.service';

describe('NotificationCleanupService', () => {
  let service: NotificationCleanupService;
  let notificationsService: jest.Mocked<NotificationsService>;

  // ── Test module setup ──────────────────────────────────────

  beforeEach(async () => {
    const mockNotificationsService = {
      cleanExpired: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationCleanupService,
        {
          provide: NotificationsService,
          useValue: mockNotificationsService,
        },
      ],
    }).compile();

    service = module.get<NotificationCleanupService>(
      NotificationCleanupService,
    );
    notificationsService = module.get(NotificationsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ================================================================
  // HANDLE CLEANUP
  // ================================================================

  describe('handleCleanup', () => {
    it('should call cleanExpired on notifications service', async () => {
      notificationsService.cleanExpired.mockResolvedValue(10);

      await service.handleCleanup();

      expect(notificationsService.cleanExpired).toHaveBeenCalledTimes(1);
    });

    it('should handle zero deleted notifications', async () => {
      notificationsService.cleanExpired.mockResolvedValue(0);

      await expect(service.handleCleanup()).resolves.toBeUndefined();

      expect(notificationsService.cleanExpired).toHaveBeenCalledTimes(1);
    });

    it('should handle large number of expired notifications', async () => {
      notificationsService.cleanExpired.mockResolvedValue(5000);

      await expect(service.handleCleanup()).resolves.toBeUndefined();

      expect(notificationsService.cleanExpired).toHaveBeenCalledTimes(1);
    });

    it('should propagate errors from cleanExpired', async () => {
      notificationsService.cleanExpired.mockRejectedValue(
        new Error('Database connection lost'),
      );

      await expect(service.handleCleanup()).rejects.toThrow(
        'Database connection lost',
      );
    });
  });
});
