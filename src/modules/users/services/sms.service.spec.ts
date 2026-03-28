import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { SmsService } from './sms.service';

// Mock twilio module — must be before import
jest.mock('twilio', () => {
  const mockCreate = jest.fn().mockResolvedValue({ sid: 'SM_MOCK_SID' });
  const MockTwilio = jest.fn().mockImplementation(() => ({
    messages: { create: mockCreate },
  }));
  return { Twilio: MockTwilio };
});

// Import after mock
import { Twilio } from 'twilio';

describe('SmsService', () => {
  // Valid UUID for mock data
  const PHONE_NUMBER = '+1234567890';
  const OTP_CODE = '123456';

  // Helper to access the mocked Twilio constructor
  const MockedTwilio = Twilio as unknown as jest.Mock;

  // Helper to get the mock messages.create function from a service instance
  const getMessagesCreateMock = (): jest.Mock => {
    const twilioInstance = MockedTwilio.mock.results[
      MockedTwilio.mock.results.length - 1
    ]?.value;
    return twilioInstance?.messages?.create;
  };

  /**
   * Factory to create a SmsService with specific config
   */
  const createServiceWithConfig = async (
    config: Record<string, string | undefined>,
  ): Promise<{ service: SmsService; configService: jest.Mocked<ConfigService> }> => {
    const mockConfigService = {
      get: jest.fn().mockImplementation((key: string) => config[key]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SmsService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    return {
      service: module.get<SmsService>(SmsService),
      configService: mockConfigService as any,
    };
  };

  const FULL_CONFIG = {
    TWILIO_ACCOUNT_SID: 'AC_MOCK_SID',
    TWILIO_AUTH_TOKEN: 'MOCK_AUTH_TOKEN',
    TWILIO_PHONE_NUMBER: '+10000000000',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ─────────────────────────────────────────────────────
  // Constructor / initialization
  // ─────────────────────────────────────────────────────
  describe('constructor', () => {
    it('should initialize Twilio client when all config values are present', async () => {
      const { service } = await createServiceWithConfig(FULL_CONFIG);

      expect(service).toBeDefined();
      expect(MockedTwilio).toHaveBeenCalledWith(
        'AC_MOCK_SID',
        'MOCK_AUTH_TOKEN',
      );
      expect(service.isAvailable()).toBe(true);
    });

    it('should NOT initialize Twilio when TWILIO_ACCOUNT_SID is missing', async () => {
      const { service } = await createServiceWithConfig({
        TWILIO_ACCOUNT_SID: undefined,
        TWILIO_AUTH_TOKEN: 'MOCK_AUTH_TOKEN',
        TWILIO_PHONE_NUMBER: '+10000000000',
      });

      expect(service.isAvailable()).toBe(false);
    });

    it('should NOT initialize Twilio when TWILIO_AUTH_TOKEN is missing', async () => {
      const { service } = await createServiceWithConfig({
        TWILIO_ACCOUNT_SID: 'AC_MOCK_SID',
        TWILIO_AUTH_TOKEN: undefined,
        TWILIO_PHONE_NUMBER: '+10000000000',
      });

      expect(service.isAvailable()).toBe(false);
    });

    it('should NOT initialize Twilio when TWILIO_PHONE_NUMBER is missing', async () => {
      const { service } = await createServiceWithConfig({
        TWILIO_ACCOUNT_SID: 'AC_MOCK_SID',
        TWILIO_AUTH_TOKEN: 'MOCK_AUTH_TOKEN',
        TWILIO_PHONE_NUMBER: undefined,
      });

      expect(service.isAvailable()).toBe(false);
    });

    it('should NOT initialize Twilio when TWILIO_PHONE_NUMBER is empty string', async () => {
      const { service } = await createServiceWithConfig({
        TWILIO_ACCOUNT_SID: 'AC_MOCK_SID',
        TWILIO_AUTH_TOKEN: 'MOCK_AUTH_TOKEN',
        TWILIO_PHONE_NUMBER: '',
      });

      expect(service.isAvailable()).toBe(false);
    });

    it('should NOT initialize Twilio when all config values are missing', async () => {
      const { service } = await createServiceWithConfig({});

      expect(service.isAvailable()).toBe(false);
      expect(MockedTwilio).not.toHaveBeenCalled();
    });

    it('should handle Twilio constructor throwing an error', async () => {
      MockedTwilio.mockImplementationOnce(() => {
        throw new Error('Invalid credentials');
      });

      const { service } = await createServiceWithConfig(FULL_CONFIG);

      expect(service.isAvailable()).toBe(false);
    });
  });

  // ─────────────────────────────────────────────────────
  // isAvailable
  // ─────────────────────────────────────────────────────
  describe('isAvailable', () => {
    it('should return true when Twilio is properly configured', async () => {
      const { service } = await createServiceWithConfig(FULL_CONFIG);

      expect(service.isAvailable()).toBe(true);
    });

    it('should return false when Twilio is not configured', async () => {
      const { service } = await createServiceWithConfig({});

      expect(service.isAvailable()).toBe(false);
    });
  });

  // ─────────────────────────────────────────────────────
  // sendSms
  // ─────────────────────────────────────────────────────
  describe('sendSms', () => {
    it('should send SMS successfully and return true', async () => {
      const { service } = await createServiceWithConfig(FULL_CONFIG);
      const mockCreate = getMessagesCreateMock();

      const result = await service.sendSms(PHONE_NUMBER, 'Hello World');

      expect(result).toBe(true);
      expect(mockCreate).toHaveBeenCalledWith({
        body: 'Hello World',
        from: '+10000000000',
        to: PHONE_NUMBER,
      });
    });

    it('should return false when Twilio is not configured (simulated mode)', async () => {
      const { service } = await createServiceWithConfig({});

      const result = await service.sendSms(PHONE_NUMBER, 'Hello World');

      expect(result).toBe(false);
    });

    it('should return false when Twilio messages.create throws an error', async () => {
      const { service } = await createServiceWithConfig(FULL_CONFIG);
      const mockCreate = getMessagesCreateMock();
      mockCreate.mockRejectedValueOnce(new Error('Twilio API error'));

      const result = await service.sendSms(PHONE_NUMBER, 'Hello World');

      expect(result).toBe(false);
    });

    it('should pass the correct phone number and message body', async () => {
      const { service } = await createServiceWithConfig(FULL_CONFIG);
      const mockCreate = getMessagesCreateMock();

      await service.sendSms('+9876543210', 'Test message');

      expect(mockCreate).toHaveBeenCalledWith({
        body: 'Test message',
        from: '+10000000000',
        to: '+9876543210',
      });
    });

    it('should use the configured Twilio phone number as "from"', async () => {
      const customConfig = {
        ...FULL_CONFIG,
        TWILIO_PHONE_NUMBER: '+15551234567',
      };
      const { service } = await createServiceWithConfig(customConfig);
      const mockCreate = getMessagesCreateMock();

      await service.sendSms(PHONE_NUMBER, 'Test');

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({ from: '+15551234567' }),
      );
    });

    it('should handle network errors gracefully', async () => {
      const { service } = await createServiceWithConfig(FULL_CONFIG);
      const mockCreate = getMessagesCreateMock();
      mockCreate.mockRejectedValueOnce(new Error('ECONNREFUSED'));

      const result = await service.sendSms(PHONE_NUMBER, 'Test');

      expect(result).toBe(false);
    });

    it('should handle non-Error throws gracefully', async () => {
      const { service } = await createServiceWithConfig(FULL_CONFIG);
      const mockCreate = getMessagesCreateMock();
      mockCreate.mockRejectedValueOnce('string error');

      const result = await service.sendSms(PHONE_NUMBER, 'Test');

      expect(result).toBe(false);
    });
  });

  // ─────────────────────────────────────────────────────
  // sendPhoneVerificationOtp
  // ─────────────────────────────────────────────────────
  describe('sendPhoneVerificationOtp', () => {
    it('should send OTP message with correct format', async () => {
      const { service } = await createServiceWithConfig(FULL_CONFIG);
      const mockCreate = getMessagesCreateMock();

      await service.sendPhoneVerificationOtp(PHONE_NUMBER, OTP_CODE);

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          body: `Your MiChambita verification code is: ${OTP_CODE}. Valid for 10 minutes.`,
          to: PHONE_NUMBER,
        }),
      );
    });

    it('should return true when SMS is sent successfully', async () => {
      const { service } = await createServiceWithConfig(FULL_CONFIG);

      const result = await service.sendPhoneVerificationOtp(
        PHONE_NUMBER,
        OTP_CODE,
      );

      expect(result).toBe(true);
    });

    it('should return false when Twilio is not configured', async () => {
      const { service } = await createServiceWithConfig({});

      const result = await service.sendPhoneVerificationOtp(
        PHONE_NUMBER,
        OTP_CODE,
      );

      expect(result).toBe(false);
    });

    it('should return false when Twilio API fails', async () => {
      const { service } = await createServiceWithConfig(FULL_CONFIG);
      const mockCreate = getMessagesCreateMock();
      mockCreate.mockRejectedValueOnce(new Error('Twilio rate limit'));

      const result = await service.sendPhoneVerificationOtp(
        PHONE_NUMBER,
        OTP_CODE,
      );

      expect(result).toBe(false);
    });

    it('should include the OTP code in the message body', async () => {
      const { service } = await createServiceWithConfig(FULL_CONFIG);
      const mockCreate = getMessagesCreateMock();

      await service.sendPhoneVerificationOtp(PHONE_NUMBER, '999888');

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.stringContaining('999888'),
        }),
      );
    });
  });

  // ─────────────────────────────────────────────────────
  // sendNotification
  // ─────────────────────────────────────────────────────
  describe('sendNotification', () => {
    it('should send notification SMS and return true', async () => {
      const { service } = await createServiceWithConfig(FULL_CONFIG);
      const mockCreate = getMessagesCreateMock();

      const result = await service.sendNotification(
        PHONE_NUMBER,
        'Your task has been completed!',
      );

      expect(result).toBe(true);
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          body: 'Your task has been completed!',
          to: PHONE_NUMBER,
        }),
      );
    });

    it('should return false when Twilio is not configured', async () => {
      const { service } = await createServiceWithConfig({});

      const result = await service.sendNotification(
        PHONE_NUMBER,
        'Notification',
      );

      expect(result).toBe(false);
    });

    it('should return false when Twilio API fails', async () => {
      const { service } = await createServiceWithConfig(FULL_CONFIG);
      const mockCreate = getMessagesCreateMock();
      mockCreate.mockRejectedValueOnce(new Error('Service unavailable'));

      const result = await service.sendNotification(
        PHONE_NUMBER,
        'Notification',
      );

      expect(result).toBe(false);
    });

    it('should delegate to sendSms with the notification message', async () => {
      const { service } = await createServiceWithConfig(FULL_CONFIG);
      const spy = jest.spyOn(service, 'sendSms');

      await service.sendNotification(PHONE_NUMBER, 'Hello there');

      expect(spy).toHaveBeenCalledWith(PHONE_NUMBER, 'Hello there');
    });
  });
});
