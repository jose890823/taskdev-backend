import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { User } from './entities/user.entity';
import { JwtStrategy } from './strategies/jwt.strategy';
import { JwtRefreshStrategy } from './strategies/jwt-refresh.strategy';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { JwtRefreshGuard } from './guards/jwt-refresh.guard';
import { RolesGuard } from './guards/roles.guard';
import { UsersModule } from '../users/users.module';
import { existsSync } from 'fs';
import { join } from 'path';

// Importación condicional del EmailModule
let EmailModule: any = null;
let EmailService: any = null;

const emailModulePath = join(__dirname, '../email/email.module');
const emailServicePath = join(__dirname, '../email/email.service');

if (
  existsSync(emailModulePath + '.ts') ||
  existsSync(emailModulePath + '.js')
) {
  try {
    EmailModule = require('../email/email.module').EmailModule;
    EmailService = require('../email/email.service').EmailService;
  } catch (error) {
    // EmailModule no disponible
  }
}

/**
 * Módulo de Autenticación
 *
 * Proporciona autenticación completa con JWT, incluyendo:
 * - Registro de usuarios con verificación OTP por email
 * - Login con access token (15min) y refresh token (7 días)
 * - Refresh token rotation para mayor seguridad
 * - Verificación de email con código OTP de 6 dígitos
 * - Recuperación de contraseña con tokens de reseteo
 * - Cambio de contraseña para usuarios autenticados
 * - Guards para protección de rutas (JWT, Refresh, Roles)
 * - Decorators útiles (@Public, @CurrentUser, @Roles)
 *
 * Este módulo es completamente independiente y puede ser eliminado
 * sin afectar el funcionamiento de otros módulos.
 */
@Module({
  imports: [
    // Configuración de entorno
    ConfigModule,

    // TypeORM para la entidad User
    TypeOrmModule.forFeature([User]),

    // Passport para estrategias JWT
    PassportModule.register({ defaultStrategy: 'jwt' }),

    // JWT Module con configuración asíncrona
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET') || 'default-secret',
        signOptions: {
          expiresIn: configService.get('JWT_EXPIRATION') || '15m',
        },
      }),
    }),

    // EmailModule opcional - solo si existe
    ...(EmailModule ? [EmailModule] : []),

    // UsersModule para el servicio de actividades
    UsersModule,
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    JwtRefreshStrategy,
    JwtAuthGuard,
    JwtRefreshGuard,
    RolesGuard,
    // Registrar JwtAuthGuard como guard global
    // Todas las rutas requieren JWT por defecto; usar @Public() para excepciones
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    // Provider condicional para EmailService
    ...(EmailService
      ? [
          {
            provide: 'EmailService',
            useExisting: EmailService,
          },
        ]
      : []),
  ],
  exports: [AuthService, JwtAuthGuard, JwtRefreshGuard, RolesGuard],
})
export class AuthModule {}
