import {
  Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, Index,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';

export enum InvitationStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  EXPIRED = 'expired',
  CANCELLED = 'cancelled',
}

@Entity('invitations')
@Index(['token'], { unique: true })
@Index(['organizationId', 'email', 'projectId'])
export class Invitation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  organizationId: string;

  @ApiProperty({ example: 'user@example.com' })
  @Column({ type: 'varchar', length: 255 })
  email: string;

  @ApiProperty({ example: 'member' })
  @Column({ type: 'varchar', length: 50, default: 'member' })
  role: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  token: string;

  @Column({ type: 'uuid' })
  invitedById: string;

  @ApiProperty({ enum: InvitationStatus })
  @Column({ type: 'enum', enum: InvitationStatus, default: InvitationStatus.PENDING })
  status: InvitationStatus;

  @ApiProperty({ example: null, description: 'ID del proyecto (si es invitacion a proyecto)', nullable: true })
  @Column({ type: 'uuid', nullable: true })
  projectId: string | null;

  @ApiProperty({ example: null, description: 'Rol en el proyecto', nullable: true })
  @Column({ type: 'varchar', length: 50, nullable: true })
  projectRole: string | null;

  @Column({ type: 'timestamp' })
  expiresAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  constructor(partial: Partial<Invitation>) {
    Object.assign(this, partial);
  }
}
