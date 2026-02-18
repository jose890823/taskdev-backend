/**
 * Interfaz base para envío de correos
 */
export interface SendEmailDto {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  from?: string;
  replyTo?: string;
}

/**
 * DTO específico para envío de OTP
 */
export interface SendOtpEmailDto {
  to: string;
  firstName: string;
  otpCode: string;
  expirationMinutes?: number;
}

/**
 * DTO para email de bienvenida
 */
export interface SendWelcomeEmailDto {
  to: string;
  firstName: string;
  lastName?: string;
}

/**
 * DTO para reset de password
 */
export interface SendPasswordResetEmailDto {
  to: string;
  firstName: string;
  resetToken: string;
  resetUrl: string;
}

/**
 * Resultado del envío de email
 */
export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}
