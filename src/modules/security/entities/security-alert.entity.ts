import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { User } from '../../auth/entities/user.entity';

export enum SecurityAlertType {
  BRUTE_FORCE_ATTACK = 'brute_force_attack',
  UNUSUAL_TRAFFIC = 'unusual_traffic',
  MULTIPLE_FAILED_LOGINS = 'multiple_failed_logins',
  SUSPICIOUS_IP_PATTERN = 'suspicious_ip_pattern',
  POTENTIAL_SCRAPING = 'potential_scraping',
  NEW_COUNTRY_LOGIN = 'new_country_login',
  ACCOUNT_TAKEOVER_ATTEMPT = 'account_takeover_attempt',
  MASS_REGISTRATION = 'mass_registration',
  API_ABUSE = 'api_abuse',
}

export enum SecurityAlertSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export enum SecurityAlertStatus {
  ACTIVE = 'active',
  INVESTIGATING = 'investigating',
  RESOLVED = 'resolved',
  DISMISSED = 'dismissed',
}

@Entity('security_alerts')
@Index(['alertType'])
@Index(['severity'])
@Index(['status'])
@Index(['createdAt'])
export class SecurityAlert {
  @ApiProperty({ description: 'ID unico de la alerta' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ description: 'Tipo de alerta', enum: SecurityAlertType })
  @Column({ type: 'varchar', length: 50 })
  alertType: SecurityAlertType;

  @ApiProperty({ description: 'Severidad', enum: SecurityAlertSeverity })
  @Column({ type: 'varchar', length: 20 })
  severity: SecurityAlertSeverity;

  @ApiProperty({ description: 'Titulo de la alerta' })
  @Column({ type: 'varchar', length: 255 })
  title: string;

  @ApiProperty({ description: 'Descripcion detallada' })
  @Column({ type: 'text' })
  description: string;

  @ApiProperty({ description: 'ID de usuario relacionado' })
  @Column({ type: 'uuid', nullable: true })
  relatedUserId: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'relatedUserId' })
  relatedUser: User | null;

  @ApiProperty({ description: 'IP relacionada' })
  @Column({ type: 'varchar', length: 45, nullable: true })
  relatedIpAddress: string | null;

  @ApiProperty({ description: 'IDs de eventos relacionados' })
  @Column({ type: 'simple-array', nullable: true })
  relatedEventIds: string[] | null;

  @ApiProperty({
    description: 'Estado de la alerta',
    enum: SecurityAlertStatus,
  })
  @Column({ type: 'varchar', length: 20, default: SecurityAlertStatus.ACTIVE })
  status: SecurityAlertStatus;

  @ApiProperty({ description: 'ID del admin asignado' })
  @Column({ type: 'uuid', nullable: true })
  assignedToId: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'assignedToId' })
  assignedTo: User | null;

  @ApiProperty({ description: 'Fecha de resolucion' })
  @Column({ type: 'timestamp', nullable: true })
  resolvedAt: Date | null;

  @ApiProperty({ description: 'ID de quien resolvio' })
  @Column({ type: 'uuid', nullable: true })
  resolvedById: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'resolvedById' })
  resolvedBy: User | null;

  @ApiProperty({ description: 'Como se resolvio' })
  @Column({ type: 'text', nullable: true })
  resolution: string | null;

  @ApiProperty({ description: 'Metadatos adicionales' })
  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any> | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  constructor(partial: Partial<SecurityAlert>) {
    Object.assign(this, partial);
  }
}
