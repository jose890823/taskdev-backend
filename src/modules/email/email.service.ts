import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { google } from 'googleapis';
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

type EmailProvider = 'resend' | 'gmail-api' | 'gmail' | 'none';

/**
 * EmailService - Servicio de envío de correos
 *
 * Prioridad de proveedores:
 * 1. Gmail API via HTTPS (funciona en Railway, no necesita puertos SMTP)
 * 2. Resend (requiere dominio verificado)
 * 3. Gmail SMTP (desarrollo local)
 * 4. Modo simulado (solo logs)
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private resend: Resend | null = null;
  private gmailTransporter: Transporter | null = null;
  private gmailApiAuth: InstanceType<typeof google.auth.OAuth2> | null = null;
  private gmailApiUser: string | null = null;
  private provider: EmailProvider = 'none';
  private readonly defaultFrom: string;
  private readonly brandName: string;

  constructor(private configService: ConfigService) {
    this.defaultFrom =
      this.configService.get<string>('EMAIL_FROM') || 'noreply@taskhub.dev';
    this.brandName =
      this.configService.get<string>('BRAND_NAME') || 'TaskHub';
    this.initialize();
  }

  /**
   * Inicializa el proveedor de email (Gmail API > Resend > Gmail SMTP > None)
   */
  private initialize(): void {
    // 1. Intentar Gmail API (HTTPS - funciona en Railway sin puertos SMTP)
    if (this.initializeGmailApi()) {
      return;
    }

    // 2. Intentar Resend (requiere dominio verificado)
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

    // 3. Fallback a Gmail SMTP (solo local)
    if (this.initializeGmailSmtp()) {
      return;
    }

    // Sin proveedor configurado
    this.provider = 'none';
    this.logger.warn(
      '⚠️ EmailService en modo simulado - Configura GMAIL_CLIENT_ID/GMAIL_CLIENT_SECRET/GMAIL_REFRESH_TOKEN o RESEND_API_KEY',
    );
  }

  /**
   * Inicializa Gmail API via OAuth2 (usa HTTPS, no SMTP)
   */
  private initializeGmailApi(): boolean {
    const clientId = this.configService.get<string>('GMAIL_CLIENT_ID');
    const clientSecret = this.configService.get<string>('GMAIL_CLIENT_SECRET');
    const refreshToken = this.configService.get<string>('GMAIL_REFRESH_TOKEN');
    const gmailUser = this.configService.get<string>('GMAIL_USER');

    if (clientId && clientSecret && refreshToken && gmailUser) {
      try {
        this.gmailApiAuth = new google.auth.OAuth2(clientId, clientSecret);
        this.gmailApiAuth.setCredentials({ refresh_token: refreshToken });
        this.gmailApiUser = gmailUser;
        this.provider = 'gmail-api';
        this.logger.log('✅ EmailService configurado con Gmail API (HTTPS)');
        this.logger.log(`📧 Usando cuenta: ${gmailUser}`);
        return true;
      } catch (error) {
        this.logger.warn('⚠️ Error inicializando Gmail API:', error.message);
      }
    }
    return false;
  }

  /**
   * Inicializa Gmail SMTP (solo funciona en local, Railway bloquea puertos SMTP)
   */
  private initializeGmailSmtp(): boolean {
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
        return true;
      } catch (error) {
        this.logger.warn('⚠️ Error inicializando Gmail SMTP:', error.message);
      }
    }
    return false;
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
   * Construye un email RFC 2822 en base64url para Gmail API
   */
  private buildRawEmail(params: {
    from: string;
    to: string | string[];
    subject: string;
    html?: string;
    text?: string;
    replyTo?: string;
  }): string {
    const to = Array.isArray(params.to) ? params.to.join(', ') : params.to;
    const boundary = `boundary_${Date.now()}_${Math.random().toString(36).slice(2)}`;

    const headers = [
      `From: ${params.from}`,
      `To: ${to}`,
      `Subject: =?UTF-8?B?${Buffer.from(params.subject).toString('base64')}?=`,
      'MIME-Version: 1.0',
    ];

    if (params.replyTo) {
      headers.push(`Reply-To: ${params.replyTo}`);
    }

    let body: string;
    if (params.html && params.text) {
      headers.push(`Content-Type: multipart/alternative; boundary="${boundary}"`);
      body = [
        `--${boundary}`,
        'Content-Type: text/plain; charset=UTF-8',
        '',
        params.text,
        `--${boundary}`,
        'Content-Type: text/html; charset=UTF-8',
        '',
        params.html,
        `--${boundary}--`,
      ].join('\r\n');
    } else if (params.html) {
      headers.push('Content-Type: text/html; charset=UTF-8');
      body = params.html;
    } else {
      headers.push('Content-Type: text/plain; charset=UTF-8');
      body = params.text || '';
    }

    const email = headers.join('\r\n') + '\r\n\r\n' + body;
    return Buffer.from(email)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  }

  /**
   * Envía un email via Gmail API (HTTPS)
   */
  private async sendViaGmailApi(params: {
    from: string;
    to: string | string[];
    subject: string;
    html?: string;
    text?: string;
    replyTo?: string;
  }): Promise<EmailResult> {
    const gmail = google.gmail({ version: 'v1', auth: this.gmailApiAuth! });
    const raw = this.buildRawEmail(params);

    const result = await gmail.users.messages.send({
      userId: 'me',
      requestBody: { raw },
    });

    this.logger.log(`📧 Email enviado via Gmail API a ${params.to}`);
    return { success: true, messageId: result.data.id || undefined };
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

      // Gmail API (HTTPS)
      if (this.provider === 'gmail-api' && this.gmailApiAuth) {
        return this.sendViaGmailApi({
          from: `${this.brandName} <${this.gmailApiUser}>`,
          to: dto.to,
          subject: dto.subject,
          html: dto.html,
          text: dto.text,
          replyTo: dto.replyTo,
        });
      }

      // Gmail SMTP
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

    if (this.provider === 'gmail-api' && this.gmailApiAuth) {
      try {
        await this.gmailApiAuth.getAccessToken();
        return {
          success: true,
          provider: 'gmail-api',
          message: 'Gmail API (HTTPS) conectado correctamente',
        };
      } catch (error) {
        return {
          success: false,
          provider: 'gmail-api',
          message: error.message,
        };
      }
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
