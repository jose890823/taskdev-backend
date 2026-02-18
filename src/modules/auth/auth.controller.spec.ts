import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { ResendOtpDto } from './dto/resend-otp.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { UserRole } from './entities/user.entity';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: jest.Mocked<AuthService>;

  const mockUserResponse = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    email: 'test@example.com',
    firstName: 'Test',
    lastName: 'User',
    phone: '+17868391882',
    role: UserRole.CLIENT,
    emailVerified: true,
    phoneVerified: false,
    isActive: true,
    lastLoginAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockAuthService = {
    register: jest.fn(),
    verifyEmail: jest.fn(),
    resendOtp: jest.fn(),
    login: jest.fn(),
    refresh: jest.fn(),
    logout: jest.fn(),
    forgotPassword: jest.fn(),
    resetPassword: jest.fn(),
    changePassword: jest.fn(),
    getMe: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get(AuthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('register', () => {
    const registerDto: RegisterDto = {
      email: 'newuser@example.com',
      password: 'Password123!',
      firstName: 'New',
      lastName: 'User',
      phone: '+17868391882',
    };

    it('debe llamar a authService.register con los datos correctos', async () => {
      const expectedResponse = {
        user: mockUserResponse,
        message: 'Usuario registrado exitosamente',
      };

      authService.register.mockResolvedValue(expectedResponse);

      const result = await controller.register(registerDto);

      expect(authService.register).toHaveBeenCalledWith(registerDto);
      expect(result).toEqual(expectedResponse);
    });

    it('debe propagar excepciones del servicio', async () => {
      authService.register.mockRejectedValue(
        new Error('El email ya está registrado'),
      );

      await expect(controller.register(registerDto)).rejects.toThrow(
        'El email ya está registrado',
      );
    });
  });

  describe('verifyEmail', () => {
    const verifyEmailDto: VerifyEmailDto = {
      email: 'test@example.com',
      otpCode: '123456',
    };

    it('debe llamar a authService.verifyEmail con los datos correctos', async () => {
      const expectedResponse = {
        success: true,
        message: 'Email verificado exitosamente',
      };

      authService.verifyEmail.mockResolvedValue(expectedResponse);

      const result = await controller.verifyEmail(verifyEmailDto);

      expect(authService.verifyEmail).toHaveBeenCalledWith(verifyEmailDto);
      expect(result).toEqual(expectedResponse);
    });
  });

  describe('resendOtp', () => {
    const resendOtpDto: ResendOtpDto = {
      email: 'test@example.com',
    };

    it('debe llamar a authService.resendOtp con los datos correctos', async () => {
      const expectedResponse = {
        message: 'Nuevo código OTP enviado',
      };

      authService.resendOtp.mockResolvedValue(expectedResponse);

      const result = await controller.resendOtp(resendOtpDto);

      expect(authService.resendOtp).toHaveBeenCalledWith(resendOtpDto);
      expect(result).toEqual(expectedResponse);
    });
  });

  describe('login', () => {
    const loginDto: LoginDto = {
      email: 'test@example.com',
      password: 'Password123!',
    };

    it('debe llamar a authService.login con los datos correctos', async () => {
      const expectedResponse = {
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        user: mockUserResponse,
      };

      authService.login.mockResolvedValue(expectedResponse);

      const result = await controller.login(loginDto);

      expect(authService.login).toHaveBeenCalledWith(loginDto);
      expect(result).toEqual(expectedResponse);
    });

    it('debe retornar tokens y usuario en la respuesta', async () => {
      const expectedResponse = {
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        user: mockUserResponse,
      };

      authService.login.mockResolvedValue(expectedResponse);

      const result = await controller.login(loginDto);

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result).toHaveProperty('user');
    });
  });

  describe('refresh', () => {
    const refreshTokenDto: RefreshTokenDto = {
      refreshToken: 'refresh-token',
    };
    const userId = '123e4567-e89b-12d3-a456-426614174000';

    it('debe llamar a authService.refresh con el token y userId correctos', async () => {
      const expectedResponse = {
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
      };

      authService.refresh.mockResolvedValue(expectedResponse);

      const result = await controller.refresh(refreshTokenDto, userId);

      expect(authService.refresh).toHaveBeenCalledWith(
        refreshTokenDto.refreshToken,
        userId,
      );
      expect(result).toEqual(expectedResponse);
    });

    it('debe retornar nuevos tokens', async () => {
      const expectedResponse = {
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
      };

      authService.refresh.mockResolvedValue(expectedResponse);

      const result = await controller.refresh(refreshTokenDto, userId);

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
    });
  });

  describe('logout', () => {
    const userId = '123e4567-e89b-12d3-a456-426614174000';

    it('debe llamar a authService.logout con el userId correcto', async () => {
      const expectedResponse = {
        message: 'Logout exitoso',
      };

      authService.logout.mockResolvedValue(expectedResponse);

      const result = await controller.logout(userId);

      expect(authService.logout).toHaveBeenCalledWith(userId);
      expect(result).toEqual(expectedResponse);
    });
  });

  describe('forgotPassword', () => {
    const forgotPasswordDto: ForgotPasswordDto = {
      email: 'test@example.com',
    };

    it('debe llamar a authService.forgotPassword con los datos correctos', async () => {
      const expectedResponse = {
        message: 'Si el email existe, recibirás un enlace',
      };

      authService.forgotPassword.mockResolvedValue(expectedResponse);

      const result = await controller.forgotPassword(forgotPasswordDto);

      expect(authService.forgotPassword).toHaveBeenCalledWith(
        forgotPasswordDto,
      );
      expect(result).toEqual(expectedResponse);
    });
  });

  describe('resetPassword', () => {
    const resetPasswordDto: ResetPasswordDto = {
      resetToken: 'reset-token',
      newPassword: 'NewPassword123!',
    };

    it('debe llamar a authService.resetPassword con los datos correctos', async () => {
      const expectedResponse = {
        message: 'Contraseña actualizada exitosamente',
      };

      authService.resetPassword.mockResolvedValue(expectedResponse);

      const result = await controller.resetPassword(resetPasswordDto);

      expect(authService.resetPassword).toHaveBeenCalledWith(resetPasswordDto);
      expect(result).toEqual(expectedResponse);
    });
  });

  describe('changePassword', () => {
    const userId = '123e4567-e89b-12d3-a456-426614174000';
    const changePasswordDto: ChangePasswordDto = {
      oldPassword: 'OldPassword123!',
      newPassword: 'NewPassword123!',
    };

    it('debe llamar a authService.changePassword con userId y datos correctos', async () => {
      const expectedResponse = {
        message: 'Contraseña cambiada exitosamente',
      };

      authService.changePassword.mockResolvedValue(expectedResponse);

      const result = await controller.changePassword(userId, changePasswordDto);

      expect(authService.changePassword).toHaveBeenCalledWith(
        userId,
        changePasswordDto,
      );
      expect(result).toEqual(expectedResponse);
    });
  });

  describe('getMe', () => {
    const userId = '123e4567-e89b-12d3-a456-426614174000';

    it('debe llamar a authService.getMe con el userId correcto', async () => {
      authService.getMe.mockResolvedValue(mockUserResponse);

      const result = await controller.getMe(userId);

      expect(authService.getMe).toHaveBeenCalledWith(userId);
      expect(result).toEqual(mockUserResponse);
    });

    it('debe retornar el usuario sin información sensible', async () => {
      authService.getMe.mockResolvedValue(mockUserResponse);

      const result = await controller.getMe(userId);

      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('email');
      expect(result).not.toHaveProperty('password');
      expect(result).not.toHaveProperty('refreshToken');
    });
  });
});
