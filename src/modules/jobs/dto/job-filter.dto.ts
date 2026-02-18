import { ApiProperty } from '@nestjs/swagger';
import {
  IsOptional,
  IsEnum,
  IsInt,
  Min,
  Max,
  IsDateString,
  IsString,
} from 'class-validator';
import { Type } from 'class-transformer';
import { JobExecutionStatus, JobName } from '../entities/job-execution.entity';

/**
 * DTO para filtrar y paginar el historial de ejecuciones de jobs
 */
export class JobFilterDto {
  @ApiProperty({
    example: 'cart-cleanup',
    description: 'Filtrar por nombre del job',
    enum: JobName,
    required: false,
  })
  @IsOptional()
  @IsEnum(JobName, { message: 'El nombre del job no es valido' })
  jobName?: JobName;

  @ApiProperty({
    example: 'completed',
    description: 'Filtrar por estado de ejecucion',
    enum: JobExecutionStatus,
    required: false,
  })
  @IsOptional()
  @IsEnum(JobExecutionStatus, { message: 'El estado no es valido' })
  status?: JobExecutionStatus;

  @ApiProperty({
    example: 'michambita-jobs',
    description: 'Filtrar por nombre de la cola',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'El nombre de la cola debe ser texto' })
  queueName?: string;

  @ApiProperty({
    example: '2026-01-01',
    description: 'Fecha desde (ISO 8601)',
    required: false,
  })
  @IsOptional()
  @IsDateString(
    {},
    { message: 'La fecha desde debe ser una fecha valida ISO 8601' },
  )
  fromDate?: string;

  @ApiProperty({
    example: '2026-12-31',
    description: 'Fecha hasta (ISO 8601)',
    required: false,
  })
  @IsOptional()
  @IsDateString(
    {},
    { message: 'La fecha hasta debe ser una fecha valida ISO 8601' },
  )
  toDate?: string;

  @ApiProperty({
    example: 1,
    description: 'Numero de pagina',
    required: false,
    default: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'La pagina debe ser un numero entero' })
  @Min(1, { message: 'La pagina minima es 1' })
  page?: number = 1;

  @ApiProperty({
    example: 20,
    description: 'Registros por pagina',
    required: false,
    default: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'El limite debe ser un numero entero' })
  @Min(1, { message: 'El limite minimo es 1' })
  @Max(100, { message: 'El limite maximo es 100' })
  limit?: number = 20;

  @ApiProperty({
    example: 'startedAt',
    description: 'Campo de ordenamiento',
    required: false,
    default: 'startedAt',
  })
  @IsOptional()
  @IsString()
  sortBy?: string = 'startedAt';

  @ApiProperty({
    example: 'DESC',
    description: 'Direccion de ordenamiento',
    required: false,
    default: 'DESC',
    enum: ['ASC', 'DESC'],
  })
  @IsOptional()
  sortOrder?: 'ASC' | 'DESC' = 'DESC';
}
