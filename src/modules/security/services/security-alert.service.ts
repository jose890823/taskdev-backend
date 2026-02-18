import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import {
  SecurityAlert,
  SecurityAlertType,
  SecurityAlertSeverity,
  SecurityAlertStatus,
} from '../entities/security-alert.entity';

interface CreateAlertDto {
  alertType: SecurityAlertType;
  severity: SecurityAlertSeverity;
  title: string;
  description: string;
  relatedUserId?: string;
  relatedIpAddress?: string;
  relatedEventIds?: string[];
  metadata?: Record<string, any>;
}

@Injectable()
export class SecurityAlertService {
  private readonly logger = new Logger(SecurityAlertService.name);

  constructor(
    @InjectRepository(SecurityAlert)
    private readonly securityAlertRepository: Repository<SecurityAlert>,
  ) {}

  /**
   * Crear nueva alerta de seguridad
   */
  async create(dto: CreateAlertDto): Promise<SecurityAlert> {
    const alert = this.securityAlertRepository.create({
      ...dto,
      status: SecurityAlertStatus.ACTIVE,
    });

    const saved = await this.securityAlertRepository.save(alert);

    // Log segun severidad
    if (dto.severity === SecurityAlertSeverity.CRITICAL) {
      this.logger.error(`🚨 ALERTA CRITICA: ${dto.title}`);
    } else if (dto.severity === SecurityAlertSeverity.HIGH) {
      this.logger.warn(`⚠️ ALERTA ALTA: ${dto.title}`);
    } else {
      this.logger.log(`📢 Nueva alerta: ${dto.title}`);
    }

    return saved;
  }

  /**
   * Obtener alertas activas
   */
  async findActive(): Promise<SecurityAlert[]> {
    return this.securityAlertRepository.find({
      where: {
        status: In([
          SecurityAlertStatus.ACTIVE,
          SecurityAlertStatus.INVESTIGATING,
        ]),
      },
      relations: ['relatedUser', 'assignedTo'],
      order: {
        severity: 'ASC', // CRITICAL primero
        createdAt: 'DESC',
      },
    });
  }

  /**
   * Obtener alerta por ID
   */
  async findById(id: string): Promise<SecurityAlert | null> {
    return this.securityAlertRepository.findOne({
      where: { id },
      relations: ['relatedUser', 'assignedTo', 'resolvedBy'],
    });
  }

  /**
   * Obtener todas las alertas con filtros
   */
  async findAll(options?: {
    status?: SecurityAlertStatus;
    severity?: SecurityAlertSeverity;
    alertType?: SecurityAlertType;
    limit?: number;
    offset?: number;
  }): Promise<{ data: SecurityAlert[]; pagination: { total: number } }> {
    const queryBuilder =
      this.securityAlertRepository.createQueryBuilder('alert');

    if (options?.status) {
      queryBuilder.andWhere('alert.status = :status', {
        status: options.status,
      });
    }

    if (options?.severity) {
      queryBuilder.andWhere('alert.severity = :severity', {
        severity: options.severity,
      });
    }

    if (options?.alertType) {
      queryBuilder.andWhere('alert.alertType = :alertType', {
        alertType: options.alertType,
      });
    }

    queryBuilder
      .leftJoinAndSelect('alert.relatedUser', 'relatedUser')
      .leftJoinAndSelect('alert.assignedTo', 'assignedTo')
      .orderBy('alert.createdAt', 'DESC');

    if (options?.limit) {
      queryBuilder.take(options.limit);
    }
    if (options?.offset) {
      queryBuilder.skip(options.offset);
    }

    const [data, total] = await queryBuilder.getManyAndCount();
    return { data, pagination: { total } };
  }

  /**
   * Actualizar estado de alerta
   */
  async updateStatus(
    id: string,
    status: SecurityAlertStatus,
    updatedById: string,
    resolution?: string,
  ): Promise<SecurityAlert | null> {
    const alert = await this.findById(id);
    if (!alert) return null;

    alert.status = status;

    if (
      status === SecurityAlertStatus.RESOLVED ||
      status === SecurityAlertStatus.DISMISSED
    ) {
      alert.resolvedAt = new Date();
      alert.resolvedById = updatedById;
      alert.resolution = resolution || null;
    }

    const saved = await this.securityAlertRepository.save(alert);
    this.logger.log(`Alerta ${id} actualizada a estado: ${status}`);

    return saved;
  }

  /**
   * Asignar alerta a un admin
   */
  async assign(
    id: string,
    assignedToId: string,
  ): Promise<SecurityAlert | null> {
    const alert = await this.findById(id);
    if (!alert) return null;

    alert.assignedToId = assignedToId;
    alert.status = SecurityAlertStatus.INVESTIGATING;

    const saved = await this.securityAlertRepository.save(alert);
    this.logger.log(`Alerta ${id} asignada a admin ${assignedToId}`);

    return saved;
  }

  /**
   * Contar alertas activas por severidad
   */
  async countActiveBySeverity(): Promise<
    Record<SecurityAlertSeverity, number>
  > {
    const alerts = await this.securityAlertRepository.find({
      where: {
        status: In([
          SecurityAlertStatus.ACTIVE,
          SecurityAlertStatus.INVESTIGATING,
        ]),
      },
    });

    const counts: Record<SecurityAlertSeverity, number> = {
      [SecurityAlertSeverity.LOW]: 0,
      [SecurityAlertSeverity.MEDIUM]: 0,
      [SecurityAlertSeverity.HIGH]: 0,
      [SecurityAlertSeverity.CRITICAL]: 0,
    };

    alerts.forEach((alert) => {
      counts[alert.severity]++;
    });

    return counts;
  }

  /**
   * Obtener estadisticas de alertas
   */
  async getStats(days: number = 30): Promise<{
    total: number;
    active: number;
    resolved: number;
    dismissed: number;
    byType: Record<string, number>;
    bySeverity: Record<string, number>;
    avgResolutionTimeHours: number;
  }> {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const alerts = await this.securityAlertRepository
      .createQueryBuilder('alert')
      .where('alert.createdAt >= :since', { since })
      .getMany();

    const byType: Record<string, number> = {};
    const bySeverity: Record<string, number> = {};
    let totalResolutionTime = 0;
    let resolvedCount = 0;

    alerts.forEach((alert) => {
      byType[alert.alertType] = (byType[alert.alertType] || 0) + 1;
      bySeverity[alert.severity] = (bySeverity[alert.severity] || 0) + 1;

      if (alert.resolvedAt) {
        totalResolutionTime +=
          alert.resolvedAt.getTime() - alert.createdAt.getTime();
        resolvedCount++;
      }
    });

    return {
      total: alerts.length,
      active: alerts.filter(
        (a) =>
          a.status === SecurityAlertStatus.ACTIVE ||
          a.status === SecurityAlertStatus.INVESTIGATING,
      ).length,
      resolved: alerts.filter((a) => a.status === SecurityAlertStatus.RESOLVED)
        .length,
      dismissed: alerts.filter(
        (a) => a.status === SecurityAlertStatus.DISMISSED,
      ).length,
      byType,
      bySeverity,
      avgResolutionTimeHours:
        resolvedCount > 0
          ? Math.round(totalResolutionTime / resolvedCount / (1000 * 60 * 60))
          : 0,
    };
  }

  /**
   * Verificar y crear alertas automaticas basadas en patrones
   */
  async checkAndCreateAlerts(
    ipAddress: string,
    failedLoginCount: number,
    rateLimitExceededCount: number,
  ): Promise<void> {
    // Alerta por multiples logins fallidos
    if (failedLoginCount >= 5 && failedLoginCount < 10) {
      await this.create({
        alertType: SecurityAlertType.MULTIPLE_FAILED_LOGINS,
        severity: SecurityAlertSeverity.MEDIUM,
        title: `Multiples intentos de login fallidos desde ${ipAddress}`,
        description: `Se detectaron ${failedLoginCount} intentos de login fallidos desde la IP ${ipAddress} en los ultimos 15 minutos.`,
        relatedIpAddress: ipAddress,
        metadata: { failedLoginCount },
      });
    } else if (failedLoginCount >= 10) {
      await this.create({
        alertType: SecurityAlertType.BRUTE_FORCE_ATTACK,
        severity: SecurityAlertSeverity.HIGH,
        title: `Posible ataque de fuerza bruta desde ${ipAddress}`,
        description: `Se detectaron ${failedLoginCount} intentos de login fallidos desde la IP ${ipAddress}. Posible ataque de fuerza bruta.`,
        relatedIpAddress: ipAddress,
        metadata: { failedLoginCount },
      });
    }

    // Alerta por rate limiting excedido
    if (rateLimitExceededCount >= 10) {
      await this.create({
        alertType: SecurityAlertType.API_ABUSE,
        severity: SecurityAlertSeverity.MEDIUM,
        title: `Rate limit excedido multiples veces desde ${ipAddress}`,
        description: `La IP ${ipAddress} ha excedido el rate limit ${rateLimitExceededCount} veces.`,
        relatedIpAddress: ipAddress,
        metadata: { rateLimitExceededCount },
      });
    }
  }
}
