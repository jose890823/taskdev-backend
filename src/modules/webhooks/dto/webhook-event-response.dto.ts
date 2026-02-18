import { ApiProperty } from '@nestjs/swagger';
import type {
  WebhookSource,
  WebhookEventStatus,
} from '../entities/webhook-event.entity';

export class WebhookEventResponseDto {
  @ApiProperty({
    example: '123e4567-e89b-12d3-a456-426614174000',
    description: 'ID unico del evento de webhook',
  })
  id: string;

  @ApiProperty({
    example: 'WHK-260207-A3K9',
    description: 'Codigo unico legible del sistema',
  })
  systemCode: string;

  @ApiProperty({
    example: 'stripe',
    description: 'Origen del webhook',
  })
  source: WebhookSource;

  @ApiProperty({
    example: 'evt_1NqXkPLkdIwOt4y7AvGQWs5E',
    description: 'ID externo del evento',
  })
  externalEventId: string;

  @ApiProperty({
    example: 'payment_intent.succeeded',
    description: 'Tipo del evento',
  })
  eventType: string;

  @ApiProperty({
    example: 'received',
    description: 'Estado actual del procesamiento',
  })
  status: WebhookEventStatus;

  @ApiProperty({
    example: 1,
    description: 'Numero de intentos realizados',
  })
  attempts: number;

  @ApiProperty({
    example: 3,
    description: 'Numero maximo de intentos permitidos',
  })
  maxAttempts: number;

  @ApiProperty({
    example: { received: true, processed: 'payment_intent.succeeded' },
    description: 'Resultado del procesamiento',
    required: false,
  })
  result: Record<string, any> | null;

  @ApiProperty({
    example: null,
    description: 'Mensaje de error si fallo',
    required: false,
  })
  errorMessage: string | null;

  @ApiProperty({
    example: null,
    description: 'Stack trace del error',
    required: false,
  })
  errorStack: string | null;

  @ApiProperty({
    example: '2026-02-07T15:30:00.000Z',
    description: 'Fecha de procesamiento exitoso',
    required: false,
  })
  processedAt: Date | null;

  @ApiProperty({
    example: null,
    description: 'Fecha del proximo reintento',
    required: false,
  })
  nextRetryAt: Date | null;

  @ApiProperty({
    example: 150,
    description: 'Tiempo de procesamiento en milisegundos',
    required: false,
  })
  processingTimeMs: number | null;

  @ApiProperty({
    example: '192.168.1.100',
    description: 'Direccion IP de origen',
    required: false,
  })
  ipAddress: string | null;

  @ApiProperty({
    example: '2026-02-07T15:00:00.000Z',
    description: 'Fecha de creacion',
  })
  createdAt: Date;

  @ApiProperty({
    example: '2026-02-07T15:30:00.000Z',
    description: 'Fecha de ultima actualizacion',
  })
  updatedAt: Date;
}

export class WebhookStatsResponseDto {
  @ApiProperty({
    example: 1250,
    description: 'Total de eventos registrados',
  })
  total: number;

  @ApiProperty({
    example: 1100,
    description: 'Eventos procesados exitosamente',
  })
  processed: number;

  @ApiProperty({
    example: 50,
    description: 'Eventos fallidos',
  })
  failed: number;

  @ApiProperty({
    example: 80,
    description: 'Eventos duplicados omitidos',
  })
  skipped: number;

  @ApiProperty({
    example: 15,
    description: 'Eventos pendientes de reintento',
  })
  pendingRetry: number;

  @ApiProperty({
    example: 145.5,
    description: 'Tiempo promedio de procesamiento en milisegundos',
  })
  avgProcessingTimeMs: number;

  @ApiProperty({
    example: { stripe: 1200, paypal: 50 },
    description: 'Desglose de eventos por origen',
  })
  bySource: Record<string, number>;

  @ApiProperty({
    example: {
      'payment_intent.succeeded': 500,
      'checkout.session.completed': 300,
    },
    description: 'Desglose de eventos por tipo',
  })
  byEventType: Record<string, number>;

  @ApiProperty({
    example: { received: 120, processed: 115, failed: 5 },
    description: 'Eventos en las ultimas 24 horas',
  })
  last24h: { received: number; processed: number; failed: number };
}
