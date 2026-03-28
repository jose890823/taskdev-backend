import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Twilio } from 'twilio';

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);
  private twilioClient: Twilio | null = null;
  private isConfigured = false;
  private twilioPhoneNumber: string;

  constructor(private configService: ConfigService) {
    const accountSid = this.configService.get<string>('TWILIO_ACCOUNT_SID');
    const authToken = this.configService.get<string>('TWILIO_AUTH_TOKEN');
    this.twilioPhoneNumber =
      this.configService.get<string>('TWILIO_PHONE_NUMBER') || '';

    if (!accountSid || !authToken || !this.twilioPhoneNumber) {
      this.logger.warn(
        '⚠️  Twilio no configurado - SMS Service en modo deshabilitado',
      );
      this.isConfigured = false;
      return;
    }

    try {
      this.twilioClient = new Twilio(accountSid, authToken);
      this.isConfigured = true;
      this.logger.log('📱 Twilio SMS Service inicializado correctamente');
    } catch (error: unknown) {
      this.logger.error(
        'Error inicializando Twilio',
        error instanceof Error ? error.stack : String(error),
      );
      this.isConfigured = false;
    }
  }

  /**
   * Check if SMS service is available
   */
  isAvailable(): boolean {
    return this.isConfigured && this.twilioClient !== null;
  }

  /**
   * Send SMS
   */
  async sendSms(to: string, message: string): Promise<boolean> {
    if (!this.isAvailable()) {
      this.logger.log(`📱 [SIMULADO] SMS a ${to}: ${message}`);
      return false;
    }

    try {
      await this.twilioClient!.messages.create({
        body: message,
        from: this.twilioPhoneNumber,
        to,
      });

      this.logger.log(`✅ SMS enviado exitosamente a ${to}`);
      return true;
    } catch (error: unknown) {
      this.logger.error(
        `Error enviando SMS a ${to}`,
        error instanceof Error ? error.stack : String(error),
      );
      return false;
    }
  }

  /**
   * Send phone verification OTP
   */
  async sendPhoneVerificationOtp(
    phoneNumber: string,
    otpCode: string,
  ): Promise<boolean> {
    const message = `Your MiChambita verification code is: ${otpCode}. Valid for 10 minutes.`;
    return this.sendSms(phoneNumber, message);
  }

  /**
   * Send notification SMS
   */
  async sendNotification(
    phoneNumber: string,
    notification: string,
  ): Promise<boolean> {
    return this.sendSms(phoneNumber, notification);
  }
}
