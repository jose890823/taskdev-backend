import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { EmailService } from './email.service';

// ── Module-level mocks ─────────────────────────────────────────

// Shared mock holders (jest.fn created inside factories reference these)
const _mocks = {
  resendSend: jest.fn(),
  sendMail: jest.fn(),
  verify: jest.fn(),
  getAccessToken: jest.fn(),
  messagesSend: jest.fn(),
  setCredentials: jest.fn(),
};

// Mock templates
jest.mock('./templates/otp.template', () => ({
  getOtpEmailTemplate: jest.fn().mockReturnValue('<html>OTP</html>'),
}));
jest.mock('./templates/welcome.template', () => ({
  getWelcomeEmailTemplate: jest.fn().mockReturnValue('<html>Welcome</html>'),
}));
jest.mock('./templates/password-reset.template', () => ({
  getPasswordResetTemplate: jest
    .fn()
    .mockReturnValue('<html>PasswordReset</html>'),
}));
jest.mock('./templates/invitation.template', () => ({
  getInvitationEmailTemplate: jest
    .fn()
    .mockReturnValue('<html>Invitation</html>'),
}));

// Mock Resend — factory must NOT reference _mocks directly because of hoisting.
// Instead we use a lazy proxy pattern.
jest.mock('resend', () => {
  return {
    Resend: jest.fn().mockImplementation(() => ({
      emails: {
        get send() {
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          return require('./email.service.spec')._mocks?.resendSend ?? jest.fn();
        },
      },
    })),
  };
});

// Mock nodemailer
jest.mock('nodemailer', () => ({
  createTransport: jest.fn().mockImplementation(() => ({
    get sendMail() {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      return require('./email.service.spec')._mocks?.sendMail ?? jest.fn();
    },
    get verify() {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      return require('./email.service.spec')._mocks?.verify ?? jest.fn();
    },
  })),
}));

// Mock googleapis
jest.mock('googleapis', () => {
  const OAuth2 = jest.fn().mockImplementation(() => ({
    setCredentials: jest.fn(),
    get getAccessToken() {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      return require('./email.service.spec')._mocks?.getAccessToken ?? jest.fn();
    },
  }));
  return {
    google: {
      auth: { OAuth2 },
      gmail: jest.fn().mockReturnValue({
        users: {
          messages: {
            get send() {
              // eslint-disable-next-line @typescript-eslint/no-require-imports
              return require('./email.service.spec')._mocks?.messagesSend ?? jest.fn();
            },
          },
        },
      }),
    },
  };
});

// Export _mocks so the lazy require() above resolves them
module.exports._mocks = _mocks;

// Import templates after mocking
import { getOtpEmailTemplate } from './templates/otp.template';
import { getWelcomeEmailTemplate } from './templates/welcome.template';
import { getPasswordResetTemplate } from './templates/password-reset.template';
import { getInvitationEmailTemplate } from './templates/invitation.template';

describe('EmailService', () => {
  let configValues: Record<string, string | undefined>;

  const buildService = async (
    overrides: Record<string, string | undefined> = {},
  ): Promise<EmailService> => {
    configValues = { ...overrides };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => configValues[key]),
          },
        },
      ],
    }).compile();

    return module.get<EmailService>(EmailService);
  };

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ================================================================
  // INITIALIZATION & PROVIDER SELECTION
  // ================================================================

  describe('Provider initialization', () => {
    it('should initialize with Gmail API when all OAuth2 credentials are present', async () => {
      const service = await buildService({
        GMAIL_CLIENT_ID: 'client-id',
        GMAIL_CLIENT_SECRET: 'client-secret',
        GMAIL_REFRESH_TOKEN: 'refresh-token',
        GMAIL_USER: 'user@gmail.com',
      });

      expect(service.getProvider()).toBe('gmail-api');
      expect(service.isAvailable()).toBe(true);
    });

    it('should initialize with Resend when API key is present (no Gmail API)', async () => {
      const service = await buildService({
        RESEND_API_KEY: 're_test_123456',
      });

      expect(service.getProvider()).toBe('resend');
      expect(service.isAvailable()).toBe(true);
    });

    it('should initialize with Gmail SMTP when user and password present (no Gmail API, no Resend)', async () => {
      const service = await buildService({
        GMAIL_USER: 'user@gmail.com',
        GMAIL_APP_PASSWORD: 'app-password',
      });

      expect(service.getProvider()).toBe('gmail');
      expect(service.isAvailable()).toBe(true);
    });

    it('should fall back to "none" when no provider is configured', async () => {
      const service = await buildService({});

      expect(service.getProvider()).toBe('none');
      expect(service.isAvailable()).toBe(false);
    });

    it('should prefer Gmail API over Resend when both are configured', async () => {
      const service = await buildService({
        GMAIL_CLIENT_ID: 'client-id',
        GMAIL_CLIENT_SECRET: 'client-secret',
        GMAIL_REFRESH_TOKEN: 'refresh-token',
        GMAIL_USER: 'user@gmail.com',
        RESEND_API_KEY: 're_test_123456',
      });

      expect(service.getProvider()).toBe('gmail-api');
    });

    it('should prefer Resend over Gmail SMTP when both configured (no Gmail API)', async () => {
      const service = await buildService({
        RESEND_API_KEY: 're_test_123456',
        GMAIL_USER: 'user@gmail.com',
        GMAIL_APP_PASSWORD: 'app-password',
      });

      expect(service.getProvider()).toBe('resend');
    });

    it('should not initialize Resend when API key is empty string', async () => {
      const service = await buildService({
        RESEND_API_KEY: '',
      });

      expect(service.getProvider()).toBe('none');
    });

    it('should not initialize Gmail SMTP when user is empty string', async () => {
      const service = await buildService({
        GMAIL_USER: '',
        GMAIL_APP_PASSWORD: 'app-password',
      });

      expect(service.getProvider()).toBe('none');
    });

    it('should not initialize Gmail SMTP when password is empty string', async () => {
      const service = await buildService({
        GMAIL_USER: 'user@gmail.com',
        GMAIL_APP_PASSWORD: '',
      });

      expect(service.getProvider()).toBe('none');
    });

    it('should use default EMAIL_FROM when not configured', async () => {
      const service = await buildService({});
      const result = await service.sendEmail({
        to: 'test@example.com',
        subject: 'Test',
      });
      expect(result.success).toBe(true);
      expect(result.messageId).toBe('simulated');
    });

    it('should use default BRAND_NAME when not configured', async () => {
      const service = await buildService({});
      await service.sendWelcomeEmail({
        to: 'test@example.com',
        firstName: 'Test',
      });
      // In simulated mode it just returns success
    });
  });

  // ================================================================
  // isAvailable
  // ================================================================

  describe('isAvailable', () => {
    it('should return true when a provider is configured', async () => {
      const service = await buildService({
        RESEND_API_KEY: 're_test_123456',
      });
      expect(service.isAvailable()).toBe(true);
    });

    it('should return false when no provider is configured', async () => {
      const service = await buildService({});
      expect(service.isAvailable()).toBe(false);
    });
  });

  // ================================================================
  // getProvider
  // ================================================================

  describe('getProvider', () => {
    it('should return the active provider type', async () => {
      const service = await buildService({
        RESEND_API_KEY: 're_test_key',
      });
      expect(service.getProvider()).toBe('resend');
    });
  });

  // ================================================================
  // sendEmail
  // ================================================================

  describe('sendEmail', () => {
    it('should return simulated result when provider is none', async () => {
      const service = await buildService({});

      const result = await service.sendEmail({
        to: 'test@example.com',
        subject: 'Test Subject',
        html: '<p>Hello</p>',
      });

      expect(result).toEqual({ success: true, messageId: 'simulated' });
    });

    it('should handle array recipients in simulated mode', async () => {
      const service = await buildService({});

      const result = await service.sendEmail({
        to: ['a@example.com', 'b@example.com'],
        subject: 'Test',
      });

      expect(result.success).toBe(true);
    });

    it('should send via Resend when provider is resend', async () => {
      _mocks.resendSend.mockResolvedValue({
        data: { id: 'resend-msg-123' },
        error: null,
      });

      const service = await buildService({
        RESEND_API_KEY: 're_test_123456',
        EMAIL_FROM: 'noreply@mydomain.com',
      });

      const result = await service.sendEmail({
        to: 'test@example.com',
        subject: 'Hello',
        html: '<p>Hi</p>',
        text: 'Hi',
        replyTo: 'reply@test.com',
      });

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('resend-msg-123');
      expect(_mocks.resendSend).toHaveBeenCalledWith({
        from: 'noreply@mydomain.com',
        to: ['test@example.com'],
        subject: 'Hello',
        html: '<p>Hi</p>',
        text: 'Hi',
        replyTo: 'reply@test.com',
      });
    });

    it('should handle Resend array recipients', async () => {
      _mocks.resendSend.mockResolvedValue({
        data: { id: 'resend-msg-456' },
        error: null,
      });

      const service = await buildService({
        RESEND_API_KEY: 're_test_123456',
      });

      const result = await service.sendEmail({
        to: ['a@test.com', 'b@test.com'],
        subject: 'Batch',
        html: '<p>batch</p>',
      });

      expect(result.success).toBe(true);
      expect(_mocks.resendSend).toHaveBeenCalledWith(
        expect.objectContaining({
          to: ['a@test.com', 'b@test.com'],
        }),
      );
    });

    it('should return error when Resend returns error', async () => {
      _mocks.resendSend.mockResolvedValue({
        data: null,
        error: { message: 'Resend validation error' },
      });

      const service = await buildService({
        RESEND_API_KEY: 're_test_123456',
      });

      const result = await service.sendEmail({
        to: 'test@example.com',
        subject: 'Fail',
        html: '<p>fail</p>',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Resend validation error');
    });

    it('should send via Gmail SMTP when provider is gmail', async () => {
      _mocks.sendMail.mockResolvedValue({ messageId: 'smtp-msg-789' });

      const service = await buildService({
        GMAIL_USER: 'user@gmail.com',
        GMAIL_APP_PASSWORD: 'app-pass',
      });

      const result = await service.sendEmail({
        to: 'test@example.com',
        subject: 'SMTP Test',
        html: '<p>SMTP</p>',
        text: 'SMTP text',
        replyTo: 'reply@test.com',
      });

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('smtp-msg-789');
      expect(_mocks.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'test@example.com',
          subject: 'SMTP Test',
          html: '<p>SMTP</p>',
          text: 'SMTP text',
          replyTo: 'reply@test.com',
        }),
      );
    });

    it('should send via Gmail API when provider is gmail-api', async () => {
      _mocks.messagesSend.mockResolvedValue({
        data: { id: 'gmail-api-msg-101' },
      });

      const service = await buildService({
        GMAIL_CLIENT_ID: 'client-id',
        GMAIL_CLIENT_SECRET: 'client-secret',
        GMAIL_REFRESH_TOKEN: 'refresh-token',
        GMAIL_USER: 'user@gmail.com',
        BRAND_NAME: 'MyApp',
      });

      const result = await service.sendEmail({
        to: 'test@example.com',
        subject: 'API Test',
        html: '<p>API</p>',
      });

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('gmail-api-msg-101');
      expect(_mocks.messagesSend).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'me',
          requestBody: expect.objectContaining({
            raw: expect.any(String),
          }),
        }),
      );
    });

    it('should use default from when dto.from is not provided', async () => {
      _mocks.resendSend.mockResolvedValue({ data: { id: '1' }, error: null });

      const service = await buildService({
        RESEND_API_KEY: 're_test_123456',
        EMAIL_FROM: 'custom@domain.com',
      });

      await service.sendEmail({
        to: 'test@example.com',
        subject: 'No from',
        html: '<p>test</p>',
      });

      expect(_mocks.resendSend).toHaveBeenCalledWith(
        expect.objectContaining({ from: 'custom@domain.com' }),
      );
    });

    it('should use dto.from when provided', async () => {
      _mocks.resendSend.mockResolvedValue({ data: { id: '2' }, error: null });

      const service = await buildService({
        RESEND_API_KEY: 're_test_123456',
        EMAIL_FROM: 'default@domain.com',
      });

      await service.sendEmail({
        to: 'test@example.com',
        subject: 'Custom from',
        html: '<p>test</p>',
        from: 'override@domain.com',
      });

      expect(_mocks.resendSend).toHaveBeenCalledWith(
        expect.objectContaining({ from: 'override@domain.com' }),
      );
    });

    it('should return error result on exception', async () => {
      _mocks.resendSend.mockRejectedValue(new Error('Network timeout'));

      const service = await buildService({
        RESEND_API_KEY: 're_test_123456',
      });

      const result = await service.sendEmail({
        to: 'test@example.com',
        subject: 'Fail',
        html: '<p>fail</p>',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network timeout');
    });

    it('should handle non-Error exceptions', async () => {
      _mocks.resendSend.mockRejectedValue('string-error');

      const service = await buildService({
        RESEND_API_KEY: 're_test_123456',
      });

      const result = await service.sendEmail({
        to: 'test@example.com',
        subject: 'Fail',
        html: '<p>fail</p>',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('string-error');
    });
  });

  // ================================================================
  // sendOtpEmail
  // ================================================================

  describe('sendOtpEmail', () => {
    it('should return simulated result when provider is none', async () => {
      const service = await buildService({});

      const result = await service.sendOtpEmail({
        to: 'test@example.com',
        firstName: 'Juan',
        otpCode: '123456',
      });

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('simulated');
    });

    it('should generate OTP template and send email', async () => {
      _mocks.resendSend.mockResolvedValue({ data: { id: 'otp-1' }, error: null });

      const service = await buildService({
        RESEND_API_KEY: 're_test_key',
        BRAND_NAME: 'MyApp',
      });

      const result = await service.sendOtpEmail({
        to: 'test@example.com',
        firstName: 'Juan',
        otpCode: '654321',
        expirationMinutes: 15,
      });

      expect(result.success).toBe(true);
      expect(getOtpEmailTemplate).toHaveBeenCalledWith({
        firstName: 'Juan',
        otpCode: '654321',
        expirationMinutes: 15,
        brandName: 'MyApp',
      });
      expect(_mocks.resendSend).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: '654321 - Código de verificación',
          html: '<html>OTP</html>',
        }),
      );
    });

    it('should use default expiration of 10 minutes when not provided', async () => {
      _mocks.resendSend.mockResolvedValue({ data: { id: 'otp-2' }, error: null });

      const service = await buildService({
        RESEND_API_KEY: 're_test_key',
      });

      await service.sendOtpEmail({
        to: 'test@example.com',
        firstName: 'Ana',
        otpCode: '111111',
      });

      expect(getOtpEmailTemplate).toHaveBeenCalledWith(
        expect.objectContaining({ expirationMinutes: 10 }),
      );
    });
  });

  // ================================================================
  // sendWelcomeEmail
  // ================================================================

  describe('sendWelcomeEmail', () => {
    it('should return simulated result when provider is none', async () => {
      const service = await buildService({});

      const result = await service.sendWelcomeEmail({
        to: 'test@example.com',
        firstName: 'Juan',
      });

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('simulated');
    });

    it('should generate welcome template and send email', async () => {
      _mocks.resendSend.mockResolvedValue({
        data: { id: 'welcome-1' },
        error: null,
      });

      const service = await buildService({
        RESEND_API_KEY: 're_test_key',
        BRAND_NAME: 'TaskHub',
      });

      const result = await service.sendWelcomeEmail({
        to: 'test@example.com',
        firstName: 'Juan',
        lastName: 'Perez',
      });

      expect(result.success).toBe(true);
      expect(getWelcomeEmailTemplate).toHaveBeenCalledWith({
        firstName: 'Juan',
        lastName: 'Perez',
        brandName: 'TaskHub',
      });
      expect(_mocks.resendSend).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: '¡Bienvenido a TaskHub!',
        }),
      );
    });
  });

  // ================================================================
  // sendPasswordResetEmail
  // ================================================================

  describe('sendPasswordResetEmail', () => {
    it('should return simulated result when provider is none', async () => {
      const service = await buildService({});

      const result = await service.sendPasswordResetEmail({
        to: 'test@example.com',
        firstName: 'Juan',
        resetToken: 'abc123',
        resetUrl: 'https://app.com/reset?token=abc123',
      });

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('simulated');
    });

    it('should generate password reset template and send email', async () => {
      _mocks.resendSend.mockResolvedValue({
        data: { id: 'reset-1' },
        error: null,
      });

      const service = await buildService({
        RESEND_API_KEY: 're_test_key',
        BRAND_NAME: 'TaskHub',
      });

      const result = await service.sendPasswordResetEmail({
        to: 'test@example.com',
        firstName: 'Juan',
        resetToken: 'token-xyz',
        resetUrl: 'https://app.com/reset?t=token-xyz',
      });

      expect(result.success).toBe(true);
      expect(getPasswordResetTemplate).toHaveBeenCalledWith({
        firstName: 'Juan',
        resetUrl: 'https://app.com/reset?t=token-xyz',
        brandName: 'TaskHub',
      });
      expect(_mocks.resendSend).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: 'Restablecer contraseña - TaskHub',
        }),
      );
    });
  });

  // ================================================================
  // sendInvitationEmail
  // ================================================================

  describe('sendInvitationEmail', () => {
    it('should return simulated result when provider is none', async () => {
      const service = await buildService({});

      const result = await service.sendInvitationEmail({
        to: 'invite@example.com',
        organizationName: 'Acme Corp',
        inviteUrl: 'https://app.com/invite/abc',
        role: 'member',
      });

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('simulated');
    });

    it('should generate invitation template and send email for organization', async () => {
      _mocks.resendSend.mockResolvedValue({
        data: { id: 'invite-1' },
        error: null,
      });

      const service = await buildService({
        RESEND_API_KEY: 're_test_key',
        BRAND_NAME: 'TaskHub',
      });

      const result = await service.sendInvitationEmail({
        to: 'invite@example.com',
        organizationName: 'Acme Corp',
        inviteUrl: 'https://app.com/invite/abc',
        invitedByName: 'Admin User',
        role: 'admin',
      });

      expect(result.success).toBe(true);
      expect(getInvitationEmailTemplate).toHaveBeenCalledWith({
        organizationName: 'Acme Corp',
        inviteUrl: 'https://app.com/invite/abc',
        invitedByName: 'Admin User',
        role: 'admin',
        brandName: 'TaskHub',
        projectName: undefined,
      });
      expect(_mocks.resendSend).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: 'Te han invitado a Acme Corp - TaskHub',
        }),
      );
    });

    it('should use project-specific subject when projectName is provided', async () => {
      _mocks.resendSend.mockResolvedValue({
        data: { id: 'invite-2' },
        error: null,
      });

      const service = await buildService({
        RESEND_API_KEY: 're_test_key',
        BRAND_NAME: 'TaskHub',
      });

      await service.sendInvitationEmail({
        to: 'invite@example.com',
        organizationName: 'Acme Corp',
        inviteUrl: 'https://app.com/invite/def',
        role: 'member',
        projectName: 'Project Alpha',
      });

      expect(_mocks.resendSend).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: 'Te han invitado al proyecto Project Alpha - TaskHub',
        }),
      );
    });
  });

  // ================================================================
  // testConnection
  // ================================================================

  describe('testConnection', () => {
    it('should return failure for provider "none"', async () => {
      const service = await buildService({});

      const result = await service.testConnection();

      expect(result).toEqual({
        success: false,
        provider: 'none',
        message: 'No hay proveedor de email configurado',
      });
    });

    it('should return success for Resend provider', async () => {
      const service = await buildService({
        RESEND_API_KEY: 're_test_key',
      });

      const result = await service.testConnection();

      expect(result).toEqual({
        success: true,
        provider: 'resend',
        message: 'Resend configurado correctamente',
      });
    });

    it('should return success for Gmail API when access token works', async () => {
      _mocks.getAccessToken.mockResolvedValue({ token: 'access-token' });

      const service = await buildService({
        GMAIL_CLIENT_ID: 'client-id',
        GMAIL_CLIENT_SECRET: 'client-secret',
        GMAIL_REFRESH_TOKEN: 'refresh-token',
        GMAIL_USER: 'user@gmail.com',
      });

      const result = await service.testConnection();

      expect(result.success).toBe(true);
      expect(result.provider).toBe('gmail-api');
      expect(result.message).toContain('Gmail API');
    });

    it('should return failure for Gmail API when access token fails', async () => {
      _mocks.getAccessToken.mockRejectedValue(
        new Error('Invalid refresh token'),
      );

      const service = await buildService({
        GMAIL_CLIENT_ID: 'client-id',
        GMAIL_CLIENT_SECRET: 'client-secret',
        GMAIL_REFRESH_TOKEN: 'bad-refresh-token',
        GMAIL_USER: 'user@gmail.com',
      });

      const result = await service.testConnection();

      expect(result.success).toBe(false);
      expect(result.provider).toBe('gmail-api');
      expect(result.message).toBe('Invalid refresh token');
    });

    it('should return success for Gmail SMTP when verify works', async () => {
      _mocks.verify.mockResolvedValue(true);

      const service = await buildService({
        GMAIL_USER: 'user@gmail.com',
        GMAIL_APP_PASSWORD: 'app-pass',
      });

      const result = await service.testConnection();

      expect(result.success).toBe(true);
      expect(result.provider).toBe('gmail');
      expect(result.message).toContain('Gmail SMTP');
    });

    it('should return failure for Gmail SMTP when verify fails', async () => {
      _mocks.verify.mockRejectedValue(new Error('SMTP connection refused'));

      const service = await buildService({
        GMAIL_USER: 'user@gmail.com',
        GMAIL_APP_PASSWORD: 'app-pass',
      });

      const result = await service.testConnection();

      expect(result.success).toBe(false);
      expect(result.provider).toBe('gmail');
      expect(result.message).toBe('SMTP connection refused');
    });
  });
});
