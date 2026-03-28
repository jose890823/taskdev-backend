import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  SecurityEventService,
  CreateSecurityEventDto,
} from './security-event.service';
import {
  SecurityEvent,
  SecurityEventType,
  SecurityEventSeverity,
} from '../entities/security-event.entity';
import { SecurityEventFilterDto } from '../dto/security-event-filter.dto';
import { Request } from 'express';

describe('SecurityEventService', () => {
  let service: SecurityEventService;
  let securityEventRepository: jest.Mocked<Repository<SecurityEvent>>;

  const mockUserId = '123e4567-e89b-12d3-a456-426614174000';
  const mockReviewerId = 'b2c3d4e5-f6a7-8901-bcde-f12345678901';
  const mockIp = '192.168.1.100';

  const mockSecurityEvent: SecurityEvent = {
    id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    eventType: SecurityEventType.LOGIN_FAILED,
    severity: SecurityEventSeverity.MEDIUM,
    ipAddress: mockIp,
    userAgent: 'Mozilla/5.0',
    userId: mockUserId,
    user: null,
    email: 'test@example.com',
    endpoint: '/api/auth/login',
    method: 'POST',
    description: 'Login fallido',
    metadata: null,
    country: null,
    city: null,
    reviewed: false,
    reviewedById: null,
    reviewedBy: null,
    reviewedAt: null,
    notes: null,
    createdAt: new Date('2026-03-28T10:00:00Z'),
  } as SecurityEvent;

  const mockQueryBuilder = {
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn(),
  };

  beforeEach(async () => {
    const mockSecurityEventRepository = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      find: jest.fn(),
      count: jest.fn(),
      createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SecurityEventService,
        {
          provide: getRepositoryToken(SecurityEvent),
          useValue: mockSecurityEventRepository,
        },
      ],
    }).compile();

    service = module.get<SecurityEventService>(SecurityEventService);
    securityEventRepository = module.get(getRepositoryToken(SecurityEvent));
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  describe('create', () => {
    const createDto: CreateSecurityEventDto = {
      eventType: SecurityEventType.LOGIN_FAILED,
      severity: SecurityEventSeverity.MEDIUM,
      ipAddress: mockIp,
      userAgent: 'Mozilla/5.0',
      userId: mockUserId,
      email: 'test@example.com',
      endpoint: '/api/auth/login',
      method: 'POST',
      description: 'Login fallido',
    };

    it('debe crear un evento de seguridad correctamente', async () => {
      securityEventRepository.create.mockReturnValue(mockSecurityEvent);
      securityEventRepository.save.mockResolvedValue(mockSecurityEvent);

      const result = await service.create(createDto);

      expect(securityEventRepository.create).toHaveBeenCalledWith(createDto);
      expect(securityEventRepository.save).toHaveBeenCalledWith(
        mockSecurityEvent,
      );
      expect(result).toEqual(mockSecurityEvent);
    });

    it('debe crear evento con severidad CRITICAL sin errores', async () => {
      const criticalDto: CreateSecurityEventDto = {
        ...createDto,
        severity: SecurityEventSeverity.CRITICAL,
      };
      const criticalEvent = {
        ...mockSecurityEvent,
        severity: SecurityEventSeverity.CRITICAL,
      };
      securityEventRepository.create.mockReturnValue(criticalEvent as any);
      securityEventRepository.save.mockResolvedValue(criticalEvent as any);

      const result = await service.create(criticalDto);

      expect(result.severity).toBe(SecurityEventSeverity.CRITICAL);
    });

    it('debe crear evento con severidad HIGH sin errores', async () => {
      const highDto: CreateSecurityEventDto = {
        ...createDto,
        severity: SecurityEventSeverity.HIGH,
      };
      const highEvent = {
        ...mockSecurityEvent,
        severity: SecurityEventSeverity.HIGH,
      };
      securityEventRepository.create.mockReturnValue(highEvent as any);
      securityEventRepository.save.mockResolvedValue(highEvent as any);

      const result = await service.create(highDto);

      expect(result.severity).toBe(SecurityEventSeverity.HIGH);
    });

    it('debe aceptar metadata en el DTO', async () => {
      const dtoWithMeta: CreateSecurityEventDto = {
        ...createDto,
        metadata: { failedAttempts: 5, threshold: 10 },
      };
      securityEventRepository.create.mockReturnValue(mockSecurityEvent);
      securityEventRepository.save.mockResolvedValue(mockSecurityEvent);

      await service.create(dtoWithMeta);

      expect(securityEventRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: { failedAttempts: 5, threshold: 10 },
        }),
      );
    });

    it('debe aceptar campos opcionales nulos', async () => {
      const minimalDto: CreateSecurityEventDto = {
        eventType: SecurityEventType.RATE_LIMIT_EXCEEDED,
        severity: SecurityEventSeverity.LOW,
        ipAddress: mockIp,
        endpoint: '/api/users',
        method: 'GET',
        description: 'Rate limit excedido',
      };
      securityEventRepository.create.mockReturnValue(mockSecurityEvent);
      securityEventRepository.save.mockResolvedValue(mockSecurityEvent);

      await service.create(minimalDto);

      expect(securityEventRepository.create).toHaveBeenCalledWith(minimalDto);
    });
  });

  describe('logFromRequest', () => {
    it('debe extraer IP y userAgent del request y crear evento', async () => {
      const mockRequest = {
        headers: {
          'x-forwarded-for': '10.0.0.1, 172.16.0.1',
          'user-agent': 'TestBrowser/1.0',
        },
        originalUrl: '/api/auth/login',
        url: '/api/auth/login',
        method: 'POST',
        ip: '127.0.0.1',
        socket: { remoteAddress: '127.0.0.1' },
      } as unknown as Request;

      securityEventRepository.create.mockReturnValue(mockSecurityEvent);
      securityEventRepository.save.mockResolvedValue(mockSecurityEvent);

      await service.logFromRequest(
        mockRequest,
        SecurityEventType.LOGIN_FAILED,
        SecurityEventSeverity.MEDIUM,
        'Login fallido',
        { userId: mockUserId, email: 'test@example.com' },
      );

      expect(securityEventRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          ipAddress: '10.0.0.1',
          userAgent: 'TestBrowser/1.0',
          eventType: SecurityEventType.LOGIN_FAILED,
          severity: SecurityEventSeverity.MEDIUM,
          endpoint: '/api/auth/login',
          method: 'POST',
          userId: mockUserId,
          email: 'test@example.com',
        }),
      );
    });

    it('debe usar x-real-ip como fallback', async () => {
      const mockRequest = {
        headers: {
          'x-real-ip': '10.0.0.2',
          'user-agent': 'TestBrowser/1.0',
        },
        originalUrl: '/api/test',
        method: 'GET',
        ip: '127.0.0.1',
        socket: { remoteAddress: '127.0.0.1' },
      } as unknown as Request;

      securityEventRepository.create.mockReturnValue(mockSecurityEvent);
      securityEventRepository.save.mockResolvedValue(mockSecurityEvent);

      await service.logFromRequest(
        mockRequest,
        SecurityEventType.SUSPICIOUS_ACTIVITY,
        SecurityEventSeverity.HIGH,
        'Actividad sospechosa',
      );

      expect(securityEventRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ ipAddress: '10.0.0.2' }),
      );
    });

    it('debe usar request.ip como ultimo fallback', async () => {
      const mockRequest = {
        headers: {},
        originalUrl: '/api/test',
        method: 'GET',
        ip: '192.168.1.50',
        socket: { remoteAddress: '192.168.1.50' },
      } as unknown as Request;

      securityEventRepository.create.mockReturnValue(mockSecurityEvent);
      securityEventRepository.save.mockResolvedValue(mockSecurityEvent);

      await service.logFromRequest(
        mockRequest,
        SecurityEventType.UNAUTHORIZED_ACCESS,
        SecurityEventSeverity.LOW,
        'Test',
      );

      expect(securityEventRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ ipAddress: '192.168.1.50' }),
      );
    });

    it('debe usar null para user-agent ausente', async () => {
      const mockRequest = {
        headers: {},
        originalUrl: '/api/test',
        method: 'GET',
        ip: '127.0.0.1',
        socket: { remoteAddress: '127.0.0.1' },
      } as unknown as Request;

      securityEventRepository.create.mockReturnValue(mockSecurityEvent);
      securityEventRepository.save.mockResolvedValue(mockSecurityEvent);

      await service.logFromRequest(
        mockRequest,
        SecurityEventType.RATE_LIMIT_EXCEEDED,
        SecurityEventSeverity.LOW,
        'Test',
      );

      expect(securityEventRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ userAgent: null }),
      );
    });

    it('debe pasar metadata opcional', async () => {
      const mockRequest = {
        headers: { 'user-agent': 'Test' },
        originalUrl: '/api/test',
        method: 'GET',
        ip: '127.0.0.1',
        socket: { remoteAddress: '127.0.0.1' },
      } as unknown as Request;

      securityEventRepository.create.mockReturnValue(mockSecurityEvent);
      securityEventRepository.save.mockResolvedValue(mockSecurityEvent);

      await service.logFromRequest(
        mockRequest,
        SecurityEventType.ADMIN_ACTION,
        SecurityEventSeverity.LOW,
        'Admin action',
        { metadata: { action: 'delete_user' } },
      );

      expect(securityEventRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: { action: 'delete_user' },
        }),
      );
    });
  });

  describe('findAll', () => {
    it('debe retornar eventos con paginacion por defecto', async () => {
      mockQueryBuilder.getManyAndCount.mockResolvedValue([
        [mockSecurityEvent],
        1,
      ]);

      const filter: SecurityEventFilterDto = {};
      const result = await service.findAll(filter);

      expect(result.data).toEqual([mockSecurityEvent]);
      expect(result.pagination).toEqual({
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
      });
    });

    it('debe aplicar filtro por eventType', async () => {
      mockQueryBuilder.getManyAndCount.mockResolvedValue([[], 0]);

      await service.findAll({
        eventType: SecurityEventType.LOGIN_FAILED,
      });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'event.eventType = :eventType',
        { eventType: SecurityEventType.LOGIN_FAILED },
      );
    });

    it('debe aplicar filtro por severity', async () => {
      mockQueryBuilder.getManyAndCount.mockResolvedValue([[], 0]);

      await service.findAll({
        severity: SecurityEventSeverity.HIGH,
      });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'event.severity = :severity',
        { severity: SecurityEventSeverity.HIGH },
      );
    });

    it('debe aplicar filtro por ipAddress', async () => {
      mockQueryBuilder.getManyAndCount.mockResolvedValue([[], 0]);

      await service.findAll({ ipAddress: mockIp });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'event.ipAddress = :ipAddress',
        { ipAddress: mockIp },
      );
    });

    it('debe aplicar filtro por reviewed', async () => {
      mockQueryBuilder.getManyAndCount.mockResolvedValue([[], 0]);

      await service.findAll({ reviewed: false });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'event.reviewed = :reviewed',
        { reviewed: false },
      );
    });

    it('debe aplicar filtro por rango de fechas', async () => {
      mockQueryBuilder.getManyAndCount.mockResolvedValue([[], 0]);

      await service.findAll({
        fromDate: '2026-01-01',
        toDate: '2026-12-31',
      });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'event.createdAt >= :fromDate',
        { fromDate: expect.any(Date) },
      );
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'event.createdAt <= :toDate',
        { toDate: expect.any(Date) },
      );
    });

    it('debe aplicar paginacion personalizada', async () => {
      mockQueryBuilder.getManyAndCount.mockResolvedValue([[], 50]);

      const result = await service.findAll({ page: 3, limit: 10 });

      expect(mockQueryBuilder.skip).toHaveBeenCalledWith(20);
      expect(mockQueryBuilder.take).toHaveBeenCalledWith(10);
      expect(result.pagination.totalPages).toBe(5);
    });

    it('debe aplicar ordenamiento personalizado', async () => {
      mockQueryBuilder.getManyAndCount.mockResolvedValue([[], 0]);

      await service.findAll({ sortBy: 'severity', sortOrder: 'ASC' });

      expect(mockQueryBuilder.orderBy).toHaveBeenCalledWith(
        'event.severity',
        'ASC',
      );
    });

    it('debe incluir relacion con user', async () => {
      mockQueryBuilder.getManyAndCount.mockResolvedValue([[], 0]);

      await service.findAll({});

      expect(mockQueryBuilder.leftJoinAndSelect).toHaveBeenCalledWith(
        'event.user',
        'user',
      );
    });
  });

  describe('findById', () => {
    it('debe retornar un evento por ID con relaciones', async () => {
      securityEventRepository.findOne.mockResolvedValue(mockSecurityEvent);

      const result = await service.findById(mockSecurityEvent.id);

      expect(securityEventRepository.findOne).toHaveBeenCalledWith({
        where: { id: mockSecurityEvent.id },
        relations: ['user', 'reviewedBy'],
      });
      expect(result).toEqual(mockSecurityEvent);
    });

    it('debe retornar null si el evento no existe', async () => {
      securityEventRepository.findOne.mockResolvedValue(null);

      const result = await service.findById('non-existent-id');

      expect(result).toBeNull();
    });
  });

  describe('markAsReviewed', () => {
    it('debe marcar un evento como revisado', async () => {
      securityEventRepository.findOne.mockResolvedValue({
        ...mockSecurityEvent,
      });
      securityEventRepository.save.mockResolvedValue({
        ...mockSecurityEvent,
        reviewed: true,
        reviewedById: mockReviewerId,
        reviewedAt: expect.any(Date),
      } as any);

      const result = await service.markAsReviewed(
        mockSecurityEvent.id,
        mockReviewerId,
        'Evento revisado y verificado',
      );

      expect(securityEventRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          reviewed: true,
          reviewedById: mockReviewerId,
          notes: 'Evento revisado y verificado',
        }),
      );
      expect(result).toBeDefined();
    });

    it('debe retornar null si el evento no existe', async () => {
      securityEventRepository.findOne.mockResolvedValue(null);

      const result = await service.markAsReviewed(
        'non-existent',
        mockReviewerId,
      );

      expect(result).toBeNull();
    });

    it('debe aceptar notes undefined y asignar null', async () => {
      securityEventRepository.findOne.mockResolvedValue({
        ...mockSecurityEvent,
      });
      securityEventRepository.save.mockResolvedValue(mockSecurityEvent);

      await service.markAsReviewed(mockSecurityEvent.id, mockReviewerId);

      expect(securityEventRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ notes: null }),
      );
    });

    it('debe establecer reviewedAt con la fecha actual', async () => {
      const now = new Date();
      jest.useFakeTimers().setSystemTime(now);

      securityEventRepository.findOne.mockResolvedValue({
        ...mockSecurityEvent,
      });
      securityEventRepository.save.mockImplementation(
        async (entity) => entity as any,
      );

      const result = await service.markAsReviewed(
        mockSecurityEvent.id,
        mockReviewerId,
      );

      expect(result!.reviewedAt).toEqual(now);

      jest.useRealTimers();
    });
  });

  describe('countByTypeInPeriod', () => {
    it('debe contar eventos por tipo y periodo', async () => {
      securityEventRepository.count.mockResolvedValue(15);

      const fromDate = new Date('2026-01-01');
      const toDate = new Date('2026-03-28');
      const result = await service.countByTypeInPeriod(
        SecurityEventType.LOGIN_FAILED,
        fromDate,
        toDate,
      );

      expect(securityEventRepository.count).toHaveBeenCalledWith({
        where: {
          eventType: SecurityEventType.LOGIN_FAILED,
          createdAt: expect.anything(),
        },
      });
      expect(result).toBe(15);
    });

    it('debe retornar 0 si no hay eventos en el periodo', async () => {
      securityEventRepository.count.mockResolvedValue(0);

      const result = await service.countByTypeInPeriod(
        SecurityEventType.BOT_DETECTED,
        new Date(),
        new Date(),
      );

      expect(result).toBe(0);
    });
  });

  describe('countByIpInPeriod', () => {
    it('debe contar eventos por IP y periodo', async () => {
      securityEventRepository.count.mockResolvedValue(25);

      const fromDate = new Date('2026-01-01');
      const toDate = new Date('2026-03-28');
      const result = await service.countByIpInPeriod(mockIp, fromDate, toDate);

      expect(securityEventRepository.count).toHaveBeenCalledWith({
        where: {
          ipAddress: mockIp,
          createdAt: expect.anything(),
        },
      });
      expect(result).toBe(25);
    });
  });

  describe('getStats', () => {
    it('debe retornar estadisticas de eventos (7 dias por defecto)', async () => {
      const events = [
        {
          ...mockSecurityEvent,
          eventType: SecurityEventType.LOGIN_FAILED,
          severity: SecurityEventSeverity.MEDIUM,
          ipAddress: '10.0.0.1',
          reviewed: false,
        },
        {
          ...mockSecurityEvent,
          id: 'event-2',
          eventType: SecurityEventType.LOGIN_SUCCESS,
          severity: SecurityEventSeverity.LOW,
          ipAddress: '10.0.0.1',
          reviewed: true,
        },
        {
          ...mockSecurityEvent,
          id: 'event-3',
          eventType: SecurityEventType.LOGIN_FAILED,
          severity: SecurityEventSeverity.HIGH,
          ipAddress: '10.0.0.2',
          reviewed: false,
        },
      ];
      securityEventRepository.find.mockResolvedValue(events as any);

      const result = await service.getStats();

      expect(result.total).toBe(3);
      expect(result.byType[SecurityEventType.LOGIN_FAILED]).toBe(2);
      expect(result.byType[SecurityEventType.LOGIN_SUCCESS]).toBe(1);
      expect(result.bySeverity[SecurityEventSeverity.MEDIUM]).toBe(1);
      expect(result.bySeverity[SecurityEventSeverity.LOW]).toBe(1);
      expect(result.bySeverity[SecurityEventSeverity.HIGH]).toBe(1);
      expect(result.unreviewed).toBe(2);
      expect(result.topIps[0]).toEqual({ ip: '10.0.0.1', count: 2 });
    });

    it('debe aceptar parametro de dias personalizado', async () => {
      securityEventRepository.find.mockResolvedValue([]);

      await service.getStats(30);

      expect(securityEventRepository.find).toHaveBeenCalledWith({
        where: { createdAt: expect.anything() },
      });
    });

    it('debe retornar estadisticas vacias cuando no hay eventos', async () => {
      securityEventRepository.find.mockResolvedValue([]);

      const result = await service.getStats();

      expect(result).toEqual({
        total: 0,
        byType: {},
        bySeverity: {},
        unreviewed: 0,
        topIps: [],
      });
    });

    it('debe limitar topIps a 10 entradas', async () => {
      const events = Array.from({ length: 15 }, (_, i) => ({
        ...mockSecurityEvent,
        id: `event-${i}`,
        ipAddress: `10.0.0.${i}`,
        reviewed: false,
      }));
      securityEventRepository.find.mockResolvedValue(events as any);

      const result = await service.getStats();

      expect(result.topIps.length).toBeLessThanOrEqual(10);
    });

    it('debe ordenar topIps por count descendente', async () => {
      const events = [
        { ...mockSecurityEvent, ipAddress: '10.0.0.1', reviewed: false },
        { ...mockSecurityEvent, ipAddress: '10.0.0.1', reviewed: false },
        { ...mockSecurityEvent, ipAddress: '10.0.0.1', reviewed: false },
        { ...mockSecurityEvent, ipAddress: '10.0.0.2', reviewed: false },
      ];
      securityEventRepository.find.mockResolvedValue(events as any);

      const result = await service.getStats();

      expect(result.topIps[0]).toEqual({ ip: '10.0.0.1', count: 3 });
      expect(result.topIps[1]).toEqual({ ip: '10.0.0.2', count: 1 });
    });
  });
});
