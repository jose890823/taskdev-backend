import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual } from 'typeorm';
import {
  WebhookEvent,
  WebhookSource,
  WebhookEventStatus,
} from './entities/webhook-event.entity';
import { WebhookFilterDto } from './dto/webhook-filter.dto';

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(
    @InjectRepository(WebhookEvent)
    private readonly webhookEventRepository: Repository<WebhookEvent>,
  ) {}

  /**
   * Registrar un evento de webhook entrante.
   * Retorna null si es duplicado (ya procesado).
   * Retorna el evento existente si fallo previamente (permite reintento).
   */
  async registerEvent(
    source: WebhookSource,
    externalEventId: string,
    eventType: string,
    payload: Record<string, any>,
    headers?: Record<string, string>,
    ipAddress?: string,
  ): Promise<WebhookEvent | null> {
    // Verificar si ya existe
    const existing = await this.webhookEventRepository.findOne({
      where: { source, externalEventId },
    });

    if (existing) {
      if (existing.status === WebhookEventStatus.PROCESSED) {
        this.logger.warn(
          `Webhook duplicado ignorado: ${source}/${externalEventId} (ya procesado)`,
        );
        return null;
      }

      if (existing.status === WebhookEventStatus.SKIPPED) {
        this.logger.warn(
          `Webhook duplicado ignorado: ${source}/${externalEventId} (ya marcado como omitido)`,
        );
        return null;
      }

      // Si fallo o esta en otro estado, permitir reintento
      this.logger.log(
        `Webhook existente encontrado para reintento: ${source}/${externalEventId} (estado: ${existing.status})`,
      );
      return existing;
    }

    // Crear nuevo registro de evento
    try {
      const event = this.webhookEventRepository.create({
        source,
        externalEventId,
        eventType,
        payload,
        headers: headers || null,
        ipAddress: ipAddress || null,
        status: WebhookEventStatus.RECEIVED,
      });

      return await this.webhookEventRepository.save(event);
    } catch (error) {
      // Manejar violacion de constraint unico (duplicado concurrente)
      if (error.code === '23505') {
        this.logger.warn(
          `Webhook duplicado concurrente detectado: ${source}/${externalEventId}`,
        );

        // Intentar obtener el existente
        const concurrent = await this.webhookEventRepository.findOne({
          where: { source, externalEventId },
        });

        if (concurrent && concurrent.status === WebhookEventStatus.PROCESSED) {
          return null;
        }

        return concurrent;
      }

      throw error;
    }
  }

  /**
   * Marcar evento como procesando
   */
  async markProcessing(id: string): Promise<void> {
    const event = await this.findEventOrFail(id);

    event.status = WebhookEventStatus.PROCESSING;
    event.attempts += 1;

    await this.webhookEventRepository.save(event);

    this.logger.log(
      `Webhook ${event.systemCode} marcado como procesando (intento ${event.attempts})`,
    );
  }

  /**
   * Marcar evento como procesado exitosamente
   */
  async markProcessed(
    id: string,
    result?: Record<string, any>,
    processingTimeMs?: number,
  ): Promise<void> {
    const event = await this.findEventOrFail(id);

    event.status = WebhookEventStatus.PROCESSED;
    event.result = result || null;
    event.processedAt = new Date();
    event.processingTimeMs = processingTimeMs || null;
    event.errorMessage = null;
    event.errorStack = null;
    event.nextRetryAt = null;

    await this.webhookEventRepository.save(event);

    this.logger.log(
      `Webhook ${event.systemCode} procesado exitosamente` +
        (processingTimeMs ? ` (${processingTimeMs}ms)` : ''),
    );
  }

  /**
   * Marcar evento como fallido.
   * Calcula nextRetryAt con backoff exponencial: 2^attempts * 30 segundos.
   * Si attempts >= maxAttempts, no programa reintento (dead letter).
   */
  async markFailed(
    id: string,
    error: Error,
    processingTimeMs?: number,
  ): Promise<void> {
    const event = await this.findEventOrFail(id);

    event.status = WebhookEventStatus.FAILED;
    event.errorMessage = error.message;
    event.errorStack = error.stack || null;
    event.processingTimeMs = processingTimeMs || null;

    // Calcular proximo reintento con backoff exponencial
    if (event.attempts < event.maxAttempts) {
      const delayMs = Math.pow(2, event.attempts) * 30 * 1000; // 2^attempts * 30s
      const nextRetry = new Date();
      nextRetry.setTime(nextRetry.getTime() + delayMs);
      event.nextRetryAt = nextRetry;

      this.logger.warn(
        `Webhook ${event.systemCode} fallo (intento ${event.attempts}/${event.maxAttempts}). ` +
          `Proximo reintento en ${delayMs / 1000}s: ${error.message}`,
      );
    } else {
      event.nextRetryAt = null;

      this.logger.error(
        `Webhook ${event.systemCode} fallo definitivamente (${event.attempts}/${event.maxAttempts}): ${error.message}`,
      );
    }

    await this.webhookEventRepository.save(event);
  }

  /**
   * Obtener eventos pendientes de reintento.
   * Eventos con status 'failed', intentos < maxAttempts y nextRetryAt <= ahora.
   */
  async getRetryableEvents(): Promise<WebhookEvent[]> {
    return this.webhookEventRepository.find({
      where: {
        status: WebhookEventStatus.FAILED,
        nextRetryAt: LessThanOrEqual(new Date()),
      },
      order: { nextRetryAt: 'ASC' },
    });
  }

  /**
   * Reintentar un evento manualmente (admin).
   * Resetea el estado a 'received' y limpia nextRetryAt.
   */
  async retryEvent(id: string, maxAttempts?: number): Promise<WebhookEvent> {
    const event = await this.findEventOrFail(id);

    if (
      event.status !== WebhookEventStatus.FAILED &&
      event.status !== WebhookEventStatus.RECEIVED
    ) {
      throw new BadRequestException(
        `No se puede reintentar un evento con estado '${event.status}'. Solo se pueden reintentar eventos fallidos o recibidos.`,
      );
    }

    event.status = WebhookEventStatus.RECEIVED;
    event.nextRetryAt = null;
    event.errorMessage = null;
    event.errorStack = null;

    if (maxAttempts !== undefined) {
      event.maxAttempts = maxAttempts;
    }

    const saved = await this.webhookEventRepository.save(event);

    this.logger.log(
      `Webhook ${event.systemCode} marcado para reintento manual por administrador`,
    );

    return saved;
  }

  /**
   * Listar eventos con filtros y paginacion
   */
  async getEvents(filters: WebhookFilterDto): Promise<{
    data: WebhookEvent[];
    pagination: {
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    };
  }> {
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const skip = (page - 1) * limit;

    const queryBuilder = this.webhookEventRepository
      .createQueryBuilder('webhook')
      .orderBy('webhook.createdAt', 'DESC');

    if (filters.source) {
      queryBuilder.andWhere('webhook.source = :source', {
        source: filters.source,
      });
    }

    if (filters.status) {
      queryBuilder.andWhere('webhook.status = :status', {
        status: filters.status,
      });
    }

    if (filters.eventType) {
      queryBuilder.andWhere('webhook.eventType = :eventType', {
        eventType: filters.eventType,
      });
    }

    if (filters.externalEventId) {
      queryBuilder.andWhere('webhook.externalEventId = :externalEventId', {
        externalEventId: filters.externalEventId,
      });
    }

    if (filters.dateFrom) {
      queryBuilder.andWhere('webhook.createdAt >= :dateFrom', {
        dateFrom: filters.dateFrom,
      });
    }

    if (filters.dateTo) {
      queryBuilder.andWhere('webhook.createdAt <= :dateTo', {
        dateTo: filters.dateTo,
      });
    }

    const [data, total] = await queryBuilder
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    return {
      data,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Obtener un evento por ID
   */
  async getEventById(id: string): Promise<WebhookEvent> {
    return this.findEventOrFail(id);
  }

  /**
   * Estadisticas de webhooks
   */
  async getStats(): Promise<{
    total: number;
    processed: number;
    failed: number;
    skipped: number;
    pendingRetry: number;
    avgProcessingTimeMs: number;
    bySource: Record<string, number>;
    byEventType: Record<string, number>;
    last24h: { received: number; processed: number; failed: number };
  }> {
    // Conteos por estado
    const statusCounts = await this.webhookEventRepository
      .createQueryBuilder('webhook')
      .select('webhook.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .groupBy('webhook.status')
      .getRawMany();

    const statusMap: Record<string, number> = {};
    for (const row of statusCounts) {
      statusMap[row.status] = parseInt(row.count, 10);
    }

    const total = Object.values(statusMap).reduce((sum, val) => sum + val, 0);
    const processed = statusMap[WebhookEventStatus.PROCESSED] || 0;
    const failed = statusMap[WebhookEventStatus.FAILED] || 0;
    const skipped = statusMap[WebhookEventStatus.SKIPPED] || 0;

    // Eventos pendientes de reintento
    const pendingRetry = await this.webhookEventRepository.count({
      where: {
        status: WebhookEventStatus.FAILED,
        nextRetryAt: LessThanOrEqual(new Date()),
      },
    });

    // Tiempo promedio de procesamiento
    const avgResult = await this.webhookEventRepository
      .createQueryBuilder('webhook')
      .select('AVG(webhook.processingTimeMs)', 'avg')
      .where('webhook.processingTimeMs IS NOT NULL')
      .getRawOne();

    const avgProcessingTimeMs = avgResult?.avg
      ? parseFloat(parseFloat(avgResult.avg).toFixed(2))
      : 0;

    // Desglose por origen
    const sourceCounts = await this.webhookEventRepository
      .createQueryBuilder('webhook')
      .select('webhook.source', 'source')
      .addSelect('COUNT(*)', 'count')
      .groupBy('webhook.source')
      .getRawMany();

    const bySource: Record<string, number> = {};
    for (const row of sourceCounts) {
      bySource[row.source] = parseInt(row.count, 10);
    }

    // Desglose por tipo de evento (top 20)
    const typeCounts = await this.webhookEventRepository
      .createQueryBuilder('webhook')
      .select('webhook.eventType', 'eventType')
      .addSelect('COUNT(*)', 'count')
      .groupBy('webhook.eventType')
      .orderBy('count', 'DESC')
      .limit(20)
      .getRawMany();

    const byEventType: Record<string, number> = {};
    for (const row of typeCounts) {
      byEventType[row.eventType] = parseInt(row.count, 10);
    }

    // Ultimas 24 horas
    const twentyFourHoursAgo = new Date();
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

    const last24hCounts = await this.webhookEventRepository
      .createQueryBuilder('webhook')
      .select('webhook.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .where('webhook.createdAt >= :since', { since: twentyFourHoursAgo })
      .groupBy('webhook.status')
      .getRawMany();

    const last24hMap: Record<string, number> = {};
    for (const row of last24hCounts) {
      last24hMap[row.status] = parseInt(row.count, 10);
    }

    const last24hTotal = Object.values(last24hMap).reduce(
      (sum, val) => sum + val,
      0,
    );

    return {
      total,
      processed,
      failed,
      skipped,
      pendingRetry,
      avgProcessingTimeMs,
      bySource,
      byEventType,
      last24h: {
        received: last24hTotal,
        processed: last24hMap[WebhookEventStatus.PROCESSED] || 0,
        failed: last24hMap[WebhookEventStatus.FAILED] || 0,
      },
    };
  }

  /**
   * Limpiar eventos antiguos (por defecto mas de 90 dias).
   * Retorna la cantidad de registros eliminados.
   */
  async cleanOldEvents(daysToKeep: number = 90): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const result = await this.webhookEventRepository
      .createQueryBuilder()
      .delete()
      .from(WebhookEvent)
      .where('createdAt < :cutoffDate', { cutoffDate })
      .andWhere('status IN (:...statuses)', {
        statuses: [WebhookEventStatus.PROCESSED, WebhookEventStatus.SKIPPED],
      })
      .execute();

    const deletedCount = result.affected || 0;

    this.logger.log(
      `Limpieza de webhooks: ${deletedCount} eventos eliminados (anteriores a ${daysToKeep} dias)`,
    );

    return deletedCount;
  }

  /**
   * Buscar evento por ID o lanzar NotFoundException
   */
  private async findEventOrFail(id: string): Promise<WebhookEvent> {
    const event = await this.webhookEventRepository.findOne({
      where: { id },
    });

    if (!event) {
      throw new NotFoundException(
        `Evento de webhook con ID '${id}' no encontrado`,
      );
    }

    return event;
  }
}
