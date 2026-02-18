import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThanOrEqual } from 'typeorm';
import {
  LoginAttempt,
  LoginFailureReason,
} from '../entities/login-attempt.entity';
import { BlockedIpService } from './blocked-ip.service';
import { SecurityEventService } from './security-event.service';
import {
  SecurityEventType,
  SecurityEventSeverity,
} from '../entities/security-event.entity';
import { SecurityConfigService } from './security-config.service';

@Injectable()
export class LoginAttemptService {
  private readonly logger = new Logger(LoginAttemptService.name);

  constructor(
    @InjectRepository(LoginAttempt)
    private readonly loginAttemptRepository: Repository<LoginAttempt>,
    private readonly blockedIpService: BlockedIpService,
    private readonly securityEventService: SecurityEventService,
    private readonly securityConfigService: SecurityConfigService,
  ) {}

  /**
   * Registrar un intento de login exitoso
   */
  async recordSuccess(
    email: string,
    ipAddress: string,
    userAgent: string | null,
    userId: string,
  ): Promise<LoginAttempt> {
    const attempt = this.loginAttemptRepository.create({
      email,
      ipAddress,
      userAgent,
      success: true,
      userId,
    });

    const saved = await this.loginAttemptRepository.save(attempt);

    // Registrar evento de seguridad
    await this.securityEventService.create({
      eventType: SecurityEventType.LOGIN_SUCCESS,
      severity: SecurityEventSeverity.LOW,
      ipAddress,
      userAgent,
      userId,
      email,
      endpoint: '/api/auth/login',
      method: 'POST',
      description: 'Login exitoso',
    });

    return saved;
  }

  /**
   * Registrar un intento de login fallido
   */
  async recordFailure(
    email: string,
    ipAddress: string,
    userAgent: string | null,
    reason: LoginFailureReason,
    userId?: string,
  ): Promise<{
    attempt: LoginAttempt;
    shouldBlock: boolean;
    failedAttempts: number;
  }> {
    const attempt = this.loginAttemptRepository.create({
      email,
      ipAddress,
      userAgent,
      success: false,
      failureReason: reason,
      userId,
    });

    const saved = await this.loginAttemptRepository.save(attempt);

    // Contar intentos fallidos recientes para esta IP
    const windowMinutes = 15;
    const windowStart = new Date(Date.now() - windowMinutes * 60 * 1000);

    const recentFailures = await this.loginAttemptRepository.count({
      where: {
        ipAddress,
        success: false,
        createdAt: MoreThanOrEqual(windowStart),
      },
    });

    // Obtener configuracion de auto-bloqueo
    const autoBlockThreshold = await this.securityConfigService.getNumberValue(
      'auto_block_after_failed_logins',
      10,
    );
    const blockDuration = await this.securityConfigService.getNumberValue(
      'block_duration_minutes',
      30,
    );

    let shouldBlock = false;

    // Determinar severidad del evento
    let severity = SecurityEventSeverity.LOW;
    if (recentFailures >= 3) severity = SecurityEventSeverity.MEDIUM;
    if (recentFailures >= 5) severity = SecurityEventSeverity.HIGH;
    if (recentFailures >= autoBlockThreshold) {
      severity = SecurityEventSeverity.CRITICAL;
      shouldBlock = true;
    }

    // Registrar evento de seguridad
    await this.securityEventService.create({
      eventType: SecurityEventType.LOGIN_FAILED,
      severity,
      ipAddress,
      userAgent,
      userId,
      email,
      endpoint: '/api/auth/login',
      method: 'POST',
      description: `Login fallido: ${reason}`,
      metadata: {
        reason,
        failedAttempts: recentFailures,
        threshold: autoBlockThreshold,
      },
    });

    // Auto-bloquear si se excede el umbral
    if (shouldBlock) {
      await this.blockedIpService.autoBlockIp(
        ipAddress,
        `${recentFailures} intentos de login fallidos en ${windowMinutes} minutos`,
        blockDuration,
      );

      this.logger.warn(
        `IP ${ipAddress} auto-bloqueada despues de ${recentFailures} intentos fallidos`,
      );
    }

    return {
      attempt: saved,
      shouldBlock,
      failedAttempts: recentFailures,
    };
  }

  /**
   * Verificar si una IP puede intentar login (rate limit)
   */
  async canAttemptLogin(ipAddress: string): Promise<{
    allowed: boolean;
    remainingAttempts: number;
    waitSeconds?: number;
  }> {
    // Verificar si la IP esta bloqueada
    const isBlocked = await this.blockedIpService.isBlocked(ipAddress);
    if (isBlocked) {
      return { allowed: false, remainingAttempts: 0, waitSeconds: 0 };
    }

    // Verificar rate limit
    const rateLimitPerMinute = await this.securityConfigService.getNumberValue(
      'rate_limit_login',
      5,
    );

    const windowStart = new Date(Date.now() - 60 * 1000); // Ultimo minuto
    const recentAttempts = await this.loginAttemptRepository.count({
      where: {
        ipAddress,
        createdAt: MoreThanOrEqual(windowStart),
      },
    });

    if (recentAttempts >= rateLimitPerMinute) {
      return {
        allowed: false,
        remainingAttempts: 0,
        waitSeconds: 60,
      };
    }

    return {
      allowed: true,
      remainingAttempts: rateLimitPerMinute - recentAttempts,
    };
  }

  /**
   * Obtener intentos recientes para una IP
   */
  async getRecentByIp(
    ipAddress: string,
    limit: number = 10,
  ): Promise<LoginAttempt[]> {
    return this.loginAttemptRepository.find({
      where: { ipAddress },
      order: { createdAt: 'DESC' },
      take: limit,
      relations: ['user'],
    });
  }

  /**
   * Obtener intentos recientes para un email
   */
  async getRecentByEmail(
    email: string,
    limit: number = 10,
  ): Promise<LoginAttempt[]> {
    return this.loginAttemptRepository.find({
      where: { email },
      order: { createdAt: 'DESC' },
      take: limit,
      relations: ['user'],
    });
  }

  /**
   * Obtener estadisticas de intentos de login
   */
  async getStats(hours: number = 24): Promise<{
    total: number;
    successful: number;
    failed: number;
    successRate: number;
    topFailedIps: { ip: string; count: number }[];
    topFailedEmails: { email: string; count: number }[];
    failureReasons: Record<string, number>;
  }> {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);

    const attempts = await this.loginAttemptRepository.find({
      where: {
        createdAt: MoreThanOrEqual(since),
      },
    });

    const successful = attempts.filter((a) => a.success).length;
    const failed = attempts.filter((a) => !a.success).length;

    // Contar por IP fallida
    const ipCounts: Record<string, number> = {};
    const emailCounts: Record<string, number> = {};
    const reasonCounts: Record<string, number> = {};

    attempts
      .filter((a) => !a.success)
      .forEach((attempt) => {
        ipCounts[attempt.ipAddress] = (ipCounts[attempt.ipAddress] || 0) + 1;
        emailCounts[attempt.email] = (emailCounts[attempt.email] || 0) + 1;
        if (attempt.failureReason) {
          reasonCounts[attempt.failureReason] =
            (reasonCounts[attempt.failureReason] || 0) + 1;
        }
      });

    const topFailedIps = Object.entries(ipCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([ip, count]) => ({ ip, count }));

    const topFailedEmails = Object.entries(emailCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([email, count]) => ({ email, count }));

    return {
      total: attempts.length,
      successful,
      failed,
      successRate:
        attempts.length > 0 ? (successful / attempts.length) * 100 : 0,
      topFailedIps,
      topFailedEmails,
      failureReasons: reasonCounts,
    };
  }
}
