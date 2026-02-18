import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

/**
 * Estados de ejecucion de un job
 */
export enum JobExecutionStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

/**
 * Nombres de jobs disponibles en MiChambita
 */
export enum JobName {
  // Los jobs especificos se agregaran segun las necesidades del proyecto
}

/**
 * Entidad que registra el historial de ejecuciones de jobs
 * para monitoreo y depuracion
 */
@Entity('job_executions')
export class JobExecution {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100 })
  @Index()
  jobName: string;

  @Column({ type: 'varchar', length: 100 })
  @Index()
  queueName: string;

  @Column({
    type: 'enum',
    enum: JobExecutionStatus,
    default: JobExecutionStatus.PENDING,
  })
  @Index()
  status: JobExecutionStatus;

  @Column({ type: 'jsonb', nullable: true })
  input: Record<string, any> | null;

  @Column({ type: 'jsonb', nullable: true })
  result: Record<string, any> | null;

  @Column({ type: 'text', nullable: true })
  errorMessage: string | null;

  @Column({ type: 'text', nullable: true })
  errorStack: string | null;

  @Column({ type: 'int', default: 0 })
  attemptNumber: number;

  @Column({ type: 'int', nullable: true })
  durationMs: number | null;

  @Column({ type: 'varchar', length: 36, nullable: true })
  triggeredBy: string | null;

  @CreateDateColumn()
  startedAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  completedAt: Date | null;

  constructor(partial: Partial<JobExecution>) {
    Object.assign(this, partial);
  }
}
