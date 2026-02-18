import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { ActiveSession, DeviceType } from '../entities/active-session.entity';
import { SecurityConfigService } from './security-config.service';
import * as crypto from 'crypto';
import * as UAParser from 'ua-parser-js';

@Injectable()
export class ActiveSessionService {
  private readonly logger = new Logger(ActiveSessionService.name);

  constructor(
    @InjectRepository(ActiveSession)
    private readonly activeSessionRepository: Repository<ActiveSession>,
    private readonly securityConfigService: SecurityConfigService,
  ) {}

  /**
   * Crear nueva sesion activa
   */
  async createSession(
    userId: string,
    refreshToken: string,
    ipAddress: string,
    userAgent: string | null,
  ): Promise<ActiveSession> {
    // Parsear user agent
    const parsed = this.parseUserAgent(userAgent);

    // Obtener duracion de sesion de config
    const sessionDays = await this.securityConfigService.getNumberValue(
      'session_max_age_days',
      7,
    );

    const session = this.activeSessionRepository.create({
      userId,
      refreshTokenHash: this.hashToken(refreshToken),
      ipAddress,
      userAgent,
      deviceType: parsed.deviceType,
      browser: parsed.browser,
      os: parsed.os,
      isActive: true,
      lastActivityAt: new Date(),
      expiresAt: new Date(Date.now() + sessionDays * 24 * 60 * 60 * 1000),
    });

    // Verificar limite de sesiones
    const maxSessions = await this.securityConfigService.getNumberValue(
      'max_sessions_per_user',
      5,
    );
    await this.enforceSessionLimit(userId, maxSessions);

    const saved = await this.activeSessionRepository.save(session);
    this.logger.log(`Nueva sesion creada para usuario ${userId}`);

    return saved;
  }

  /**
   * Actualizar ultima actividad de sesion
   */
  async updateActivity(refreshToken: string): Promise<void> {
    const hash = this.hashToken(refreshToken);
    await this.activeSessionRepository.update(
      { refreshTokenHash: hash, isActive: true },
      { lastActivityAt: new Date() },
    );
  }

  /**
   * Encontrar sesion por refresh token
   */
  async findByRefreshToken(
    refreshToken: string,
  ): Promise<ActiveSession | null> {
    const hash = this.hashToken(refreshToken);
    return this.activeSessionRepository.findOne({
      where: { refreshTokenHash: hash, isActive: true },
      relations: ['user'],
    });
  }

  /**
   * Revocar sesion por refresh token
   */
  async revokeSession(refreshToken: string): Promise<boolean> {
    const hash = this.hashToken(refreshToken);
    const result = await this.activeSessionRepository.update(
      { refreshTokenHash: hash },
      { isActive: false },
    );

    return (result.affected || 0) > 0;
  }

  /**
   * Revocar sesion por ID
   */
  async revokeSessionById(sessionId: string, userId: string): Promise<boolean> {
    const session = await this.activeSessionRepository.findOne({
      where: { id: sessionId, userId },
    });

    if (!session) return false;

    session.isActive = false;
    await this.activeSessionRepository.save(session);

    this.logger.log(`Sesion ${sessionId} revocada para usuario ${userId}`);
    return true;
  }

  /**
   * Revocar todas las sesiones de un usuario
   */
  async revokeAllUserSessions(userId: string): Promise<number> {
    const result = await this.activeSessionRepository.update(
      { userId, isActive: true },
      { isActive: false },
    );

    this.logger.log(`Todas las sesiones revocadas para usuario ${userId}`);
    return result.affected || 0;
  }

  /**
   * Obtener sesiones activas de un usuario
   */
  async getUserSessions(userId: string): Promise<ActiveSession[]> {
    return this.activeSessionRepository.find({
      where: { userId, isActive: true },
      order: { lastActivityAt: 'DESC' },
    });
  }

  /**
   * Aplicar limite de sesiones (eliminar las mas antiguas)
   */
  private async enforceSessionLimit(
    userId: string,
    maxSessions: number,
  ): Promise<void> {
    const sessions = await this.activeSessionRepository.find({
      where: { userId, isActive: true },
      order: { lastActivityAt: 'ASC' },
    });

    if (sessions.length >= maxSessions) {
      // Revocar sesiones mas antiguas
      const toRevoke = sessions.slice(0, sessions.length - maxSessions + 1);
      for (const session of toRevoke) {
        session.isActive = false;
        await this.activeSessionRepository.save(session);
      }

      this.logger.log(
        `${toRevoke.length} sesiones antiguas revocadas para usuario ${userId}`,
      );
    }
  }

  /**
   * Limpiar sesiones expiradas
   */
  async cleanExpiredSessions(): Promise<number> {
    const result = await this.activeSessionRepository.update(
      {
        isActive: true,
        expiresAt: LessThan(new Date()),
      },
      { isActive: false },
    );

    if (result.affected && result.affected > 0) {
      this.logger.log(`${result.affected} sesiones expiradas limpiadas`);
    }

    return result.affected || 0;
  }

  /**
   * Obtener estadisticas de sesiones
   */
  async getStats(): Promise<{
    totalActive: number;
    byDeviceType: Record<string, number>;
    byBrowser: Record<string, number>;
    byOs: Record<string, number>;
    avgSessionAge: number;
  }> {
    const sessions = await this.activeSessionRepository.find({
      where: { isActive: true },
    });

    const byDeviceType: Record<string, number> = {};
    const byBrowser: Record<string, number> = {};
    const byOs: Record<string, number> = {};
    let totalAge = 0;

    const now = Date.now();
    sessions.forEach((session) => {
      byDeviceType[session.deviceType] =
        (byDeviceType[session.deviceType] || 0) + 1;
      if (session.browser) {
        byBrowser[session.browser] = (byBrowser[session.browser] || 0) + 1;
      }
      if (session.os) {
        byOs[session.os] = (byOs[session.os] || 0) + 1;
      }
      totalAge += now - session.createdAt.getTime();
    });

    return {
      totalActive: sessions.length,
      byDeviceType,
      byBrowser,
      byOs,
      avgSessionAge:
        sessions.length > 0
          ? Math.round(totalAge / sessions.length / (1000 * 60 * 60)) // en horas
          : 0,
    };
  }

  /**
   * Hash del refresh token para almacenamiento seguro
   */
  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  /**
   * Parsear User Agent
   */
  private parseUserAgent(userAgent: string | null): {
    deviceType: DeviceType;
    browser: string | null;
    os: string | null;
  } {
    if (!userAgent) {
      return { deviceType: DeviceType.UNKNOWN, browser: null, os: null };
    }

    const parser = new UAParser.UAParser(userAgent);
    const result = parser.getResult();

    let deviceType = DeviceType.UNKNOWN;
    const device = result.device.type;

    if (device === 'mobile') {
      deviceType = DeviceType.MOBILE;
    } else if (device === 'tablet') {
      deviceType = DeviceType.TABLET;
    } else if (!device || device === 'desktop') {
      deviceType = DeviceType.DESKTOP;
    }

    return {
      deviceType,
      browser: result.browser.name || null,
      os: result.os.name || null,
    };
  }
}
