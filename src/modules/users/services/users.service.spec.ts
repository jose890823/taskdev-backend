import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { Repository } from 'typeorm';
import { UsersService } from './users.service';
import { SmsService } from './sms.service';
import { EncryptionService } from '../../../shared/encryption.service';
import { User, UserRole } from '../../auth/entities/user.entity';
import { UpdateProfileDto } from '../dto/update-profile.dto';
import { UpdateUserAdminDto } from '../dto/update-user-admin.dto';
import { UserFilterDto } from '../dto/user-filter.dto';
import * as bcrypt from 'bcrypt';

// Mock bcrypt at module level
jest.mock('bcrypt', () => ({
  hash: jest.fn().mockResolvedValue('$2b$10$hashedPassword'),
}));

describe('UsersService', () => {
  let service: UsersService;
  let userRepository: jest.Mocked<Repository<User>>;
  let smsService: jest.Mocked<SmsService>;
  let encryptionService: jest.Mocked<EncryptionService>;

  // ── Mock data ──────────────────────────────────────────────

  const mockUserId = '123e4567-e89b-12d3-a456-426614174000';
  const mockUserId2 = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

  const createMockUser = (overrides: Partial<User> = {}): User => {
    const user = {
      id: mockUserId,
      systemCode: 'USR-260206-A3K7',
      email: 'test@example.com',
      password: '$2b$10$hashedPassword',
      firstName: 'Juan',
      lastName: 'Perez',
      slug: 'juan-perez',
      phone: '+1234567890',
      roles: [UserRole.USER],
      emailVerified: true,
      phoneVerified: false,
      isActive: true,
      isSystemUser: false,
      lastLoginAt: null,
      profilePhoto: null,
      address: null,
      city: null,
      state: null,
      zipCode: null,
      country: null,
      dateOfBirth: null,
      identificationNumber: null,
      preferredLanguage: 'es',
      preferredCurrency: 'USD',
      preferredTimezone: 'America/New_York',
      refreshToken: null,
      refreshTokenExpiresAt: null,
      otpCode: null,
      otpExpiresAt: null,
      otpAttempts: 0,
      resetPasswordToken: null,
      resetPasswordExpiresAt: null,
      createdAt: new Date('2026-01-01'),
      updatedAt: new Date('2026-01-01'),
      deletedAt: null,
      // Methods
      get fullName() {
        return `${this.firstName} ${this.lastName}`;
      },
      get role() {
        if (!this.roles || this.roles.length === 0) return UserRole.USER;
        const hierarchy = [UserRole.SUPER_ADMIN, UserRole.USER];
        for (const r of hierarchy) {
          if (this.roles.includes(r)) return r;
        }
        return this.roles[0];
      },
      hasRole(role: UserRole) {
        return this.roles?.includes(role) ?? false;
      },
      hasAnyRole(roles: UserRole[]) {
        return roles.some((r) => this.hasRole(r));
      },
      isAdmin() {
        return this.hasRole(UserRole.SUPER_ADMIN);
      },
      isSuperAdmin() {
        return this.hasRole(UserRole.SUPER_ADMIN);
      },
      isUser() {
        return this.hasRole(UserRole.USER);
      },
      isOtpExpired() {
        if (!this.otpExpiresAt) return true;
        return new Date() > this.otpExpiresAt;
      },
      isResetTokenExpired() {
        if (!this.resetPasswordExpiresAt) return true;
        return new Date() > this.resetPasswordExpiresAt;
      },
      hasReachedMaxOtpAttempts(maxAttempts: number) {
        return this.otpAttempts >= maxAttempts;
      },
      generateSystemCode: jest.fn(),
      ...overrides,
    } as unknown as User;
    return user;
  };

  const mockUser = createMockUser();

  const mockSuperAdmin = createMockUser({
    id: mockUserId2,
    email: 'admin@taskhub.dev',
    firstName: 'Super',
    lastName: 'Admin',
    roles: [UserRole.SUPER_ADMIN],
    isSystemUser: true,
  });

  // ── QueryBuilder helper ────────────────────────────────────

  const createMockQueryBuilder = (overrides: Record<string, any> = {}) => {
    const qb: Record<string, jest.Mock> = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orWhere: jest.fn().mockReturnThis(),
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
      getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      getCount: jest.fn().mockResolvedValue(0),
      ...overrides,
    };
    // Make every method return `this` by default (chainable)
    for (const key of Object.keys(qb)) {
      if (
        !overrides[key] &&
        !['getMany', 'getManyAndCount', 'getCount'].includes(key)
      ) {
        qb[key] = jest.fn().mockReturnValue(qb);
      }
    }
    // Re-apply overrides for terminal methods
    if (overrides.getMany) qb.getMany = overrides.getMany;
    if (overrides.getManyAndCount)
      qb.getManyAndCount = overrides.getManyAndCount;
    if (overrides.getCount) qb.getCount = overrides.getCount;
    return qb;
  };

  // ── Test module setup ──────────────────────────────────────

  beforeEach(async () => {
    const mockUserRepository = {
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      softRemove: jest.fn(),
      count: jest.fn(),
      createQueryBuilder: jest.fn(),
    };

    const mockSmsService = {
      sendPhoneVerificationOtp: jest.fn().mockResolvedValue(true),
      sendSms: jest.fn().mockResolvedValue(true),
      isAvailable: jest.fn().mockReturnValue(true),
    };

    const mockEncryptionService = {
      encrypt: jest.fn().mockReturnValue('encrypted-value'),
      decrypt: jest.fn().mockReturnValue('decrypted-value'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: getRepositoryToken(User),
          useValue: mockUserRepository,
        },
        {
          provide: SmsService,
          useValue: mockSmsService,
        },
        {
          provide: EncryptionService,
          useValue: mockEncryptionService,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    userRepository = module.get(getRepositoryToken(User));
    smsService = module.get(SmsService);
    encryptionService = module.get(EncryptionService);
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ================================================================
  // USER PROFILE MANAGEMENT
  // ================================================================

  describe('findById', () => {
    it('should return user when found', async () => {
      userRepository.findOne.mockResolvedValue(mockUser);

      const result = await service.findById(mockUserId);

      expect(userRepository.findOne).toHaveBeenCalledWith({
        where: { id: mockUserId },
      });
      expect(result).toEqual(mockUser);
    });

    it('should throw NotFoundException when user not found', async () => {
      userRepository.findOne.mockResolvedValue(null);

      await expect(service.findById('non-existent-id')).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.findById('non-existent-id')).rejects.toThrow(
        'User not found',
      );
    });
  });

  describe('updateProfile', () => {
    it('should update basic profile fields', async () => {
      const user = createMockUser();
      userRepository.findOne.mockResolvedValue(user);
      userRepository.save.mockImplementation(async (u) => u as User);

      const dto: UpdateProfileDto = {
        firstName: 'Carlos',
        lastName: 'Garcia',
        address: '456 Oak Ave',
        city: 'Orlando',
        state: 'Florida',
        zipCode: '32801',
        country: 'United States',
      };

      const result = await service.updateProfile(mockUserId, dto);

      expect(result.firstName).toBe('Carlos');
      expect(result.lastName).toBe('Garcia');
      expect(result.address).toBe('456 Oak Ave');
      expect(result.city).toBe('Orlando');
      expect(result.state).toBe('Florida');
      expect(result.zipCode).toBe('32801');
      expect(result.country).toBe('United States');
      expect(userRepository.save).toHaveBeenCalled();
    });

    it('should update dateOfBirth as Date object', async () => {
      const user = createMockUser();
      userRepository.findOne.mockResolvedValue(user);
      userRepository.save.mockImplementation(async (u) => u as User);

      const dto: UpdateProfileDto = { dateOfBirth: '1990-05-15' };

      const result = await service.updateProfile(mockUserId, dto);

      expect(result.dateOfBirth).toBeInstanceOf(Date);
      expect(userRepository.save).toHaveBeenCalled();
    });

    it('should encrypt identification number when provided', async () => {
      const user = createMockUser();
      userRepository.findOne.mockResolvedValue(user);
      userRepository.save.mockImplementation(async (u) => u as User);

      const dto: UpdateProfileDto = { identificationNumber: 'V-12345678' };

      await service.updateProfile(mockUserId, dto);

      expect(encryptionService.encrypt).toHaveBeenCalledWith('V-12345678');
      expect(userRepository.save).toHaveBeenCalled();
    });

    it('should mark phone as unverified when phone changes', async () => {
      const user = createMockUser({
        phone: '+1111111111',
        phoneVerified: true,
      });
      userRepository.findOne.mockResolvedValue(user);
      userRepository.save.mockImplementation(async (u) => u as User);

      const dto: UpdateProfileDto = { phone: '+9999999999' };

      const result = await service.updateProfile(mockUserId, dto);

      expect(result.phone).toBe('+9999999999');
      expect(result.phoneVerified).toBe(false);
    });

    it('should NOT mark phone as unverified when phone is the same', async () => {
      const user = createMockUser({
        phone: '+1234567890',
        phoneVerified: true,
      });
      userRepository.findOne.mockResolvedValue(user);
      userRepository.save.mockImplementation(async (u) => u as User);

      const dto: UpdateProfileDto = { phone: '+1234567890' };

      const result = await service.updateProfile(mockUserId, dto);

      // Phone didn't change, phoneVerified should stay true
      expect(result.phoneVerified).toBe(true);
    });

    it('should throw NotFoundException if user does not exist', async () => {
      userRepository.findOne.mockResolvedValue(null);

      await expect(
        service.updateProfile('non-existent', { firstName: 'New' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should not modify fields not present in dto', async () => {
      const user = createMockUser({
        firstName: 'Original',
        lastName: 'Name',
        city: 'Miami',
      });
      userRepository.findOne.mockResolvedValue(user);
      userRepository.save.mockImplementation(async (u) => u as User);

      // Only update firstName
      const dto: UpdateProfileDto = { firstName: 'Updated' };

      const result = await service.updateProfile(mockUserId, dto);

      expect(result.firstName).toBe('Updated');
      expect(result.lastName).toBe('Name');
      expect(result.city).toBe('Miami');
    });
  });

  describe('updateProfilePhoto', () => {
    it('should update the profile photo URL', async () => {
      const user = createMockUser();
      userRepository.findOne.mockResolvedValue(user);
      userRepository.save.mockImplementation(async (u) => u as User);

      const result = await service.updateProfilePhoto(
        mockUserId,
        'https://storage.example.com/photo.jpg',
      );

      expect(result.profilePhoto).toBe('https://storage.example.com/photo.jpg');
      expect(userRepository.save).toHaveBeenCalled();
    });

    it('should throw NotFoundException if user not found', async () => {
      userRepository.findOne.mockResolvedValue(null);

      await expect(
        service.updateProfilePhoto('non-existent', 'https://photo.jpg'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteProfilePhoto', () => {
    it('should set profile photo to null', async () => {
      const user = createMockUser({ profilePhoto: 'https://old-photo.jpg' });
      userRepository.findOne.mockResolvedValue(user);
      userRepository.save.mockImplementation(async (u) => u as User);

      const result = await service.deleteProfilePhoto(mockUserId);

      expect(result.profilePhoto).toBeNull();
      expect(userRepository.save).toHaveBeenCalled();
    });

    it('should throw NotFoundException if user not found', async () => {
      userRepository.findOne.mockResolvedValue(null);

      await expect(service.deleteProfilePhoto('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ================================================================
  // PHONE VERIFICATION
  // ================================================================

  describe('sendPhoneOtp', () => {
    it('should generate OTP, save it, and send SMS', async () => {
      const user = createMockUser({ phoneVerified: false });
      userRepository.findOne.mockResolvedValue(user);
      userRepository.save.mockImplementation(async (u) => u as User);

      await service.sendPhoneOtp(mockUserId, { phone: '+9876543210' });

      expect(userRepository.save).toHaveBeenCalled();
      const savedUser = (userRepository.save as jest.Mock).mock.calls[0][0];
      expect(savedUser.otpCode).toBeDefined();
      expect(savedUser.otpCode).toMatch(/^\d{6}$/);
      expect(savedUser.otpExpiresAt).toBeInstanceOf(Date);
      expect(savedUser.otpAttempts).toBe(0);
      expect(smsService.sendPhoneVerificationOtp).toHaveBeenCalledWith(
        '+9876543210',
        expect.any(String),
      );
    });

    it('should throw BadRequestException if phone already verified with same number', async () => {
      const user = createMockUser({
        phone: '+1234567890',
        phoneVerified: true,
      });
      userRepository.findOne.mockResolvedValue(user);

      await expect(
        service.sendPhoneOtp(mockUserId, { phone: '+1234567890' }),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.sendPhoneOtp(mockUserId, { phone: '+1234567890' }),
      ).rejects.toThrow('Phone already verified');
    });

    it('should allow sending OTP if phone is verified but number is different', async () => {
      const user = createMockUser({
        phone: '+1111111111',
        phoneVerified: true,
      });
      userRepository.findOne.mockResolvedValue(user);
      userRepository.save.mockImplementation(async (u) => u as User);

      // Different phone number → should proceed
      await expect(
        service.sendPhoneOtp(mockUserId, { phone: '+2222222222' }),
      ).resolves.not.toThrow();
    });

    it('should update phone and mark unverified if phone differs', async () => {
      const user = createMockUser({
        phone: '+1111111111',
        phoneVerified: false,
      });
      userRepository.findOne.mockResolvedValue(user);
      userRepository.save.mockImplementation(async (u) => u as User);

      await service.sendPhoneOtp(mockUserId, { phone: '+2222222222' });

      const savedUser = (userRepository.save as jest.Mock).mock.calls[0][0];
      expect(savedUser.phone).toBe('+2222222222');
      expect(savedUser.phoneVerified).toBe(false);
    });

    it('should throw NotFoundException if user not found', async () => {
      userRepository.findOne.mockResolvedValue(null);

      await expect(
        service.sendPhoneOtp('non-existent', { phone: '+1234567890' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('verifyPhone', () => {
    it('should verify phone when OTP is correct', async () => {
      const futureDate = new Date(Date.now() + 10 * 60 * 1000);
      const user = createMockUser({
        phoneVerified: false,
        otpCode: '123456',
        otpExpiresAt: futureDate,
        otpAttempts: 0,
      });
      userRepository.findOne.mockResolvedValue(user);
      userRepository.save.mockImplementation(async (u) => u as User);

      const result = await service.verifyPhone(mockUserId, {
        otpCode: '123456',
      });

      expect(result.phoneVerified).toBe(true);
      expect(result.otpCode).toBeNull();
      expect(result.otpExpiresAt).toBeNull();
      expect(result.otpAttempts).toBe(0);
    });

    it('should throw BadRequestException if phone already verified', async () => {
      const user = createMockUser({ phoneVerified: true });
      userRepository.findOne.mockResolvedValue(user);

      await expect(
        service.verifyPhone(mockUserId, { otpCode: '123456' }),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.verifyPhone(mockUserId, { otpCode: '123456' }),
      ).rejects.toThrow('Phone already verified');
    });

    it('should throw BadRequestException if no OTP exists', async () => {
      const user = createMockUser({
        phoneVerified: false,
        otpCode: null,
        otpExpiresAt: null,
      });
      userRepository.findOne.mockResolvedValue(user);

      await expect(
        service.verifyPhone(mockUserId, { otpCode: '123456' }),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.verifyPhone(mockUserId, { otpCode: '123456' }),
      ).rejects.toThrow('No OTP found');
    });

    it('should throw BadRequestException if OTP is expired', async () => {
      const pastDate = new Date(Date.now() - 60 * 1000); // 1 min ago
      const user = createMockUser({
        phoneVerified: false,
        otpCode: '123456',
        otpExpiresAt: pastDate,
        otpAttempts: 0,
      });
      userRepository.findOne.mockResolvedValue(user);

      await expect(
        service.verifyPhone(mockUserId, { otpCode: '123456' }),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.verifyPhone(mockUserId, { otpCode: '123456' }),
      ).rejects.toThrow('OTP expired');
    });

    it('should throw BadRequestException if max attempts reached', async () => {
      const futureDate = new Date(Date.now() + 10 * 60 * 1000);
      const user = createMockUser({
        phoneVerified: false,
        otpCode: '123456',
        otpExpiresAt: futureDate,
        otpAttempts: 3,
      });
      userRepository.findOne.mockResolvedValue(user);

      await expect(
        service.verifyPhone(mockUserId, { otpCode: '123456' }),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.verifyPhone(mockUserId, { otpCode: '123456' }),
      ).rejects.toThrow('Maximum OTP attempts reached');
    });

    it('should increment attempts and throw BadRequestException on wrong OTP', async () => {
      const futureDate = new Date(Date.now() + 10 * 60 * 1000);
      const user = createMockUser({
        phoneVerified: false,
        otpCode: '123456',
        otpExpiresAt: futureDate,
        otpAttempts: 0,
      });
      userRepository.findOne.mockResolvedValue(user);
      userRepository.save.mockImplementation(async (u) => u as User);

      await expect(
        service.verifyPhone(mockUserId, { otpCode: '999999' }),
      ).rejects.toThrow(BadRequestException);

      // Check that attempts were incremented and saved
      expect(userRepository.save).toHaveBeenCalled();
      const savedUser = (userRepository.save as jest.Mock).mock.calls[0][0];
      expect(savedUser.otpAttempts).toBe(1);
    });

    it('should show remaining attempts in error message', async () => {
      const futureDate = new Date(Date.now() + 10 * 60 * 1000);
      const user = createMockUser({
        phoneVerified: false,
        otpCode: '123456',
        otpExpiresAt: futureDate,
        otpAttempts: 1,
      });
      userRepository.findOne.mockResolvedValue(user);
      userRepository.save.mockImplementation(async (u) => u as User);

      await expect(
        service.verifyPhone(mockUserId, { otpCode: '999999' }),
      ).rejects.toThrow('Invalid OTP. 1 attempts remaining');
    });

    it('should throw NotFoundException if user not found', async () => {
      userRepository.findOne.mockResolvedValue(null);

      await expect(
        service.verifyPhone('non-existent', { otpCode: '123456' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ================================================================
  // ADMIN OPERATIONS
  // ================================================================

  describe('findAll', () => {
    it('should return paginated users with default params', async () => {
      const mockQb = createMockQueryBuilder({
        getManyAndCount: jest.fn().mockResolvedValue([[mockUser], 1]),
      });
      userRepository.createQueryBuilder.mockReturnValue(mockQb as any);

      const filter: UserFilterDto = {};
      const result = await service.findAll(filter);

      expect(result.data).toEqual([mockUser]);
      expect(result.pagination).toEqual({
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
      });
      expect(mockQb.orderBy).toHaveBeenCalledWith('user.createdAt', 'DESC');
      expect(mockQb.skip).toHaveBeenCalledWith(0);
      expect(mockQb.take).toHaveBeenCalledWith(20);
    });

    it('should apply search filter', async () => {
      const mockQb = createMockQueryBuilder({
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      });
      userRepository.createQueryBuilder.mockReturnValue(mockQb as any);

      await service.findAll({ search: 'juan' } as UserFilterDto);

      expect(mockQb.andWhere).toHaveBeenCalledWith(
        '(user.firstName ILIKE :search OR user.lastName ILIKE :search OR user.email ILIKE :search)',
        { search: '%juan%' },
      );
    });

    it('should apply businessId filter', async () => {
      const mockQb = createMockQueryBuilder({
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      });
      userRepository.createQueryBuilder.mockReturnValue(mockQb as any);

      const bizId = 'b1b2c3d4-e5f6-7890-abcd-ef1234567890';
      await service.findAll({ businessId: bizId } as UserFilterDto);

      expect(mockQb.andWhere).toHaveBeenCalledWith(
        'user.businessId = :businessId',
        { businessId: bizId },
      );
    });

    it('should apply role filter with exact match patterns', async () => {
      const mockQb = createMockQueryBuilder({
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      });
      userRepository.createQueryBuilder.mockReturnValue(mockQb as any);

      await service.findAll({ role: UserRole.USER } as UserFilterDto);

      expect(mockQb.andWhere).toHaveBeenCalledWith(
        '(user.roles = :exactRole OR user.roles LIKE :startRole OR user.roles LIKE :endRole OR user.roles LIKE :midRole)',
        {
          exactRole: UserRole.USER,
          startRole: `${UserRole.USER},%`,
          endRole: `%,${UserRole.USER}`,
          midRole: `%,${UserRole.USER},%`,
        },
      );
    });

    it('should apply isActive filter', async () => {
      const mockQb = createMockQueryBuilder({
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      });
      userRepository.createQueryBuilder.mockReturnValue(mockQb as any);

      await service.findAll({ isActive: true } as UserFilterDto);

      expect(mockQb.andWhere).toHaveBeenCalledWith(
        'user.isActive = :isActive',
        { isActive: true },
      );
    });

    it('should apply emailVerified filter', async () => {
      const mockQb = createMockQueryBuilder({
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      });
      userRepository.createQueryBuilder.mockReturnValue(mockQb as any);

      await service.findAll({ emailVerified: false } as UserFilterDto);

      expect(mockQb.andWhere).toHaveBeenCalledWith(
        'user.emailVerified = :emailVerified',
        { emailVerified: false },
      );
    });

    it('should apply phoneVerified filter', async () => {
      const mockQb = createMockQueryBuilder({
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      });
      userRepository.createQueryBuilder.mockReturnValue(mockQb as any);

      await service.findAll({ phoneVerified: true } as UserFilterDto);

      expect(mockQb.andWhere).toHaveBeenCalledWith(
        'user.phoneVerified = :phoneVerified',
        { phoneVerified: true },
      );
    });

    it('should use whitelisted sortBy field', async () => {
      const mockQb = createMockQueryBuilder({
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      });
      userRepository.createQueryBuilder.mockReturnValue(mockQb as any);

      await service.findAll({
        sortBy: 'email',
        sortOrder: 'ASC',
      } as UserFilterDto);

      expect(mockQb.orderBy).toHaveBeenCalledWith('user.email', 'ASC');
    });

    it('should fallback to createdAt when sortBy is not in whitelist (SQL injection prevention)', async () => {
      const mockQb = createMockQueryBuilder({
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      });
      userRepository.createQueryBuilder.mockReturnValue(mockQb as any);

      await service.findAll({
        sortBy: 'password; DROP TABLE users;--',
        sortOrder: 'ASC',
      } as UserFilterDto);

      expect(mockQb.orderBy).toHaveBeenCalledWith('user.createdAt', 'ASC');
    });

    it('should fallback to createdAt for unknown sortBy fields', async () => {
      const mockQb = createMockQueryBuilder({
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      });
      userRepository.createQueryBuilder.mockReturnValue(mockQb as any);

      await service.findAll({ sortBy: 'nonExistentField' } as UserFilterDto);

      expect(mockQb.orderBy).toHaveBeenCalledWith('user.createdAt', 'DESC');
    });

    it('should accept all valid whitelist fields', async () => {
      const validFields = [
        'createdAt',
        'updatedAt',
        'email',
        'firstName',
        'lastName',
        'isActive',
      ];

      for (const field of validFields) {
        const mockQb = createMockQueryBuilder({
          getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
        });
        userRepository.createQueryBuilder.mockReturnValue(mockQb as any);

        await service.findAll({ sortBy: field } as UserFilterDto);

        expect(mockQb.orderBy).toHaveBeenCalledWith(`user.${field}`, 'DESC');
      }
    });

    it('should handle pagination correctly', async () => {
      const mockQb = createMockQueryBuilder({
        getManyAndCount: jest.fn().mockResolvedValue([[], 50]),
      });
      userRepository.createQueryBuilder.mockReturnValue(mockQb as any);

      const result = await service.findAll({
        page: 3,
        limit: 10,
      } as UserFilterDto);

      expect(mockQb.skip).toHaveBeenCalledWith(20); // (3-1) * 10
      expect(mockQb.take).toHaveBeenCalledWith(10);
      expect(result.pagination).toEqual({
        total: 50,
        page: 3,
        limit: 10,
        totalPages: 5,
      });
    });

    it('should combine multiple filters', async () => {
      const mockQb = createMockQueryBuilder({
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      });
      userRepository.createQueryBuilder.mockReturnValue(mockQb as any);

      await service.findAll({
        search: 'test',
        role: UserRole.USER,
        isActive: true,
        emailVerified: true,
        sortBy: 'email',
        sortOrder: 'ASC',
        page: 2,
        limit: 5,
      } as UserFilterDto);

      // All filters should be called
      expect(mockQb.andWhere).toHaveBeenCalledTimes(4); // search, role, isActive, emailVerified
      expect(mockQb.orderBy).toHaveBeenCalledWith('user.email', 'ASC');
      expect(mockQb.skip).toHaveBeenCalledWith(5); // (2-1) * 5
      expect(mockQb.take).toHaveBeenCalledWith(5);
    });
  });

  describe('updateRoles', () => {
    it('should update user roles', async () => {
      const user = createMockUser({ roles: [UserRole.USER] });
      userRepository.findOne.mockResolvedValue(user);
      userRepository.save.mockImplementation(async (u) => u as User);

      const result = await service.updateRoles(mockUserId, [
        UserRole.USER,
        UserRole.SUPER_ADMIN,
      ]);

      expect(result.roles).toEqual([UserRole.USER, UserRole.SUPER_ADMIN]);
    });

    it('should prevent removing super_admin from the last super admin', async () => {
      const user = createMockUser({ roles: [UserRole.SUPER_ADMIN] });
      userRepository.findOne.mockResolvedValue(user);

      const mockQb = createMockQueryBuilder({
        getCount: jest.fn().mockResolvedValue(1),
      });
      userRepository.createQueryBuilder.mockReturnValue(mockQb as any);

      await expect(
        service.updateRoles(mockUserId, [UserRole.USER]),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.updateRoles(mockUserId, [UserRole.USER]),
      ).rejects.toThrow(
        'Cannot remove super_admin role from the last super admin',
      );
    });

    it('should allow removing super_admin when there are other super admins', async () => {
      const user = createMockUser({ roles: [UserRole.SUPER_ADMIN] });
      userRepository.findOne.mockResolvedValue(user);
      userRepository.save.mockImplementation(async (u) => u as User);

      const mockQb = createMockQueryBuilder({
        getCount: jest.fn().mockResolvedValue(2),
      });
      userRepository.createQueryBuilder.mockReturnValue(mockQb as any);

      const result = await service.updateRoles(mockUserId, [UserRole.USER]);

      expect(result.roles).toEqual([UserRole.USER]);
    });

    it('should throw NotFoundException if user not found', async () => {
      userRepository.findOne.mockResolvedValue(null);

      await expect(
        service.updateRoles('non-existent', [UserRole.USER]),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateRole (deprecated)', () => {
    it('should delegate to updateRoles with single-element array', async () => {
      const user = createMockUser({ roles: [UserRole.USER] });
      userRepository.findOne.mockResolvedValue(user);
      userRepository.save.mockImplementation(async (u) => u as User);

      const spy = jest.spyOn(service, 'updateRoles');

      await service.updateRole(mockUserId, UserRole.USER);

      expect(spy).toHaveBeenCalledWith(mockUserId, [UserRole.USER]);
    });
  });

  describe('addRole', () => {
    it('should add a new role to the user', async () => {
      const user = createMockUser({ roles: [UserRole.USER] });
      userRepository.findOne.mockResolvedValue(user);
      userRepository.save.mockImplementation(async (u) => u as User);

      const result = await service.addRole(mockUserId, UserRole.SUPER_ADMIN);

      expect(result.roles).toContain(UserRole.SUPER_ADMIN);
      expect(result.roles).toContain(UserRole.USER);
      expect(userRepository.save).toHaveBeenCalled();
    });

    it('should not duplicate an existing role', async () => {
      const user = createMockUser({ roles: [UserRole.USER] });
      userRepository.findOne.mockResolvedValue(user);

      const result = await service.addRole(mockUserId, UserRole.USER);

      // Should not call save if role already exists
      expect(userRepository.save).not.toHaveBeenCalled();
      expect(result.roles).toEqual([UserRole.USER]);
    });

    it('should throw NotFoundException if user not found', async () => {
      userRepository.findOne.mockResolvedValue(null);

      await expect(
        service.addRole('non-existent', UserRole.USER),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('removeRole', () => {
    it('should remove a role from the user', async () => {
      const user = createMockUser({
        roles: [UserRole.USER, UserRole.SUPER_ADMIN],
      });
      userRepository.findOne.mockResolvedValue(user);
      userRepository.save.mockImplementation(async (u) => u as User);

      // Need to mock countUsersWithRole — there are 2 super admins
      const mockQb = createMockQueryBuilder({
        getCount: jest.fn().mockResolvedValue(2),
      });
      userRepository.createQueryBuilder.mockReturnValue(mockQb as any);

      const result = await service.removeRole(mockUserId, UserRole.SUPER_ADMIN);

      expect(result.roles).toEqual([UserRole.USER]);
      expect(result.roles).not.toContain(UserRole.SUPER_ADMIN);
    });

    it('should prevent removing super_admin from the last super admin', async () => {
      const user = createMockUser({
        roles: [UserRole.SUPER_ADMIN, UserRole.USER],
      });
      userRepository.findOne.mockResolvedValue(user);

      const mockQb = createMockQueryBuilder({
        getCount: jest.fn().mockResolvedValue(1),
      });
      userRepository.createQueryBuilder.mockReturnValue(mockQb as any);

      await expect(
        service.removeRole(mockUserId, UserRole.SUPER_ADMIN),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.removeRole(mockUserId, UserRole.SUPER_ADMIN),
      ).rejects.toThrow(
        'Cannot remove super_admin role from the last super admin',
      );
    });

    it('should prevent removing the last role (user must have at least one)', async () => {
      const user = createMockUser({ roles: [UserRole.USER] });
      userRepository.findOne.mockResolvedValue(user);

      await expect(
        service.removeRole(mockUserId, UserRole.USER),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.removeRole(mockUserId, UserRole.USER),
      ).rejects.toThrow('User must have at least one role');
    });

    it('should throw NotFoundException if user not found', async () => {
      userRepository.findOne.mockResolvedValue(null);

      await expect(
        service.removeRole('non-existent', UserRole.USER),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('toggleActive', () => {
    it('should activate a user', async () => {
      const user = createMockUser({ isActive: false });
      userRepository.findOne.mockResolvedValue(user);
      userRepository.save.mockImplementation(async (u) => u as User);

      const result = await service.toggleActive(mockUserId, true);

      expect(result.isActive).toBe(true);
    });

    it('should deactivate a regular user', async () => {
      const user = createMockUser({ isActive: true, roles: [UserRole.USER] });
      userRepository.findOne.mockResolvedValue(user);
      userRepository.save.mockImplementation(async (u) => u as User);

      const result = await service.toggleActive(mockUserId, false);

      expect(result.isActive).toBe(false);
    });

    it('should prevent deactivating a super admin', async () => {
      const user = createMockUser({
        isActive: true,
        roles: [UserRole.SUPER_ADMIN],
      });
      userRepository.findOne.mockResolvedValue(user);

      await expect(service.toggleActive(mockUserId, false)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.toggleActive(mockUserId, false)).rejects.toThrow(
        'Cannot deactivate super admin',
      );
    });

    it('should throw NotFoundException if user not found', async () => {
      userRepository.findOne.mockResolvedValue(null);

      await expect(service.toggleActive('non-existent', true)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('deleteUser', () => {
    it('should soft-delete a regular user', async () => {
      const user = createMockUser({
        roles: [UserRole.USER],
        isSystemUser: false,
      });
      userRepository.findOne.mockResolvedValue(user);
      userRepository.softRemove.mockResolvedValue(user);

      await service.deleteUser(mockUserId);

      expect(userRepository.softRemove).toHaveBeenCalledWith(user);
    });

    it('should prevent deleting a system user', async () => {
      const user = createMockUser({ isSystemUser: true });
      userRepository.findOne.mockResolvedValue(user);

      await expect(service.deleteUser(mockUserId)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.deleteUser(mockUserId)).rejects.toThrow(
        'Cannot delete system user',
      );
    });

    it('should prevent deleting a super admin', async () => {
      const user = createMockUser({
        roles: [UserRole.SUPER_ADMIN],
        isSystemUser: false,
      });
      userRepository.findOne.mockResolvedValue(user);

      await expect(service.deleteUser(mockUserId)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.deleteUser(mockUserId)).rejects.toThrow(
        'Cannot delete super admin',
      );
    });

    it('should throw NotFoundException if user not found', async () => {
      userRepository.findOne.mockResolvedValue(null);

      await expect(service.deleteUser('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('updateUserAdmin', () => {
    it('should update basic fields (firstName, lastName)', async () => {
      const user = createMockUser();
      userRepository.findOne.mockResolvedValue(user);
      userRepository.save.mockImplementation(async (u) => u as User);

      const dto: UpdateUserAdminDto = {
        firstName: 'Carlos',
        lastName: 'Lopez',
      };

      const result = await service.updateUserAdmin(
        mockUserId,
        dto,
        mockSuperAdmin,
      );

      expect(result.firstName).toBe('Carlos');
      expect(result.lastName).toBe('Lopez');
    });

    it('should update email and auto-unverify when emailVerified not provided', async () => {
      const user = createMockUser({
        email: 'old@example.com',
        emailVerified: true,
      });
      userRepository.findOne
        .mockResolvedValueOnce(user) // findById
        .mockResolvedValueOnce(null); // email uniqueness check
      userRepository.save.mockImplementation(async (u) => u as User);

      const dto: UpdateUserAdminDto = { email: 'new@example.com' };

      const result = await service.updateUserAdmin(
        mockUserId,
        dto,
        mockSuperAdmin,
      );

      expect(result.email).toBe('new@example.com');
      expect(result.emailVerified).toBe(false);
    });

    it('should NOT auto-unverify email when emailVerified is explicitly provided', async () => {
      const user = createMockUser({
        email: 'old@example.com',
        emailVerified: true,
      });
      userRepository.findOne
        .mockResolvedValueOnce(user) // findById
        .mockResolvedValueOnce(null); // email uniqueness check
      userRepository.save.mockImplementation(async (u) => u as User);

      const dto: UpdateUserAdminDto = {
        email: 'new@example.com',
        emailVerified: true,
      };

      const result = await service.updateUserAdmin(
        mockUserId,
        dto,
        mockSuperAdmin,
      );

      expect(result.email).toBe('new@example.com');
      expect(result.emailVerified).toBe(true);
    });

    it('should throw ConflictException when email is already in use', async () => {
      const user = createMockUser({ email: 'old@example.com' });
      const otherUser = createMockUser({
        id: mockUserId2,
        email: 'taken@example.com',
      });

      userRepository.findOne
        .mockResolvedValueOnce(user) // findById
        .mockResolvedValueOnce(otherUser); // email uniqueness check

      const dto: UpdateUserAdminDto = { email: 'taken@example.com' };

      await expect(
        service.updateUserAdmin(mockUserId, dto, mockSuperAdmin),
      ).rejects.toThrow(new ConflictException('Email already in use'));
    });

    it('should update phone and auto-unverify when phoneVerified not provided', async () => {
      const user = createMockUser({
        phone: '+1111111111',
        phoneVerified: true,
      });
      userRepository.findOne.mockResolvedValue(user);
      userRepository.save.mockImplementation(async (u) => u as User);

      const dto: UpdateUserAdminDto = { phone: '+2222222222' };

      const result = await service.updateUserAdmin(
        mockUserId,
        dto,
        mockSuperAdmin,
      );

      expect(result.phone).toBe('+2222222222');
      expect(result.phoneVerified).toBe(false);
    });

    it('should NOT auto-unverify phone when phoneVerified is explicitly provided', async () => {
      const user = createMockUser({
        phone: '+1111111111',
        phoneVerified: true,
      });
      userRepository.findOne.mockResolvedValue(user);
      userRepository.save.mockImplementation(async (u) => u as User);

      const dto: UpdateUserAdminDto = {
        phone: '+2222222222',
        phoneVerified: true,
      };

      const result = await service.updateUserAdmin(
        mockUserId,
        dto,
        mockSuperAdmin,
      );

      expect(result.phone).toBe('+2222222222');
      expect(result.phoneVerified).toBe(true);
    });

    it('should throw ForbiddenException when non-super-admin changes verification status', async () => {
      const user = createMockUser({ emailVerified: false });
      userRepository.findOne.mockResolvedValue(user);

      const regularAdmin = createMockUser({
        id: mockUserId2,
        roles: [UserRole.USER],
      });

      const dto: UpdateUserAdminDto = { emailVerified: true };

      await expect(
        service.updateUserAdmin(mockUserId, dto, regularAdmin),
      ).rejects.toThrow(ForbiddenException);
      await expect(
        service.updateUserAdmin(mockUserId, dto, regularAdmin),
      ).rejects.toThrow(
        'Only super admins can change email or phone verification status',
      );
    });

    it('should allow non-super-admin when verification status does not actually change', async () => {
      const user = createMockUser({
        emailVerified: true,
        phoneVerified: false,
      });
      userRepository.findOne.mockResolvedValue(user);
      userRepository.save.mockImplementation(async (u) => u as User);

      const regularAdmin = createMockUser({
        id: mockUserId2,
        roles: [UserRole.USER],
      });

      // Same values → no real change
      const dto: UpdateUserAdminDto = {
        emailVerified: true,
        phoneVerified: false,
      };

      await expect(
        service.updateUserAdmin(mockUserId, dto, regularAdmin),
      ).resolves.not.toThrow();
    });

    it('should update roles array', async () => {
      const user = createMockUser({ roles: [UserRole.USER] });
      userRepository.findOne.mockResolvedValue(user);
      userRepository.save.mockImplementation(async (u) => u as User);

      const dto: UpdateUserAdminDto = {
        roles: [UserRole.USER, UserRole.SUPER_ADMIN],
      };

      const result = await service.updateUserAdmin(
        mockUserId,
        dto,
        mockSuperAdmin,
      );

      expect(result.roles).toEqual([UserRole.USER, UserRole.SUPER_ADMIN]);
    });

    it('should prevent removing super_admin role from last super admin via roles update', async () => {
      const user = createMockUser({ roles: [UserRole.SUPER_ADMIN] });
      userRepository.findOne.mockResolvedValue(user);

      const mockQb = createMockQueryBuilder({
        getCount: jest.fn().mockResolvedValue(1),
      });
      userRepository.createQueryBuilder.mockReturnValue(mockQb as any);

      const dto: UpdateUserAdminDto = { roles: [UserRole.USER] };

      await expect(
        service.updateUserAdmin(mockUserId, dto, mockSuperAdmin),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.updateUserAdmin(mockUserId, dto, mockSuperAdmin),
      ).rejects.toThrow(
        'Cannot remove super_admin role from the last super admin',
      );
    });

    it('should support legacy role field (converts to array)', async () => {
      const user = createMockUser({ roles: [UserRole.USER] });
      userRepository.findOne.mockResolvedValue(user);
      userRepository.save.mockImplementation(async (u) => u as User);

      const dto: UpdateUserAdminDto = { role: UserRole.SUPER_ADMIN };

      const result = await service.updateUserAdmin(
        mockUserId,
        dto,
        mockSuperAdmin,
      );

      expect(result.roles).toEqual([UserRole.SUPER_ADMIN]);
    });

    it('should prevent demoting last super admin via legacy role field', async () => {
      const user = createMockUser({ roles: [UserRole.SUPER_ADMIN] });
      userRepository.findOne.mockResolvedValue(user);

      const mockQb = createMockQueryBuilder({
        getCount: jest.fn().mockResolvedValue(1),
      });
      userRepository.createQueryBuilder.mockReturnValue(mockQb as any);

      const dto: UpdateUserAdminDto = { role: UserRole.USER };

      await expect(
        service.updateUserAdmin(mockUserId, dto, mockSuperAdmin),
      ).rejects.toThrow(BadRequestException);
    });

    it('should prevent deactivating super admin via isActive', async () => {
      const user = createMockUser({ roles: [UserRole.SUPER_ADMIN] });
      userRepository.findOne.mockResolvedValue(user);

      const dto: UpdateUserAdminDto = { isActive: false };

      await expect(
        service.updateUserAdmin(mockUserId, dto, mockSuperAdmin),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.updateUserAdmin(mockUserId, dto, mockSuperAdmin),
      ).rejects.toThrow('Cannot deactivate super admin');
    });

    it('should update profile fields (address, city, state, zipCode, country)', async () => {
      const user = createMockUser();
      userRepository.findOne.mockResolvedValue(user);
      userRepository.save.mockImplementation(async (u) => u as User);

      const dto: UpdateUserAdminDto = {
        address: '789 Pine St',
        city: 'Austin',
        state: 'Texas',
        zipCode: '73301',
        country: 'United States',
      };

      const result = await service.updateUserAdmin(
        mockUserId,
        dto,
        mockSuperAdmin,
      );

      expect(result.address).toBe('789 Pine St');
      expect(result.city).toBe('Austin');
      expect(result.state).toBe('Texas');
      expect(result.zipCode).toBe('73301');
      expect(result.country).toBe('United States');
    });

    it('should update dateOfBirth as Date', async () => {
      const user = createMockUser();
      userRepository.findOne.mockResolvedValue(user);
      userRepository.save.mockImplementation(async (u) => u as User);

      const dto: UpdateUserAdminDto = { dateOfBirth: '1995-12-25' };

      const result = await service.updateUserAdmin(
        mockUserId,
        dto,
        mockSuperAdmin,
      );

      expect(result.dateOfBirth).toBeInstanceOf(Date);
    });

    it('should encrypt identification number', async () => {
      const user = createMockUser();
      userRepository.findOne.mockResolvedValue(user);
      userRepository.save.mockImplementation(async (u) => u as User);

      const dto: UpdateUserAdminDto = {
        identificationNumber: 'V-12345678',
      };

      await service.updateUserAdmin(mockUserId, dto, mockSuperAdmin);

      expect(encryptionService.encrypt).toHaveBeenCalledWith('V-12345678');
    });

    it('should set identification number to null when empty string', async () => {
      const user = createMockUser({ identificationNumber: 'encrypted-old' });
      userRepository.findOne.mockResolvedValue(user);
      userRepository.save.mockImplementation(async (u) => u as User);

      const dto: UpdateUserAdminDto = { identificationNumber: '' };

      const result = await service.updateUserAdmin(
        mockUserId,
        dto,
        mockSuperAdmin,
      );

      // Empty string is falsy, so it should be set to null
      expect(result.identificationNumber).toBeNull();
      expect(encryptionService.encrypt).not.toHaveBeenCalled();
    });

    it('should hash and update password', async () => {
      const user = createMockUser();
      userRepository.findOne.mockResolvedValue(user);
      userRepository.save.mockImplementation(async (u) => u as User);

      const dto: UpdateUserAdminDto = { password: 'NewPass123!' };

      const result = await service.updateUserAdmin(
        mockUserId,
        dto,
        mockSuperAdmin,
      );

      expect(bcrypt.hash).toHaveBeenCalledWith('NewPass123!', 10);
      expect(result.password).toBe('$2b$10$hashedPassword');
    });

    it('should not update email if same email is provided', async () => {
      const user = createMockUser({
        email: 'same@example.com',
        emailVerified: true,
      });
      userRepository.findOne.mockResolvedValue(user);
      userRepository.save.mockImplementation(async (u) => u as User);

      const dto: UpdateUserAdminDto = { email: 'same@example.com' };

      const result = await service.updateUserAdmin(
        mockUserId,
        dto,
        mockSuperAdmin,
      );

      // Should not check uniqueness nor unverify
      expect(result.emailVerified).toBe(true);
      // findOne called once for findById, NOT a second time for uniqueness
      expect(userRepository.findOne).toHaveBeenCalledTimes(1);
    });

    it('should throw NotFoundException if user not found', async () => {
      userRepository.findOne.mockResolvedValue(null);

      await expect(
        service.updateUserAdmin(
          'non-existent',
          { firstName: 'X' },
          mockSuperAdmin,
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getStats', () => {
    it('should return complete user statistics', async () => {
      userRepository.count
        .mockResolvedValueOnce(100) // total
        .mockResolvedValueOnce(85) // active
        .mockResolvedValueOnce(70) // emailVerified
        .mockResolvedValueOnce(30); // phoneVerified

      // Mock createQueryBuilder for each role in UserRole enum
      const mockQb = createMockQueryBuilder({
        getCount: jest
          .fn()
          .mockResolvedValueOnce(5) // super_admin
          .mockResolvedValueOnce(95), // user
      });
      userRepository.createQueryBuilder.mockReturnValue(mockQb as any);

      const result = await service.getStats();

      expect(result.total).toBe(100);
      expect(result.active).toBe(85);
      expect(result.inactive).toBe(15);
      expect(result.emailVerified).toBe(70);
      expect(result.phoneVerified).toBe(30);
      expect(result.byRole).toBeDefined();
      expect(result.byRole[UserRole.SUPER_ADMIN]).toBe(5);
      expect(result.byRole[UserRole.USER]).toBe(95);
    });
  });

  // ================================================================
  // SEARCH
  // ================================================================

  describe('searchUsers', () => {
    it('should search users by email or name', async () => {
      const mockQb = createMockQueryBuilder({
        getMany: jest.fn().mockResolvedValue([mockUser]),
      });
      userRepository.createQueryBuilder.mockReturnValue(mockQb as any);

      const result = await service.searchUsers('juan');

      expect(mockQb.where).toHaveBeenCalledWith('user.email ILIKE :query', {
        query: '%juan%',
      });
      expect(mockQb.orWhere).toHaveBeenCalledWith(
        'user.firstName ILIKE :query',
        { query: '%juan%' },
      );
      expect(mockQb.orWhere).toHaveBeenCalledWith(
        'user.lastName ILIKE :query',
        { query: '%juan%' },
      );
      expect(mockQb.take).toHaveBeenCalledWith(10);
      expect(result).toEqual([mockUser]);
    });

    it('should respect custom limit', async () => {
      const mockQb = createMockQueryBuilder({
        getMany: jest.fn().mockResolvedValue([]),
      });
      userRepository.createQueryBuilder.mockReturnValue(mockQb as any);

      await service.searchUsers('test', 5);

      expect(mockQb.take).toHaveBeenCalledWith(5);
    });

    it('should return empty array when no matches', async () => {
      const mockQb = createMockQueryBuilder({
        getMany: jest.fn().mockResolvedValue([]),
      });
      userRepository.createQueryBuilder.mockReturnValue(mockQb as any);

      const result = await service.searchUsers('nonexistent');

      expect(result).toEqual([]);
    });
  });

  // ================================================================
  // SLUG AND FULL NAME SEARCH
  // ================================================================

  describe('findBySlug', () => {
    it('should return user when slug exists', async () => {
      userRepository.findOne.mockResolvedValue(mockUser);

      const result = await service.findBySlug('juan-perez');

      expect(userRepository.findOne).toHaveBeenCalledWith({
        where: { slug: 'juan-perez' },
      });
      expect(result).toEqual(mockUser);
    });

    it('should throw NotFoundException when slug not found', async () => {
      userRepository.findOne.mockResolvedValue(null);

      await expect(service.findBySlug('non-existent')).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.findBySlug('non-existent')).rejects.toThrow(
        'User with slug "non-existent" not found',
      );
    });
  });

  describe('searchByFullName', () => {
    it('should search across full name, firstName, lastName, and slug', async () => {
      const mockQb = createMockQueryBuilder({
        getMany: jest.fn().mockResolvedValue([mockUser]),
      });
      userRepository.createQueryBuilder.mockReturnValue(mockQb as any);

      const result = await service.searchByFullName('Juan Pérez');

      expect(mockQb.where).toHaveBeenCalled();
      expect(mockQb.orWhere).toHaveBeenCalledTimes(3);
      expect(mockQb.take).toHaveBeenCalledWith(10);
      expect(result).toEqual([mockUser]);
    });

    it('should respect custom limit', async () => {
      const mockQb = createMockQueryBuilder({
        getMany: jest.fn().mockResolvedValue([]),
      });
      userRepository.createQueryBuilder.mockReturnValue(mockQb as any);

      await service.searchByFullName('Test', 5);

      expect(mockQb.take).toHaveBeenCalledWith(5);
    });

    it('should normalize search text (remove accents, lowercase)', async () => {
      const mockQb = createMockQueryBuilder({
        getMany: jest.fn().mockResolvedValue([]),
      });
      userRepository.createQueryBuilder.mockReturnValue(mockQb as any);

      await service.searchByFullName('Ángél Gómez');

      // The normalized search should be "angel gomez"
      expect(mockQb.where).toHaveBeenCalledWith(
        "LOWER(UNACCENT(CONCAT(user.firstName, ' ', user.lastName))) LIKE :search",
        { search: '%angel gomez%' },
      );
    });
  });

  describe('generateSlugFromName', () => {
    it('should generate slug from first and last name', () => {
      const slug = service.generateSlugFromName('Juan', 'Pérez');

      expect(slug).toBe('juan-perez');
    });

    it('should handle accented characters', () => {
      const slug = service.generateSlugFromName('Ángel', 'García López');

      expect(slug).toBe('angel-garcia-lopez');
    });

    it('should handle multiple spaces', () => {
      const slug = service.generateSlugFromName('Juan  Carlos', 'De la Cruz');

      expect(slug).toBe('juan-carlos-de-la-cruz');
    });

    it('should handle special characters', () => {
      const slug = service.generateSlugFromName("O'Brien", 'Smith-Jones');

      expect(slug).toBe('obrien-smith-jones');
    });

    it('should handle leading/trailing spaces', () => {
      const slug = service.generateSlugFromName('  Juan ', ' Perez  ');

      expect(slug).toBe('juan-perez');
    });

    it('should handle empty strings', () => {
      const slug = service.generateSlugFromName('', '');

      expect(slug).toBe('');
    });
  });

  describe('generateUniqueSlug', () => {
    it('should return base slug when no conflicts exist', async () => {
      userRepository.findOne.mockResolvedValue(null);

      const slug = await service.generateUniqueSlug('Juan', 'Perez');

      expect(slug).toBe('juan-perez');
    });

    it('should append counter when slug conflicts exist', async () => {
      const existingUser = createMockUser({
        id: mockUserId2,
        slug: 'juan-perez',
      });

      userRepository.findOne
        .mockResolvedValueOnce(existingUser) // "juan-perez" → conflict
        .mockResolvedValueOnce(null); // "juan-perez-1" → available

      const slug = await service.generateUniqueSlug('Juan', 'Perez');

      expect(slug).toBe('juan-perez-1');
    });

    it('should skip conflict when excluded user ID matches', async () => {
      const existingUser = createMockUser({
        id: mockUserId,
        slug: 'juan-perez',
      });

      userRepository.findOne.mockResolvedValue(existingUser);

      // Exclude the user's own ID → should return base slug
      const slug = await service.generateUniqueSlug(
        'Juan',
        'Perez',
        mockUserId,
      );

      expect(slug).toBe('juan-perez');
    });

    it('should use random suffix fallback after max attempts', async () => {
      // All attempts (0 through 5) return a different user
      const differentUser = createMockUser({ id: mockUserId2 });
      userRepository.findOne.mockResolvedValue(differentUser);

      const slug = await service.generateUniqueSlug('Juan', 'Perez');

      // After MAX_ATTEMPTS (5), falls back to random suffix
      expect(slug).toMatch(/^juan-perez-[a-f0-9]{6}$/);
    });
  });

  describe('regenerateSlug', () => {
    it('should regenerate slug for user', async () => {
      const user = createMockUser({
        firstName: 'Juan',
        lastName: 'Perez',
        slug: 'old-slug',
      });
      userRepository.findOne
        .mockResolvedValueOnce(user) // findById
        .mockResolvedValueOnce(null); // generateUniqueSlug check
      userRepository.save.mockImplementation(async (u) => u as User);

      const result = await service.regenerateSlug(mockUserId);

      expect(result.slug).toBe('juan-perez');
      expect(userRepository.save).toHaveBeenCalled();
    });

    it('should throw NotFoundException if user not found', async () => {
      userRepository.findOne.mockResolvedValue(null);

      await expect(service.regenerateSlug('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
