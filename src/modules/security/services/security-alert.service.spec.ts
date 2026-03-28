import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SecurityAlertService } from './security-alert.service';
import {
  SecurityAlert,
  SecurityAlertType,
  SecurityAlertSeverity,
  SecurityAlertStatus,
} from '../entities/security-alert.entity';

describe('SecurityAlertService', () => {
  let service: SecurityAlertService;
  let securityAlertRepository: jest.Mocked<Repository<SecurityAlert>>;

  const mockUserId = '123e4567-e89b-12d3-a456-426614174000';
  const mockAdminId = 'b2c3d4e5-f6a7-8901-bcde-f12345678901';
  const mockIp = '192.168.1.100';

  const mockAlert: SecurityAlert = {
    id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    alertType: SecurityAlertType.MULTIPLE_FAILED_LOGINS,
    severity: SecurityAlertSeverity.MEDIUM,
    title: 'Multiples intentos de login fallidos',
    description: 'Se detectaron 5 intentos fallidos desde 192.168.1.100',
    relatedUserId: null,
    relatedUser: null,
    relatedIpAddress: mockIp,
    relatedEventIds: null,
    status: SecurityAlertStatus.ACTIVE,
    assignedToId: null,
    assignedTo: null,
    resolvedAt: null,
    resolvedById: null,
    resolvedBy: null,
    resolution: null,
    metadata: { failedLoginCount: 5 },
    createdAt: new Date('2026-03-28T10:00:00Z'),
    updatedAt: new Date('2026-03-28T10:00:00Z'),
  } as unknown as SecurityAlert;

  const mockQueryBuilder = {
    andWhere: jest.fn().mockReturnThis(),
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn(),
    getMany: jest.fn(),
  };

  beforeEach(async () => {
    const mockSecurityAlertRepository = {
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
      createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SecurityAlertService,
        {
          provide: getRepositoryToken(SecurityAlert),
          useValue: mockSecurityAlertRepository,
        },
      ],
    }).compile();

    service = module.get<SecurityAlertService>(SecurityAlertService);
    securityAlertRepository = module.get(getRepositoryToken(SecurityAlert));
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  describe('create', () => {
    it('debe crear una nueva alerta de seguridad', async () => {
      securityAlertRepository.create.mockReturnValue(mockAlert as any);
      securityAlertRepository.save.mockResolvedValue(mockAlert as any);

      const result = await service.create({
        alertType: SecurityAlertType.MULTIPLE_FAILED_LOGINS,
        severity: SecurityAlertSeverity.MEDIUM,
        title: 'Multiples intentos de login fallidos',
        description: 'Se detectaron 5 intentos fallidos',
        relatedIpAddress: mockIp,
        metadata: { failedLoginCount: 5 },
      });

      expect(securityAlertRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          alertType: SecurityAlertType.MULTIPLE_FAILED_LOGINS,
          status: SecurityAlertStatus.ACTIVE,
        }),
      );
      expect(result).toEqual(mockAlert);
    });

    it('debe crear alerta CRITICAL sin errores', async () => {
      const criticalAlert = {
        ...mockAlert,
        severity: SecurityAlertSeverity.CRITICAL,
      };
      securityAlertRepository.create.mockReturnValue(criticalAlert as any);
      securityAlertRepository.save.mockResolvedValue(criticalAlert as any);

      const result = await service.create({
        alertType: SecurityAlertType.BRUTE_FORCE_ATTACK,
        severity: SecurityAlertSeverity.CRITICAL,
        title: 'Ataque de fuerza bruta',
        description: 'Posible ataque desde 192.168.1.100',
      });

      expect(result.severity).toBe(SecurityAlertSeverity.CRITICAL);
    });

    it('debe crear alerta HIGH sin errores', async () => {
      const highAlert = {
        ...mockAlert,
        severity: SecurityAlertSeverity.HIGH,
      };
      securityAlertRepository.create.mockReturnValue(highAlert as any);
      securityAlertRepository.save.mockResolvedValue(highAlert as any);

      const result = await service.create({
        alertType: SecurityAlertType.ACCOUNT_TAKEOVER_ATTEMPT,
        severity: SecurityAlertSeverity.HIGH,
        title: 'Intento de account takeover',
        description: 'Actividad sospechosa detectada',
      });

      expect(result.severity).toBe(SecurityAlertSeverity.HIGH);
    });

    it('debe crear alerta LOW sin errores', async () => {
      const lowAlert = {
        ...mockAlert,
        severity: SecurityAlertSeverity.LOW,
      };
      securityAlertRepository.create.mockReturnValue(lowAlert as any);
      securityAlertRepository.save.mockResolvedValue(lowAlert as any);

      const result = await service.create({
        alertType: SecurityAlertType.UNUSUAL_TRAFFIC,
        severity: SecurityAlertSeverity.LOW,
        title: 'Trafico inusual',
        description: 'Patron de trafico inusual detectado',
      });

      expect(result.severity).toBe(SecurityAlertSeverity.LOW);
    });

    it('debe aceptar campos opcionales', async () => {
      securityAlertRepository.create.mockReturnValue(mockAlert as any);
      securityAlertRepository.save.mockResolvedValue(mockAlert as any);

      await service.create({
        alertType: SecurityAlertType.SUSPICIOUS_IP_PATTERN,
        severity: SecurityAlertSeverity.MEDIUM,
        title: 'Test',
        description: 'Test alert',
        relatedUserId: mockUserId,
        relatedIpAddress: mockIp,
        relatedEventIds: ['event-1', 'event-2'],
        metadata: { key: 'value' },
      });

      expect(securityAlertRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          relatedUserId: mockUserId,
          relatedIpAddress: mockIp,
          relatedEventIds: ['event-1', 'event-2'],
          metadata: { key: 'value' },
        }),
      );
    });
  });

  describe('findActive', () => {
    it('debe retornar alertas activas e investigando', async () => {
      securityAlertRepository.find.mockResolvedValue([mockAlert as any]);

      const result = await service.findActive();

      expect(securityAlertRepository.find).toHaveBeenCalledWith({
        where: {
          status: expect.anything(), // In([ACTIVE, INVESTIGATING])
        },
        relations: ['relatedUser', 'assignedTo'],
        order: {
          severity: 'ASC',
          createdAt: 'DESC',
        },
      });
      expect(result).toEqual([mockAlert]);
    });

    it('debe retornar array vacio si no hay alertas activas', async () => {
      securityAlertRepository.find.mockResolvedValue([]);

      const result = await service.findActive();

      expect(result).toEqual([]);
    });
  });

  describe('findById', () => {
    it('debe retornar alerta por ID con relaciones', async () => {
      securityAlertRepository.findOne.mockResolvedValue(mockAlert as any);

      const result = await service.findById(mockAlert.id);

      expect(securityAlertRepository.findOne).toHaveBeenCalledWith({
        where: { id: mockAlert.id },
        relations: ['relatedUser', 'assignedTo', 'resolvedBy'],
      });
      expect(result).toEqual(mockAlert);
    });

    it('debe retornar null si la alerta no existe', async () => {
      securityAlertRepository.findOne.mockResolvedValue(null);

      const result = await service.findById('non-existent-id');

      expect(result).toBeNull();
    });
  });

  describe('findAll', () => {
    it('debe retornar alertas con paginacion', async () => {
      mockQueryBuilder.getManyAndCount.mockResolvedValue([[mockAlert], 1]);

      const result = await service.findAll();

      expect(result.data).toEqual([mockAlert]);
      expect(result.pagination.total).toBe(1);
    });

    it('debe aplicar filtro por status', async () => {
      mockQueryBuilder.getManyAndCount.mockResolvedValue([[], 0]);

      await service.findAll({
        status: SecurityAlertStatus.ACTIVE,
      });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'alert.status = :status',
        { status: SecurityAlertStatus.ACTIVE },
      );
    });

    it('debe aplicar filtro por severity', async () => {
      mockQueryBuilder.getManyAndCount.mockResolvedValue([[], 0]);

      await service.findAll({
        severity: SecurityAlertSeverity.HIGH,
      });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'alert.severity = :severity',
        { severity: SecurityAlertSeverity.HIGH },
      );
    });

    it('debe aplicar filtro por alertType', async () => {
      mockQueryBuilder.getManyAndCount.mockResolvedValue([[], 0]);

      await service.findAll({
        alertType: SecurityAlertType.BRUTE_FORCE_ATTACK,
      });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'alert.alertType = :alertType',
        { alertType: SecurityAlertType.BRUTE_FORCE_ATTACK },
      );
    });

    it('debe aplicar limit y offset', async () => {
      mockQueryBuilder.getManyAndCount.mockResolvedValue([[], 0]);

      await service.findAll({ limit: 10, offset: 20 });

      expect(mockQueryBuilder.take).toHaveBeenCalledWith(10);
      expect(mockQueryBuilder.skip).toHaveBeenCalledWith(20);
    });

    it('debe incluir relaciones', async () => {
      mockQueryBuilder.getManyAndCount.mockResolvedValue([[], 0]);

      await service.findAll();

      expect(mockQueryBuilder.leftJoinAndSelect).toHaveBeenCalledWith(
        'alert.relatedUser',
        'relatedUser',
      );
      expect(mockQueryBuilder.leftJoinAndSelect).toHaveBeenCalledWith(
        'alert.assignedTo',
        'assignedTo',
      );
    });

    it('debe retornar datos vacios cuando no hay alertas', async () => {
      mockQueryBuilder.getManyAndCount.mockResolvedValue([[], 0]);

      const result = await service.findAll();

      expect(result.data).toEqual([]);
      expect(result.pagination.total).toBe(0);
    });
  });

  describe('updateStatus', () => {
    it('debe actualizar el estado de una alerta a INVESTIGATING', async () => {
      securityAlertRepository.findOne.mockResolvedValue({
        ...mockAlert,
      } as any);
      securityAlertRepository.save.mockImplementation(
        async (entity) => entity as any,
      );

      const result = await service.updateStatus(
        mockAlert.id,
        SecurityAlertStatus.INVESTIGATING,
        mockAdminId,
      );

      expect(result!.status).toBe(SecurityAlertStatus.INVESTIGATING);
    });

    it('debe establecer resolucion cuando el estado es RESOLVED', async () => {
      securityAlertRepository.findOne.mockResolvedValue({
        ...mockAlert,
      } as any);
      securityAlertRepository.save.mockImplementation(
        async (entity) => entity as any,
      );

      const result = await service.updateStatus(
        mockAlert.id,
        SecurityAlertStatus.RESOLVED,
        mockAdminId,
        'Falso positivo verificado',
      );

      expect(result!.status).toBe(SecurityAlertStatus.RESOLVED);
      expect(result!.resolvedAt).toBeInstanceOf(Date);
      expect(result!.resolvedById).toBe(mockAdminId);
      expect(result!.resolution).toBe('Falso positivo verificado');
    });

    it('debe establecer resolucion cuando el estado es DISMISSED', async () => {
      securityAlertRepository.findOne.mockResolvedValue({
        ...mockAlert,
      } as any);
      securityAlertRepository.save.mockImplementation(
        async (entity) => entity as any,
      );

      const result = await service.updateStatus(
        mockAlert.id,
        SecurityAlertStatus.DISMISSED,
        mockAdminId,
      );

      expect(result!.status).toBe(SecurityAlertStatus.DISMISSED);
      expect(result!.resolvedAt).toBeInstanceOf(Date);
      expect(result!.resolvedById).toBe(mockAdminId);
      expect(result!.resolution).toBeNull();
    });

    it('debe retornar null si la alerta no existe', async () => {
      securityAlertRepository.findOne.mockResolvedValue(null);

      const result = await service.updateStatus(
        'non-existent',
        SecurityAlertStatus.RESOLVED,
        mockAdminId,
      );

      expect(result).toBeNull();
    });

    it('no debe establecer resolucion para estados no terminales', async () => {
      securityAlertRepository.findOne.mockResolvedValue({
        ...mockAlert,
        resolvedAt: null,
        resolvedById: null,
        resolution: null,
      } as any);
      securityAlertRepository.save.mockImplementation(
        async (entity) => entity as any,
      );

      const result = await service.updateStatus(
        mockAlert.id,
        SecurityAlertStatus.INVESTIGATING,
        mockAdminId,
      );

      expect(result!.resolvedAt).toBeNull();
      expect(result!.resolvedById).toBeNull();
    });
  });

  describe('assign', () => {
    it('debe asignar una alerta a un admin', async () => {
      securityAlertRepository.findOne.mockResolvedValue({
        ...mockAlert,
      } as any);
      securityAlertRepository.save.mockImplementation(
        async (entity) => entity as any,
      );

      const result = await service.assign(mockAlert.id, mockAdminId);

      expect(result!.assignedToId).toBe(mockAdminId);
      expect(result!.status).toBe(SecurityAlertStatus.INVESTIGATING);
    });

    it('debe retornar null si la alerta no existe', async () => {
      securityAlertRepository.findOne.mockResolvedValue(null);

      const result = await service.assign('non-existent', mockAdminId);

      expect(result).toBeNull();
    });

    it('debe cambiar el estado automaticamente a INVESTIGATING', async () => {
      securityAlertRepository.findOne.mockResolvedValue({
        ...mockAlert,
        status: SecurityAlertStatus.ACTIVE,
      } as any);
      securityAlertRepository.save.mockImplementation(
        async (entity) => entity as any,
      );

      const result = await service.assign(mockAlert.id, mockAdminId);

      expect(result!.status).toBe(SecurityAlertStatus.INVESTIGATING);
    });
  });

  describe('countActiveBySeverity', () => {
    it('debe contar alertas activas por severidad', async () => {
      const alerts = [
        { ...mockAlert, severity: SecurityAlertSeverity.CRITICAL },
        { ...mockAlert, severity: SecurityAlertSeverity.CRITICAL },
        { ...mockAlert, severity: SecurityAlertSeverity.HIGH },
        { ...mockAlert, severity: SecurityAlertSeverity.MEDIUM },
      ];
      securityAlertRepository.find.mockResolvedValue(alerts as any);

      const result = await service.countActiveBySeverity();

      expect(result[SecurityAlertSeverity.CRITICAL]).toBe(2);
      expect(result[SecurityAlertSeverity.HIGH]).toBe(1);
      expect(result[SecurityAlertSeverity.MEDIUM]).toBe(1);
      expect(result[SecurityAlertSeverity.LOW]).toBe(0);
    });

    it('debe retornar todos los contadores en 0 si no hay alertas', async () => {
      securityAlertRepository.find.mockResolvedValue([]);

      const result = await service.countActiveBySeverity();

      expect(result).toEqual({
        [SecurityAlertSeverity.LOW]: 0,
        [SecurityAlertSeverity.MEDIUM]: 0,
        [SecurityAlertSeverity.HIGH]: 0,
        [SecurityAlertSeverity.CRITICAL]: 0,
      });
    });
  });

  describe('getStats', () => {
    it('debe retornar estadisticas completas de alertas', async () => {
      const alerts = [
        {
          ...mockAlert,
          alertType: SecurityAlertType.BRUTE_FORCE_ATTACK,
          severity: SecurityAlertSeverity.HIGH,
          status: SecurityAlertStatus.ACTIVE,
          resolvedAt: null,
        },
        {
          ...mockAlert,
          id: 'alert-2',
          alertType: SecurityAlertType.MULTIPLE_FAILED_LOGINS,
          severity: SecurityAlertSeverity.MEDIUM,
          status: SecurityAlertStatus.RESOLVED,
          resolvedAt: new Date(
            new Date('2026-03-28T10:00:00Z').getTime() + 2 * 60 * 60 * 1000,
          ),
          createdAt: new Date('2026-03-28T10:00:00Z'),
        },
        {
          ...mockAlert,
          id: 'alert-3',
          alertType: SecurityAlertType.API_ABUSE,
          severity: SecurityAlertSeverity.MEDIUM,
          status: SecurityAlertStatus.DISMISSED,
          resolvedAt: null,
        },
      ];
      mockQueryBuilder.getMany.mockResolvedValue(alerts);

      const result = await service.getStats();

      expect(result.total).toBe(3);
      expect(result.active).toBe(1);
      expect(result.resolved).toBe(1);
      expect(result.dismissed).toBe(1);
      expect(result.byType[SecurityAlertType.BRUTE_FORCE_ATTACK]).toBe(1);
      expect(result.byType[SecurityAlertType.MULTIPLE_FAILED_LOGINS]).toBe(1);
      expect(result.byType[SecurityAlertType.API_ABUSE]).toBe(1);
      expect(result.bySeverity[SecurityAlertSeverity.HIGH]).toBe(1);
      expect(result.bySeverity[SecurityAlertSeverity.MEDIUM]).toBe(2);
    });

    it('debe calcular avgResolutionTimeHours correctamente', async () => {
      const createdAt = new Date('2026-03-28T10:00:00Z');
      const resolvedAt = new Date(createdAt.getTime() + 4 * 60 * 60 * 1000); // 4 hours later

      const alerts = [
        {
          ...mockAlert,
          status: SecurityAlertStatus.RESOLVED,
          createdAt,
          resolvedAt,
        },
      ];
      mockQueryBuilder.getMany.mockResolvedValue(alerts);

      const result = await service.getStats();

      expect(result.avgResolutionTimeHours).toBe(4);
    });

    it('debe retornar estadisticas vacias sin alertas', async () => {
      mockQueryBuilder.getMany.mockResolvedValue([]);

      const result = await service.getStats();

      expect(result).toEqual({
        total: 0,
        active: 0,
        resolved: 0,
        dismissed: 0,
        byType: {},
        bySeverity: {},
        avgResolutionTimeHours: 0,
      });
    });

    it('debe aceptar parametro de dias personalizado', async () => {
      mockQueryBuilder.getMany.mockResolvedValue([]);

      await service.getStats(90);

      expect(mockQueryBuilder.where).toHaveBeenCalledWith(
        'alert.createdAt >= :since',
        { since: expect.any(Date) },
      );
    });

    it('debe retornar avgResolutionTimeHours 0 si no hay alertas resueltas', async () => {
      const alerts = [
        {
          ...mockAlert,
          status: SecurityAlertStatus.ACTIVE,
          resolvedAt: null,
        },
      ];
      mockQueryBuilder.getMany.mockResolvedValue(alerts);

      const result = await service.getStats();

      expect(result.avgResolutionTimeHours).toBe(0);
    });

    it('debe contar INVESTIGATING como active', async () => {
      const alerts = [
        {
          ...mockAlert,
          status: SecurityAlertStatus.INVESTIGATING,
          resolvedAt: null,
        },
      ];
      mockQueryBuilder.getMany.mockResolvedValue(alerts);

      const result = await service.getStats();

      expect(result.active).toBe(1);
    });
  });

  describe('checkAndCreateAlerts', () => {
    beforeEach(() => {
      securityAlertRepository.create.mockReturnValue(mockAlert as any);
      securityAlertRepository.save.mockResolvedValue(mockAlert as any);
    });

    it('debe crear alerta MEDIUM cuando hay 5-9 logins fallidos', async () => {
      await service.checkAndCreateAlerts(mockIp, 5, 0);

      expect(securityAlertRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          alertType: SecurityAlertType.MULTIPLE_FAILED_LOGINS,
          severity: SecurityAlertSeverity.MEDIUM,
          status: SecurityAlertStatus.ACTIVE,
        }),
      );
    });

    it('debe crear alerta HIGH cuando hay 10+ logins fallidos', async () => {
      await service.checkAndCreateAlerts(mockIp, 10, 0);

      expect(securityAlertRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          alertType: SecurityAlertType.BRUTE_FORCE_ATTACK,
          severity: SecurityAlertSeverity.HIGH,
        }),
      );
    });

    it('debe crear alerta por rate limit cuando excede 10', async () => {
      await service.checkAndCreateAlerts(mockIp, 0, 15);

      expect(securityAlertRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          alertType: SecurityAlertType.API_ABUSE,
          severity: SecurityAlertSeverity.MEDIUM,
        }),
      );
    });

    it('no debe crear alerta si los logins fallidos son menores a 5', async () => {
      await service.checkAndCreateAlerts(mockIp, 3, 0);

      expect(securityAlertRepository.create).not.toHaveBeenCalled();
    });

    it('no debe crear alerta si el rate limit excedido es menor a 10', async () => {
      await service.checkAndCreateAlerts(mockIp, 0, 5);

      expect(securityAlertRepository.create).not.toHaveBeenCalled();
    });

    it('debe crear ambas alertas si se cumplen ambos umbrales', async () => {
      await service.checkAndCreateAlerts(mockIp, 7, 12);

      // Should create MULTIPLE_FAILED_LOGINS + API_ABUSE
      expect(securityAlertRepository.save).toHaveBeenCalledTimes(2);
    });

    it('debe incluir IP y metadata en la alerta', async () => {
      await service.checkAndCreateAlerts(mockIp, 8, 0);

      expect(securityAlertRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          relatedIpAddress: mockIp,
          metadata: { failedLoginCount: 8 },
        }),
      );
    });

    it('debe crear alerta BRUTE_FORCE en lugar de MULTIPLE_FAILED_LOGINS para 10+ fallas', async () => {
      await service.checkAndCreateAlerts(mockIp, 15, 0);

      // For >= 10, should create BRUTE_FORCE_ATTACK not MULTIPLE_FAILED_LOGINS
      expect(securityAlertRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          alertType: SecurityAlertType.BRUTE_FORCE_ATTACK,
          severity: SecurityAlertSeverity.HIGH,
        }),
      );
      // Should NOT have been called with MULTIPLE_FAILED_LOGINS
      expect(securityAlertRepository.create).not.toHaveBeenCalledWith(
        expect.objectContaining({
          alertType: SecurityAlertType.MULTIPLE_FAILED_LOGINS,
        }),
      );
    });
  });
});
