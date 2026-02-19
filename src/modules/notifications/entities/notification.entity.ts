import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  BeforeInsert,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { generateSystemCode } from '../../../common/utils/system-code-generator.util';
import { User } from '../../auth/entities/user.entity';

/**
 * Tipo de notificación
 */
export enum NotificationType {
  // Tareas
  TASK_ASSIGNED = 'task_assigned',
  TASK_UNASSIGNED = 'task_unassigned',
  TASK_STATUS_CHANGED = 'task_status_changed',
  TASK_COMPLETED = 'task_completed',
  TASK_COMMENTED = 'task_commented',
  TASK_DUE_SOON = 'task_due_soon',
  SUBTASK_CREATED = 'subtask_created',

  // Proyectos
  PROJECT_MEMBER_ADDED = 'project_member_added',
  PROJECT_MEMBER_REMOVED = 'project_member_removed',

  // Organizaciones
  ORG_MEMBER_ADDED = 'org_member_added',
  ORG_INVITATION_RECEIVED = 'org_invitation_received',

  // Sistema
  SYSTEM_ANNOUNCEMENT = 'system_announcement',
  ACCOUNT_SECURITY = 'account_security',
  PASSWORD_CHANGED = 'password_changed',
  WELCOME = 'welcome',
  CUSTOM = 'custom',
}

/**
 * Canal de entrega de la notificación
 */
export enum NotificationChannel {
  IN_APP = 'in_app',
  EMAIL = 'email',
  SMS = 'sms',
  PUSH = 'push',
}

/**
 * Prioridad de la notificación
 */
export enum NotificationPriority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  URGENT = 'urgent',
}

/**
 * Estado de la notificación
 */
export enum NotificationStatus {
  PENDING = 'pending',
  SENT = 'sent',
  DELIVERED = 'delivered',
  READ = 'read',
  FAILED = 'failed',
}

/**
 * Notificación enviada a un usuario
 */
@Entity('notifications')
@Index(['userId'])
@Index(['type'])
@Index(['status'])
@Index(['isRead'])
@Index(['createdAt'])
@Index(['userId', 'isRead'])
export class Notification {
  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'ID único de la notificación',
  })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({
    example: 'NTF-260206-A3K7',
    description: 'Codigo unico legible del sistema',
  })
  @Column({ type: 'varchar', length: 20, unique: true, nullable: true })
  systemCode: string;

  @BeforeInsert()
  generateSystemCode() {
    if (!this.systemCode) {
      this.systemCode = generateSystemCode('Notification');
    }
  }

  // ============================================
  // USUARIO DESTINATARIO
  // ============================================

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'uuid' })
  userId: string;

  // ============================================
  // TIPO Y CANAL
  // ============================================

  @ApiProperty({
    example: 'task_assigned',
    description: 'Tipo de notificación',
    enum: NotificationType,
  })
  @Column({ type: 'varchar', length: 50 })
  type: NotificationType;

  @ApiProperty({
    example: 'in_app',
    description: 'Canal de entrega',
    enum: NotificationChannel,
  })
  @Column({
    type: 'enum',
    enum: NotificationChannel,
    default: NotificationChannel.IN_APP,
  })
  channel: NotificationChannel;

  @ApiProperty({
    example: 'normal',
    description: 'Prioridad',
    enum: NotificationPriority,
  })
  @Column({
    type: 'enum',
    enum: NotificationPriority,
    default: NotificationPriority.NORMAL,
  })
  priority: NotificationPriority;

  @ApiProperty({
    example: 'sent',
    description: 'Estado de la notificación',
    enum: NotificationStatus,
  })
  @Column({
    type: 'enum',
    enum: NotificationStatus,
    default: NotificationStatus.PENDING,
  })
  status: NotificationStatus;

  // ============================================
  // CONTENIDO
  // ============================================

  @ApiProperty({
    example: 'Tarea asignada',
    description: 'Título de la notificación',
  })
  @Column({ type: 'varchar', length: 255 })
  title: string;

  @ApiProperty({
    example: 'Juan te asigno la tarea "Disenar landing page"',
    description: 'Mensaje de la notificación',
  })
  @Column({ type: 'text' })
  message: string;

  @ApiProperty({
    example: '/tasks/550e8400-e29b-41d4-a716-446655440000',
    description: 'URL de acción (opcional)',
    required: false,
  })
  @Column({ type: 'varchar', length: 500, nullable: true })
  actionUrl: string | null;

  @ApiProperty({
    example: 'Ver tarea',
    description: 'Texto del botón de acción',
    required: false,
  })
  @Column({ type: 'varchar', length: 100, nullable: true })
  actionText: string | null;

  @ApiProperty({
    example: 'clipboard-check',
    description: 'Icono de la notificación (nombre del icono)',
    required: false,
  })
  @Column({ type: 'varchar', length: 50, nullable: true })
  icon: string | null;

  // ============================================
  // ESTADO DE LECTURA
  // ============================================

  @ApiProperty({
    example: false,
    description: 'Si la notificación ha sido leída',
  })
  @Column({ type: 'boolean', default: false })
  isRead: boolean;

  @ApiProperty({
    example: '2026-02-05T10:00:00.000Z',
    description: 'Fecha de lectura',
    required: false,
  })
  @Column({ type: 'timestamp', nullable: true })
  readAt: Date | null;

  // ============================================
  // ENTREGA
  // ============================================

  @ApiProperty({
    example: '2026-02-05T10:00:00.000Z',
    description: 'Fecha de envío',
    required: false,
  })
  @Column({ type: 'timestamp', nullable: true })
  sentAt: Date | null;

  @ApiProperty({
    example: '2026-02-05T10:00:05.000Z',
    description: 'Fecha de entrega confirmada',
    required: false,
  })
  @Column({ type: 'timestamp', nullable: true })
  deliveredAt: Date | null;

  @ApiProperty({
    example: 'Email bounced',
    description: 'Razón de fallo (si aplica)',
    required: false,
  })
  @Column({ type: 'text', nullable: true })
  failureReason: string | null;

  @ApiProperty({
    example: 0,
    description: 'Número de reintentos',
  })
  @Column({ type: 'int', default: 0 })
  retryCount: number;

  // ============================================
  // METADATA Y REFERENCIA
  // ============================================

  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'ID de la entidad relacionada (task, project, etc.)',
    required: false,
  })
  @Column({ type: 'uuid', nullable: true })
  referenceId: string | null;

  @ApiProperty({
    example: 'task',
    description: 'Tipo de entidad relacionada',
    required: false,
  })
  @Column({ type: 'varchar', length: 50, nullable: true })
  referenceType: string | null;

  @ApiProperty({
    description: 'Metadata adicional',
    required: false,
  })
  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any> | null;

  // ============================================
  // EXPIRACIÓN
  // ============================================

  @ApiProperty({
    example: '2026-02-12T10:00:00.000Z',
    description: 'Fecha de expiración de la notificación',
    required: false,
  })
  @Column({ type: 'timestamp', nullable: true })
  expiresAt: Date | null;

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

  constructor(partial: Partial<Notification>) {
    Object.assign(this, partial);
  }

  // ============================================
  // MÉTODOS HELPER
  // ============================================

  /**
   * Verifica si la notificación ha expirado
   */
  get isExpired(): boolean {
    if (!this.expiresAt) return false;
    return new Date() > new Date(this.expiresAt);
  }

  /**
   * Marca como leída
   */
  markAsRead(): void {
    this.isRead = true;
    this.readAt = new Date();
    this.status = NotificationStatus.READ;
  }
}
