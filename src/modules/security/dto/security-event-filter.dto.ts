import { ApiProperty } from '@nestjs/swagger';
import {
  IsOptional,
  IsEnum,
  IsInt,
  Min,
  Max,
  IsString,
  IsBoolean,
  IsDateString,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  SecurityEventType,
  SecurityEventSeverity,
} from '../entities/security-event.entity';

export class SecurityEventFilterDto {
  @ApiProperty({
    example: 'login_failed',
    description: 'Filtrar por tipo de evento',
    enum: SecurityEventType,
    required: false,
  })
  @IsOptional()
  @IsEnum(SecurityEventType)
  eventType?: SecurityEventType;

  @ApiProperty({
    example: 'high',
    description: 'Filtrar por severidad',
    enum: SecurityEventSeverity,
    required: false,
  })
  @IsOptional()
  @IsEnum(SecurityEventSeverity)
  severity?: SecurityEventSeverity;

  @ApiProperty({
    example: '192.168.1.1',
    description: 'Filtrar por IP',
    required: false,
  })
  @IsOptional()
  @IsString()
  ipAddress?: string;

  @ApiProperty({
    example: false,
    description: 'Filtrar por revisados/no revisados',
    required: false,
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  reviewed?: boolean;

  @ApiProperty({
    example: '2026-01-01',
    description: 'Fecha desde',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @ApiProperty({
    example: '2026-12-31',
    description: 'Fecha hasta',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  toDate?: string;

  @ApiProperty({
    example: 1,
    description: 'Numero de pagina',
    required: false,
    default: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiProperty({
    example: 20,
    description: 'Registros por pagina',
    required: false,
    default: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiProperty({
    example: 'createdAt',
    description: 'Campo de ordenamiento',
    required: false,
    default: 'createdAt',
  })
  @IsOptional()
  sortBy?: string = 'createdAt';

  @ApiProperty({
    example: 'DESC',
    description: 'Direccion de ordenamiento',
    required: false,
    default: 'DESC',
  })
  @IsOptional()
  sortOrder?: 'ASC' | 'DESC' = 'DESC';
}
