import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Repository } from 'typeorm';
import { WebhooksService } from './webhooks.service';
import {
  WebhookEvent,
  WebhookSource,
  WebhookEventStatus,
} from './entities/webhook-event.entity';

describe('WebhooksService', () => {
  let service: WebhooksService;
  let webhookEventRepository: jest.Mocked<Repository<WebhookEvent>>;

  // ── Mock data ──────────────────────────────────────────────

  const mockEventId = '123e4567-e89b-12d3-a456-426614174000';
  const mockEventId2 = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

  const createMockWebhookEvent = (
    overrides: Partial<WebhookEvent> = {},
  ): WebhookEvent => {
    return {
      id: mockEventId,
      systemCode: 'WHK-260207-A3K9',
      source: WebhookSource.STRIPE,
      externalEventId: 'evt_1NqXkPLkdIwOt4y7AvGQWs5E',
      eventType: 'payment_intent.succeeded',
      payload: { id: 'evt_xxx', type: 'payment_intent.succeeded' },
      headers: { 'stripe-signature': 'whsec_xxx' },
      status: WebhookEventStatus.RECEIVED,
      attempts: 0,
      maxAttempts: 3,
      result: null,
      errorMessage: null,
      errorStack: null,
      processedAt: null,
      nextRetryAt: null,
      processingTimeMs: null,
      ipAddress: '192.168.1.100',
      createdAt: new Date('2026-01-01'),
      updatedAt: new Date('2026-01-01'),
      generateSystemCode: jest.fn(),
      ...overrides,
    } as unknown as WebhookEvent;
  };

  // ── QueryBuilder helper ────────────────────────────────────

  const createMockQueryBuilder = (overrides: Record<string, any> = {}) => {
    const qb: Record<string, jest.Mock> = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
      getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      getCount: jest.fn().mockResolvedValue(0),
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([]),
      getRawOne: jest.fn().mockResolvedValue(null),
      delete: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue({ affected: 0 }),
      limit: jest.fn().mockReturnThis(),
      ...overrides,
    };
    for (const key of Object.keys(qb)) {
      if (
        !overrides[key] &&
        ![
          'getMany',
          'getManyAndCount',
          'getCount',
          'getRawMany',
          'getRawOne',
          'execute',
        ].includes(key)
      ) {
        qb[key] = jest.fn().mockReturnValue(qb);
      }
    }
    if (overrides.getMany) qb.getMany = overrides.getMany;
    if (overrides.getManyAndCount)
      qb.getManyAndCount = overrides.getManyAndCount;
    if (overrides.getCount) qb.getCount = overrides.getCount;
    if (overrides.getRawMany) qb.getRawMany = overrides.getRawMany;
    if (overrides.getRawOne) qb.getRawOne = overrides.getRawOne;
    if (overrides.execute) qb.execute = overrides.execute;
    return qb;
  };

  // ── Test module setup ──────────────────────────────────────

  beforeEach(async () => {
    const mockWebhookEventRepository = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn(),
      create: jest.fn().mockImplementation((dto) => ({ ...dto })),
      save: jest.fn().mockImplementation(async (entity) => entity),
      remove: jest.fn().mockResolvedValue(undefined),
      count: jest.fn().mockResolvedValue(0),
      createQueryBuilder: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebhooksService,
        {
          provide: getRepositoryToken(WebhookEvent),
          useValue: mockWebhookEventRepository,
        },
      ],
    }).compile();

    service = module.get<WebhooksService>(WebhooksService);
    webhookEventRepository = module.get(getRepositoryToken(WebhookEvent));
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ================================================================
  // REGISTER EVENT
  // ================================================================

  describe('registerEvent', () => {
    it('should create a new webhook event when no existing event', async () => {
      webhookEventRepository.findOne.mockResolvedValue(null);
      const createdEvent = createMockWebhookEvent({
        status: WebhookEventStatus.RECEIVED,
      });
      webhookEventRepository.create.mockReturnValue(createdEvent);
      webhookEventRepository.save.mockResolvedValue(createdEvent);

      const result = await service.registerEvent(
        WebhookSource.STRIPE,
        'evt_new_123',
        'payment_intent.succeeded',
        { id: 'evt_new_123' },
        { 'stripe-signature': 'sig_xxx' },
        '10.0.0.1',
      );

      expect(result).toEqual(createdEvent);
      expect(webhookEventRepository.create).toHaveBeenCalledWith({
        source: WebhookSource.STRIPE,
        externalEventId: 'evt_new_123',
        eventType: 'payment_intent.succeeded',
        payload: { id: 'evt_new_123' },
        headers: { 'stripe-signature': 'sig_xxx' },
        ipAddress: '10.0.0.1',
        status: WebhookEventStatus.RECEIVED,
      });
      expect(webhookEventRepository.save).toHaveBeenCalled();
    });

    it('should return null when duplicate event is already processed', async () => {
      const processedEvent = createMockWebhookEvent({
        status: WebhookEventStatus.PROCESSED,
      });
      webhookEventRepository.findOne.mockResolvedValue(processedEvent);

      const result = await service.registerEvent(
        WebhookSource.STRIPE,
        'evt_duplicate',
        'payment_intent.succeeded',
        { id: 'evt_duplicate' },
      );

      expect(result).toBeNull();
      expect(webhookEventRepository.create).not.toHaveBeenCalled();
    });

    it('should return null when duplicate event is already skipped', async () => {
      const skippedEvent = createMockWebhookEvent({
        status: WebhookEventStatus.SKIPPED,
      });
      webhookEventRepository.findOne.mockResolvedValue(skippedEvent);

      const result = await service.registerEvent(
        WebhookSource.STRIPE,
        'evt_skipped',
        'payment_intent.succeeded',
        { id: 'evt_skipped' },
      );

      expect(result).toBeNull();
    });

    it('should return existing event for retry when status is failed', async () => {
      const failedEvent = createMockWebhookEvent({
        status: WebhookEventStatus.FAILED,
      });
      webhookEventRepository.findOne.mockResolvedValue(failedEvent);

      const result = await service.registerEvent(
        WebhookSource.STRIPE,
        'evt_failed',
        'payment_intent.succeeded',
        { id: 'evt_failed' },
      );

      expect(result).toEqual(failedEvent);
      expect(webhookEventRepository.create).not.toHaveBeenCalled();
    });

    it('should return existing event for retry when status is received', async () => {
      const receivedEvent = createMockWebhookEvent({
        status: WebhookEventStatus.RECEIVED,
      });
      webhookEventRepository.findOne.mockResolvedValue(receivedEvent);

      const result = await service.registerEvent(
        WebhookSource.STRIPE,
        'evt_received',
        'payment_intent.succeeded',
        { id: 'evt_received' },
      );

      expect(result).toEqual(receivedEvent);
    });

    it('should handle concurrent duplicate insert (unique constraint violation)', async () => {
      webhookEventRepository.findOne
        .mockResolvedValueOnce(null) // first check — no existing
        .mockResolvedValueOnce(
          createMockWebhookEvent({
            status: WebhookEventStatus.RECEIVED,
          }),
        ); // concurrent lookup after error

      const uniqueError = { code: '23505', message: 'unique violation' };
      webhookEventRepository.save.mockRejectedValue(uniqueError);
      webhookEventRepository.create.mockReturnValue(
        createMockWebhookEvent() as any,
      );

      const result = await service.registerEvent(
        WebhookSource.STRIPE,
        'evt_concurrent',
        'payment_intent.succeeded',
        { id: 'evt_concurrent' },
      );

      expect(result).toBeDefined();
      expect(result!.status).toBe(WebhookEventStatus.RECEIVED);
    });

    it('should return null on concurrent duplicate if already processed', async () => {
      webhookEventRepository.findOne
        .mockResolvedValueOnce(null) // first check
        .mockResolvedValueOnce(
          createMockWebhookEvent({
            status: WebhookEventStatus.PROCESSED,
          }),
        ); // concurrent lookup

      const uniqueError = { code: '23505', message: 'unique violation' };
      webhookEventRepository.save.mockRejectedValue(uniqueError);
      webhookEventRepository.create.mockReturnValue(
        createMockWebhookEvent() as any,
      );

      const result = await service.registerEvent(
        WebhookSource.STRIPE,
        'evt_concurrent_processed',
        'payment_intent.succeeded',
        { id: 'evt_concurrent_processed' },
      );

      expect(result).toBeNull();
    });

    it('should return null for concurrent duplicate when event not found on retry', async () => {
      webhookEventRepository.findOne
        .mockResolvedValueOnce(null) // first check
        .mockResolvedValueOnce(null); // concurrent lookup — somehow null

      const uniqueError = { code: '23505', message: 'unique violation' };
      webhookEventRepository.save.mockRejectedValue(uniqueError);
      webhookEventRepository.create.mockReturnValue(
        createMockWebhookEvent() as any,
      );

      const result = await service.registerEvent(
        WebhookSource.STRIPE,
        'evt_gone',
        'payment_intent.succeeded',
        { id: 'evt_gone' },
      );

      // concurrent returns null (findOne returned null)
      expect(result).toBeNull();
    });

    it('should re-throw non-unique-constraint errors', async () => {
      webhookEventRepository.findOne.mockResolvedValue(null);
      webhookEventRepository.create.mockReturnValue(
        createMockWebhookEvent() as any,
      );

      const genericError = new Error('Connection refused');
      webhookEventRepository.save.mockRejectedValue(genericError);

      await expect(
        service.registerEvent(
          WebhookSource.STRIPE,
          'evt_error',
          'payment_intent.succeeded',
          { id: 'evt_error' },
        ),
      ).rejects.toThrow('Connection refused');
    });

    it('should set headers to null when not provided', async () => {
      webhookEventRepository.findOne.mockResolvedValue(null);
      const createdEvent = createMockWebhookEvent({ headers: null });
      webhookEventRepository.create.mockReturnValue(createdEvent);
      webhookEventRepository.save.mockResolvedValue(createdEvent);

      await service.registerEvent(
        WebhookSource.CUSTOM,
        'evt_no_headers',
        'custom.event',
        { data: 'test' },
      );

      expect(webhookEventRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: null,
          ipAddress: null,
        }),
      );
    });
  });

  // ================================================================
  // MARK PROCESSING
  // ================================================================

  describe('markProcessing', () => {
    it('should mark event as processing and increment attempts', async () => {
      const event = createMockWebhookEvent({
        status: WebhookEventStatus.RECEIVED,
        attempts: 0,
      });
      webhookEventRepository.findOne.mockResolvedValue(event);
      webhookEventRepository.save.mockImplementation(
        async (entity) => entity as WebhookEvent,
      );

      await service.markProcessing(mockEventId);

      expect(webhookEventRepository.save).toHaveBeenCalled();
      const saved = (webhookEventRepository.save as jest.Mock).mock.calls[0][0];
      expect(saved.status).toBe(WebhookEventStatus.PROCESSING);
      expect(saved.attempts).toBe(1);
    });

    it('should increment attempts from existing count', async () => {
      const event = createMockWebhookEvent({
        status: WebhookEventStatus.FAILED,
        attempts: 2,
      });
      webhookEventRepository.findOne.mockResolvedValue(event);
      webhookEventRepository.save.mockImplementation(
        async (entity) => entity as WebhookEvent,
      );

      await service.markProcessing(mockEventId);

      const saved = (webhookEventRepository.save as jest.Mock).mock.calls[0][0];
      expect(saved.attempts).toBe(3);
    });

    it('should throw NotFoundException when event does not exist', async () => {
      webhookEventRepository.findOne.mockResolvedValue(null);

      await expect(service.markProcessing('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ================================================================
  // MARK PROCESSED
  // ================================================================

  describe('markProcessed', () => {
    it('should mark event as processed with result and timing', async () => {
      const event = createMockWebhookEvent({
        status: WebhookEventStatus.PROCESSING,
        attempts: 1,
        errorMessage: 'previous error',
        errorStack: 'stack trace',
        nextRetryAt: new Date(),
      });
      webhookEventRepository.findOne.mockResolvedValue(event);
      webhookEventRepository.save.mockImplementation(
        async (entity) => entity as WebhookEvent,
      );

      const result = { success: true };

      await service.markProcessed(mockEventId, result, 150);

      const saved = (webhookEventRepository.save as jest.Mock).mock.calls[0][0];
      expect(saved.status).toBe(WebhookEventStatus.PROCESSED);
      expect(saved.result).toEqual({ success: true });
      expect(saved.processedAt).toBeInstanceOf(Date);
      expect(saved.processingTimeMs).toBe(150);
      expect(saved.errorMessage).toBeNull();
      expect(saved.errorStack).toBeNull();
      expect(saved.nextRetryAt).toBeNull();
    });

    it('should mark processed without optional params', async () => {
      const event = createMockWebhookEvent({
        status: WebhookEventStatus.PROCESSING,
      });
      webhookEventRepository.findOne.mockResolvedValue(event);
      webhookEventRepository.save.mockImplementation(
        async (entity) => entity as WebhookEvent,
      );

      await service.markProcessed(mockEventId);

      const saved = (webhookEventRepository.save as jest.Mock).mock.calls[0][0];
      expect(saved.status).toBe(WebhookEventStatus.PROCESSED);
      expect(saved.result).toBeNull();
      expect(saved.processingTimeMs).toBeNull();
    });

    it('should throw NotFoundException when event does not exist', async () => {
      webhookEventRepository.findOne.mockResolvedValue(null);

      await expect(service.markProcessed('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ================================================================
  // MARK FAILED
  // ================================================================

  describe('markFailed', () => {
    it('should mark event as failed and schedule retry with exponential backoff', async () => {
      const event = createMockWebhookEvent({
        status: WebhookEventStatus.PROCESSING,
        attempts: 1,
        maxAttempts: 3,
      });
      webhookEventRepository.findOne.mockResolvedValue(event);
      webhookEventRepository.save.mockImplementation(
        async (entity) => entity as WebhookEvent,
      );

      const error = new Error('Connection timeout');
      error.stack = 'Error: Connection timeout\n    at ...';

      await service.markFailed(mockEventId, error, 500);

      const saved = (webhookEventRepository.save as jest.Mock).mock.calls[0][0];
      expect(saved.status).toBe(WebhookEventStatus.FAILED);
      expect(saved.errorMessage).toBe('Connection timeout');
      expect(saved.errorStack).toBe('Error: Connection timeout\n    at ...');
      expect(saved.processingTimeMs).toBe(500);
      expect(saved.nextRetryAt).toBeInstanceOf(Date);
      // Exponential backoff: 2^1 * 30s = 60s into the future
      const expectedMinDelay = 55 * 1000; // allow some tolerance
      const actualDelay =
        saved.nextRetryAt.getTime() - Date.now();
      expect(actualDelay).toBeGreaterThan(expectedMinDelay);
    });

    it('should not schedule retry when max attempts reached', async () => {
      const event = createMockWebhookEvent({
        status: WebhookEventStatus.PROCESSING,
        attempts: 3,
        maxAttempts: 3,
      });
      webhookEventRepository.findOne.mockResolvedValue(event);
      webhookEventRepository.save.mockImplementation(
        async (entity) => entity as WebhookEvent,
      );

      const error = new Error('Final failure');

      await service.markFailed(mockEventId, error);

      const saved = (webhookEventRepository.save as jest.Mock).mock.calls[0][0];
      expect(saved.status).toBe(WebhookEventStatus.FAILED);
      expect(saved.nextRetryAt).toBeNull();
    });

    it('should calculate correct backoff for different attempt counts', async () => {
      // Test backoff for attempt 2: 2^2 * 30 = 120s
      const event = createMockWebhookEvent({
        attempts: 2,
        maxAttempts: 5,
      });
      webhookEventRepository.findOne.mockResolvedValue(event);
      webhookEventRepository.save.mockImplementation(
        async (entity) => entity as WebhookEvent,
      );

      await service.markFailed(mockEventId, new Error('fail'));

      const saved = (webhookEventRepository.save as jest.Mock).mock.calls[0][0];
      expect(saved.nextRetryAt).toBeInstanceOf(Date);
      const delay = saved.nextRetryAt.getTime() - Date.now();
      // 2^2 * 30s = 120s = 120000ms (with some tolerance)
      expect(delay).toBeGreaterThan(115000);
      expect(delay).toBeLessThan(125000);
    });

    it('should handle error without stack trace', async () => {
      const event = createMockWebhookEvent({
        attempts: 1,
        maxAttempts: 3,
      });
      webhookEventRepository.findOne.mockResolvedValue(event);
      webhookEventRepository.save.mockImplementation(
        async (entity) => entity as WebhookEvent,
      );

      const error = new Error('No stack');
      error.stack = undefined;

      await service.markFailed(mockEventId, error);

      const saved = (webhookEventRepository.save as jest.Mock).mock.calls[0][0];
      expect(saved.errorStack).toBeNull();
    });

    it('should set processingTimeMs to null when not provided', async () => {
      const event = createMockWebhookEvent({
        attempts: 1,
        maxAttempts: 3,
      });
      webhookEventRepository.findOne.mockResolvedValue(event);
      webhookEventRepository.save.mockImplementation(
        async (entity) => entity as WebhookEvent,
      );

      await service.markFailed(mockEventId, new Error('fail'));

      const saved = (webhookEventRepository.save as jest.Mock).mock.calls[0][0];
      expect(saved.processingTimeMs).toBeNull();
    });

    it('should throw NotFoundException when event does not exist', async () => {
      webhookEventRepository.findOne.mockResolvedValue(null);

      await expect(
        service.markFailed('non-existent', new Error('fail')),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ================================================================
  // GET RETRYABLE EVENTS
  // ================================================================

  describe('getRetryableEvents', () => {
    it('should return failed events with nextRetryAt in the past', async () => {
      const retryableEvents = [
        createMockWebhookEvent({
          status: WebhookEventStatus.FAILED,
          nextRetryAt: new Date('2026-01-01'),
        }),
      ];
      webhookEventRepository.find.mockResolvedValue(retryableEvents);

      const result = await service.getRetryableEvents();

      expect(result).toEqual(retryableEvents);
      expect(webhookEventRepository.find).toHaveBeenCalledWith({
        where: {
          status: WebhookEventStatus.FAILED,
          nextRetryAt: expect.any(Object), // LessThanOrEqual(new Date())
        },
        order: { nextRetryAt: 'ASC' },
      });
    });

    it('should return empty array when no retryable events', async () => {
      webhookEventRepository.find.mockResolvedValue([]);

      const result = await service.getRetryableEvents();

      expect(result).toEqual([]);
    });
  });

  // ================================================================
  // RETRY EVENT
  // ================================================================

  describe('retryEvent', () => {
    it('should reset a failed event for retry', async () => {
      const failedEvent = createMockWebhookEvent({
        status: WebhookEventStatus.FAILED,
        errorMessage: 'Previous error',
        errorStack: 'stack...',
        nextRetryAt: new Date(),
      });
      webhookEventRepository.findOne.mockResolvedValue(failedEvent);
      webhookEventRepository.save.mockImplementation(
        async (entity) => entity as WebhookEvent,
      );

      const result = await service.retryEvent(mockEventId);

      expect(result.status).toBe(WebhookEventStatus.RECEIVED);
      expect(result.nextRetryAt).toBeNull();
      expect(result.errorMessage).toBeNull();
      expect(result.errorStack).toBeNull();
    });

    it('should allow retry for received events', async () => {
      const receivedEvent = createMockWebhookEvent({
        status: WebhookEventStatus.RECEIVED,
      });
      webhookEventRepository.findOne.mockResolvedValue(receivedEvent);
      webhookEventRepository.save.mockImplementation(
        async (entity) => entity as WebhookEvent,
      );

      const result = await service.retryEvent(mockEventId);

      expect(result.status).toBe(WebhookEventStatus.RECEIVED);
    });

    it('should update maxAttempts when provided', async () => {
      const failedEvent = createMockWebhookEvent({
        status: WebhookEventStatus.FAILED,
        maxAttempts: 3,
      });
      webhookEventRepository.findOne.mockResolvedValue(failedEvent);
      webhookEventRepository.save.mockImplementation(
        async (entity) => entity as WebhookEvent,
      );

      const result = await service.retryEvent(mockEventId, 5);

      expect(result.maxAttempts).toBe(5);
    });

    it('should not change maxAttempts when not provided', async () => {
      const failedEvent = createMockWebhookEvent({
        status: WebhookEventStatus.FAILED,
        maxAttempts: 3,
      });
      webhookEventRepository.findOne.mockResolvedValue(failedEvent);
      webhookEventRepository.save.mockImplementation(
        async (entity) => entity as WebhookEvent,
      );

      const result = await service.retryEvent(mockEventId);

      expect(result.maxAttempts).toBe(3);
    });

    it('should throw BadRequestException for processed events', async () => {
      const processedEvent = createMockWebhookEvent({
        status: WebhookEventStatus.PROCESSED,
      });
      webhookEventRepository.findOne.mockResolvedValue(processedEvent);

      await expect(service.retryEvent(mockEventId)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.retryEvent(mockEventId)).rejects.toThrow(
        "No se puede reintentar un evento con estado 'processed'",
      );
    });

    it('should throw BadRequestException for processing events', async () => {
      const processingEvent = createMockWebhookEvent({
        status: WebhookEventStatus.PROCESSING,
      });
      webhookEventRepository.findOne.mockResolvedValue(processingEvent);

      await expect(service.retryEvent(mockEventId)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException for skipped events', async () => {
      const skippedEvent = createMockWebhookEvent({
        status: WebhookEventStatus.SKIPPED,
      });
      webhookEventRepository.findOne.mockResolvedValue(skippedEvent);

      await expect(service.retryEvent(mockEventId)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw NotFoundException when event does not exist', async () => {
      webhookEventRepository.findOne.mockResolvedValue(null);

      await expect(service.retryEvent('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ================================================================
  // GET EVENTS (LIST)
  // ================================================================

  describe('getEvents', () => {
    it('should return paginated events with default params', async () => {
      const events = [createMockWebhookEvent()];
      const mockQb = createMockQueryBuilder({
        getManyAndCount: jest.fn().mockResolvedValue([events, 1]),
      });
      webhookEventRepository.createQueryBuilder.mockReturnValue(mockQb as any);

      const result = await service.getEvents({});

      expect(result.data).toEqual(events);
      expect(result.pagination).toEqual({
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
      });
      expect(mockQb.orderBy).toHaveBeenCalledWith(
        'webhook.createdAt',
        'DESC',
      );
      expect(mockQb.skip).toHaveBeenCalledWith(0);
      expect(mockQb.take).toHaveBeenCalledWith(20);
    });

    it('should apply source filter', async () => {
      const mockQb = createMockQueryBuilder({
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      });
      webhookEventRepository.createQueryBuilder.mockReturnValue(mockQb as any);

      await service.getEvents({ source: WebhookSource.STRIPE });

      expect(mockQb.andWhere).toHaveBeenCalledWith(
        'webhook.source = :source',
        { source: WebhookSource.STRIPE },
      );
    });

    it('should apply status filter', async () => {
      const mockQb = createMockQueryBuilder({
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      });
      webhookEventRepository.createQueryBuilder.mockReturnValue(mockQb as any);

      await service.getEvents({ status: WebhookEventStatus.FAILED });

      expect(mockQb.andWhere).toHaveBeenCalledWith(
        'webhook.status = :status',
        { status: WebhookEventStatus.FAILED },
      );
    });

    it('should apply eventType filter', async () => {
      const mockQb = createMockQueryBuilder({
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      });
      webhookEventRepository.createQueryBuilder.mockReturnValue(mockQb as any);

      await service.getEvents({ eventType: 'payment_intent.succeeded' });

      expect(mockQb.andWhere).toHaveBeenCalledWith(
        'webhook.eventType = :eventType',
        { eventType: 'payment_intent.succeeded' },
      );
    });

    it('should apply externalEventId filter', async () => {
      const mockQb = createMockQueryBuilder({
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      });
      webhookEventRepository.createQueryBuilder.mockReturnValue(mockQb as any);

      await service.getEvents({ externalEventId: 'evt_123' });

      expect(mockQb.andWhere).toHaveBeenCalledWith(
        'webhook.externalEventId = :externalEventId',
        { externalEventId: 'evt_123' },
      );
    });

    it('should apply dateFrom filter', async () => {
      const mockQb = createMockQueryBuilder({
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      });
      webhookEventRepository.createQueryBuilder.mockReturnValue(mockQb as any);

      await service.getEvents({ dateFrom: '2026-01-01T00:00:00.000Z' });

      expect(mockQb.andWhere).toHaveBeenCalledWith(
        'webhook.createdAt >= :dateFrom',
        { dateFrom: '2026-01-01T00:00:00.000Z' },
      );
    });

    it('should apply dateTo filter', async () => {
      const mockQb = createMockQueryBuilder({
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      });
      webhookEventRepository.createQueryBuilder.mockReturnValue(mockQb as any);

      await service.getEvents({ dateTo: '2026-12-31T23:59:59.999Z' });

      expect(mockQb.andWhere).toHaveBeenCalledWith(
        'webhook.createdAt <= :dateTo',
        { dateTo: '2026-12-31T23:59:59.999Z' },
      );
    });

    it('should handle pagination correctly', async () => {
      const mockQb = createMockQueryBuilder({
        getManyAndCount: jest.fn().mockResolvedValue([[], 100]),
      });
      webhookEventRepository.createQueryBuilder.mockReturnValue(mockQb as any);

      const result = await service.getEvents({ page: 5, limit: 10 });

      expect(mockQb.skip).toHaveBeenCalledWith(40); // (5-1) * 10
      expect(mockQb.take).toHaveBeenCalledWith(10);
      expect(result.pagination).toEqual({
        total: 100,
        page: 5,
        limit: 10,
        totalPages: 10,
      });
    });

    it('should combine multiple filters', async () => {
      const mockQb = createMockQueryBuilder({
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      });
      webhookEventRepository.createQueryBuilder.mockReturnValue(mockQb as any);

      await service.getEvents({
        source: WebhookSource.PAYPAL,
        status: WebhookEventStatus.PROCESSED,
        eventType: 'PAYMENT.CAPTURE.COMPLETED',
        dateFrom: '2026-01-01',
        dateTo: '2026-12-31',
        page: 2,
        limit: 5,
      });

      expect(mockQb.andWhere).toHaveBeenCalledTimes(5);
    });
  });

  // ================================================================
  // GET EVENT BY ID
  // ================================================================

  describe('getEventById', () => {
    it('should return event when found', async () => {
      const event = createMockWebhookEvent();
      webhookEventRepository.findOne.mockResolvedValue(event);

      const result = await service.getEventById(mockEventId);

      expect(result).toEqual(event);
      expect(webhookEventRepository.findOne).toHaveBeenCalledWith({
        where: { id: mockEventId },
      });
    });

    it('should throw NotFoundException when not found', async () => {
      webhookEventRepository.findOne.mockResolvedValue(null);

      await expect(service.getEventById('non-existent')).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.getEventById('non-existent')).rejects.toThrow(
        "Evento de webhook con ID 'non-existent' no encontrado",
      );
    });
  });

  // ================================================================
  // STATS
  // ================================================================

  describe('getStats', () => {
    it('should return comprehensive webhook statistics', async () => {
      const statusCounts = [
        { status: WebhookEventStatus.PROCESSED, count: '50' },
        { status: WebhookEventStatus.FAILED, count: '10' },
        { status: WebhookEventStatus.SKIPPED, count: '5' },
        { status: WebhookEventStatus.RECEIVED, count: '3' },
      ];

      const sourceCounts = [
        { source: WebhookSource.STRIPE, count: '40' },
        { source: WebhookSource.PAYPAL, count: '28' },
      ];

      const typeCounts = [
        { eventType: 'payment_intent.succeeded', count: '30' },
        { eventType: 'customer.created', count: '10' },
      ];

      const last24hCounts = [
        { status: WebhookEventStatus.PROCESSED, count: '8' },
        { status: WebhookEventStatus.FAILED, count: '2' },
      ];

      const mockQb = createMockQueryBuilder({
        getRawMany: jest
          .fn()
          .mockResolvedValueOnce(statusCounts)
          .mockResolvedValueOnce(sourceCounts)
          .mockResolvedValueOnce(typeCounts)
          .mockResolvedValueOnce(last24hCounts),
        getRawOne: jest.fn().mockResolvedValue({ avg: '125.50' }),
      });

      webhookEventRepository.createQueryBuilder.mockReturnValue(
        mockQb as any,
      );
      webhookEventRepository.count.mockResolvedValue(3); // pendingRetry

      const result = await service.getStats();

      expect(result.total).toBe(68); // 50 + 10 + 5 + 3
      expect(result.processed).toBe(50);
      expect(result.failed).toBe(10);
      expect(result.skipped).toBe(5);
      expect(result.pendingRetry).toBe(3);
      expect(result.avgProcessingTimeMs).toBe(125.5);
      expect(result.bySource).toEqual({
        [WebhookSource.STRIPE]: 40,
        [WebhookSource.PAYPAL]: 28,
      });
      expect(result.byEventType).toEqual({
        'payment_intent.succeeded': 30,
        'customer.created': 10,
      });
      expect(result.last24h).toEqual({
        received: 10, // 8 + 2
        processed: 8,
        failed: 2,
      });
    });

    it('should handle empty statistics', async () => {
      const mockQb = createMockQueryBuilder({
        getRawMany: jest.fn().mockResolvedValue([]),
        getRawOne: jest.fn().mockResolvedValue(null),
      });

      webhookEventRepository.createQueryBuilder.mockReturnValue(
        mockQb as any,
      );
      webhookEventRepository.count.mockResolvedValue(0);

      const result = await service.getStats();

      expect(result.total).toBe(0);
      expect(result.processed).toBe(0);
      expect(result.failed).toBe(0);
      expect(result.skipped).toBe(0);
      expect(result.pendingRetry).toBe(0);
      expect(result.avgProcessingTimeMs).toBe(0);
      expect(result.bySource).toEqual({});
      expect(result.byEventType).toEqual({});
      expect(result.last24h).toEqual({
        received: 0,
        processed: 0,
        failed: 0,
      });
    });

    it('should handle null avg processing time', async () => {
      const mockQb = createMockQueryBuilder({
        getRawMany: jest.fn().mockResolvedValue([]),
        getRawOne: jest.fn().mockResolvedValue({ avg: null }),
      });

      webhookEventRepository.createQueryBuilder.mockReturnValue(
        mockQb as any,
      );
      webhookEventRepository.count.mockResolvedValue(0);

      const result = await service.getStats();

      expect(result.avgProcessingTimeMs).toBe(0);
    });
  });

  // ================================================================
  // CLEAN OLD EVENTS
  // ================================================================

  describe('cleanOldEvents', () => {
    it('should delete old processed and skipped events with default 90 days', async () => {
      const mockQb = createMockQueryBuilder({
        execute: jest.fn().mockResolvedValue({ affected: 25 }),
      });
      webhookEventRepository.createQueryBuilder.mockReturnValue(mockQb as any);

      const result = await service.cleanOldEvents();

      expect(result).toBe(25);
      expect(mockQb.delete).toHaveBeenCalled();
      expect(mockQb.from).toHaveBeenCalledWith(WebhookEvent);
      expect(mockQb.where).toHaveBeenCalledWith(
        'createdAt < :cutoffDate',
        expect.objectContaining({ cutoffDate: expect.any(Date) }),
      );
      expect(mockQb.andWhere).toHaveBeenCalledWith(
        'status IN (:...statuses)',
        {
          statuses: [
            WebhookEventStatus.PROCESSED,
            WebhookEventStatus.SKIPPED,
          ],
        },
      );
    });

    it('should use custom daysToKeep value', async () => {
      const mockQb = createMockQueryBuilder({
        execute: jest.fn().mockResolvedValue({ affected: 10 }),
      });
      webhookEventRepository.createQueryBuilder.mockReturnValue(mockQb as any);

      const result = await service.cleanOldEvents(30);

      expect(result).toBe(10);
      // Verify cutoff date is approximately 30 days ago
      const callArgs = (mockQb.where as jest.Mock).mock.calls[0];
      const cutoffDate = callArgs[1].cutoffDate as Date;
      const expectedCutoff = new Date();
      expectedCutoff.setDate(expectedCutoff.getDate() - 30);
      // Allow 5 seconds tolerance
      expect(
        Math.abs(cutoffDate.getTime() - expectedCutoff.getTime()),
      ).toBeLessThan(5000);
    });

    it('should return 0 when no events to clean', async () => {
      const mockQb = createMockQueryBuilder({
        execute: jest.fn().mockResolvedValue({ affected: 0 }),
      });
      webhookEventRepository.createQueryBuilder.mockReturnValue(mockQb as any);

      const result = await service.cleanOldEvents();

      expect(result).toBe(0);
    });

    it('should return 0 when affected is null', async () => {
      const mockQb = createMockQueryBuilder({
        execute: jest.fn().mockResolvedValue({ affected: null }),
      });
      webhookEventRepository.createQueryBuilder.mockReturnValue(mockQb as any);

      const result = await service.cleanOldEvents();

      expect(result).toBe(0);
    });
  });
});
