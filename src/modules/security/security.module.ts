import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule } from '@nestjs/throttler';
import { ConfigModule, ConfigService } from '@nestjs/config';

// Entities
import {
  SecurityEvent,
  BlockedIP,
  LoginAttempt,
  RateLimitLog,
  ActiveSession,
  SecurityConfig,
  SecurityAlert,
} from './entities';

// Services
import {
  SecurityEventService,
  BlockedIpService,
  LoginAttemptService,
  SecurityConfigService,
  ActiveSessionService,
  SecurityAlertService,
} from './services';

// Guards
import { IpBlockGuard } from './guards';

// Controllers
import { SecurityAdminController } from './security-admin.controller';

/**
 * Modulo de Seguridad
 *
 * Proporciona funcionalidades de seguridad completas:
 * - Rate Limiting con @nestjs/throttler
 * - Bloqueo de IPs (manual y automatico)
 * - Registro de eventos de seguridad
 * - Tracking de intentos de login
 * - Gestion de sesiones activas
 * - Alertas de seguridad automaticas
 * - Dashboard de monitoreo para super_admin
 *
 * Este modulo es GLOBAL para que los guards y servicios
 * esten disponibles en toda la aplicacion.
 */
@Global()
@Module({
  imports: [
    // TypeORM para las entidades de seguridad
    TypeOrmModule.forFeature([
      SecurityEvent,
      BlockedIP,
      LoginAttempt,
      RateLimitLog,
      ActiveSession,
      SecurityConfig,
      SecurityAlert,
    ]),

    // Throttler para rate limiting
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        throttlers: [
          {
            name: 'short',
            ttl: 1000, // 1 segundo
            limit: 3, // 3 peticiones por segundo
          },
          {
            name: 'medium',
            ttl: 10000, // 10 segundos
            limit: 20, // 20 peticiones por 10 segundos
          },
          {
            name: 'long',
            ttl: 60000, // 1 minuto
            limit: 100, // 100 peticiones por minuto
          },
        ],
      }),
    }),

    ConfigModule,
  ],
  controllers: [SecurityAdminController],
  providers: [
    // Services
    SecurityEventService,
    BlockedIpService,
    LoginAttemptService,
    SecurityConfigService,
    ActiveSessionService,
    SecurityAlertService,

    // Guards
    IpBlockGuard,
  ],
  exports: [
    // Export services para uso en otros modulos
    SecurityEventService,
    BlockedIpService,
    LoginAttemptService,
    SecurityConfigService,
    ActiveSessionService,
    SecurityAlertService,

    // Export guards
    IpBlockGuard,

    // Export TypeORM para que otros modulos puedan usar las entidades
    TypeOrmModule,
  ],
})
export class SecurityModule {}
