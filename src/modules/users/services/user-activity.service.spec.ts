import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserActivityService } from './user-activity.service';
import { UserActivity, ActivityType } from '../entities/user-activity.entity';

describe('UserActivityService', () => {
  let service: UserActivityService;
  let activityRepository: jest.Mocked<Repository<UserActivity>>;

  // Valid UUIDs for mock data
  const USER_ID = '123e4567-e89b-12d3-a456-426614174000';
  const ADMIN_ID = '223e4567-e89b-12d3-a456-426614174001';
  const ACTIVITY_ID_1 = '323e4567-e89b-12d3-a456-426614174002';
  const ACTIVITY_ID_2 = '423e4567-e89b-12d3-a456-426614174003';
  const ACTIVITY_ID_3 = '523e4567-e89b-12d3-a456-426614174004';

  const now = new Date('2026-03-28T12:00:00.000Z');

  const mockActivity: UserActivity = {
    id: ACTIVITY_ID_1,
    userId: USER_ID,
    activityType: ActivityType.LOGIN,
    description: 'User logged in successfully',
    ipAddress: '192.168.1.1',
    userAgent: 'Mozilla/5.0 (X11; Linux x86_64)',
    metadata: null,
    performedBy: null,
    createdAt: now,
    user: null as any,
    performer: null,
    constructor: UserActivity.prototype.constructor,
  } as unknown as UserActivity;

  const mockActivities: UserActivity[] = [
    mockActivity,
    {
      id: ACTIVITY_ID_2,
      userId: USER_ID,
      activityType: ActivityType.PROFILE_UPDATED,
      description: 'Profile updated',
      ipAddress: '10.0.0.1',
      userAgent: 'Chrome/120',
      metadata: { field: 'firstName' },
      performedBy: null,
      createdAt: new Date('2026-03-27T10:00:00.000Z'),
    } as unknown as UserActivity,
    {
      id: ACTIVITY_ID_3,
      userId: USER_ID,
      activityType: ActivityType.LOGIN,
      description: 'User logged in',
      ipAddress: '192.168.1.2',
      userAgent: 'Firefox/125',
      metadata: null,
      performedBy: null,
      createdAt: new Date('2026-03-20T08:00:00.000Z'),
    } as unknown as UserActivity,
  ];

  // Reusable QueryBuilder mock factory
  const createQueryBuilderMock = (overrides?: Record<string, jest.Mock>) => ({
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
    execute: jest.fn().mockResolvedValue({ affected: 0 }),
    ...overrides,
  });

  beforeEach(async () => {
    const mockActivityRepository = {
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
      count: jest.fn(),
      createQueryBuilder: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserActivityService,
        {
          provide: getRepositoryToken(UserActivity),
          useValue: mockActivityRepository,
        },
      ],
    }).compile();

    service = module.get<UserActivityService>(UserActivityService);
    activityRepository = module.get(getRepositoryToken(UserActivity));
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ─────────────────────────────────────────────────────
  // logActivity
  // ─────────────────────────────────────────────────────
  describe('logActivity', () => {
    const baseParams = {
      userId: USER_ID,
      activityType: ActivityType.LOGIN,
      description: 'User logged in successfully',
    };

    it('should create and save an activity with all parameters', async () => {
      const fullParams = {
        ...baseParams,
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        metadata: { browser: 'Chrome' },
        performedBy: ADMIN_ID,
      };

      activityRepository.create.mockReturnValue(mockActivity);
      activityRepository.save.mockResolvedValue(mockActivity);

      const result = await service.logActivity(fullParams);

      expect(activityRepository.create).toHaveBeenCalledWith({
        userId: fullParams.userId,
        activityType: fullParams.activityType,
        description: fullParams.description,
        ipAddress: fullParams.ipAddress,
        userAgent: fullParams.userAgent,
        metadata: fullParams.metadata,
        performedBy: fullParams.performedBy,
      });
      expect(activityRepository.save).toHaveBeenCalledWith(mockActivity);
      expect(result).toEqual(mockActivity);
    });

    it('should set optional fields to null when not provided', async () => {
      activityRepository.create.mockReturnValue(mockActivity);
      activityRepository.save.mockResolvedValue(mockActivity);

      await service.logActivity(baseParams);

      expect(activityRepository.create).toHaveBeenCalledWith({
        userId: baseParams.userId,
        activityType: baseParams.activityType,
        description: baseParams.description,
        ipAddress: null,
        userAgent: null,
        metadata: null,
        performedBy: null,
      });
    });

    it('should set ipAddress to null when undefined', async () => {
      activityRepository.create.mockReturnValue(mockActivity);
      activityRepository.save.mockResolvedValue(mockActivity);

      await service.logActivity({ ...baseParams, ipAddress: undefined });

      expect(activityRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ ipAddress: null }),
      );
    });

    it('should preserve ipAddress when explicitly provided', async () => {
      activityRepository.create.mockReturnValue(mockActivity);
      activityRepository.save.mockResolvedValue(mockActivity);

      await service.logActivity({ ...baseParams, ipAddress: '10.0.0.1' });

      expect(activityRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ ipAddress: '10.0.0.1' }),
      );
    });

    it('should return the saved activity entity', async () => {
      const savedActivity = { ...mockActivity, id: ACTIVITY_ID_2 };
      activityRepository.create.mockReturnValue(savedActivity as UserActivity);
      activityRepository.save.mockResolvedValue(savedActivity as UserActivity);

      const result = await service.logActivity(baseParams);

      expect(result.id).toBe(ACTIVITY_ID_2);
    });

    it('should propagate repository errors', async () => {
      activityRepository.create.mockReturnValue(mockActivity);
      activityRepository.save.mockRejectedValue(
        new Error('DB connection lost'),
      );

      await expect(service.logActivity(baseParams)).rejects.toThrow(
        'DB connection lost',
      );
    });
  });

  // ─────────────────────────────────────────────────────
  // getUserActivities
  // ─────────────────────────────────────────────────────
  describe('getUserActivities', () => {
    it('should return activities for a user with default options', async () => {
      const qb = createQueryBuilderMock({
        getManyAndCount: jest.fn().mockResolvedValue([[mockActivity], 1]),
      });
      activityRepository.createQueryBuilder.mockReturnValue(qb as any);

      const result = await service.getUserActivities(USER_ID);

      expect(activityRepository.createQueryBuilder).toHaveBeenCalledWith(
        'activity',
      );
      expect(qb.where).toHaveBeenCalledWith('activity.userId = :userId', {
        userId: USER_ID,
      });
      expect(qb.leftJoinAndSelect).toHaveBeenCalledWith(
        'activity.performer',
        'performer',
      );
      expect(qb.orderBy).toHaveBeenCalledWith('activity.createdAt', 'DESC');
      expect(result).toEqual({
        data: [mockActivity],
        pagination: { total: 1 },
      });
    });

    it('should filter by activityType when provided', async () => {
      const qb = createQueryBuilderMock({
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      });
      activityRepository.createQueryBuilder.mockReturnValue(qb as any);

      await service.getUserActivities(USER_ID, {
        activityType: ActivityType.LOGIN,
      });

      expect(qb.andWhere).toHaveBeenCalledWith(
        'activity.activityType = :activityType',
        { activityType: ActivityType.LOGIN },
      );
    });

    it('should NOT filter by activityType when not provided', async () => {
      const qb = createQueryBuilderMock({
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      });
      activityRepository.createQueryBuilder.mockReturnValue(qb as any);

      await service.getUserActivities(USER_ID);

      expect(qb.andWhere).not.toHaveBeenCalled();
    });

    it('should apply limit (take) when provided', async () => {
      const qb = createQueryBuilderMock({
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      });
      activityRepository.createQueryBuilder.mockReturnValue(qb as any);

      await service.getUserActivities(USER_ID, { limit: 25 });

      expect(qb.take).toHaveBeenCalledWith(25);
    });

    it('should NOT apply limit when not provided', async () => {
      const qb = createQueryBuilderMock({
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      });
      activityRepository.createQueryBuilder.mockReturnValue(qb as any);

      await service.getUserActivities(USER_ID);

      expect(qb.take).not.toHaveBeenCalled();
    });

    it('should apply offset (skip) when provided', async () => {
      const qb = createQueryBuilderMock({
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      });
      activityRepository.createQueryBuilder.mockReturnValue(qb as any);

      await service.getUserActivities(USER_ID, { offset: 10 });

      expect(qb.skip).toHaveBeenCalledWith(10);
    });

    it('should NOT apply offset when not provided', async () => {
      const qb = createQueryBuilderMock({
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      });
      activityRepository.createQueryBuilder.mockReturnValue(qb as any);

      await service.getUserActivities(USER_ID);

      expect(qb.skip).not.toHaveBeenCalled();
    });

    it('should apply all options together', async () => {
      const qb = createQueryBuilderMock({
        getManyAndCount: jest.fn().mockResolvedValue([[mockActivity], 1]),
      });
      activityRepository.createQueryBuilder.mockReturnValue(qb as any);

      await service.getUserActivities(USER_ID, {
        limit: 10,
        offset: 20,
        activityType: ActivityType.PROFILE_UPDATED,
      });

      expect(qb.andWhere).toHaveBeenCalledWith(
        'activity.activityType = :activityType',
        { activityType: ActivityType.PROFILE_UPDATED },
      );
      expect(qb.take).toHaveBeenCalledWith(10);
      expect(qb.skip).toHaveBeenCalledWith(20);
    });

    it('should return empty data with total 0 when no activities found', async () => {
      const qb = createQueryBuilderMock({
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      });
      activityRepository.createQueryBuilder.mockReturnValue(qb as any);

      const result = await service.getUserActivities(USER_ID);

      expect(result).toEqual({ data: [], pagination: { total: 0 } });
    });

    it('should handle limit: 0 (falsy) by not applying take', async () => {
      const qb = createQueryBuilderMock({
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      });
      activityRepository.createQueryBuilder.mockReturnValue(qb as any);

      await service.getUserActivities(USER_ID, { limit: 0 });

      expect(qb.take).not.toHaveBeenCalled();
    });

    it('should handle offset: 0 (falsy) by not applying skip', async () => {
      const qb = createQueryBuilderMock({
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      });
      activityRepository.createQueryBuilder.mockReturnValue(qb as any);

      await service.getUserActivities(USER_ID, { offset: 0 });

      expect(qb.skip).not.toHaveBeenCalled();
    });
  });

  // ─────────────────────────────────────────────────────
  // getRecentActivities
  // ─────────────────────────────────────────────────────
  describe('getRecentActivities', () => {
    it('should return the last 50 activities for a user', async () => {
      const qb = createQueryBuilderMock({
        getManyAndCount: jest
          .fn()
          .mockResolvedValue([mockActivities, mockActivities.length]),
      });
      activityRepository.createQueryBuilder.mockReturnValue(qb as any);

      const result = await service.getRecentActivities(USER_ID);

      expect(qb.take).toHaveBeenCalledWith(50);
      expect(result).toEqual(mockActivities);
    });

    it('should return an empty array when user has no activities', async () => {
      const qb = createQueryBuilderMock({
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      });
      activityRepository.createQueryBuilder.mockReturnValue(qb as any);

      const result = await service.getRecentActivities(USER_ID);

      expect(result).toEqual([]);
    });

    it('should delegate to getUserActivities with limit 50', async () => {
      const spy = jest.spyOn(service, 'getUserActivities').mockResolvedValue({
        data: [mockActivity],
        pagination: { total: 1 },
      });

      const result = await service.getRecentActivities(USER_ID);

      expect(spy).toHaveBeenCalledWith(USER_ID, { limit: 50 });
      expect(result).toEqual([mockActivity]);
    });
  });

  // ─────────────────────────────────────────────────────
  // getActivitiesByType
  // ─────────────────────────────────────────────────────
  describe('getActivitiesByType', () => {
    it('should return activities filtered by type', async () => {
      const loginActivities = mockActivities.filter(
        (a) => a.activityType === ActivityType.LOGIN,
      );
      activityRepository.find.mockResolvedValue(loginActivities);

      const result = await service.getActivitiesByType(
        USER_ID,
        ActivityType.LOGIN,
      );

      expect(activityRepository.find).toHaveBeenCalledWith({
        where: {
          userId: USER_ID,
          activityType: ActivityType.LOGIN,
        },
        order: {
          createdAt: 'DESC',
        },
        take: 100,
      });
      expect(result).toEqual(loginActivities);
    });

    it('should return empty array when no activities of that type exist', async () => {
      activityRepository.find.mockResolvedValue([]);

      const result = await service.getActivitiesByType(
        USER_ID,
        ActivityType.PAYMENT_COMPLETED,
      );

      expect(result).toEqual([]);
    });

    it('should limit results to 100', async () => {
      activityRepository.find.mockResolvedValue([]);

      await service.getActivitiesByType(USER_ID, ActivityType.LOGIN);

      expect(activityRepository.find).toHaveBeenCalledWith(
        expect.objectContaining({ take: 100 }),
      );
    });

    it('should order by createdAt DESC', async () => {
      activityRepository.find.mockResolvedValue([]);

      await service.getActivitiesByType(USER_ID, ActivityType.PROFILE_UPDATED);

      expect(activityRepository.find).toHaveBeenCalledWith(
        expect.objectContaining({ order: { createdAt: 'DESC' } }),
      );
    });
  });

  // ─────────────────────────────────────────────────────
  // countActivitiesByType
  // ─────────────────────────────────────────────────────
  describe('countActivitiesByType', () => {
    it('should return the count of activities for a given type', async () => {
      activityRepository.count.mockResolvedValue(42);

      const result = await service.countActivitiesByType(
        USER_ID,
        ActivityType.LOGIN,
      );

      expect(activityRepository.count).toHaveBeenCalledWith({
        where: {
          userId: USER_ID,
          activityType: ActivityType.LOGIN,
        },
      });
      expect(result).toBe(42);
    });

    it('should return 0 when no activities of that type exist', async () => {
      activityRepository.count.mockResolvedValue(0);

      const result = await service.countActivitiesByType(
        USER_ID,
        ActivityType.PAYMENT_FAILED,
      );

      expect(result).toBe(0);
    });

    it('should propagate repository errors', async () => {
      activityRepository.count.mockRejectedValue(new Error('Query failed'));

      await expect(
        service.countActivitiesByType(USER_ID, ActivityType.LOGIN),
      ).rejects.toThrow('Query failed');
    });
  });

  // ─────────────────────────────────────────────────────
  // deleteOldActivities
  // ─────────────────────────────────────────────────────
  describe('deleteOldActivities', () => {
    it('should delete activities older than the specified days', async () => {
      const qb = createQueryBuilderMock({
        execute: jest.fn().mockResolvedValue({ affected: 15 }),
      });
      activityRepository.createQueryBuilder.mockReturnValue(qb as any);

      const result = await service.deleteOldActivities(30);

      expect(activityRepository.createQueryBuilder).toHaveBeenCalled();
      expect(qb.delete).toHaveBeenCalled();
      expect(qb.where).toHaveBeenCalledWith('createdAt < :cutoffDate', {
        cutoffDate: expect.any(Date),
      });
      expect(qb.execute).toHaveBeenCalled();
      expect(result).toBe(15);
    });

    it('should default to 90 days when no argument provided', async () => {
      const qb = createQueryBuilderMock({
        execute: jest.fn().mockResolvedValue({ affected: 5 }),
      });
      activityRepository.createQueryBuilder.mockReturnValue(qb as any);

      // Capture the cutoff date passed to .where()
      let capturedCutoffDate: Date | undefined;
      qb.where.mockImplementation((_clause: string, params: any) => {
        capturedCutoffDate = params.cutoffDate;
        return qb;
      });

      await service.deleteOldActivities();

      expect(capturedCutoffDate).toBeInstanceOf(Date);
      // The cutoff date should be approximately 90 days ago
      const expectedCutoff = new Date();
      expectedCutoff.setDate(expectedCutoff.getDate() - 90);
      const diffMs = Math.abs(
        capturedCutoffDate!.getTime() - expectedCutoff.getTime(),
      );
      // Allow 5 seconds tolerance for test execution time
      expect(diffMs).toBeLessThan(5000);
    });

    it('should return 0 when no activities are deleted', async () => {
      const qb = createQueryBuilderMock({
        execute: jest.fn().mockResolvedValue({ affected: 0 }),
      });
      activityRepository.createQueryBuilder.mockReturnValue(qb as any);

      const result = await service.deleteOldActivities(7);

      expect(result).toBe(0);
    });

    it('should return 0 when affected is null/undefined', async () => {
      const qb = createQueryBuilderMock({
        execute: jest.fn().mockResolvedValue({ affected: null }),
      });
      activityRepository.createQueryBuilder.mockReturnValue(qb as any);

      const result = await service.deleteOldActivities(30);

      expect(result).toBe(0);
    });

    it('should calculate correct cutoff date for custom days', async () => {
      const qb = createQueryBuilderMock({
        execute: jest.fn().mockResolvedValue({ affected: 3 }),
      });
      activityRepository.createQueryBuilder.mockReturnValue(qb as any);

      let capturedCutoffDate: Date | undefined;
      qb.where.mockImplementation((_clause: string, params: any) => {
        capturedCutoffDate = params.cutoffDate;
        return qb;
      });

      await service.deleteOldActivities(7);

      const expectedCutoff = new Date();
      expectedCutoff.setDate(expectedCutoff.getDate() - 7);
      const diffMs = Math.abs(
        capturedCutoffDate!.getTime() - expectedCutoff.getTime(),
      );
      expect(diffMs).toBeLessThan(5000);
    });

    it('should propagate repository errors', async () => {
      const qb = createQueryBuilderMock({
        execute: jest.fn().mockRejectedValue(new Error('Delete failed')),
      });
      activityRepository.createQueryBuilder.mockReturnValue(qb as any);

      await expect(service.deleteOldActivities(30)).rejects.toThrow(
        'Delete failed',
      );
    });
  });

  // ─────────────────────────────────────────────────────
  // getUserActivityStats
  // ─────────────────────────────────────────────────────
  describe('getUserActivityStats', () => {
    it('should return complete stats for a user with activities', async () => {
      // Dates relative to "now" in the test
      const realNow = new Date();
      const todayActivity = {
        ...mockActivity,
        id: ACTIVITY_ID_1,
        activityType: ActivityType.LOGIN,
        createdAt: realNow,
      } as unknown as UserActivity;

      const yesterdayActivity = {
        ...mockActivity,
        id: ACTIVITY_ID_2,
        activityType: ActivityType.PROFILE_UPDATED,
        createdAt: new Date(
          realNow.getFullYear(),
          realNow.getMonth(),
          realNow.getDate() - 1,
        ),
      } as unknown as UserActivity;

      const oldActivity = {
        ...mockActivity,
        id: ACTIVITY_ID_3,
        activityType: ActivityType.LOGOUT,
        createdAt: new Date('2025-01-01T10:00:00.000Z'),
      } as unknown as UserActivity;

      // Activities are ordered DESC by createdAt
      activityRepository.find.mockResolvedValue([
        todayActivity,
        yesterdayActivity,
        oldActivity,
      ]);

      const result = await service.getUserActivityStats(USER_ID);

      expect(activityRepository.find).toHaveBeenCalledWith({
        where: { userId: USER_ID },
        order: { createdAt: 'DESC' },
      });
      expect(result.total).toBe(3);
      expect(result.lastActivity).toEqual(realNow);
      expect(result.lastLogin).toEqual(realNow);
      expect(result.today).toBeGreaterThanOrEqual(1);
      expect(result.activitiesByType).toHaveProperty(ActivityType.LOGIN, 1);
      expect(result.activitiesByType).toHaveProperty(
        ActivityType.PROFILE_UPDATED,
        1,
      );
      expect(result.activitiesByType).toHaveProperty(ActivityType.LOGOUT, 1);
    });

    it('should return null dates when user has no activities', async () => {
      activityRepository.find.mockResolvedValue([]);

      const result = await service.getUserActivityStats(USER_ID);

      expect(result).toEqual({
        total: 0,
        lastActivity: null,
        lastLogin: null,
        today: 0,
        thisWeek: 0,
        activitiesByType: {},
      });
    });

    it('should return null for lastLogin when no LOGIN activities exist', async () => {
      const profileActivity = {
        ...mockActivity,
        activityType: ActivityType.PROFILE_UPDATED,
        createdAt: new Date(),
      } as unknown as UserActivity;
      activityRepository.find.mockResolvedValue([profileActivity]);

      const result = await service.getUserActivityStats(USER_ID);

      expect(result.lastLogin).toBeNull();
      expect(result.lastActivity).toEqual(profileActivity.createdAt);
      expect(result.total).toBe(1);
    });

    it('should count today activities correctly', async () => {
      const realNow = new Date();
      const todayActivities = [
        {
          ...mockActivity,
          id: ACTIVITY_ID_1,
          activityType: ActivityType.LOGIN,
          createdAt: realNow,
        },
        {
          ...mockActivity,
          id: ACTIVITY_ID_2,
          activityType: ActivityType.PROFILE_UPDATED,
          createdAt: realNow,
        },
      ] as unknown as UserActivity[];

      activityRepository.find.mockResolvedValue(todayActivities);

      const result = await service.getUserActivityStats(USER_ID);

      expect(result.today).toBe(2);
    });

    it('should aggregate activitiesByType correctly with multiple same-type activities', async () => {
      const loginActivities = [
        {
          ...mockActivity,
          id: ACTIVITY_ID_1,
          activityType: ActivityType.LOGIN,
          createdAt: new Date(),
        },
        {
          ...mockActivity,
          id: ACTIVITY_ID_2,
          activityType: ActivityType.LOGIN,
          createdAt: new Date(),
        },
        {
          ...mockActivity,
          id: ACTIVITY_ID_3,
          activityType: ActivityType.LOGOUT,
          createdAt: new Date(),
        },
      ] as unknown as UserActivity[];

      activityRepository.find.mockResolvedValue(loginActivities);

      const result = await service.getUserActivityStats(USER_ID);

      expect(result.activitiesByType[ActivityType.LOGIN]).toBe(2);
      expect(result.activitiesByType[ActivityType.LOGOUT]).toBe(1);
    });

    it('should use first activity (most recent) as lastActivity', async () => {
      const recentDate = new Date('2026-03-28T15:00:00.000Z');
      const olderDate = new Date('2026-03-20T10:00:00.000Z');

      const activities = [
        { ...mockActivity, id: ACTIVITY_ID_1, createdAt: recentDate },
        { ...mockActivity, id: ACTIVITY_ID_2, createdAt: olderDate },
      ] as unknown as UserActivity[];

      activityRepository.find.mockResolvedValue(activities);

      const result = await service.getUserActivityStats(USER_ID);

      expect(result.lastActivity).toEqual(recentDate);
    });

    it('should find lastLogin from first LOGIN type in sorted activities', async () => {
      const loginDate = new Date('2026-03-27T09:00:00.000Z');
      const activities = [
        {
          ...mockActivity,
          id: ACTIVITY_ID_1,
          activityType: ActivityType.PROFILE_UPDATED,
          createdAt: new Date('2026-03-28T12:00:00.000Z'),
        },
        {
          ...mockActivity,
          id: ACTIVITY_ID_2,
          activityType: ActivityType.LOGIN,
          createdAt: loginDate,
        },
      ] as unknown as UserActivity[];

      activityRepository.find.mockResolvedValue(activities);

      const result = await service.getUserActivityStats(USER_ID);

      expect(result.lastLogin).toEqual(loginDate);
    });

    it('should propagate repository errors', async () => {
      activityRepository.find.mockRejectedValue(
        new Error('Connection timeout'),
      );

      await expect(service.getUserActivityStats(USER_ID)).rejects.toThrow(
        'Connection timeout',
      );
    });
  });

  // ─────────────────────────────────────────────────────
  // getActivitiesPerformedBy
  // ─────────────────────────────────────────────────────
  describe('getActivitiesPerformedBy', () => {
    it('should return activities performed by an admin', async () => {
      const adminActivities = [
        {
          ...mockActivity,
          performedBy: ADMIN_ID,
          activityType: ActivityType.ROLE_CHANGED,
        },
      ] as unknown as UserActivity[];

      activityRepository.find.mockResolvedValue(adminActivities);

      const result = await service.getActivitiesPerformedBy(ADMIN_ID);

      expect(activityRepository.find).toHaveBeenCalledWith({
        where: { performedBy: ADMIN_ID },
        relations: ['user'],
        order: { createdAt: 'DESC' },
        take: 100,
      });
      expect(result).toEqual(adminActivities);
    });

    it('should accept a custom limit', async () => {
      activityRepository.find.mockResolvedValue([]);

      await service.getActivitiesPerformedBy(ADMIN_ID, 50);

      expect(activityRepository.find).toHaveBeenCalledWith(
        expect.objectContaining({ take: 50 }),
      );
    });

    it('should default to limit 100 when not specified', async () => {
      activityRepository.find.mockResolvedValue([]);

      await service.getActivitiesPerformedBy(ADMIN_ID);

      expect(activityRepository.find).toHaveBeenCalledWith(
        expect.objectContaining({ take: 100 }),
      );
    });

    it('should include user relation', async () => {
      activityRepository.find.mockResolvedValue([]);

      await service.getActivitiesPerformedBy(ADMIN_ID);

      expect(activityRepository.find).toHaveBeenCalledWith(
        expect.objectContaining({ relations: ['user'] }),
      );
    });

    it('should return empty array when admin has no performed activities', async () => {
      activityRepository.find.mockResolvedValue([]);

      const result = await service.getActivitiesPerformedBy(ADMIN_ID);

      expect(result).toEqual([]);
    });

    it('should order by createdAt DESC', async () => {
      activityRepository.find.mockResolvedValue([]);

      await service.getActivitiesPerformedBy(ADMIN_ID);

      expect(activityRepository.find).toHaveBeenCalledWith(
        expect.objectContaining({ order: { createdAt: 'DESC' } }),
      );
    });

    it('should propagate repository errors', async () => {
      activityRepository.find.mockRejectedValue(
        new Error('Table does not exist'),
      );

      await expect(service.getActivitiesPerformedBy(ADMIN_ID)).rejects.toThrow(
        'Table does not exist',
      );
    });
  });
});
