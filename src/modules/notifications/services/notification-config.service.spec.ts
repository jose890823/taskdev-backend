import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificationConfigService } from './notification-config.service';
import { NotificationEventConfig } from '../entities/notification-event-config.entity';

describe('NotificationConfigService', () => {
  let service: NotificationConfigService;
  let configRepository: jest.Mocked<Repository<NotificationEventConfig>>;

  // ── Mock data ──────────────────────────────────────────────

  const mockConfigId = '123e4567-e89b-12d3-a456-426614174000';

  const createMockConfig = (
    overrides: Partial<NotificationEventConfig> = {},
  ): NotificationEventConfig => {
    return {
      id: mockConfigId,
      eventType: 'task_assigned',
      label: 'Tarea asignada',
      description: 'Cuando un usuario es asignado a una tarea',
      isEnabled: true,
      category: 'tasks',
      createdAt: new Date('2026-01-01'),
      updatedAt: new Date('2026-01-01'),
      ...overrides,
    } as NotificationEventConfig;
  };

  // ── Test module setup ──────────────────────────────────────

  beforeEach(async () => {
    const mockQueryBuilder = {
      insert: jest.fn().mockReturnThis(),
      into: jest.fn().mockReturnThis(),
      values: jest.fn().mockReturnThis(),
      orIgnore: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue({ identifiers: [{ id: 'new-id' }] }),
    };

    const mockConfigRepository = {
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationConfigService,
        {
          provide: getRepositoryToken(NotificationEventConfig),
          useValue: mockConfigRepository,
        },
      ],
    }).compile();

    service = module.get<NotificationConfigService>(NotificationConfigService);
    configRepository = module.get(getRepositoryToken(NotificationEventConfig));
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ================================================================
  // ON APPLICATION BOOTSTRAP
  // ================================================================

  describe('onApplicationBootstrap', () => {
    it('should seed event configs and refresh cache', async () => {
      // refreshCache
      configRepository.find.mockResolvedValue([
        createMockConfig({ eventType: 'task_assigned', isEnabled: true }),
      ]);

      await service.onApplicationBootstrap();

      // createQueryBuilder called for each seed (11 seeds) via atomic upsert
      expect(configRepository.createQueryBuilder).toHaveBeenCalledTimes(11);
      // find called once for refreshCache
      expect(configRepository.find).toHaveBeenCalledTimes(1);
    });
  });

  // ================================================================
  // SEED EVENT CONFIGS
  // ================================================================

  describe('seedEventConfigs', () => {
    it('should use atomic upsert (ON CONFLICT DO NOTHING) for all seeds', async () => {
      await service.seedEventConfigs();

      // 11 seeds → 11 createQueryBuilder calls with insert + orIgnore
      expect(configRepository.createQueryBuilder).toHaveBeenCalledTimes(11);
    });

    it('should handle already-existing configs gracefully via orIgnore', async () => {
      // Simulate ON CONFLICT DO NOTHING — empty identifiers means row existed
      const mockQb = (configRepository.createQueryBuilder as jest.Mock)();
      mockQb.execute.mockResolvedValue({ identifiers: [] });

      await service.seedEventConfigs();

      // Should not throw — orIgnore handles duplicates
      expect(configRepository.createQueryBuilder).toHaveBeenCalled();
    });

    it('should handle mixed new and existing configs', async () => {
      let callCount = 0;
      const mockQb = (configRepository.createQueryBuilder as jest.Mock)();
      mockQb.execute.mockImplementation(async () => {
        callCount++;
        // First 5 return new IDs, rest return empty (already existed)
        return callCount <= 5
          ? { identifiers: [{ id: `new-${callCount}` }] }
          : { identifiers: [] };
      });

      await service.seedEventConfigs();

      expect(configRepository.createQueryBuilder).toHaveBeenCalled();
    });
  });

  // ================================================================
  // REFRESH CACHE
  // ================================================================

  describe('refreshCache', () => {
    it('should populate cache from database', async () => {
      configRepository.find.mockResolvedValue([
        createMockConfig({ eventType: 'task_assigned', isEnabled: true }),
        createMockConfig({ eventType: 'task_completed', isEnabled: false }),
      ]);

      await service.refreshCache();

      expect(service.isEventEnabled('task_assigned')).toBe(true);
      expect(service.isEventEnabled('task_completed')).toBe(false);
    });

    it('should clear previous cache before refreshing', async () => {
      // First refresh
      configRepository.find.mockResolvedValue([
        createMockConfig({ eventType: 'task_assigned', isEnabled: true }),
        createMockConfig({ eventType: 'old_event', isEnabled: true }),
      ]);
      await service.refreshCache();

      expect(service.isEventEnabled('old_event')).toBe(true);

      // Second refresh without old_event
      configRepository.find.mockResolvedValue([
        createMockConfig({ eventType: 'task_assigned', isEnabled: true }),
      ]);
      await service.refreshCache();

      // old_event should default to true (not in cache → ?? true)
      expect(service.isEventEnabled('old_event')).toBe(true);
    });
  });

  // ================================================================
  // IS EVENT ENABLED
  // ================================================================

  describe('isEventEnabled', () => {
    it('should return true for enabled events', async () => {
      configRepository.find.mockResolvedValue([
        createMockConfig({ eventType: 'task_assigned', isEnabled: true }),
      ]);
      await service.refreshCache();

      expect(service.isEventEnabled('task_assigned')).toBe(true);
    });

    it('should return false for disabled events', async () => {
      configRepository.find.mockResolvedValue([
        createMockConfig({ eventType: 'task_due_soon', isEnabled: false }),
      ]);
      await service.refreshCache();

      expect(service.isEventEnabled('task_due_soon')).toBe(false);
    });

    it('should return true for unknown events (default behavior)', () => {
      // Without refreshCache, cache is empty
      expect(service.isEventEnabled('non_existent_event')).toBe(true);
    });
  });

  // ================================================================
  // FIND ALL
  // ================================================================

  describe('findAll', () => {
    it('should return all configs ordered by category and eventType', async () => {
      const configs = [
        createMockConfig({
          eventType: 'org_member_added',
          category: 'organizations',
        }),
        createMockConfig({
          eventType: 'project_member_added',
          category: 'projects',
        }),
        createMockConfig({ eventType: 'task_assigned', category: 'tasks' }),
      ];
      configRepository.find.mockResolvedValue(configs);

      const result = await service.findAll();

      expect(result).toEqual(configs);
      expect(configRepository.find).toHaveBeenCalledWith({
        order: { category: 'ASC', eventType: 'ASC' },
      });
    });

    it('should return empty array when no configs exist', async () => {
      configRepository.find.mockResolvedValue([]);

      const result = await service.findAll();

      expect(result).toEqual([]);
    });
  });

  // ================================================================
  // UPDATE
  // ================================================================

  describe('update', () => {
    it('should enable an event config', async () => {
      const config = createMockConfig({ isEnabled: false });
      configRepository.findOne.mockResolvedValue(config);
      configRepository.save.mockResolvedValue({
        ...config,
        isEnabled: true,
      } as NotificationEventConfig);

      const result = await service.update(mockConfigId, { isEnabled: true });

      expect(result.isEnabled).toBe(true);
      expect(configRepository.save).toHaveBeenCalled();
    });

    it('should disable an event config', async () => {
      const config = createMockConfig({ isEnabled: true });
      configRepository.findOne.mockResolvedValue(config);
      configRepository.save.mockResolvedValue({
        ...config,
        isEnabled: false,
      } as NotificationEventConfig);

      const result = await service.update(mockConfigId, { isEnabled: false });

      expect(result.isEnabled).toBe(false);
    });

    it('should update the config cache after update', async () => {
      const config = createMockConfig({
        eventType: 'task_assigned',
        isEnabled: true,
      });
      configRepository.findOne.mockResolvedValue(config);
      configRepository.save.mockResolvedValue({
        ...config,
        isEnabled: false,
      } as NotificationEventConfig);

      // Populate cache first
      configRepository.find.mockResolvedValue([config]);
      await service.refreshCache();
      expect(service.isEventEnabled('task_assigned')).toBe(true);

      // Update to disabled
      await service.update(mockConfigId, { isEnabled: false });

      // Cache should reflect the new value
      expect(service.isEventEnabled('task_assigned')).toBe(false);
    });

    it('should throw Error when config not found', async () => {
      configRepository.findOne.mockResolvedValue(null);

      await expect(
        service.update('non-existent-id', { isEnabled: true }),
      ).rejects.toThrow('Configuracion de evento no encontrada');
    });
  });
});
