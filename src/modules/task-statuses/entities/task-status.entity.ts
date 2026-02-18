import {
  Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, Index,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';

@Entity('task_statuses')
@Index(['projectId'])
export class TaskStatus {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ description: 'ID del proyecto (null = estado global para daily tasks)', required: false })
  @Column({ type: 'uuid', nullable: true })
  projectId: string | null;

  @ApiProperty({ example: 'En progreso' })
  @Column({ type: 'varchar', length: 100 })
  name: string;

  @ApiProperty({ example: '#f59e0b' })
  @Column({ type: 'varchar', length: 7, default: '#6b7280' })
  color: string;

  @ApiProperty({ example: 'circle', required: false })
  @Column({ type: 'varchar', length: 50, nullable: true })
  icon: string | null;

  @ApiProperty({ example: 0 })
  @Column({ type: 'int', default: 0 })
  position: number;

  @ApiProperty({ example: false, description: 'Es el estado por defecto al crear tareas' })
  @Column({ type: 'boolean', default: false })
  isDefault: boolean;

  @ApiProperty({ example: false, description: 'Marca la tarea como completada' })
  @Column({ type: 'boolean', default: false })
  isCompleted: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  constructor(partial: Partial<TaskStatus>) {
    Object.assign(this, partial);
  }
}
