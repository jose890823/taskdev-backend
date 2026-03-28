import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ActiveSessionService } from './active-session.service';
import { SecurityConfigService } from './security-config.service';
import { ActiveSession, DeviceType } from '../entities/active-session.entity';
import * as crypto from 'crypto';

describe('ActiveSessionService', () => {
  let service: ActiveSessionService;
  let activeSessionRepository: jest.Mocked<Repository<ActiveSession>>;
  let securityConfigService: jest.Mocked<SecurityConfigService>;

  const mockUserId = '123e4567-e89b-12d3-a456-426614174000';
  const mockRefreshToken = 'mock-refresh-token-abc123';
  const mockRefreshTokenHash = crypto
    .createHash('sha256')
    .update(mockRefreshToken)
    .digest('hex');
  const mockIp = '192.168.1.100';
  const mockUserAgent =
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120.0.0.0';

  const mockSession: ActiveSession = {
    id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    userId: mockUserId,
    user: null as any,
    refreshTokenHash: mockRefreshTokenHash,
    ipAddress: mockIp,
    userAgent: mockUserAgent,
    deviceType: DeviceType.DESKTOP,
    browser: 'Chrome',
    os: 'Linux',
    country: null,
    city: null,
    isActive: true,
    lastActivityAt: new Date('2026-03-28T10:00:00Z'),
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    createdAt: new Date('2026-03-28T09:00:00Z'),
    isExpired: jest.fn().mockReturnValue(false),
  } as unknown as ActiveSession;

  beforeEach(async () => {
    const mockActiveSessionRepository = {
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
    };

    const mockSecurityConfigService = {
      getNumberValue: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ActiveSessionService,
        {
          provide: getRepositoryToken(ActiveSession),
          useValue: mockActiveSessionRepository,
        },
        {
          provide: SecurityConfigService,
          useValue: mockSecurityConfigService,
        },
      ],
    }).compile();

    service = module.get<ActiveSessionService>(ActiveSessionService);
    activeSessionRepository = module.get(getRepositoryToken(ActiveSession));
    securityConfigService = module.get(SecurityConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  describe('createSession', () => {
    beforeEach(() => {
      securityConfigService.getNumberValue
        .mockResolvedValueOnce(7) // session_max_age_days
        .mockResolvedValueOnce(5); // max_sessions_per_user
    });

    it('debe crear una nueva sesion activa', async () => {
      activeSessionRepository.create.mockReturnValue(mockSession);
      activeSessionRepository.save.mockResolvedValue(mockSession);
      activeSessionRepository.find.mockResolvedValue([]); // enforceSessionLimit

      const result = await service.createSession(
        mockUserId,
        mockRefreshToken,
        mockIp,
        mockUserAgent,
      );

      expect(activeSessionRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: mockUserId,
          refreshTokenHash: mockRefreshTokenHash,
          ipAddress: mockIp,
          userAgent: mockUserAgent,
          deviceType: expect.any(String),
          isActive: true,
        }),
      );
      expect(result).toEqual(mockSession);
    });

    it('debe parsear user agent para desktop', async () => {
      activeSessionRepository.create.mockReturnValue(mockSession);
      activeSessionRepository.save.mockResolvedValue(mockSession);
      activeSessionRepository.find.mockResolvedValue([]);

      await service.createSession(
        mockUserId,
        mockRefreshToken,
        mockIp,
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120.0.0.0',
      );

      expect(activeSessionRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          browser: expect.any(String),
          os: expect.any(String),
        }),
      );
    });

    it('debe manejar userAgent null', async () => {
      activeSessionRepository.create.mockReturnValue(mockSession);
      activeSessionRepository.save.mockResolvedValue(mockSession);
      activeSessionRepository.find.mockResolvedValue([]);

      await service.createSession(mockUserId, mockRefreshToken, mockIp, null);

      expect(activeSessionRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          deviceType: DeviceType.UNKNOWN,
          browser: null,
          os: null,
        }),
      );
    });

    it('debe aplicar limite de sesiones revocando las mas antiguas', async () => {
      const oldSessions = [
        { ...mockSession, id: 'old-1', isActive: true },
        { ...mockSession, id: 'old-2', isActive: true },
        { ...mockSession, id: 'old-3', isActive: true },
        { ...mockSession, id: 'old-4', isActive: true },
        { ...mockSession, id: 'old-5', isActive: true },
      ];

      activeSessionRepository.create.mockReturnValue(mockSession);
      activeSessionRepository.save.mockResolvedValue(mockSession);
      activeSessionRepository.find.mockResolvedValue(oldSessions as any);

      await service.createSession(
        mockUserId,
        mockRefreshToken,
        mockIp,
        mockUserAgent,
      );

      // Should have revoked the oldest session(s) to make room
      // With 5 active and max 5, we need to revoke 1 to add the new one
      expect(activeSessionRepository.save).toHaveBeenCalled();
    });

    it('debe obtener configuracion de duracion de sesion', async () => {
      activeSessionRepository.create.mockReturnValue(mockSession);
      activeSessionRepository.save.mockResolvedValue(mockSession);
      activeSessionRepository.find.mockResolvedValue([]);

      await service.createSession(
        mockUserId,
        mockRefreshToken,
        mockIp,
        mockUserAgent,
      );

      expect(securityConfigService.getNumberValue).toHaveBeenCalledWith(
        'session_max_age_days',
        7,
      );
      expect(securityConfigService.getNumberValue).toHaveBeenCalledWith(
        'max_sessions_per_user',
        5,
      );
    });

    it('debe calcular la fecha de expiracion basada en configuracion', async () => {
      activeSessionRepository.create.mockReturnValue(mockSession);
      activeSessionRepository.save.mockResolvedValue(mockSession);
      activeSessionRepository.find.mockResolvedValue([]);

      await service.createSession(
        mockUserId,
        mockRefreshToken,
        mockIp,
        mockUserAgent,
      );

      const createCall = activeSessionRepository.create.mock.calls[0][0] as any;
      expect(createCall.expiresAt).toBeInstanceOf(Date);
      // Verify it's approximately 7 days from now
      const expectedExpiry = Date.now() + 7 * 24 * 60 * 60 * 1000;
      expect(
        Math.abs(createCall.expiresAt.getTime() - expectedExpiry),
      ).toBeLessThan(5000);
    });
  });

  describe('updateActivity', () => {
    it('debe actualizar la ultima actividad de la sesion', async () => {
      activeSessionRepository.update.mockResolvedValue({ affected: 1 } as any);

      await service.updateActivity(mockRefreshToken);

      expect(activeSessionRepository.update).toHaveBeenCalledWith(
        { refreshTokenHash: mockRefreshTokenHash, isActive: true },
        { lastActivityAt: expect.any(Date) },
      );
    });

    it('debe hashear el token antes de buscar', async () => {
      activeSessionRepository.update.mockResolvedValue({ affected: 0 } as any);

      await service.updateActivity('some-other-token');

      const expectedHash = crypto
        .createHash('sha256')
        .update('some-other-token')
        .digest('hex');

      expect(activeSessionRepository.update).toHaveBeenCalledWith(
        { refreshTokenHash: expectedHash, isActive: true },
        expect.any(Object),
      );
    });
  });

  describe('findByRefreshToken', () => {
    it('debe encontrar sesion activa por refresh token', async () => {
      activeSessionRepository.findOne.mockResolvedValue(mockSession);

      const result = await service.findByRefreshToken(mockRefreshToken);

      expect(activeSessionRepository.findOne).toHaveBeenCalledWith({
        where: { refreshTokenHash: mockRefreshTokenHash, isActive: true },
        relations: ['user'],
      });
      expect(result).toEqual(mockSession);
    });

    it('debe retornar null si no se encuentra la sesion', async () => {
      activeSessionRepository.findOne.mockResolvedValue(null);

      const result = await service.findByRefreshToken('invalid-token');

      expect(result).toBeNull();
    });
  });

  describe('revokeSession', () => {
    it('debe revocar una sesion por refresh token', async () => {
      activeSessionRepository.update.mockResolvedValue({ affected: 1 } as any);

      const result = await service.revokeSession(mockRefreshToken);

      expect(activeSessionRepository.update).toHaveBeenCalledWith(
        { refreshTokenHash: mockRefreshTokenHash },
        { isActive: false },
      );
      expect(result).toBe(true);
    });

    it('debe retornar false si la sesion no existe', async () => {
      activeSessionRepository.update.mockResolvedValue({ affected: 0 } as any);

      const result = await service.revokeSession('non-existent-token');

      expect(result).toBe(false);
    });

    it('debe manejar affected undefined', async () => {
      activeSessionRepository.update.mockResolvedValue({
        affected: undefined,
      } as any);

      const result = await service.revokeSession(mockRefreshToken);

      expect(result).toBe(false);
    });
  });

  describe('revokeSessionById', () => {
    it('debe revocar una sesion por ID y userId', async () => {
      activeSessionRepository.findOne.mockResolvedValue({
        ...mockSession,
      } as any);
      activeSessionRepository.save.mockResolvedValue({
        ...mockSession,
        isActive: false,
      } as any);

      const result = await service.revokeSessionById(
        mockSession.id,
        mockUserId,
      );

      expect(activeSessionRepository.findOne).toHaveBeenCalledWith({
        where: { id: mockSession.id, userId: mockUserId },
      });
      expect(result).toBe(true);
    });

    it('debe retornar false si la sesion no pertenece al usuario', async () => {
      activeSessionRepository.findOne.mockResolvedValue(null);

      const result = await service.revokeSessionById(
        mockSession.id,
        'another-user-id',
      );

      expect(result).toBe(false);
    });

    it('debe retornar false si la sesion no existe', async () => {
      activeSessionRepository.findOne.mockResolvedValue(null);

      const result = await service.revokeSessionById(
        'non-existent-id',
        mockUserId,
      );

      expect(result).toBe(false);
    });
  });

  describe('revokeAllUserSessions', () => {
    it('debe revocar todas las sesiones activas de un usuario', async () => {
      activeSessionRepository.update.mockResolvedValue({ affected: 3 } as any);

      const result = await service.revokeAllUserSessions(mockUserId);

      expect(activeSessionRepository.update).toHaveBeenCalledWith(
        { userId: mockUserId, isActive: true },
        { isActive: false },
      );
      expect(result).toBe(3);
    });

    it('debe retornar 0 si no hay sesiones activas', async () => {
      activeSessionRepository.update.mockResolvedValue({ affected: 0 } as any);

      const result = await service.revokeAllUserSessions(mockUserId);

      expect(result).toBe(0);
    });

    it('debe manejar affected undefined', async () => {
      activeSessionRepository.update.mockResolvedValue({
        affected: undefined,
      } as any);

      const result = await service.revokeAllUserSessions(mockUserId);

      expect(result).toBe(0);
    });
  });

  describe('getUserSessions', () => {
    it('debe retornar sesiones activas del usuario', async () => {
      activeSessionRepository.find.mockResolvedValue([mockSession]);

      const result = await service.getUserSessions(mockUserId);

      expect(activeSessionRepository.find).toHaveBeenCalledWith({
        where: { userId: mockUserId, isActive: true },
        order: { lastActivityAt: 'DESC' },
      });
      expect(result).toEqual([mockSession]);
    });

    it('debe retornar array vacio si no hay sesiones', async () => {
      activeSessionRepository.find.mockResolvedValue([]);

      const result = await service.getUserSessions(mockUserId);

      expect(result).toEqual([]);
    });
  });

  describe('cleanExpiredSessions', () => {
    it('debe limpiar sesiones expiradas', async () => {
      activeSessionRepository.update.mockResolvedValue({ affected: 5 } as any);

      const result = await service.cleanExpiredSessions();

      expect(activeSessionRepository.update).toHaveBeenCalledWith(
        expect.objectContaining({
          isActive: true,
        }),
        { isActive: false },
      );
      expect(result).toBe(5);
    });

    it('debe retornar 0 si no hay sesiones expiradas', async () => {
      activeSessionRepository.update.mockResolvedValue({ affected: 0 } as any);

      const result = await service.cleanExpiredSessions();

      expect(result).toBe(0);
    });

    it('debe manejar affected undefined', async () => {
      activeSessionRepository.update.mockResolvedValue({
        affected: undefined,
      } as any);

      const result = await service.cleanExpiredSessions();

      expect(result).toBe(0);
    });
  });

  describe('getStats', () => {
    it('debe retornar estadisticas de sesiones activas', async () => {
      const sessions = [
        {
          ...mockSession,
          deviceType: DeviceType.DESKTOP,
          browser: 'Chrome',
          os: 'Linux',
          createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2h ago
        },
        {
          ...mockSession,
          id: 'session-2',
          deviceType: DeviceType.MOBILE,
          browser: 'Safari',
          os: 'iOS',
          createdAt: new Date(Date.now() - 4 * 60 * 60 * 1000), // 4h ago
        },
        {
          ...mockSession,
          id: 'session-3',
          deviceType: DeviceType.DESKTOP,
          browser: 'Chrome',
          os: 'Windows',
          createdAt: new Date(Date.now() - 6 * 60 * 60 * 1000), // 6h ago
        },
      ];
      activeSessionRepository.find.mockResolvedValue(sessions as any);

      const result = await service.getStats();

      expect(result.totalActive).toBe(3);
      expect(result.byDeviceType[DeviceType.DESKTOP]).toBe(2);
      expect(result.byDeviceType[DeviceType.MOBILE]).toBe(1);
      expect(result.byBrowser['Chrome']).toBe(2);
      expect(result.byBrowser['Safari']).toBe(1);
      expect(result.byOs['Linux']).toBe(1);
      expect(result.byOs['iOS']).toBe(1);
      expect(result.byOs['Windows']).toBe(1);
      expect(result.avgSessionAge).toBeGreaterThan(0);
    });

    it('debe retornar estadisticas vacias si no hay sesiones', async () => {
      activeSessionRepository.find.mockResolvedValue([]);

      const result = await service.getStats();

      expect(result).toEqual({
        totalActive: 0,
        byDeviceType: {},
        byBrowser: {},
        byOs: {},
        avgSessionAge: 0,
      });
    });

    it('debe manejar sesiones sin browser y os', async () => {
      const sessions = [
        {
          ...mockSession,
          deviceType: DeviceType.UNKNOWN,
          browser: null,
          os: null,
          createdAt: new Date(Date.now() - 1 * 60 * 60 * 1000),
        },
      ];
      activeSessionRepository.find.mockResolvedValue(sessions as any);

      const result = await service.getStats();

      expect(result.totalActive).toBe(1);
      expect(result.byDeviceType[DeviceType.UNKNOWN]).toBe(1);
      expect(Object.keys(result.byBrowser)).toHaveLength(0);
      expect(Object.keys(result.byOs)).toHaveLength(0);
    });

    it('debe calcular avgSessionAge en horas', async () => {
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
      const sessions = [
        {
          ...mockSession,
          createdAt: twoHoursAgo,
        },
      ];
      activeSessionRepository.find.mockResolvedValue(sessions as any);

      const result = await service.getStats();

      // Should be approximately 2 hours
      expect(result.avgSessionAge).toBeGreaterThanOrEqual(1);
      expect(result.avgSessionAge).toBeLessThanOrEqual(3);
    });
  });
});
