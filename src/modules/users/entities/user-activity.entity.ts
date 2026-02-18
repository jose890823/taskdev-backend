import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { User } from '../../auth/entities/user.entity';

export enum ActivityType {
  // Authentication activities
  LOGIN = 'login',
  LOGOUT = 'logout',
  PASSWORD_CHANGED = 'password_changed',
  PASSWORD_RESET = 'password_reset',
  EMAIL_VERIFIED = 'email_verified',
  PHONE_VERIFIED = 'phone_verified',

  // Profile activities
  PROFILE_UPDATED = 'profile_updated',
  PROFILE_PHOTO_UPLOADED = 'profile_photo_uploaded',
  PROFILE_PHOTO_DELETED = 'profile_photo_deleted',

  // Payment activities
  PAYMENT_COMPLETED = 'payment_completed',
  PAYMENT_FAILED = 'payment_failed',

  // Admin activities
  ROLE_CHANGED = 'role_changed',
  USER_ACTIVATED = 'user_activated',
  USER_DEACTIVATED = 'user_deactivated',
  USER_DELETED = 'user_deleted',

  // Other activities
  NOTIFICATION_SENT = 'notification_sent',
}

/**
 * User Activity Entity
 * Tracks all user actions for audit trail and activity history
 */
@Entity('user_activities')
@Index(['userId', 'createdAt'])
@Index(['activityType'])
@Index(['createdAt'])
export class UserActivity {
  @ApiProperty({
    example: '123e4567-e89b-12d3-a456-426614174000',
    description: 'Activity ID',
  })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({
    example: '123e4567-e89b-12d3-a456-426614174000',
    description: 'User ID',
  })
  @Column({ type: 'uuid' })
  @Index()
  userId: string;

  @ApiProperty({
    example: 'login',
    description: 'Type of activity',
    enum: ActivityType,
  })
  @Column({
    type: 'enum',
    enum: ActivityType,
  })
  activityType: ActivityType;

  @ApiProperty({
    example: 'User logged in successfully',
    description: 'Human-readable description of the activity',
  })
  @Column({ type: 'text' })
  description: string;

  @ApiProperty({
    example: '192.168.1.1',
    description: 'IP address from which the activity was performed',
    required: false,
  })
  @Column({ type: 'varchar', length: 45, nullable: true })
  ipAddress: string | null;

  @ApiProperty({
    example: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)...',
    description: 'User agent string',
    required: false,
  })
  @Column({ type: 'text', nullable: true })
  userAgent: string | null;

  @ApiProperty({
    example: { poaId: 'abc-123', status: 'approved' },
    description: 'Additional metadata about the activity',
    required: false,
  })
  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any> | null;

  @ApiProperty({
    example: '123e4567-e89b-12d3-a456-426614174000',
    description:
      'ID of the admin who performed the action (for admin activities)',
    required: false,
  })
  @Column({ type: 'uuid', nullable: true })
  performedBy: string | null;

  @ApiProperty({
    example: '2025-01-01T10:30:00.000Z',
    description: 'When the activity occurred',
  })
  @CreateDateColumn()
  createdAt: Date;

  // Relations
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'performedBy' })
  performer: User | null;

  constructor(partial: Partial<UserActivity>) {
    Object.assign(this, partial);
  }
}
