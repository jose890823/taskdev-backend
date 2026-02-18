import { ApiProperty } from '@nestjs/swagger';
import {
  IsOptional,
  IsEnum,
  IsString,
  IsInt,
  Min,
  Max,
  IsDateString,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  WebhookSource,
  WebhookEventStatus,
} from '../entities/webhook-event.entity';

export class WebhookFilterDto {
  @ApiProperty({
    example: 'stripe',
    description: 'Filtrar por origen del webhook',
    enum: WebhookSource,
    required: false,
  })
  @IsOptional()
  @IsEnum(WebhookSource, {
    message: 'El origen debe ser un valor valido (stripe, paypal, custom)',
  })
  source?: WebhookSource;

  @ApiProperty({
    example: 'processed',
    description: 'Filtrar por estado del evento',
    enum: WebhookEventStatus,
    required: false,
  })
  @IsOptional()
  @IsEnum(WebhookEventStatus, {
    message:
      'El estado debe ser un valor valido (received, processing, processed, failed, skipped)',
  })
  status?: WebhookEventStatus;

  @ApiProperty({
    example: 'payment_intent.succeeded',
    description: 'Filtrar por tipo de evento',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'El tipo de evento debe ser una cadena de texto' })
  eventType?: string;

  @ApiProperty({
    example: 'evt_1NqXkPLkdIwOt4y7AvGQWs5E',
    description: 'Buscar por ID externo del evento',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'El ID externo debe ser una cadena de texto' })
  externalEventId?: string;

  @ApiProperty({
    example: '2026-01-01T00:00:00.000Z',
    description: 'Fecha de inicio del rango de busqueda (ISO 8601)',
    required: false,
  })
  @IsOptional()
  @IsDateString(
    {},
    { message: 'La fecha de inicio debe tener formato ISO 8601 valido' },
  )
  dateFrom?: string;

  @ApiProperty({
    example: '2026-02-07T23:59:59.999Z',
    description: 'Fecha de fin del rango de busqueda (ISO 8601)',
    required: false,
  })
  @IsOptional()
  @IsDateString(
    {},
    { message: 'La fecha de fin debe tener formato ISO 8601 valido' },
  )
  dateTo?: string;

  @ApiProperty({
    example: 1,
    description: 'Numero de pagina (empieza en 1)',
    required: false,
    default: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'La pagina debe ser un numero entero' })
  @Min(1, { message: 'La pagina debe ser al menos 1' })
  page?: number = 1;

  @ApiProperty({
    example: 20,
    description: 'Cantidad de resultados por pagina (maximo 100)',
    required: false,
    default: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'El limite debe ser un numero entero' })
  @Min(1, { message: 'El limite debe ser al menos 1' })
  @Max(100, { message: 'El limite no puede superar 100' })
  limit?: number = 20;
}
