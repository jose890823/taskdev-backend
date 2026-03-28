import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LoginAttemptService } from './login-attempt.service';
import { BlockedIpService } from './blocked-ip.service';
import { SecurityEventService } from './security-event.service';
import { SecurityConfigService } from './security-config.service';
import {
  LoginAttempt,
  LoginFailureReason,
} from '../entities/login-attempt.entity';
import {
  SecurityEventType,
  SecurityEventSeverity,
} from '../entities/security-event.entity';

describe('LoginAttemptService', () => {
  let service: LoginAttemptService;
  let loginAttemptRepository: jest.Mocked<Repository<LoginAttempt>>;
  let blockedIpService: jest.Mocked<BlockedIpService>;
  let securityEventService: jest.Mocked<SecurityEventService>;
  let securityConfigService: jest.Mocked<SecurityConfigService>;

  const mockUserId = '123e4567-e89b-12d3-a456-426614174000';
  const mockIp = '192.168.1.100';
  const mockEmail = 'test@example.com';
  const mockUserAgent = 'Mozilla/5.0 (X11; Linux x86_64)';

  const mockLoginAttempt: LoginAttempt = {
    id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    email: mockEmail,
    ipAddress: mockIp,
    userAgent: mockUserAgent,
    success: true,
    failureReason: null,
    userId: mockUserId,
    user: null,
    createdAt: new Date('2026-03-28T10:00:00Z'),
  } as LoginAttempt;

  beforeEach(async () => {
    const mockLoginAttemptRepository = {
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
      count: jest.fn(),
      createQueryBuilder: jest.fn(),
    };

    const mockBlockedIpService = {
      isBlocked: jest.fn(),
      autoBlockIp: jest.fn(),
    };

    const mockSecurityEventService = {
      create: jest.fn(),
    };

    const mockSecurityConfigService = {
      getNumberValue: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LoginAttemptService,
        {
          provide: getRepositoryToken(LoginAttempt),
          useValue: mockLoginAttemptRepository,
        },
        {
          provide: BlockedIpService,
          useValue: mockBlockedIpService,
        },
        {
          provide: SecurityEventService,
          useValue: mockSecurityEventService,
        },
        {
          provide: SecurityConfigService,
          useValue: mockSecurityConfigService,
        },
      ],
    }).compile();

    service = module.get<LoginAttemptService>(LoginAttemptService);
    loginAttemptRepository = module.get(getRepositoryToken(LoginAttempt));
    blockedIpService = module.get(BlockedIpService);
    securityEventService = module.get(SecurityEventService);
    securityConfigService = module.get(SecurityConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  describe('recordSuccess', () => {
    it('debe registrar un intento de login exitoso', async () => {
      loginAttemptRepository.create.mockReturnValue(mockLoginAttempt);
      loginAttemptRepository.save.mockResolvedValue(mockLoginAttempt);
      securityEventService.create.mockResolvedValue({} as any);

      const result = await service.recordSuccess(
        mockEmail,
        mockIp,
        mockUserAgent,
        mockUserId,
      );

      expect(loginAttemptRepository.create).toHaveBeenCalledWith({
        email: mockEmail,
        ipAddress: mockIp,
        userAgent: mockUserAgent,
        success: true,
        userId: mockUserId,
      });
      expect(loginAttemptRepository.save).toHaveBeenCalledWith(
        mockLoginAttempt,
      );
      expect(result).toEqual(mockLoginAttempt);
    });

    it('debe registrar un evento de seguridad LOGIN_SUCCESS', async () => {
      loginAttemptRepository.create.mockReturnValue(mockLoginAttempt);
      loginAttemptRepository.save.mockResolvedValue(mockLoginAttempt);
      securityEventService.create.mockResolvedValue({} as any);

      await service.recordSuccess(mockEmail, mockIp, mockUserAgent, mockUserId);

      expect(securityEventService.create).toHaveBeenCalledWith({
        eventType: SecurityEventType.LOGIN_SUCCESS,
        severity: SecurityEventSeverity.LOW,
        ipAddress: mockIp,
        userAgent: mockUserAgent,
        userId: mockUserId,
        email: mockEmail,
        endpoint: '/api/auth/login',
        method: 'POST',
        description: 'Login exitoso',
      });
    });

    it('debe manejar userAgent null', async () => {
      const attemptNullUA = { ...mockLoginAttempt, userAgent: null };
      loginAttemptRepository.create.mockReturnValue(
        attemptNullUA as LoginAttempt,
      );
      loginAttemptRepository.save.mockResolvedValue(
        attemptNullUA as LoginAttempt,
      );
      securityEventService.create.mockResolvedValue({} as any);

      const result = await service.recordSuccess(
        mockEmail,
        mockIp,
        null,
        mockUserId,
      );

      expect(loginAttemptRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ userAgent: null }),
      );
      expect(result.userAgent).toBeNull();
    });
  });

  describe('recordFailure', () => {
    const failedAttempt: LoginAttempt = {
      ...mockLoginAttempt,
      success: false,
      failureReason: LoginFailureReason.INVALID_PASSWORD,
    } as LoginAttempt;

    beforeEach(() => {
      loginAttemptRepository.create.mockReturnValue(failedAttempt);
      loginAttemptRepository.save.mockResolvedValue(failedAttempt);
      securityEventService.create.mockResolvedValue({} as any);
      securityConfigService.getNumberValue
        .mockResolvedValueOnce(10) // auto_block_after_failed_logins
        .mockResolvedValueOnce(30); // block_duration_minutes
    });

    it('debe registrar un intento de login fallido', async () => {
      loginAttemptRepository.count.mockResolvedValue(1);

      const result = await service.recordFailure(
        mockEmail,
        mockIp,
        mockUserAgent,
        LoginFailureReason.INVALID_PASSWORD,
        mockUserId,
      );

      expect(loginAttemptRepository.create).toHaveBeenCalledWith({
        email: mockEmail,
        ipAddress: mockIp,
        userAgent: mockUserAgent,
        success: false,
        failureReason: LoginFailureReason.INVALID_PASSWORD,
        userId: mockUserId,
      });
      expect(result.attempt).toEqual(failedAttempt);
    });

    it('debe retornar shouldBlock=false cuando las fallas son menores al umbral', async () => {
      loginAttemptRepository.count.mockResolvedValue(2);

      const result = await service.recordFailure(
        mockEmail,
        mockIp,
        mockUserAgent,
        LoginFailureReason.INVALID_PASSWORD,
      );

      expect(result.shouldBlock).toBe(false);
      expect(result.failedAttempts).toBe(2);
    });

    it('debe crear evento con severidad LOW cuando hay menos de 3 fallas', async () => {
      loginAttemptRepository.count.mockResolvedValue(2);

      await service.recordFailure(
        mockEmail,
        mockIp,
        mockUserAgent,
        LoginFailureReason.INVALID_PASSWORD,
      );

      expect(securityEventService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          severity: SecurityEventSeverity.LOW,
        }),
      );
    });

    it('debe crear evento con severidad MEDIUM cuando hay 3+ fallas', async () => {
      loginAttemptRepository.count.mockResolvedValue(4);

      await service.recordFailure(
        mockEmail,
        mockIp,
        mockUserAgent,
        LoginFailureReason.INVALID_PASSWORD,
      );

      expect(securityEventService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          severity: SecurityEventSeverity.MEDIUM,
        }),
      );
    });

    it('debe crear evento con severidad HIGH cuando hay 5+ fallas', async () => {
      loginAttemptRepository.count.mockResolvedValue(7);

      await service.recordFailure(
        mockEmail,
        mockIp,
        mockUserAgent,
        LoginFailureReason.INVALID_PASSWORD,
      );

      expect(securityEventService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          severity: SecurityEventSeverity.HIGH,
        }),
      );
    });

    it('debe crear evento con severidad CRITICAL y shouldBlock=true cuando se alcanza el umbral', async () => {
      loginAttemptRepository.count.mockResolvedValue(10);
      blockedIpService.autoBlockIp.mockResolvedValue({} as any);

      const result = await service.recordFailure(
        mockEmail,
        mockIp,
        mockUserAgent,
        LoginFailureReason.INVALID_PASSWORD,
      );

      expect(result.shouldBlock).toBe(true);
      expect(securityEventService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          severity: SecurityEventSeverity.CRITICAL,
        }),
      );
    });

    it('debe llamar autoBlockIp cuando se supera el umbral', async () => {
      loginAttemptRepository.count.mockResolvedValue(12);
      blockedIpService.autoBlockIp.mockResolvedValue({} as any);

      await service.recordFailure(
        mockEmail,
        mockIp,
        mockUserAgent,
        LoginFailureReason.INVALID_PASSWORD,
      );

      expect(blockedIpService.autoBlockIp).toHaveBeenCalledWith(
        mockIp,
        expect.stringContaining('12 intentos de login fallidos'),
        30,
      );
    });

    it('no debe llamar autoBlockIp cuando las fallas son menores al umbral', async () => {
      loginAttemptRepository.count.mockResolvedValue(5);

      await service.recordFailure(
        mockEmail,
        mockIp,
        mockUserAgent,
        LoginFailureReason.INVALID_PASSWORD,
      );

      expect(blockedIpService.autoBlockIp).not.toHaveBeenCalled();
    });

    it('debe incluir metadata con reason, failedAttempts y threshold en el evento', async () => {
      loginAttemptRepository.count.mockResolvedValue(3);

      await service.recordFailure(
        mockEmail,
        mockIp,
        mockUserAgent,
        LoginFailureReason.INVALID_EMAIL,
      );

      expect(securityEventService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: {
            reason: LoginFailureReason.INVALID_EMAIL,
            failedAttempts: 3,
            threshold: 10,
          },
        }),
      );
    });

    it('debe funcionar sin userId opcional', async () => {
      loginAttemptRepository.count.mockResolvedValue(1);

      const result = await service.recordFailure(
        mockEmail,
        mockIp,
        mockUserAgent,
        LoginFailureReason.INVALID_EMAIL,
      );

      expect(loginAttemptRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ userId: undefined }),
      );
      expect(result.attempt).toBeDefined();
    });
  });

  describe('canAttemptLogin', () => {
    it('debe denegar si la IP esta bloqueada', async () => {
      blockedIpService.isBlocked.mockResolvedValue(true);

      const result = await service.canAttemptLogin(mockIp);

      expect(result).toEqual({
        allowed: false,
        remainingAttempts: 0,
        waitSeconds: 0,
      });
    });

    it('debe permitir si la IP no esta bloqueada y no excede rate limit', async () => {
      blockedIpService.isBlocked.mockResolvedValue(false);
      securityConfigService.getNumberValue.mockResolvedValue(5);
      loginAttemptRepository.count.mockResolvedValue(2);

      const result = await service.canAttemptLogin(mockIp);

      expect(result).toEqual({
        allowed: true,
        remainingAttempts: 3,
      });
    });

    it('debe denegar si se excede el rate limit por minuto', async () => {
      blockedIpService.isBlocked.mockResolvedValue(false);
      securityConfigService.getNumberValue.mockResolvedValue(5);
      loginAttemptRepository.count.mockResolvedValue(5);

      const result = await service.canAttemptLogin(mockIp);

      expect(result).toEqual({
        allowed: false,
        remainingAttempts: 0,
        waitSeconds: 60,
      });
    });

    it('debe calcular correctamente los intentos restantes', async () => {
      blockedIpService.isBlocked.mockResolvedValue(false);
      securityConfigService.getNumberValue.mockResolvedValue(10);
      loginAttemptRepository.count.mockResolvedValue(7);

      const result = await service.canAttemptLogin(mockIp);

      expect(result).toEqual({
        allowed: true,
        remainingAttempts: 3,
      });
    });

    it('debe denegar con waitSeconds cuando rate limit se excede en mas', async () => {
      blockedIpService.isBlocked.mockResolvedValue(false);
      securityConfigService.getNumberValue.mockResolvedValue(5);
      loginAttemptRepository.count.mockResolvedValue(15);

      const result = await service.canAttemptLogin(mockIp);

      expect(result.allowed).toBe(false);
      expect(result.waitSeconds).toBe(60);
    });
  });

  describe('getRecentByIp', () => {
    it('debe retornar intentos recientes para una IP con limite por defecto', async () => {
      loginAttemptRepository.find.mockResolvedValue([mockLoginAttempt]);

      const result = await service.getRecentByIp(mockIp);

      expect(loginAttemptRepository.find).toHaveBeenCalledWith({
        where: { ipAddress: mockIp },
        order: { createdAt: 'DESC' },
        take: 10,
        relations: ['user'],
      });
      expect(result).toEqual([mockLoginAttempt]);
    });

    it('debe respetar el parametro limit', async () => {
      loginAttemptRepository.find.mockResolvedValue([]);

      await service.getRecentByIp(mockIp, 5);

      expect(loginAttemptRepository.find).toHaveBeenCalledWith(
        expect.objectContaining({ take: 5 }),
      );
    });
  });

  describe('getRecentByEmail', () => {
    it('debe retornar intentos recientes para un email con limite por defecto', async () => {
      loginAttemptRepository.find.mockResolvedValue([mockLoginAttempt]);

      const result = await service.getRecentByEmail(mockEmail);

      expect(loginAttemptRepository.find).toHaveBeenCalledWith({
        where: { email: mockEmail },
        order: { createdAt: 'DESC' },
        take: 10,
        relations: ['user'],
      });
      expect(result).toEqual([mockLoginAttempt]);
    });

    it('debe respetar el parametro limit personalizado', async () => {
      loginAttemptRepository.find.mockResolvedValue([]);

      await service.getRecentByEmail(mockEmail, 25);

      expect(loginAttemptRepository.find).toHaveBeenCalledWith(
        expect.objectContaining({ take: 25 }),
      );
    });
  });

  describe('getStats', () => {
    const mockQueryBuilder = {
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      getRawMany: jest.fn(),
    };

    beforeEach(() => {
      loginAttemptRepository.createQueryBuilder.mockReturnValue(
        mockQueryBuilder as any,
      );
    });

    it('debe retornar estadisticas con parametros por defecto (24 horas)', async () => {
      loginAttemptRepository.count
        .mockResolvedValueOnce(100) // total
        .mockResolvedValueOnce(80); // successful

      mockQueryBuilder.getRawMany
        .mockResolvedValueOnce([{ ip: mockIp, count: '5' }]) // topFailedIps
        .mockResolvedValueOnce([{ email: mockEmail, count: '3' }]) // topFailedEmails
        .mockResolvedValueOnce([
          { reason: LoginFailureReason.INVALID_PASSWORD, count: '15' },
        ]); // failureReasons

      const result = await service.getStats();

      expect(result.total).toBe(100);
      expect(result.successful).toBe(80);
      expect(result.failed).toBe(20);
      expect(result.successRate).toBe(80);
      expect(result.topFailedIps).toEqual([{ ip: mockIp, count: 5 }]);
      expect(result.topFailedEmails).toEqual([{ email: mockEmail, count: 3 }]);
      expect(result.failureReasons).toEqual({
        [LoginFailureReason.INVALID_PASSWORD]: 15,
      });
    });

    it('debe aceptar parametro de horas personalizado', async () => {
      loginAttemptRepository.count
        .mockResolvedValueOnce(50)
        .mockResolvedValueOnce(40);
      mockQueryBuilder.getRawMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const result = await service.getStats(48);

      expect(result.total).toBe(50);
      expect(result.successful).toBe(40);
      expect(result.failed).toBe(10);
    });

    it('debe retornar successRate 0 cuando no hay intentos', async () => {
      loginAttemptRepository.count
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0);
      mockQueryBuilder.getRawMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const result = await service.getStats();

      expect(result.successRate).toBe(0);
      expect(result.topFailedIps).toEqual([]);
      expect(result.topFailedEmails).toEqual([]);
      expect(result.failureReasons).toEqual({});
    });

    it('debe parsear counts de string a number correctamente', async () => {
      loginAttemptRepository.count
        .mockResolvedValueOnce(10)
        .mockResolvedValueOnce(5);
      mockQueryBuilder.getRawMany
        .mockResolvedValueOnce([
          { ip: '10.0.0.1', count: '7' },
          { ip: '10.0.0.2', count: '3' },
        ])
        .mockResolvedValueOnce([{ email: 'bad@test.com', count: '12' }])
        .mockResolvedValueOnce([
          { reason: LoginFailureReason.ACCOUNT_LOCKED, count: '2' },
        ]);

      const result = await service.getStats();

      expect(result.topFailedIps[0].count).toBe(7);
      expect(result.topFailedIps[1].count).toBe(3);
      expect(result.topFailedEmails[0].count).toBe(12);
      expect(result.failureReasons[LoginFailureReason.ACCOUNT_LOCKED]).toBe(2);
    });
  });
});
