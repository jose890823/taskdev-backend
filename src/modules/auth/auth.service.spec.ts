import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import {
  ConflictException,
  UnauthorizedException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Repository } from 'typeorm';
import { AuthService } from './auth.service';
import { User, UserRole } from './entities/user.entity';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { ResendOtpDto } from './dto/resend-otp.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ChangePasswordDto } from './dto/change-password.dto';

// Mock bcrypt module
jest.mock('bcrypt', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

import * as bcrypt from 'bcrypt';

describe('AuthService', () => {
  let service: AuthService;
  let userRepository: jest.Mocked<Repository<User>>;
  let jwtService: jest.Mocked<JwtService>;
  let configService: jest.Mocked<ConfigService>;

  const mockUser: User = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    email: 'test@example.com',
    password: 'hashedPassword123',
    firstName: 'Test',
    lastName: 'User',
    phone: '+17868391882',
    role: UserRole.CLIENT,
    emailVerified: true,
    phoneVerified: false,
    isActive: true,
    lastLoginAt: new Date(),
    refreshToken: 'hashedRefreshToken',
    refreshTokenExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    otpCode: null,
    otpExpiresAt: null,
    otpAttempts: 0,
    resetPasswordToken: null,
    resetPasswordExpiresAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    isOtpExpired: jest.fn().mockReturnValue(false),
    isResetTokenExpired: jest.fn().mockReturnValue(false),
    hasReachedMaxOtpAttempts: jest.fn().mockReturnValue(false),
  };

  beforeEach(async () => {
    const mockRepository = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };

    const mockJwtService = {
      signAsync: jest.fn(),
    };

    const mockConfigService = {
      get: jest.fn((key: string, defaultValue?: any) => {
        const config = {
          BCRYPT_ROUNDS: 10,
          OTP_LENGTH: 6,
          OTP_EXPIRATION_MINUTES: 10,
          OTP_MAX_ATTEMPTS: 3,
          JWT_SECRET: 'test-secret',
          JWT_EXPIRATION: '15m',
          JWT_REFRESH_SECRET: 'test-refresh-secret',
          JWT_REFRESH_EXPIRATION: '7d',
        };
        return config[key] || defaultValue;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: getRepositoryToken(User),
          useValue: mockRepository,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    userRepository = module.get(getRepositoryToken(User));
    jwtService = module.get(JwtService);
    configService = module.get(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  describe('register', () => {
    const registerDto: RegisterDto = {
      email: 'newuser@example.com',
      password: 'Password123!',
      firstName: 'New',
      lastName: 'User',
      phone: '+17868391882',
    };

    it('debe registrar un nuevo usuario exitosamente', async () => {
      userRepository.findOne.mockResolvedValue(null);
      userRepository.create.mockReturnValue({
        ...mockUser,
        ...registerDto,
        otpCode: '123456',
      } as User);
      userRepository.save.mockResolvedValue({
        ...mockUser,
        ...registerDto,
        otpCode: '123456',
        emailVerified: false,
      } as User);

      (bcrypt.hash as jest.Mock).mockResolvedValue('hashedPassword' as never);

      const result = await service.register(registerDto);

      expect(userRepository.findOne).toHaveBeenCalledWith({
        where: { email: registerDto.email },
      });
      expect(result).toHaveProperty('user');
      expect(result).toHaveProperty('message');
      expect(result.user).not.toHaveProperty('password');
      expect(result.user).not.toHaveProperty('otpCode');
    });

    it('debe lanzar ConflictException si el email ya existe', async () => {
      userRepository.findOne.mockResolvedValue(mockUser);

      await expect(service.register(registerDto)).rejects.toThrow(
        ConflictException,
      );
      await expect(service.register(registerDto)).rejects.toThrow(
        'El email ya está registrado',
      );
    });
  });

  describe('verifyEmail', () => {
    const verifyEmailDto: VerifyEmailDto = {
      email: 'test@example.com',
      otpCode: '123456',
    };

    it('debe verificar el email exitosamente', async () => {
      const unverifiedUser = {
        ...mockUser,
        emailVerified: false,
        otpCode: '123456',
        otpAttempts: 0,
        isOtpExpired: jest.fn().mockReturnValue(false),
        hasReachedMaxOtpAttempts: jest.fn().mockReturnValue(false),
      };

      userRepository.findOne.mockResolvedValue(unverifiedUser as User);
      userRepository.save.mockResolvedValue({
        ...unverifiedUser,
        emailVerified: true,
        otpCode: null,
      } as User);

      const result = await service.verifyEmail(verifyEmailDto);

      expect(result.success).toBe(true);
      expect(result.message).toContain('verificado exitosamente');
      expect(userRepository.save).toHaveBeenCalled();
    });

    it('debe lanzar NotFoundException si el usuario no existe', async () => {
      userRepository.findOne.mockResolvedValue(null);

      await expect(service.verifyEmail(verifyEmailDto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('debe lanzar BadRequestException si el email ya está verificado', async () => {
      userRepository.findOne.mockResolvedValue(mockUser);

      await expect(service.verifyEmail(verifyEmailDto)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.verifyEmail(verifyEmailDto)).rejects.toThrow(
        'ya ha sido verificado',
      );
    });

    it('debe lanzar BadRequestException si se excedieron los intentos', async () => {
      const userWithMaxAttempts = {
        ...mockUser,
        emailVerified: false,
        otpAttempts: 3,
        hasReachedMaxOtpAttempts: jest.fn().mockReturnValue(true),
      };

      userRepository.findOne.mockResolvedValue(userWithMaxAttempts as User);

      await expect(service.verifyEmail(verifyEmailDto)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.verifyEmail(verifyEmailDto)).rejects.toThrow(
        'excedido el número máximo de intentos',
      );
    });

    it('debe lanzar BadRequestException si el OTP expiró', async () => {
      const userWithExpiredOtp = {
        ...mockUser,
        emailVerified: false,
        otpCode: '123456',
        isOtpExpired: jest.fn().mockReturnValue(true),
        hasReachedMaxOtpAttempts: jest.fn().mockReturnValue(false),
      };

      userRepository.findOne.mockResolvedValue(userWithExpiredOtp as User);

      await expect(service.verifyEmail(verifyEmailDto)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.verifyEmail(verifyEmailDto)).rejects.toThrow(
        'código OTP ha expirado',
      );
    });

    it('debe incrementar intentos y lanzar error si el código OTP es incorrecto', async () => {
      const userWithWrongOtp = {
        ...mockUser,
        emailVerified: false,
        otpCode: '654321',
        otpAttempts: 0,
        isOtpExpired: jest.fn().mockReturnValue(false),
        hasReachedMaxOtpAttempts: jest.fn().mockReturnValue(false),
      };

      userRepository.findOne.mockResolvedValue(userWithWrongOtp as User);
      userRepository.save.mockResolvedValue({
        ...userWithWrongOtp,
        otpAttempts: 1,
      } as User);

      await expect(service.verifyEmail(verifyEmailDto)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.verifyEmail(verifyEmailDto)).rejects.toThrow(
        'Código OTP incorrecto',
      );
      expect(userRepository.save).toHaveBeenCalled();
    });
  });

  describe('resendOtp', () => {
    const resendOtpDto: ResendOtpDto = {
      email: 'test@example.com',
    };

    it('debe reenviar el OTP exitosamente', async () => {
      const unverifiedUser = {
        ...mockUser,
        emailVerified: false,
      };

      userRepository.findOne.mockResolvedValue(unverifiedUser as User);
      userRepository.save.mockResolvedValue(unverifiedUser as User);

      const result = await service.resendOtp(resendOtpDto);

      expect(result.message).toContain('Nuevo código OTP');
      expect(userRepository.save).toHaveBeenCalled();
    });

    it('debe lanzar NotFoundException si el usuario no existe', async () => {
      userRepository.findOne.mockResolvedValue(null);

      await expect(service.resendOtp(resendOtpDto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('debe lanzar BadRequestException si el email ya está verificado', async () => {
      userRepository.findOne.mockResolvedValue(mockUser);

      await expect(service.resendOtp(resendOtpDto)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('login', () => {
    const loginDto: LoginDto = {
      email: 'test@example.com',
      password: 'Password123!',
    };

    it('debe hacer login exitosamente', async () => {
      userRepository.findOne.mockResolvedValue(mockUser);
      userRepository.save.mockResolvedValue(mockUser);
      jwtService.signAsync
        .mockResolvedValueOnce('access-token')
        .mockResolvedValueOnce('refresh-token');

      jest
        .spyOn(bcrypt, 'compare')
        .mockImplementation(() => Promise.resolve(true) as any);
      jest
        .spyOn(bcrypt, 'hash')
        .mockResolvedValue('hashedRefreshToken' as never);

      const result = await service.login(loginDto);

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result).toHaveProperty('user');
      expect(result.user).not.toHaveProperty('password');
      expect(result.user).not.toHaveProperty('refreshToken');
    });

    it('debe lanzar UnauthorizedException si el usuario no existe', async () => {
      userRepository.findOne.mockResolvedValue(null);

      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.login(loginDto)).rejects.toThrow(
        'Credenciales inválidas',
      );
    });

    it('debe lanzar UnauthorizedException si el email no está verificado', async () => {
      const unverifiedUser = {
        ...mockUser,
        emailVerified: false,
      };

      userRepository.findOne.mockResolvedValue(unverifiedUser as User);

      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.login(loginDto)).rejects.toThrow(
        'verificar tu email',
      );
    });

    it('debe lanzar UnauthorizedException si el usuario está inactivo', async () => {
      const inactiveUser = {
        ...mockUser,
        isActive: false,
      };

      userRepository.findOne.mockResolvedValue(inactiveUser as User);

      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.login(loginDto)).rejects.toThrow('desactivada');
    });

    it('debe lanzar UnauthorizedException si la contraseña es incorrecta', async () => {
      userRepository.findOne.mockResolvedValue(mockUser);
      jest
        .spyOn(bcrypt, 'compare')
        .mockImplementation(() => Promise.resolve(false) as any);

      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.login(loginDto)).rejects.toThrow(
        'Credenciales inválidas',
      );
    });
  });

  describe('refresh', () => {
    const refreshToken = 'valid-refresh-token';
    const userId = mockUser.id;

    it('debe refrescar los tokens exitosamente', async () => {
      userRepository.findOne.mockResolvedValue(mockUser);
      userRepository.save.mockResolvedValue(mockUser);
      jwtService.signAsync
        .mockResolvedValueOnce('new-access-token')
        .mockResolvedValueOnce('new-refresh-token');

      jest
        .spyOn(bcrypt, 'compare')
        .mockImplementation(() => Promise.resolve(true) as any);
      jest
        .spyOn(bcrypt, 'hash')
        .mockResolvedValue('newHashedRefreshToken' as never);

      const result = await service.refresh(refreshToken, userId);

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result.accessToken).toBe('new-access-token');
      expect(result.refreshToken).toBe('new-refresh-token');
    });

    it('debe lanzar UnauthorizedException si el usuario no existe', async () => {
      userRepository.findOne.mockResolvedValue(null);

      await expect(service.refresh(refreshToken, userId)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('debe lanzar UnauthorizedException si el usuario está inactivo', async () => {
      const inactiveUser = {
        ...mockUser,
        isActive: false,
      };

      userRepository.findOne.mockResolvedValue(inactiveUser as User);

      await expect(service.refresh(refreshToken, userId)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('debe lanzar UnauthorizedException si el refresh token expiró', async () => {
      const userWithExpiredToken = {
        ...mockUser,
        refreshTokenExpiresAt: new Date(Date.now() - 1000),
      };

      userRepository.findOne.mockResolvedValue(userWithExpiredToken as User);

      await expect(service.refresh(refreshToken, userId)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.refresh(refreshToken, userId)).rejects.toThrow(
        'expirado',
      );
    });

    it('debe lanzar UnauthorizedException si el refresh token es inválido', async () => {
      userRepository.findOne.mockResolvedValue(mockUser);
      jest
        .spyOn(bcrypt, 'compare')
        .mockImplementation(() => Promise.resolve(false) as any);

      await expect(service.refresh(refreshToken, userId)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.refresh(refreshToken, userId)).rejects.toThrow(
        'inválido',
      );
    });
  });

  describe('logout', () => {
    const userId = mockUser.id;

    it('debe hacer logout exitosamente', async () => {
      userRepository.findOne.mockResolvedValue(mockUser);
      userRepository.save.mockResolvedValue({
        ...mockUser,
        refreshToken: null,
      } as User);

      const result = await service.logout(userId);

      expect(result.message).toContain('Logout exitoso');
      expect(userRepository.save).toHaveBeenCalled();
    });

    it('debe lanzar NotFoundException si el usuario no existe', async () => {
      userRepository.findOne.mockResolvedValue(null);

      await expect(service.logout(userId)).rejects.toThrow(NotFoundException);
    });
  });

  describe('forgotPassword', () => {
    const forgotPasswordDto: ForgotPasswordDto = {
      email: 'test@example.com',
    };

    it('debe generar token de reseteo si el usuario existe', async () => {
      userRepository.findOne.mockResolvedValue(mockUser);
      userRepository.save.mockResolvedValue(mockUser);

      const result = await service.forgotPassword(forgotPasswordDto);

      expect(result.message).toContain('Si el email existe');
      expect(userRepository.save).toHaveBeenCalled();
    });

    it('debe retornar el mismo mensaje si el usuario no existe (seguridad)', async () => {
      userRepository.findOne.mockResolvedValue(null);

      const result = await service.forgotPassword(forgotPasswordDto);

      expect(result.message).toContain('Si el email existe');
      expect(userRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('resetPassword', () => {
    const resetPasswordDto: ResetPasswordDto = {
      resetToken: 'valid-reset-token',
      newPassword: 'NewPassword123!',
    };

    it('debe resetear la contraseña exitosamente', async () => {
      const userWithResetToken = {
        ...mockUser,
        resetPasswordToken: 'valid-reset-token',
        resetPasswordExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
        isResetTokenExpired: jest.fn().mockReturnValue(false),
      };

      userRepository.findOne.mockResolvedValue(userWithResetToken as User);
      userRepository.save.mockResolvedValue({
        ...userWithResetToken,
        password: 'newHashedPassword',
        resetPasswordToken: null,
      } as User);

      jest
        .spyOn(bcrypt, 'hash')
        .mockResolvedValue('newHashedPassword' as never);

      const result = await service.resetPassword(resetPasswordDto);

      expect(result.message).toContain('actualizada exitosamente');
      expect(userRepository.save).toHaveBeenCalled();
    });

    it('debe lanzar BadRequestException si el token es inválido', async () => {
      userRepository.findOne.mockResolvedValue(null);

      await expect(service.resetPassword(resetPasswordDto)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.resetPassword(resetPasswordDto)).rejects.toThrow(
        'inválido',
      );
    });

    it('debe lanzar BadRequestException si el token expiró', async () => {
      const userWithExpiredToken = {
        ...mockUser,
        resetPasswordToken: 'valid-reset-token',
        isResetTokenExpired: jest.fn().mockReturnValue(true),
      };

      userRepository.findOne.mockResolvedValue(userWithExpiredToken as User);

      await expect(service.resetPassword(resetPasswordDto)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.resetPassword(resetPasswordDto)).rejects.toThrow(
        'expirado',
      );
    });
  });

  describe('changePassword', () => {
    const userId = mockUser.id;
    const changePasswordDto: ChangePasswordDto = {
      oldPassword: 'OldPassword123!',
      newPassword: 'NewPassword123!',
    };

    it('debe cambiar la contraseña exitosamente', async () => {
      userRepository.findOne.mockResolvedValue(mockUser);
      userRepository.save.mockResolvedValue({
        ...mockUser,
        password: 'newHashedPassword',
      } as User);

      jest
        .spyOn(bcrypt, 'compare')
        .mockImplementation(() => Promise.resolve(true) as any);
      jest
        .spyOn(bcrypt, 'hash')
        .mockResolvedValue('newHashedPassword' as never);

      const result = await service.changePassword(userId, changePasswordDto);

      expect(result.message).toContain('cambiada exitosamente');
      expect(userRepository.save).toHaveBeenCalled();
    });

    it('debe lanzar NotFoundException si el usuario no existe', async () => {
      userRepository.findOne.mockResolvedValue(null);

      await expect(
        service.changePassword(userId, changePasswordDto),
      ).rejects.toThrow(NotFoundException);
    });

    it('debe lanzar BadRequestException si la contraseña actual es incorrecta', async () => {
      userRepository.findOne.mockResolvedValue(mockUser);
      jest
        .spyOn(bcrypt, 'compare')
        .mockImplementation(() => Promise.resolve(false) as any);

      await expect(
        service.changePassword(userId, changePasswordDto),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.changePassword(userId, changePasswordDto),
      ).rejects.toThrow('contraseña actual es incorrecta');
    });
  });

  describe('getMe', () => {
    const userId = mockUser.id;

    it('debe retornar el usuario actual sin información sensible', async () => {
      userRepository.findOne.mockResolvedValue(mockUser);

      const result = await service.getMe(userId);

      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('email');
      expect(result).not.toHaveProperty('password');
      expect(result).not.toHaveProperty('refreshToken');
      expect(result).not.toHaveProperty('otpCode');
      expect(result).not.toHaveProperty('resetPasswordToken');
    });

    it('debe lanzar NotFoundException si el usuario no existe', async () => {
      userRepository.findOne.mockResolvedValue(null);

      await expect(service.getMe(userId)).rejects.toThrow(NotFoundException);
    });
  });
});
