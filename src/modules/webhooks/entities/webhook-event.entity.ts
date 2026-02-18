import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  BeforeInsert,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { generateSystemCode } from '../../../common/utils/system-code-generator.util';

export enum WebhookSource {
  STRIPE = 'stripe',
  PAYPAL = 'paypal',
  CUSTOM = 'custom',
}

export enum WebhookEventStatus {
  RECEIVED = 'received',
  PROCESSING = 'processing',
  PROCESSED = 'processed',
  FAILED = 'failed',
  SKIPPED = 'skipped',
}

@Entity('webhook_events')
@Index(['source', 'externalEventId'], { unique: true })
export class WebhookEvent {
  @ApiProperty({
    example: '123e4567-e89b-12d3-a456-426614174000',
    description: 'ID unico del evento de webhook',
  })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({
    example: 'WHK-260207-A3K9',
    description: 'Codigo unico legible del sistema',
  })
  @Column({ type: 'varchar', length: 50, unique: true })
  @Index()
  systemCode: string;

  @ApiProperty({
    example: 'stripe',
    description: 'Origen del webhook (stripe, paypal, custom)',
    enum: WebhookSource,
  })
  @Column({ type: 'enum', enum: WebhookSource })
  @Index()
  source: WebhookSource;

  @ApiProperty({
    example: 'evt_1NqXkPLkdIwOt4y7AvGQWs5E',
    description: 'ID externo del evento (ej: Stripe event.id)',
  })
  @Column({ type: 'varchar', length: 255 })
  @Index()
  externalEventId: string;

  @ApiProperty({
    example: 'payment_intent.succeeded',
    description: 'Tipo del evento recibido',
  })
  @Column({ type: 'varchar', length: 100 })
  @Index()
  eventType: string;

  @ApiProperty({
    example: { id: 'evt_xxx', type: 'payment_intent.succeeded' },
    description: 'Payload completo del evento recibido',
  })
  @Column({ type: 'jsonb' })
  payload: Record<string, any>;

  @ApiProperty({
    example: { 'stripe-signature': 'whsec_xxx' },
    description: 'Headers relevantes del request (firma, etc)',
    required: false,
  })
  @Column({ type: 'jsonb', nullable: true })
  headers: Record<string, string> | null;

  @ApiProperty({
    example: 'received',
    description: 'Estado actual del procesamiento del evento',
    enum: WebhookEventStatus,
  })
  @Column({
    type: 'enum',
    enum: WebhookEventStatus,
    default: WebhookEventStatus.RECEIVED,
  })
  @Index()
  status: WebhookEventStatus;

  @ApiProperty({
    example: 1,
    description: 'Numero de intentos de procesamiento realizados',
  })
  @Column({ type: 'int', default: 0 })
  attempts: number;

  @ApiProperty({
    example: 3,
    description: 'Numero maximo de intentos permitidos',
  })
  @Column({ type: 'int', default: 3 })
  maxAttempts: number;

  @ApiProperty({
    example: { received: true, processed: 'payment_intent.succeeded' },
    description: 'Resultado del procesamiento exitoso',
    required: false,
  })
  @Column({ type: 'jsonb', nullable: true })
  result: Record<string, any> | null;

  @ApiProperty({
    example: 'Error al procesar el evento: conexion rechazada',
    description: 'Mensaje de error si el procesamiento fallo',
    required: false,
  })
  @Column({ type: 'text', nullable: true })
  errorMessage: string | null;

  @ApiProperty({
    example: 'Error: Connection refused\n    at ...',
    description: 'Stack trace del error',
    required: false,
  })
  @Column({ type: 'text', nullable: true })
  errorStack: string | null;

  @ApiProperty({
    example: '2026-02-07T15:30:00.000Z',
    description: 'Fecha y hora en que se proceso exitosamente',
    required: false,
  })
  @Column({ type: 'timestamptz', nullable: true })
  processedAt: Date | null;

  @ApiProperty({
    example: '2026-02-07T16:00:00.000Z',
    description: 'Fecha y hora del proximo reintento programado',
    required: false,
  })
  @Column({ type: 'timestamptz', nullable: true })
  nextRetryAt: Date | null;

  @ApiProperty({
    example: 150,
    description: 'Tiempo de procesamiento en milisegundos',
    required: false,
  })
  @Column({ type: 'int', nullable: true })
  processingTimeMs: number | null;

  @ApiProperty({
    example: '192.168.1.100',
    description: 'Direccion IP de origen del webhook',
    required: false,
  })
  @Column({ type: 'varchar', length: 50, nullable: true })
  ipAddress: string | null;

  @ApiProperty({
    example: '2026-02-07T15:00:00.000Z',
    description: 'Fecha de creacion del registro',
  })
  @CreateDateColumn()
  createdAt: Date;

  @ApiProperty({
    example: '2026-02-07T15:30:00.000Z',
    description: 'Fecha de ultima actualizacion',
  })
  @UpdateDateColumn()
  updatedAt: Date;

  @BeforeInsert()
  generateSystemCode() {
    if (!this.systemCode) {
      this.systemCode = generateSystemCode('WebhookEvent');
    }
  }

  constructor(partial: Partial<WebhookEvent>) {
    Object.assign(this, partial);
  }
}
