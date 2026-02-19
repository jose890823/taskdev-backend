import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';

/**
 * Configuración de eventos de notificación (admin-level toggle)
 */
@Entity('notification_event_configs')
@Index(['eventType'], { unique: true })
export class NotificationEventConfig {
  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'ID único',
  })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({
    example: 'task_assigned',
    description: 'Tipo de evento',
  })
  @Column({ type: 'varchar', length: 50, unique: true })
  eventType: string;

  @ApiProperty({
    example: 'Tarea asignada',
    description: 'Etiqueta legible del evento',
  })
  @Column({ type: 'varchar', length: 100 })
  label: string;

  @ApiProperty({
    example: 'Cuando un usuario es asignado a una tarea',
    description: 'Descripción del evento',
  })
  @Column({ type: 'varchar', length: 255, nullable: true })
  description: string | null;

  @ApiProperty({
    example: true,
    description: 'Si el evento está habilitado para generar notificaciones',
  })
  @Column({ type: 'boolean', default: true })
  isEnabled: boolean;

  @ApiProperty({
    example: 'tasks',
    description: 'Categoría del evento (tasks, projects, organizations)',
  })
  @Column({ type: 'varchar', length: 50 })
  category: string;

  @ApiProperty({ description: 'Fecha de creación' })
  @CreateDateColumn()
  createdAt: Date;

  @ApiProperty({ description: 'Fecha de última actualización' })
  @UpdateDateColumn()
  updatedAt: Date;

  constructor(partial: Partial<NotificationEventConfig>) {
    Object.assign(this, partial);
  }
}
