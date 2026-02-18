import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';
import {
  SecurityEvent,
  SecurityEventType,
  SecurityEventSeverity,
} from '../entities/security-event.entity';
import { SecurityEventFilterDto } from '../dto/security-event-filter.dto';
import { Request } from 'express';

export interface CreateSecurityEventDto {
  eventType: SecurityEventType;
  severity: SecurityEventSeverity;
  ipAddress: string;
  userAgent?: string | null;
  userId?: string | null;
  email?: string | null;
  endpoint: string;
  method: string;
  description: string;
  metadata?: Record<string, any> | null;
  country?: string | null;
  city?: string | null;
}

@Injectable()
export class SecurityEventService {
  private readonly logger = new Logger(SecurityEventService.name);

  constructor(
    @InjectRepository(SecurityEvent)
    private readonly securityEventRepository: Repository<SecurityEvent>,
  ) {}

  /**
   * Crear un nuevo evento de seguridad
   */
  async create(dto: CreateSecurityEventDto): Promise<SecurityEvent> {
    const event = this.securityEventRepository.create(dto);
    const saved = await this.securityEventRepository.save(event);

    // Log eventos criticos
    if (dto.severity === SecurityEventSeverity.CRITICAL) {
      this.logger.error(
        `🚨 CRITICAL SECURITY EVENT: ${dto.eventType} - ${dto.description} - IP: ${dto.ipAddress}`,
      );
    } else if (dto.severity === SecurityEventSeverity.HIGH) {
      this.logger.warn(
        `⚠️ HIGH SECURITY EVENT: ${dto.eventType} - ${dto.description} - IP: ${dto.ipAddress}`,
      );
    }

    return saved;
  }

  /**
   * Registrar evento de seguridad desde un request
   */
  async logFromRequest(
    request: Request,
    eventType: SecurityEventType,
    severity: SecurityEventSeverity,
    description: string,
    options?: {
      userId?: string;
      email?: string;
      metadata?: Record<string, any>;
    },
  ): Promise<SecurityEvent> {
    const ipAddress = this.getClientIp(request);
    const userAgent = request.headers['user-agent'] || null;

    return this.create({
      eventType,
      severity,
      ipAddress,
      userAgent,
      userId: options?.userId,
      email: options?.email,
      endpoint: request.originalUrl || request.url,
      method: request.method,
      description,
      metadata: options?.metadata,
    });
  }

  /**
   * Obtener eventos con filtros y paginacion
   */
  async findAll(filter: SecurityEventFilterDto): Promise<{
    data: SecurityEvent[];
    pagination: { total: number; page: number; limit: number; totalPages: number };
  }> {
    const queryBuilder =
      this.securityEventRepository.createQueryBuilder('event');

    // Filtros
    if (filter.eventType) {
      queryBuilder.andWhere('event.eventType = :eventType', {
        eventType: filter.eventType,
      });
    }

    if (filter.severity) {
      queryBuilder.andWhere('event.severity = :severity', {
        severity: filter.severity,
      });
    }

    if (filter.ipAddress) {
      queryBuilder.andWhere('event.ipAddress = :ipAddress', {
        ipAddress: filter.ipAddress,
      });
    }

    if (filter.reviewed !== undefined) {
      queryBuilder.andWhere('event.reviewed = :reviewed', {
        reviewed: filter.reviewed,
      });
    }

    if (filter.fromDate) {
      queryBuilder.andWhere('event.createdAt >= :fromDate', {
        fromDate: new Date(filter.fromDate),
      });
    }

    if (filter.toDate) {
      queryBuilder.andWhere('event.createdAt <= :toDate', {
        toDate: new Date(filter.toDate),
      });
    }

    // Ordenamiento
    queryBuilder.orderBy(
      `event.${filter.sortBy || 'createdAt'}`,
      filter.sortOrder || 'DESC',
    );

    // Paginacion
    const page = filter.page || 1;
    const limit = filter.limit || 20;
    queryBuilder.skip((page - 1) * limit).take(limit);

    // Relaciones
    queryBuilder.leftJoinAndSelect('event.user', 'user');

    const [data, total] = await queryBuilder.getManyAndCount();

    return {
      data,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  /**
   * Obtener evento por ID
   */
  async findById(id: string): Promise<SecurityEvent | null> {
    return this.securityEventRepository.findOne({
      where: { id },
      relations: ['user', 'reviewedBy'],
    });
  }

  /**
   * Marcar evento como revisado
   */
  async markAsReviewed(
    id: string,
    reviewedById: string,
    notes?: string,
  ): Promise<SecurityEvent | null> {
    const event = await this.findById(id);
    if (!event) return null;

    event.reviewed = true;
    event.reviewedById = reviewedById;
    event.reviewedAt = new Date();
    event.notes = notes || null;

    return this.securityEventRepository.save(event);
  }

  /**
   * Contar eventos por tipo en un periodo
   */
  async countByTypeInPeriod(
    eventType: SecurityEventType,
    fromDate: Date,
    toDate: Date,
  ): Promise<number> {
    return this.securityEventRepository.count({
      where: {
        eventType,
        createdAt: Between(fromDate, toDate),
      },
    });
  }

  /**
   * Contar eventos por IP en un periodo
   */
  async countByIpInPeriod(
    ipAddress: string,
    fromDate: Date,
    toDate: Date,
  ): Promise<number> {
    return this.securityEventRepository.count({
      where: {
        ipAddress,
        createdAt: Between(fromDate, toDate),
      },
    });
  }

  /**
   * Obtener estadisticas de eventos
   */
  async getStats(days: number = 7): Promise<{
    total: number;
    byType: Record<string, number>;
    bySeverity: Record<string, number>;
    unreviewed: number;
    topIps: { ip: string; count: number }[];
  }> {
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - days);

    const events = await this.securityEventRepository.find({
      where: {
        createdAt: MoreThanOrEqual(fromDate),
      },
    });

    const byType: Record<string, number> = {};
    const bySeverity: Record<string, number> = {};
    const ipCounts: Record<string, number> = {};
    let unreviewed = 0;

    events.forEach((event) => {
      byType[event.eventType] = (byType[event.eventType] || 0) + 1;
      bySeverity[event.severity] = (bySeverity[event.severity] || 0) + 1;
      ipCounts[event.ipAddress] = (ipCounts[event.ipAddress] || 0) + 1;
      if (!event.reviewed) unreviewed++;
    });

    // Top 10 IPs
    const topIps = Object.entries(ipCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([ip, count]) => ({ ip, count }));

    return {
      total: events.length,
      byType,
      bySeverity,
      unreviewed,
      topIps,
    };
  }

  /**
   * Obtener IP del cliente
   */
  private getClientIp(request: Request): string {
    const forwardedFor = request.headers['x-forwarded-for'];
    if (forwardedFor) {
      const ips = Array.isArray(forwardedFor)
        ? forwardedFor[0]
        : forwardedFor.split(',')[0];
      return ips.trim();
    }

    const realIp = request.headers['x-real-ip'];
    if (realIp) {
      return Array.isArray(realIp) ? realIp[0] : realIp;
    }

    return request.ip || request.socket.remoteAddress || 'unknown';
  }
}
