import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BlockedIpService } from './blocked-ip.service';
import { SecurityEventService } from './security-event.service';
import { BlockedIP, BlockedByType } from '../entities/blocked-ip.entity';
import {
  SecurityEventType,
  SecurityEventSeverity,
} from '../entities/security-event.entity';

describe('BlockedIpService', () => {
  let service: BlockedIpService;
  let blockedIpRepository: jest.Mocked<Repository<BlockedIP>>;
  let securityEventService: jest.Mocked<SecurityEventService>;

  const mockAdminUserId = '123e4567-e89b-12d3-a456-426614174000';
  const mockIp = '192.168.1.100';

  const futureDate = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now
  const pastDate = new Date(Date.now() - 60 * 60 * 1000); // 1 hour ago

  const mockBlockedIp: BlockedIP = {
    id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    ipAddress: mockIp,
    reason: 'Intentos de login fallidos',
    blockedBy: BlockedByType.SYSTEM,
    blockedByUserId: null,
    blockedByUser: null,
    permanent: false,
    expiresAt: futureDate,
    attemptsSinceBlock: 0,
    isActive: true,
    createdAt: new Date('2026-03-28T10:00:00Z'),
    updatedAt: new Date('2026-03-28T10:00:00Z'),
    isExpired: jest.fn().mockReturnValue(false),
  } as unknown as BlockedIP;

  beforeEach(async () => {
    const mockBlockedIpRepository = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
    };

    const mockSecurityEventService = {
      create: jest.fn().mockResolvedValue({} as any),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BlockedIpService,
        {
          provide: getRepositoryToken(BlockedIP),
          useValue: mockBlockedIpRepository,
        },
        {
          provide: SecurityEventService,
          useValue: mockSecurityEventService,
        },
      ],
    }).compile();

    service = module.get<BlockedIpService>(BlockedIpService);
    blockedIpRepository = module.get(getRepositoryToken(BlockedIP));
    securityEventService = module.get(SecurityEventService);
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  describe('isBlocked', () => {
    // Force cache to be stale so isBlocked will call refreshCache with our mocks
    const forceStaleCache = () => {
      (service as any).lastCacheUpdate = null;
    };

    it('debe retornar false si la IP no esta en cache', async () => {
      forceStaleCache();
      blockedIpRepository.find.mockResolvedValue([]);

      const result = await service.isBlocked('10.0.0.1');

      expect(result).toBe(false);
    });

    it('debe retornar true si la IP esta bloqueada y no ha expirado', async () => {
      forceStaleCache();
      const activeBlock = {
        ...mockBlockedIp,
        isExpired: jest.fn().mockReturnValue(false),
      };
      // refreshCache returns the blocked IP
      blockedIpRepository.find.mockResolvedValue([activeBlock as any]);
      // findOne for DB verification
      blockedIpRepository.findOne.mockResolvedValue(activeBlock as any);
      blockedIpRepository.save.mockResolvedValue(activeBlock as any);

      const result = await service.isBlocked(mockIp);

      expect(result).toBe(true);
    });

    it('debe retornar false y desactivar bloqueo si ha expirado', async () => {
      forceStaleCache();
      const expiredBlock = {
        ...mockBlockedIp,
        isExpired: jest.fn().mockReturnValue(true),
        expiresAt: pastDate,
      };
      // refreshCache loads the IP (it checks expiration differently in cache)
      blockedIpRepository.find.mockResolvedValue([
        { ...expiredBlock, permanent: false, expiresAt: futureDate } as any,
      ]);
      // findOne returns the expired block
      blockedIpRepository.findOne.mockResolvedValue(expiredBlock as any);
      blockedIpRepository.save.mockResolvedValue({
        ...expiredBlock,
        isActive: false,
      } as any);

      const result = await service.isBlocked(mockIp);

      expect(result).toBe(false);
      expect(blockedIpRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ isActive: false }),
      );
    });

    it('debe incrementar attemptsSinceBlock para bloqueo activo', async () => {
      forceStaleCache();
      const activeBlock = {
        ...mockBlockedIp,
        attemptsSinceBlock: 5,
        isExpired: jest.fn().mockReturnValue(false),
      };
      blockedIpRepository.find.mockResolvedValue([activeBlock as any]);
      blockedIpRepository.findOne.mockResolvedValue(activeBlock as any);
      blockedIpRepository.save.mockResolvedValue(activeBlock as any);

      await service.isBlocked(mockIp);

      expect(blockedIpRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ attemptsSinceBlock: 6 }),
      );
    });

    it('debe retornar false si la IP esta en cache pero no en BD', async () => {
      forceStaleCache();
      // Force cache to have the IP by providing it during refreshCache
      blockedIpRepository.find.mockResolvedValue([mockBlockedIp as any]);
      // But findOne returns null (deleted from DB)
      blockedIpRepository.findOne.mockResolvedValue(null);

      const result = await service.isBlocked(mockIp);

      expect(result).toBe(false);
    });
  });

  describe('blockIp', () => {
    it('debe crear un nuevo bloqueo manual', async () => {
      blockedIpRepository.findOne.mockResolvedValue(null);
      blockedIpRepository.create.mockReturnValue(mockBlockedIp as any);
      blockedIpRepository.save.mockResolvedValue(mockBlockedIp as any);

      const result = await service.blockIp(
        mockIp,
        'Actividad sospechosa',
        mockAdminUserId,
      );

      expect(blockedIpRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          ipAddress: mockIp,
          reason: 'Actividad sospechosa',
          blockedBy: BlockedByType.ADMIN,
          blockedByUserId: mockAdminUserId,
          permanent: false,
          isActive: true,
        }),
      );
      expect(result).toEqual(mockBlockedIp);
    });

    it('debe crear bloqueo permanente cuando se especifica', async () => {
      blockedIpRepository.findOne.mockResolvedValue(null);
      blockedIpRepository.create.mockReturnValue(mockBlockedIp as any);
      blockedIpRepository.save.mockResolvedValue(mockBlockedIp as any);

      await service.blockIp(mockIp, 'Atacante conocido', mockAdminUserId, {
        permanent: true,
      });

      expect(blockedIpRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          permanent: true,
          expiresAt: null,
        }),
      );
    });

    it('debe crear bloqueo con duracion personalizada', async () => {
      blockedIpRepository.findOne.mockResolvedValue(null);
      blockedIpRepository.create.mockReturnValue(mockBlockedIp as any);
      blockedIpRepository.save.mockResolvedValue(mockBlockedIp as any);

      await service.blockIp(mockIp, 'Test', mockAdminUserId, {
        durationMinutes: 120,
      });

      expect(blockedIpRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          permanent: false,
        }),
      );
      // The expiresAt should be approximately 120 minutes from now
      const createCall = blockedIpRepository.create.mock.calls[0][0] as any;
      expect(createCall.expiresAt).toBeInstanceOf(Date);
    });

    it('debe actualizar bloqueo existente activo no expirado', async () => {
      const existingBlock = {
        ...mockBlockedIp,
        isActive: true,
        isExpired: jest.fn().mockReturnValue(false),
      };
      blockedIpRepository.findOne.mockResolvedValue(existingBlock as any);
      blockedIpRepository.save.mockResolvedValue(existingBlock as any);

      const result = await service.blockIp(
        mockIp,
        'Razon actualizada',
        mockAdminUserId,
      );

      expect(blockedIpRepository.create).not.toHaveBeenCalled();
      expect(blockedIpRepository.save).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('debe crear nuevo bloqueo si el existente esta inactivo', async () => {
      const inactiveBlock = {
        ...mockBlockedIp,
        isActive: false,
        isExpired: jest.fn().mockReturnValue(false),
      };
      blockedIpRepository.findOne.mockResolvedValue(inactiveBlock as any);
      blockedIpRepository.create.mockReturnValue(mockBlockedIp as any);
      blockedIpRepository.save.mockResolvedValue(mockBlockedIp as any);

      await service.blockIp(mockIp, 'Nuevo bloqueo', mockAdminUserId);

      expect(blockedIpRepository.create).toHaveBeenCalled();
    });

    it('debe registrar evento de seguridad IP_BLOCKED', async () => {
      blockedIpRepository.findOne.mockResolvedValue(null);
      blockedIpRepository.create.mockReturnValue(mockBlockedIp as any);
      blockedIpRepository.save.mockResolvedValue(mockBlockedIp as any);

      await service.blockIp(mockIp, 'Test', mockAdminUserId);

      expect(securityEventService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: SecurityEventType.IP_BLOCKED,
          severity: SecurityEventSeverity.MEDIUM,
          ipAddress: mockIp,
          userId: mockAdminUserId,
        }),
      );
    });

    it('debe usar duracion por defecto de 30 minutos si no se especifica', async () => {
      blockedIpRepository.findOne.mockResolvedValue(null);
      blockedIpRepository.create.mockReturnValue(mockBlockedIp as any);
      blockedIpRepository.save.mockResolvedValue(mockBlockedIp as any);

      await service.blockIp(mockIp, 'Test', mockAdminUserId);

      const createCall = blockedIpRepository.create.mock.calls[0][0] as any;
      const expectedExpiry = Date.now() + 30 * 60 * 1000;
      const actualExpiry = createCall.expiresAt.getTime();
      // Allow 5 seconds tolerance
      expect(Math.abs(actualExpiry - expectedExpiry)).toBeLessThan(5000);
    });
  });

  describe('autoBlockIp', () => {
    it('debe crear bloqueo automatico por el sistema', async () => {
      blockedIpRepository.findOne.mockResolvedValue(null);
      blockedIpRepository.create.mockReturnValue(mockBlockedIp as any);
      blockedIpRepository.save.mockResolvedValue(mockBlockedIp as any);

      const result = await service.autoBlockIp(
        mockIp,
        '10 intentos fallidos',
        30,
      );

      expect(blockedIpRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          ipAddress: mockIp,
          reason: '10 intentos fallidos',
          blockedBy: BlockedByType.SYSTEM,
          permanent: false,
          isActive: true,
        }),
      );
      expect(result).toEqual(mockBlockedIp);
    });

    it('debe extender bloqueo existente si ya esta bloqueada', async () => {
      const existingBlock = {
        ...mockBlockedIp,
        isActive: true,
        reason: 'Razon original',
        isExpired: jest.fn().mockReturnValue(false),
      };
      blockedIpRepository.findOne.mockResolvedValue(existingBlock as any);
      blockedIpRepository.save.mockResolvedValue(existingBlock as any);

      await service.autoBlockIp(mockIp, 'Nueva razon', 60);

      expect(blockedIpRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          reason: expect.stringContaining('Razon original | Nueva razon'),
        }),
      );
    });

    it('debe registrar evento de seguridad con severidad HIGH', async () => {
      blockedIpRepository.findOne.mockResolvedValue(null);
      blockedIpRepository.create.mockReturnValue(mockBlockedIp as any);
      blockedIpRepository.save.mockResolvedValue(mockBlockedIp as any);

      await service.autoBlockIp(mockIp, 'Auto-bloqueo', 30);

      expect(securityEventService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: SecurityEventType.IP_BLOCKED,
          severity: SecurityEventSeverity.HIGH,
          metadata: { durationMinutes: 30, autoBlocked: true },
        }),
      );
    });

    it('debe usar duracion por defecto de 30 minutos', async () => {
      blockedIpRepository.findOne.mockResolvedValue(null);
      blockedIpRepository.create.mockReturnValue(mockBlockedIp as any);
      blockedIpRepository.save.mockResolvedValue(mockBlockedIp as any);

      await service.autoBlockIp(mockIp, 'Test');

      const createCall = blockedIpRepository.create.mock.calls[0][0] as any;
      const expectedExpiry = Date.now() + 30 * 60 * 1000;
      const actualExpiry = createCall.expiresAt.getTime();
      expect(Math.abs(actualExpiry - expectedExpiry)).toBeLessThan(5000);
    });
  });

  describe('unblockIp', () => {
    it('debe desbloquear una IP existente', async () => {
      blockedIpRepository.findOne.mockResolvedValue(mockBlockedIp as any);
      blockedIpRepository.save.mockResolvedValue({
        ...mockBlockedIp,
        isActive: false,
      } as any);

      const result = await service.unblockIp(mockIp, mockAdminUserId);

      expect(result).toBe(true);
      expect(blockedIpRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ isActive: false }),
      );
    });

    it('debe retornar false si la IP no esta en la BD', async () => {
      blockedIpRepository.findOne.mockResolvedValue(null);

      const result = await service.unblockIp('10.0.0.1');

      expect(result).toBe(false);
    });

    it('debe registrar evento de seguridad IP_UNBLOCKED', async () => {
      blockedIpRepository.findOne.mockResolvedValue(mockBlockedIp as any);
      blockedIpRepository.save.mockResolvedValue({
        ...mockBlockedIp,
        isActive: false,
      } as any);

      await service.unblockIp(mockIp, mockAdminUserId);

      expect(securityEventService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: SecurityEventType.IP_UNBLOCKED,
          severity: SecurityEventSeverity.LOW,
          ipAddress: mockIp,
          userId: mockAdminUserId,
        }),
      );
    });

    it('debe funcionar sin adminUserId', async () => {
      blockedIpRepository.findOne.mockResolvedValue(mockBlockedIp as any);
      blockedIpRepository.save.mockResolvedValue({
        ...mockBlockedIp,
        isActive: false,
      } as any);

      const result = await service.unblockIp(mockIp);

      expect(result).toBe(true);
      expect(securityEventService.create).toHaveBeenCalledWith(
        expect.objectContaining({ userId: undefined }),
      );
    });
  });

  describe('findAllActive', () => {
    it('debe retornar todas las IPs bloqueadas activas', async () => {
      blockedIpRepository.find.mockResolvedValue([mockBlockedIp as any]);

      const result = await service.findAllActive();

      expect(blockedIpRepository.find).toHaveBeenCalledWith({
        where: { isActive: true },
        relations: ['blockedByUser'],
        order: { createdAt: 'DESC' },
      });
      expect(result).toEqual([mockBlockedIp]);
    });

    it('debe retornar array vacio si no hay IPs bloqueadas', async () => {
      blockedIpRepository.find.mockResolvedValue([]);

      const result = await service.findAllActive();

      expect(result).toEqual([]);
    });
  });

  describe('cleanExpiredBlocks', () => {
    it('debe limpiar bloqueos expirados y refrescar cache', async () => {
      blockedIpRepository.update.mockResolvedValue({ affected: 3 } as any);
      // refreshCache call
      blockedIpRepository.find.mockResolvedValue([]);

      const result = await service.cleanExpiredBlocks();

      expect(blockedIpRepository.update).toHaveBeenCalledWith(
        expect.objectContaining({
          isActive: true,
          permanent: false,
        }),
        { isActive: false },
      );
      expect(result).toBe(3);
    });

    it('debe retornar 0 si no hay bloqueos expirados', async () => {
      blockedIpRepository.update.mockResolvedValue({ affected: 0 } as any);

      const result = await service.cleanExpiredBlocks();

      expect(result).toBe(0);
    });

    it('debe manejar affected undefined', async () => {
      blockedIpRepository.update.mockResolvedValue({
        affected: undefined,
      } as any);

      const result = await service.cleanExpiredBlocks();

      expect(result).toBe(0);
    });
  });

  describe('getStats', () => {
    it('debe retornar estadisticas completas', async () => {
      const blockedIps = [
        {
          ...mockBlockedIp,
          blockedBy: BlockedByType.SYSTEM,
          permanent: false,
        },
        {
          ...mockBlockedIp,
          id: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
          blockedBy: BlockedByType.ADMIN,
          permanent: true,
        },
        {
          ...mockBlockedIp,
          id: 'c3d4e5f6-a7b8-9012-cdef-123456789012',
          blockedBy: BlockedByType.SYSTEM,
          permanent: false,
        },
      ];
      blockedIpRepository.find.mockResolvedValue(blockedIps as any);

      const result = await service.getStats();

      expect(result.totalActive).toBe(3);
      expect(result.totalPermanent).toBe(1);
      expect(result.totalAutoBlocked).toBe(2);
      expect(result.totalManualBlocked).toBe(1);
      expect(result.recentBlocks.length).toBeLessThanOrEqual(10);
    });

    it('debe retornar estadisticas vacias si no hay IPs bloqueadas', async () => {
      blockedIpRepository.find.mockResolvedValue([]);

      const result = await service.getStats();

      expect(result).toEqual({
        totalActive: 0,
        totalPermanent: 0,
        totalAutoBlocked: 0,
        totalManualBlocked: 0,
        recentBlocks: [],
      });
    });

    it('debe limitar recentBlocks a 10', async () => {
      const manyBlocks = Array.from({ length: 15 }, (_, i) => ({
        ...mockBlockedIp,
        id: `id-${i}`,
        blockedBy: BlockedByType.SYSTEM,
        permanent: false,
      }));
      blockedIpRepository.find.mockResolvedValue(manyBlocks as any);

      const result = await service.getStats();

      expect(result.recentBlocks).toHaveLength(10);
    });
  });
});
