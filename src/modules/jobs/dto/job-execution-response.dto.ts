import { ApiProperty } from '@nestjs/swagger';
import type { JobExecutionStatus } from '../entities/job-execution.entity';

/**
 * DTO de respuesta para una ejecucion de job
 */
export class JobExecutionResponseDto {
  @ApiProperty({
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    description: 'ID unico de la ejecucion',
  })
  id: string;

  @ApiProperty({
    example: 'cart-cleanup',
    description: 'Nombre del job ejecutado',
  })
  jobName: string;

  @ApiProperty({
    example: 'michambita-jobs',
    description: 'Nombre de la cola donde se ejecuto',
  })
  queueName: string;

  @ApiProperty({
    example: 'completed',
    description: 'Estado de la ejecucion',
    enum: ['pending', 'processing', 'completed', 'failed'],
  })
  status: JobExecutionStatus;

  @ApiProperty({
    example: { dryRun: false },
    description: 'Datos de entrada del job',
    nullable: true,
  })
  input: Record<string, any> | null;

  @ApiProperty({
    example: { deletedCarts: 5, deletedItems: 12 },
    description: 'Resultado de la ejecucion',
    nullable: true,
  })
  result: Record<string, any> | null;

  @ApiProperty({
    example: null,
    description: 'Mensaje de error si fallo',
    nullable: true,
  })
  errorMessage: string | null;

  @ApiProperty({
    example: 0,
    description: 'Numero de intento de ejecucion',
  })
  attemptNumber: number;

  @ApiProperty({
    example: 1250,
    description: 'Duracion de la ejecucion en milisegundos',
    nullable: true,
  })
  durationMs: number | null;

  @ApiProperty({
    example: null,
    description: 'ID del usuario que disparo el job manualmente',
    nullable: true,
  })
  triggeredBy: string | null;

  @ApiProperty({
    example: '2026-02-07T10:00:00.000Z',
    description: 'Fecha y hora de inicio',
  })
  startedAt: Date;

  @ApiProperty({
    example: '2026-02-07T10:00:01.250Z',
    description: 'Fecha y hora de finalizacion',
    nullable: true,
  })
  completedAt: Date | null;
}
