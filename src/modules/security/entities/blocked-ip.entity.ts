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

export enum BlockedByType {
  SYSTEM = 'system',
  ADMIN = 'admin',
}

@Entity('blocked_ips')
@Index(['ipAddress'], { unique: true })
@Index(['isActive'])
@Index(['expiresAt'])
export class BlockedIP {
  @ApiProperty({ description: 'ID unico del bloqueo' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ description: 'Direccion IP bloqueada' })
  @Column({ type: 'varchar', length: 45 })
  ipAddress: string;

  @ApiProperty({ description: 'Razon del bloqueo' })
  @Column({ type: 'text' })
  reason: string;

  @ApiProperty({ description: 'Quien realizo el bloqueo', enum: BlockedByType })
  @Column({ type: 'varchar', length: 20 })
  blockedBy: BlockedByType;

  @ApiProperty({ description: 'ID del admin que bloqueo (si fue manual)' })
  @Column({ type: 'uuid', nullable: true })
  blockedByUserId: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'blockedByUserId' })
  blockedByUser: User | null;

  @ApiProperty({ description: 'Si es un bloqueo permanente' })
  @Column({ type: 'boolean', default: false })
  permanent: boolean;

  @ApiProperty({ description: 'Fecha de expiracion del bloqueo' })
  @Column({ type: 'timestamp', nullable: true })
  expiresAt: Date | null;

  @ApiProperty({ description: 'Intentos desde que fue bloqueado' })
  @Column({ type: 'int', default: 0 })
  attemptsSinceBlock: number;

  @ApiProperty({ description: 'Si el bloqueo esta activo' })
  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  constructor(partial: Partial<BlockedIP>) {
    Object.assign(this, partial);
  }

  /**
   * Verifica si el bloqueo ha expirado
   */
  isExpired(): boolean {
    if (this.permanent) return false;
    if (!this.expiresAt) return false;
    return new Date() > this.expiresAt;
  }
}
