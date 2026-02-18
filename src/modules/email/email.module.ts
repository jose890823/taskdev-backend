import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EmailService } from './email.service';

/**
 * EmailModule - Módulo OPCIONAL de envío de correos
 *
 * FILOSOFÍA: Este módulo puede ser eliminado completamente y el sistema seguirá funcionando.
 * Si el módulo no existe o Resend no está configurado, los correos simplemente no se envían.
 *
 * Configuración requerida en .env:
 * - RESEND_API_KEY: Tu API key de Resend (obligatorio)
 * - EMAIL_FROM: Email remitente por defecto (opcional, default: noreply@michambita.com)
 *
 * Para obtener una API key gratuita:
 * 1. Registrarse en https://resend.com
 * 2. Verificar tu dominio o usar el dominio de testing
 * 3. Copiar la API key del dashboard
 */
@Module({
  imports: [ConfigModule],
  providers: [EmailService],
  exports: [EmailService],
})
export class EmailModule {}
