import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsUUID,
  IsOptional,
  IsString,
  IsEnum,
  IsUrl,
  MaxLength,
} from 'class-validator';
import {
  NotificationType,
  NotificationChannel,
  NotificationPriority,
} from '../entities/notification.entity';

/**
 * DTO para crear una notificación
 */
export class CreateNotificationDto {
  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'ID del usuario destinatario',
  })
  @IsNotEmpty({ message: 'El ID del usuario es obligatorio' })
  @IsUUID('4', { message: 'El ID debe ser un UUID válido' })
  userId: string;

  @ApiProperty({
    example: 'enrollment_confirmed',
    description: 'Tipo de notificación',
    enum: NotificationType,
  })
  @IsNotEmpty({ message: 'El tipo de notificación es obligatorio' })
  @IsEnum(NotificationType, { message: 'Tipo de notificación no válido' })
  type: NotificationType;

  @ApiProperty({
    example: 'Inscripción confirmada',
    description: 'Título de la notificación',
  })
  @IsNotEmpty({ message: 'El título es obligatorio' })
  @IsString()
  @MaxLength(255, { message: 'El título no puede exceder 255 caracteres' })
  title: string;

  @ApiProperty({
    example: 'Tu inscripción al curso ha sido confirmada exitosamente.',
    description: 'Mensaje de la notificación',
  })
  @IsNotEmpty({ message: 'El mensaje es obligatorio' })
  @IsString()
  message: string;

  @ApiPropertyOptional({
    example: 'in_app',
    description: 'Canal de entrega',
    enum: NotificationChannel,
  })
  @IsOptional()
  @IsEnum(NotificationChannel)
  channel?: NotificationChannel;

  @ApiPropertyOptional({
    example: 'normal',
    description: 'Prioridad',
    enum: NotificationPriority,
  })
  @IsOptional()
  @IsEnum(NotificationPriority)
  priority?: NotificationPriority;

  @ApiPropertyOptional({
    example: '/products/example-product',
    description: 'URL de acción',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  actionUrl?: string;

  @ApiPropertyOptional({
    example: 'Ver curso',
    description: 'Texto del botón de acción',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  actionText?: string;

  @ApiPropertyOptional({
    example: 'graduation-cap',
    description: 'Icono de la notificación',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  icon?: string;

  @ApiPropertyOptional({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'ID de la entidad relacionada',
  })
  @IsOptional()
  @IsUUID('4')
  referenceId?: string;

  @ApiPropertyOptional({
    example: 'enrollment',
    description: 'Tipo de entidad relacionada',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  referenceType?: string;

  @ApiPropertyOptional({
    description: 'Metadata adicional',
  })
  @IsOptional()
  metadata?: Record<string, any>;
}
