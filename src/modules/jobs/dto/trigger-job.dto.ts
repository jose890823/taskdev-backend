import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional } from 'class-validator';
import { JobName } from '../entities/job-execution.entity';

/**
 * DTO para disparar un job manualmente
 */
export class TriggerJobDto {
  @ApiProperty({
    example: 'cart-cleanup',
    description: 'Nombre del job a ejecutar',
    enum: JobName,
  })
  @IsNotEmpty({ message: 'El nombre del job es obligatorio' })
  @IsEnum(JobName, { message: 'El nombre del job no es valido' })
  jobName: JobName;

  @ApiProperty({
    example: { dryRun: true },
    description: 'Datos de entrada opcionales para el job',
    required: false,
  })
  @IsOptional()
  input?: Record<string, any>;
}
