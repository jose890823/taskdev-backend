import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { BlockedIP, BlockedByType } from '../entities/blocked-ip.entity';
import { SecurityEventService } from './security-event.service';
import {
  SecurityEventType,
  SecurityEventSeverity,
} from '../entities/security-event.entity';

@Injectable()
export class BlockedIpService {
  private readonly logger = new Logger(BlockedIpService.name);
  private blockedIpsCache: Set<string> = new Set();
  private lastCacheUpdate: Date | null = null;
  private readonly CACHE_TTL_MS = 60000; // 1 minuto

  constructor(
    @InjectRepository(BlockedIP)
    private readonly blockedIpRepository: Repository<BlockedIP>,
    private readonly securityEventService: SecurityEventService,
  ) {
    // Cargar cache inicial
    this.refreshCache();
  }

  /**
   * Refrescar cache de IPs bloqueadas
   */
  private async refreshCache(): Promise<void> {
    try {
      const blockedIps = await this.blockedIpRepository.find({
        where: { isActive: true },
      });

      this.blockedIpsCache.clear();

      const now = new Date();
      blockedIps.forEach((blocked) => {
        // Solo agregar si no ha expirado
        if (
          blocked.permanent ||
          !blocked.expiresAt ||
          blocked.expiresAt > now
        ) {
          this.blockedIpsCache.add(blocked.ipAddress);
        }
      });

      this.lastCacheUpdate = now;
      this.logger.debug(
        `Cache de IPs bloqueadas actualizado: ${this.blockedIpsCache.size} IPs`,
      );
    } catch (error) {
      this.logger.error('Error actualizando cache de IPs bloqueadas', error);
    }
  }

  /**
   * Verificar si una IP esta bloqueada (usa cache)
   */
  async isBlocked(ipAddress: string): Promise<boolean> {
    // Refrescar cache si es necesario
    if (
      !this.lastCacheUpdate ||
      Date.now() - this.lastCacheUpdate.getTime() > this.CACHE_TTL_MS
    ) {
      await this.refreshCache();
    }

    // Verificar en cache primero
    if (this.blockedIpsCache.has(ipAddress)) {
      // Verificar en BD para asegurar que no ha expirado
      const blocked = await this.blockedIpRepository.findOne({
        where: { ipAddress, isActive: true },
      });

      if (blocked && !blocked.isExpired()) {
        // Incrementar contador de intentos
        blocked.attemptsSinceBlock += 1;
        await this.blockedIpRepository.save(blocked);
        return true;
      } else if (blocked && blocked.isExpired()) {
        // Desactivar bloqueo expirado
        blocked.isActive = false;
        await this.blockedIpRepository.save(blocked);
        this.blockedIpsCache.delete(ipAddress);
      }
    }

    return false;
  }

  /**
   * Bloquear una IP manualmente (admin)
   */
  async blockIp(
    ipAddress: string,
    reason: string,
    adminUserId: string,
    options?: {
      permanent?: boolean;
      durationMinutes?: number;
    },
  ): Promise<BlockedIP> {
    // Verificar si ya esta bloqueada
    const existing = await this.blockedIpRepository.findOne({
      where: { ipAddress },
    });

    if (existing && existing.isActive && !existing.isExpired()) {
      // Actualizar bloqueo existente
      existing.reason = reason;
      existing.blockedBy = BlockedByType.ADMIN;
      existing.blockedByUserId = adminUserId;
      existing.permanent = options?.permanent || false;
      existing.expiresAt = options?.permanent
        ? null
        : options?.durationMinutes
          ? new Date(Date.now() + options.durationMinutes * 60 * 1000)
          : new Date(Date.now() + 30 * 60 * 1000); // 30 min default

      const updated = await this.blockedIpRepository.save(existing);
      this.blockedIpsCache.add(ipAddress);

      this.logger.warn(`IP ${ipAddress} bloqueada actualizada por admin`);
      return updated;
    }

    // Crear nuevo bloqueo
    const blocked = this.blockedIpRepository.create({
      ipAddress,
      reason,
      blockedBy: BlockedByType.ADMIN,
      blockedByUserId: adminUserId,
      permanent: options?.permanent || false,
      expiresAt: options?.permanent
        ? null
        : options?.durationMinutes
          ? new Date(Date.now() + options.durationMinutes * 60 * 1000)
          : new Date(Date.now() + 30 * 60 * 1000),
      isActive: true,
    });

    const saved = await this.blockedIpRepository.save(blocked);
    this.blockedIpsCache.add(ipAddress);

    // Registrar evento de seguridad
    await this.securityEventService.create({
      eventType: SecurityEventType.IP_BLOCKED,
      severity: SecurityEventSeverity.MEDIUM,
      ipAddress,
      endpoint: '/admin/security/blocked-ips',
      method: 'POST',
      description: `IP bloqueada manualmente: ${reason}`,
      userId: adminUserId,
      metadata: {
        permanent: options?.permanent,
        durationMinutes: options?.durationMinutes,
      },
    });

    this.logger.warn(`IP ${ipAddress} bloqueada por admin: ${reason}`);
    return saved;
  }

  /**
   * Bloquear IP automaticamente por el sistema
   */
  async autoBlockIp(
    ipAddress: string,
    reason: string,
    durationMinutes: number = 30,
  ): Promise<BlockedIP> {
    const existing = await this.blockedIpRepository.findOne({
      where: { ipAddress },
    });

    if (existing && existing.isActive && !existing.isExpired()) {
      // Si ya esta bloqueada, extender el bloqueo
      existing.expiresAt = new Date(Date.now() + durationMinutes * 60 * 1000);
      existing.reason = `${existing.reason} | ${reason}`;
      return this.blockedIpRepository.save(existing);
    }

    const blocked = this.blockedIpRepository.create({
      ipAddress,
      reason,
      blockedBy: BlockedByType.SYSTEM,
      permanent: false,
      expiresAt: new Date(Date.now() + durationMinutes * 60 * 1000),
      isActive: true,
    });

    const saved = await this.blockedIpRepository.save(blocked);
    this.blockedIpsCache.add(ipAddress);

    // Registrar evento
    await this.securityEventService.create({
      eventType: SecurityEventType.IP_BLOCKED,
      severity: SecurityEventSeverity.HIGH,
      ipAddress,
      endpoint: 'system',
      method: 'AUTO',
      description: `IP bloqueada automaticamente: ${reason}`,
      metadata: { durationMinutes, autoBlocked: true },
    });

    this.logger.warn(`IP ${ipAddress} bloqueada automaticamente: ${reason}`);
    return saved;
  }

  /**
   * Desbloquear una IP
   */
  async unblockIp(ipAddress: string, adminUserId?: string): Promise<boolean> {
    const blocked = await this.blockedIpRepository.findOne({
      where: { ipAddress },
    });

    if (!blocked) return false;

    blocked.isActive = false;
    await this.blockedIpRepository.save(blocked);
    this.blockedIpsCache.delete(ipAddress);

    // Registrar evento
    await this.securityEventService.create({
      eventType: SecurityEventType.IP_UNBLOCKED,
      severity: SecurityEventSeverity.LOW,
      ipAddress,
      endpoint: '/admin/security/blocked-ips',
      method: 'DELETE',
      description: 'IP desbloqueada',
      userId: adminUserId,
    });

    this.logger.log(`IP ${ipAddress} desbloqueada`);
    return true;
  }

  /**
   * Listar todas las IPs bloqueadas activas
   */
  async findAllActive(): Promise<BlockedIP[]> {
    return this.blockedIpRepository.find({
      where: { isActive: true },
      relations: ['blockedByUser'],
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Limpiar bloqueos expirados
   */
  async cleanExpiredBlocks(): Promise<number> {
    const result = await this.blockedIpRepository.update(
      {
        isActive: true,
        permanent: false,
        expiresAt: LessThan(new Date()),
      },
      { isActive: false },
    );

    if (result.affected && result.affected > 0) {
      await this.refreshCache();
      this.logger.log(`${result.affected} bloqueos expirados limpiados`);
    }

    return result.affected || 0;
  }

  /**
   * Obtener estadisticas de IPs bloqueadas
   */
  async getStats(): Promise<{
    totalActive: number;
    totalPermanent: number;
    totalAutoBlocked: number;
    totalManualBlocked: number;
    recentBlocks: BlockedIP[];
  }> {
    const active = await this.blockedIpRepository.find({
      where: { isActive: true },
      relations: ['blockedByUser'],
      order: { createdAt: 'DESC' },
    });

    const permanent = active.filter((b) => b.permanent);
    const autoBlocked = active.filter(
      (b) => b.blockedBy === BlockedByType.SYSTEM,
    );
    const manualBlocked = active.filter(
      (b) => b.blockedBy === BlockedByType.ADMIN,
    );

    return {
      totalActive: active.length,
      totalPermanent: permanent.length,
      totalAutoBlocked: autoBlocked.length,
      totalManualBlocked: manualBlocked.length,
      recentBlocks: active.slice(0, 10),
    };
  }
}
