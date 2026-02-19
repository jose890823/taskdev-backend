import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { User } from '../../auth/entities/user.entity';

/**
 * Preferencias de notificación del usuario
 */
@Entity('notification_preferences')
@Index(['userId'], { unique: true })
export class NotificationPreference {
  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'ID único de las preferencias',
  })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // ============================================
  // USUARIO
  // ============================================

  @OneToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'uuid' })
  userId: string;

  // ============================================
  // CANALES GLOBALES
  // ============================================

  @ApiProperty({
    example: true,
    description: 'Recibir notificaciones por email',
  })
  @Column({ type: 'boolean', default: true })
  emailEnabled: boolean;

  @ApiProperty({
    example: true,
    description: 'Recibir notificaciones in-app',
  })
  @Column({ type: 'boolean', default: true })
  inAppEnabled: boolean;

  @ApiProperty({
    example: false,
    description: 'Recibir notificaciones push',
  })
  @Column({ type: 'boolean', default: false })
  pushEnabled: boolean;

  @ApiProperty({
    example: false,
    description: 'Recibir notificaciones por SMS',
  })
  @Column({ type: 'boolean', default: false })
  smsEnabled: boolean;

  // ============================================
  // PREFERENCIAS POR CATEGORÍA - IN-APP
  // ============================================

  @ApiProperty({
    example: true,
    description: 'Notificaciones in-app de tareas',
  })
  @Column({ type: 'boolean', default: true })
  inAppTasks: boolean;

  @ApiProperty({
    example: true,
    description: 'Notificaciones in-app de proyectos',
  })
  @Column({ type: 'boolean', default: true })
  inAppProjects: boolean;

  @ApiProperty({
    example: true,
    description: 'Notificaciones in-app de organizaciones',
  })
  @Column({ type: 'boolean', default: true })
  inAppOrganizations: boolean;

  @ApiProperty({
    example: true,
    description: 'Notificaciones in-app de anuncios',
  })
  @Column({ type: 'boolean', default: true })
  inAppAnnouncements: boolean;

  // ============================================
  // FRECUENCIA DE DIGEST
  // ============================================

  @ApiProperty({
    example: 'instant',
    description: 'Frecuencia de emails: instant, daily, weekly',
  })
  @Column({ type: 'varchar', length: 20, default: 'instant' })
  emailFrequency: 'instant' | 'daily' | 'weekly';

  @ApiProperty({
    example: '09:00',
    description: 'Hora preferida para digest (HH:mm)',
  })
  @Column({ type: 'varchar', length: 5, default: '09:00' })
  digestTime: string;

  @ApiProperty({
    example: 'America/New_York',
    description: 'Zona horaria del usuario',
  })
  @Column({ type: 'varchar', length: 50, default: 'America/New_York' })
  timezone: string;

  // ============================================
  // QUIET HOURS
  // ============================================

  @ApiProperty({
    example: false,
    description: 'Activar horas silenciosas',
  })
  @Column({ type: 'boolean', default: false })
  quietHoursEnabled: boolean;

  @ApiProperty({
    example: '22:00',
    description: 'Inicio de horas silenciosas (HH:mm)',
  })
  @Column({ type: 'varchar', length: 5, default: '22:00' })
  quietHoursStart: string;

  @ApiProperty({
    example: '08:00',
    description: 'Fin de horas silenciosas (HH:mm)',
  })
  @Column({ type: 'varchar', length: 5, default: '08:00' })
  quietHoursEnd: string;

  // ============================================
  // TIMESTAMPS
  // ============================================

  @ApiProperty({ description: 'Fecha de creación' })
  @CreateDateColumn()
  createdAt: Date;

  @ApiProperty({ description: 'Fecha de última actualización' })
  @UpdateDateColumn()
  updatedAt: Date;

  // ============================================
  // CONSTRUCTOR
  // ============================================

  constructor(partial: Partial<NotificationPreference>) {
    Object.assign(this, partial);
  }
}
