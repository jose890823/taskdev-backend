import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { User } from '../../auth/entities/user.entity';

export enum SecurityEventType {
  LOGIN_FAILED = 'login_failed',
  LOGIN_SUCCESS = 'login_success',
  LOGIN_BLOCKED = 'login_blocked',
  RATE_LIMIT_EXCEEDED = 'rate_limit_exceeded',
  SUSPICIOUS_ACTIVITY = 'suspicious_activity',
  PASSWORD_RESET_REQUESTED = 'password_reset_requested',
  PASSWORD_CHANGED = 'password_changed',
  ACCOUNT_LOCKED = 'account_locked',
  ACCOUNT_UNLOCKED = 'account_unlocked',
  UNAUTHORIZED_ACCESS = 'unauthorized_access',
  CORS_VIOLATION = 'cors_violation',
  BOT_DETECTED = 'bot_detected',
  SCRAPING_ATTEMPT = 'scraping_attempt',
  IP_BLOCKED = 'ip_blocked',
  IP_UNBLOCKED = 'ip_unblocked',
  SESSION_CREATED = 'session_created',
  SESSION_REVOKED = 'session_revoked',
  ADMIN_ACTION = 'admin_action',
}

export enum SecurityEventSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

@Entity('security_events')
@Index(['eventType'])
@Index(['severity'])
@Index(['ipAddress'])
@Index(['createdAt'])
@Index(['reviewed'])
export class SecurityEvent {
  @ApiProperty({ description: 'ID unico del evento' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ description: 'Tipo de evento', enum: SecurityEventType })
  @Column({ type: 'varchar', length: 50 })
  eventType: SecurityEventType;

  @ApiProperty({
    description: 'Severidad del evento',
    enum: SecurityEventSeverity,
  })
  @Column({ type: 'varchar', length: 20 })
  severity: SecurityEventSeverity;

  @ApiProperty({ description: 'Direccion IP' })
  @Column({ type: 'varchar', length: 45 })
  ipAddress: string;

  @ApiProperty({ description: 'User Agent del navegador' })
  @Column({ type: 'text', nullable: true })
  userAgent: string | null;

  @ApiProperty({ description: 'ID del usuario relacionado' })
  @Column({ type: 'uuid', nullable: true })
  userId: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'userId' })
  user: User | null;

  @ApiProperty({ description: 'Email intentado (para login fallido)' })
  @Column({ type: 'varchar', length: 255, nullable: true })
  email: string | null;

  @ApiProperty({ description: 'Endpoint afectado' })
  @Column({ type: 'varchar', length: 500 })
  endpoint: string;

  @ApiProperty({ description: 'Metodo HTTP' })
  @Column({ type: 'varchar', length: 10 })
  method: string;

  @ApiProperty({ description: 'Descripcion del evento' })
  @Column({ type: 'text' })
  description: string;

  @ApiProperty({ description: 'Metadatos adicionales en JSON' })
  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any> | null;

  @ApiProperty({ description: 'Pais de origen' })
  @Column({ type: 'varchar', length: 100, nullable: true })
  country: string | null;

  @ApiProperty({ description: 'Ciudad de origen' })
  @Column({ type: 'varchar', length: 100, nullable: true })
  city: string | null;

  @ApiProperty({ description: 'Si el evento fue revisado' })
  @Column({ type: 'boolean', default: false })
  reviewed: boolean;

  @ApiProperty({ description: 'ID del admin que reviso' })
  @Column({ type: 'uuid', nullable: true })
  reviewedById: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'reviewedById' })
  reviewedBy: User | null;

  @ApiProperty({ description: 'Fecha de revision' })
  @Column({ type: 'timestamp', nullable: true })
  reviewedAt: Date | null;

  @ApiProperty({ description: 'Notas del admin' })
  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @CreateDateColumn()
  createdAt: Date;

  constructor(partial: Partial<SecurityEvent>) {
    Object.assign(this, partial);
  }
}
