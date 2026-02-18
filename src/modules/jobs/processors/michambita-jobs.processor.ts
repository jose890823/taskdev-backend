import { Processor, Process } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import type { Job } from 'bull';
import { DataSource } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  JobExecution,
  JobExecutionStatus,
} from '../entities/job-execution.entity';

/**
 * Procesador central de jobs de MiChambita
 * Ejecuta todas las tareas programadas y manuales
 */
@Processor('michambita-jobs')
export class MichambitaJobsProcessor {
  private readonly logger = new Logger(MichambitaJobsProcessor.name);

  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(JobExecution)
    private readonly jobExecutionRepository: Repository<JobExecution>,
  ) {}

  // ============================================
  // HELPERS - Registro de ejecuciones
  // ============================================

  /**
   * Crea un registro de ejecucion al inicio del job
   */
  private async createExecution(
    jobName: string,
    input: any,
    attemptNumber: number,
  ): Promise<JobExecution> {
    try {
      const execution = this.jobExecutionRepository.create({
        jobName,
        queueName: 'michambita-jobs',
        status: JobExecutionStatus.PROCESSING,
        input: input && Object.keys(input).length > 0 ? input : null,
        attemptNumber,
      });
      return await this.jobExecutionRepository.save(execution);
    } catch (error) {
      this.logger.warn(
        `No se pudo crear registro de ejecucion para ${jobName}: ${error.message}`,
      );
      return new JobExecution({
        jobName,
        queueName: 'michambita-jobs',
        status: JobExecutionStatus.PROCESSING,
      });
    }
  }

  /**
   * Marca una ejecucion como completada con resultado
   */
  private async completeExecution(
    execution: JobExecution,
    result: any,
    startTime: number,
  ): Promise<void> {
    try {
      execution.status = JobExecutionStatus.COMPLETED;
      execution.result = result;
      execution.durationMs = Date.now() - startTime;
      execution.completedAt = new Date();

      if (execution.id) {
        await this.jobExecutionRepository.save(execution);
      }
    } catch (error) {
      this.logger.warn(
        `No se pudo actualizar registro de ejecucion: ${error.message}`,
      );
    }
  }

  /**
   * Marca una ejecucion como fallida con error
   */
  private async failExecution(
    execution: JobExecution,
    error: any,
    startTime: number,
  ): Promise<void> {
    try {
      execution.status = JobExecutionStatus.FAILED;
      execution.errorMessage = error.message || 'Error desconocido';
      execution.errorStack = error.stack || null;
      execution.durationMs = Date.now() - startTime;
      execution.completedAt = new Date();

      if (execution.id) {
        await this.jobExecutionRepository.save(execution);
      }
    } catch (saveError) {
      this.logger.warn(
        `No se pudo registrar fallo de ejecucion: ${saveError.message}`,
      );
    }
  }
}
