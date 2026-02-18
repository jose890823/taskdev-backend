import {
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { Queue } from 'bull';
import {
  JobExecution,
  JobExecutionStatus,
  JobName,
} from './entities/job-execution.entity';
import { JobFilterDto } from './dto/job-filter.dto';

/**
 * Servicio central para gestion de jobs en background
 * Registra jobs programados, permite disparos manuales
 * y proporciona historial de ejecuciones
 */
@Injectable()
export class JobsService implements OnModuleInit {
  private readonly logger = new Logger(JobsService.name);

  constructor(
    @InjectQueue('michambita-jobs')
    private readonly queue: Queue,
    @InjectRepository(JobExecution)
    private readonly jobExecutionRepository: Repository<JobExecution>,
  ) {}

  /**
   * Al iniciar el modulo, registrar todos los jobs programados con cron
   */
  async onModuleInit(): Promise<void> {
    try {
      // Limpiar jobs repetibles existentes para evitar duplicados
      const repeatableJobs = await this.queue.getRepeatableJobs();
      for (const job of repeatableJobs) {
        await this.queue.removeRepeatableByKey(job.key);
      }

      // Los jobs programados se registraran segun las necesidades del proyecto

      this.logger.log('JobsModule inicializado exitosamente');
    } catch (error) {
      this.logger.error(
        `Error al inicializar JobsModule: ${error.message}`,
      );
      this.logger.warn(
        'Los jobs no se pudieron registrar. Verifique la conexion a Redis.',
      );
    }
  }

  /**
   * Disparar un job manualmente desde el panel de administracion
   */
  async triggerJob(
    jobName: JobName,
    triggeredBy?: string,
    input?: Record<string, any>,
  ): Promise<JobExecution> {
    // Crear registro de ejecucion
    const execution = this.jobExecutionRepository.create({
      jobName: jobName as unknown as string,
      queueName: 'michambita-jobs',
      status: JobExecutionStatus.PENDING,
      input: input ?? null,
      triggeredBy: triggeredBy ?? null,
    });

    const savedExecution = await this.jobExecutionRepository.save(execution);

    // Agregar job a la cola con referencia a la ejecucion
    await this.queue.add(jobName as unknown as string, {
      ...input,
      _executionId: savedExecution.id,
      _triggeredBy: triggeredBy,
    });

    this.logger.log(
      `Job '${jobName}' disparado manualmente por usuario ${triggeredBy || 'sistema'}`,
    );

    return savedExecution;
  }

  /**
   * Obtener historial de ejecuciones con filtros y paginacion
   */
  async getExecutions(filters: JobFilterDto): Promise<{
    data: JobExecution[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> {
    const {
      jobName,
      status,
      queueName,
      fromDate,
      toDate,
      page = 1,
      limit = 20,
      sortBy = 'startedAt',
      sortOrder = 'DESC',
    } = filters;

    const queryBuilder = this.jobExecutionRepository
      .createQueryBuilder('execution')
      .orderBy(`execution.${sortBy}`, sortOrder)
      .skip((page - 1) * limit)
      .take(limit);

    if (jobName) {
      queryBuilder.andWhere('execution.jobName = :jobName', { jobName });
    }

    if (status) {
      queryBuilder.andWhere('execution.status = :status', { status });
    }

    if (queueName) {
      queryBuilder.andWhere('execution.queueName = :queueName', { queueName });
    }

    if (fromDate) {
      queryBuilder.andWhere('execution.startedAt >= :fromDate', { fromDate });
    }

    if (toDate) {
      queryBuilder.andWhere('execution.startedAt <= :toDate', { toDate });
    }

    const [data, total] = await queryBuilder.getManyAndCount();

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Obtener el ultimo estado de ejecucion de cada job
   */
  async getJobStatuses(): Promise<Record<string, JobExecution | null>> {
    const jobNames = Object.values(JobName);
    const statuses: Record<string, JobExecution | null> = {};

    for (const name of jobNames) {
      const latest = await this.jobExecutionRepository.findOne({
        where: { jobName: name },
        order: { startedAt: 'DESC' },
      });
      statuses[name] = latest || null;
    }

    return statuses;
  }

  /**
   * Obtener detalle de una ejecucion por ID
   */
  async getExecution(id: string): Promise<JobExecution> {
    const execution = await this.jobExecutionRepository.findOne({
      where: { id },
    });

    if (!execution) {
      throw new NotFoundException(
        `Ejecucion de job con ID ${id} no encontrada`,
      );
    }

    return execution;
  }

  /**
   * Eliminar ejecuciones antiguas (mayores a 30 dias)
   */
  async cleanOldExecutions(): Promise<number> {
    const result = await this.jobExecutionRepository
      .createQueryBuilder()
      .delete()
      .from(JobExecution)
      .where("startedAt < NOW() - INTERVAL '30 days'")
      .execute();

    const deleted = result.affected || 0;

    this.logger.log(
      `Limpieza de ejecuciones antiguas: ${deleted} registros eliminados`,
    );

    return deleted;
  }
}
