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

export enum RateLimitAction {
  WARNED = 'warned',
  BLOCKED = 'blocked',
  TEMPORARILY_BANNED = 'temporarily_banned',
}

@Entity('rate_limit_logs')
@Index(['ipAddress'])
@Index(['endpoint'])
@Index(['createdAt'])
export class RateLimitLog {
  @ApiProperty({ description: 'ID unico del log' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ description: 'Direccion IP' })
  @Column({ type: 'varchar', length: 45 })
  ipAddress: string;

  @ApiProperty({ description: 'ID del usuario' })
  @Column({ type: 'uuid', nullable: true })
  userId: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'userId' })
  user: User | null;

  @ApiProperty({ description: 'Endpoint afectado' })
  @Column({ type: 'varchar', length: 500 })
  endpoint: string;

  @ApiProperty({ description: 'Numero de peticiones en la ventana' })
  @Column({ type: 'int' })
  requestCount: number;

  @ApiProperty({ description: 'Inicio de la ventana de tiempo' })
  @Column({ type: 'timestamp' })
  windowStart: Date;

  @ApiProperty({ description: 'Fin de la ventana de tiempo' })
  @Column({ type: 'timestamp' })
  windowEnd: Date;

  @ApiProperty({ description: 'Limite configurado' })
  @Column({ type: 'int' })
  limit: number;

  @ApiProperty({ description: 'Accion tomada', enum: RateLimitAction })
  @Column({ type: 'varchar', length: 30 })
  action: RateLimitAction;

  @CreateDateColumn()
  createdAt: Date;

  constructor(partial: Partial<RateLimitLog>) {
    Object.assign(this, partial);
  }
}
