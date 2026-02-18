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

export enum LoginFailureReason {
  INVALID_EMAIL = 'invalid_email',
  INVALID_PASSWORD = 'invalid_password',
  ACCOUNT_LOCKED = 'account_locked',
  ACCOUNT_INACTIVE = 'account_inactive',
  EMAIL_NOT_VERIFIED = 'email_not_verified',
  RATE_LIMITED = 'rate_limited',
  IP_BLOCKED = 'ip_blocked',
}

@Entity('login_attempts')
@Index(['email'])
@Index(['ipAddress'])
@Index(['success'])
@Index(['createdAt'])
export class LoginAttempt {
  @ApiProperty({ description: 'ID unico del intento' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ description: 'Email utilizado en el intento' })
  @Column({ type: 'varchar', length: 255 })
  email: string;

  @ApiProperty({ description: 'Direccion IP' })
  @Column({ type: 'varchar', length: 45 })
  ipAddress: string;

  @ApiProperty({ description: 'User Agent del navegador' })
  @Column({ type: 'text', nullable: true })
  userAgent: string | null;

  @ApiProperty({ description: 'Si el intento fue exitoso' })
  @Column({ type: 'boolean' })
  success: boolean;

  @ApiProperty({ description: 'Razon del fallo', enum: LoginFailureReason })
  @Column({ type: 'varchar', length: 50, nullable: true })
  failureReason: LoginFailureReason | null;

  @ApiProperty({ description: 'ID del usuario si existe' })
  @Column({ type: 'uuid', nullable: true })
  userId: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'userId' })
  user: User | null;

  @CreateDateColumn()
  createdAt: Date;

  constructor(partial: Partial<LoginAttempt>) {
    Object.assign(this, partial);
  }
}
