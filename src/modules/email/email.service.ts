import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import {
  SendEmailDto,
  SendOtpEmailDto,
  SendWelcomeEmailDto,
  SendPasswordResetEmailDto,
  SendInvitationEmailDto,
  EmailResult,
} from './interfaces/email.interface';
import { getOtpEmailTemplate } from './templates/otp.template';
import { getWelcomeEmailTemplate } from './templates/welcome.template';
import { getPasswordResetTemplate } from './templates/password-reset.template';
import { getInvitationEmailTemplate } from './templates/invitation.template';

type EmailProvider = 'resend' | 'gmail' | 'none';

/**
 * EmailService - Servicio de envío de correos
 *
 * Prioridad de proveedores:
 * 1. Resend (recomendado para producción)
 * 2. Gmail SMTP (backup/desarrollo)
 * 3. Modo simulado (solo logs)
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private resend: Resend | null = null;
  private gmailTransporter: Transporter | null = null;
  private provider: EmailProvider = 'none';
  private readonly defaultFrom: string;
  private readonly brandName: string;

  constructor(private configService: ConfigService) {
    this.defaultFrom =
      this.configService.get<string>('EMAIL_FROM') || 'noreply@michambita.com';
    this.brandName =
      this.configService.get<string>('BRAND_NAME') || 'MiChambita';
    this.initialize();
  }

  /**
   * Inicializa el proveedor de email (Resend > Gmail > None)
   */
  private initialize(): void {
    // Intentar Resend primero
    const resendApiKey = this.configService.get<string>('RESEND_API_KEY');
    if (resendApiKey && resendApiKey !== '') {
      try {
        this.resend = new Resend(resendApiKey);
        this.provider = 'resend';
        this.logger.log('✅ EmailService configurado con Resend');
        this.logger.log(`📧 Enviando desde: ${this.defaultFrom}`);
        return;
      } catch (error) {
        this.logger.warn('⚠️ Error inicializando Resend:', error.message);
      }
    }

    // Fallback a Gmail SMTP
    const gmailUser = this.configService.get<string>('GMAIL_USER');
    const gmailPass = this.configService.get<string>('GMAIL_APP_PASSWORD');
    if (gmailUser && gmailPass && gmailUser !== '' && gmailPass !== '') {
      try {
        this.gmailTransporter = nodemailer.createTransport({
          host: 'smtp.gmail.com',
          port: 587,
          secure: false,
          auth: { user: gmailUser, pass: gmailPass },
          connectionTimeout: 30000,
          greetingTimeout: 30000,
          socketTimeout: 60000,
          pool: true,
          maxConnections: 5,
          maxMessages: 100,
        });
        this.provider = 'gmail';
        this.logger.log('✅ EmailService configurado con Gmail SMTP');
        this.logger.log(`📧 Usando cuenta: ${gmailUser}`);
        return;
      } catch (error) {
        this.logger.warn('⚠️ Error inicializando Gmail SMTP:', error.message);
      }
    }

    // Sin proveedor configurado
    this.provider = 'none';
    this.logger.warn(
      '⚠️ EmailService en modo simulado - Configura RESEND_API_KEY o GMAIL_USER/GMAIL_APP_PASSWORD',
    );
  }

  /**
   * Verifica si el servicio de email está disponible
   */
  isAvailable(): boolean {
    return this.provider !== 'none';
  }

  /**
   * Obtiene el proveedor activo
   */
  getProvider(): EmailProvider {
    return this.provider;
  }

  /**
   * Envía un email genérico
   */
  async sendEmail(dto: SendEmailDto): Promise<EmailResult> {
    const from = dto.from || this.defaultFrom;

    // Modo simulado
    if (this.provider === 'none') {
      this.logger.debug(`📧 [SIMULADO] Email a ${dto.to}: ${dto.subject}`);
      return { success: true, messageId: 'simulated' };
    }

    try {
      // Resend
      if (this.provider === 'resend' && this.resend) {
        const result = await this.resend.emails.send({
          from,
          to: Array.isArray(dto.to) ? dto.to : [dto.to],
          subject: dto.subject,
          html: dto.html || '',
          text: dto.text,
          replyTo: dto.replyTo,
        });

        if (result.error) {
          throw new Error(result.error.message);
        }

        this.logger.log(`Email enviado via Resend a ${dto.to}`);
        return { success: true, messageId: result.data?.id };
      }

      // Gmail
      if (this.provider === 'gmail' && this.gmailTransporter) {
        const info = await this.gmailTransporter.sendMail({
          from,
          to: dto.to,
          subject: dto.subject,
          html: dto.html,
          text: dto.text,
          replyTo: dto.replyTo,
        });

        this.logger.log(`📧 Email enviado via Gmail a ${dto.to}`);
        return { success: true, messageId: info.messageId };
      }

      throw new Error('No email provider available');
    } catch (error) {
      this.logger.error(`❌ Error enviando email a ${dto.to}:`, error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Envía código OTP de verificación
   */
  async sendOtpEmail(dto: SendOtpEmailDto): Promise<EmailResult> {
    if (this.provider === 'none') {
      this.logger.log(`📧 [SIMULADO] OTP para ${dto.to}: ${dto.otpCode}`);
      return { success: true, messageId: 'simulated' };
    }

    const html = getOtpEmailTemplate({
      firstName: dto.firstName,
      otpCode: dto.otpCode,
      expirationMinutes: dto.expirationMinutes || 10,
      brandName: this.brandName,
    });

    return this.sendEmail({
      to: dto.to,
      subject: `${dto.otpCode} - Código de verificación`,
      html,
    });
  }

  /**
   * Envía email de bienvenida
   */
  async sendWelcomeEmail(dto: SendWelcomeEmailDto): Promise<EmailResult> {
    if (this.provider === 'none') {
      this.logger.log(`📧 [SIMULADO] Bienvenida para ${dto.to}`);
      return { success: true, messageId: 'simulated' };
    }

    const html = getWelcomeEmailTemplate({
      firstName: dto.firstName,
      lastName: dto.lastName,
      brandName: this.brandName,
    });

    return this.sendEmail({
      to: dto.to,
      subject: `¡Bienvenido a ${this.brandName}!`,
      html,
    });
  }

  /**
   * Envía email de reseteo de contraseña
   */
  async sendPasswordResetEmail(
    dto: SendPasswordResetEmailDto,
  ): Promise<EmailResult> {
    if (this.provider === 'none') {
      this.logger.log(`📧 [SIMULADO] Reset password para ${dto.to}`);
      return { success: true, messageId: 'simulated' };
    }

    const html = getPasswordResetTemplate({
      firstName: dto.firstName,
      resetUrl: dto.resetUrl,
      brandName: this.brandName,
    });

    return this.sendEmail({
      to: dto.to,
      subject: `Restablecer contraseña - ${this.brandName}`,
      html,
    });
  }

  /**
   * Envía email de invitacion a organizacion
   */
  async sendInvitationEmail(dto: SendInvitationEmailDto): Promise<EmailResult> {
    if (this.provider === 'none') {
      this.logger.log(`📧 [SIMULADO] Invitacion para ${dto.to}: ${dto.inviteUrl}`);
      return { success: true, messageId: 'simulated' };
    }

    const html = getInvitationEmailTemplate({
      organizationName: dto.organizationName,
      inviteUrl: dto.inviteUrl,
      invitedByName: dto.invitedByName,
      role: dto.role,
      brandName: this.brandName,
      projectName: dto.projectName,
    });

    const subject = dto.projectName
      ? `Te han invitado al proyecto ${dto.projectName} - ${this.brandName}`
      : `Te han invitado a ${dto.organizationName} - ${this.brandName}`;

    return this.sendEmail({
      to: dto.to,
      subject,
      html,
    });
  }

  /**
   * Método para testing - verifica conectividad
   */
  async testConnection(): Promise<{
    success: boolean;
    provider: string;
    message: string;
  }> {
    if (this.provider === 'none') {
      return {
        success: false,
        provider: 'none',
        message: 'No hay proveedor de email configurado',
      };
    }

    if (this.provider === 'resend') {
      return {
        success: true,
        provider: 'resend',
        message: 'Resend configurado correctamente',
      };
    }

    if (this.provider === 'gmail' && this.gmailTransporter) {
      try {
        await this.gmailTransporter.verify();
        return {
          success: true,
          provider: 'gmail',
          message: 'Gmail SMTP conectado correctamente',
        };
      } catch (error) {
        return {
          success: false,
          provider: 'gmail',
          message: error.message,
        };
      }
    }

    return {
      success: false,
      provider: 'unknown',
      message: 'Estado desconocido',
    };
  }
}
