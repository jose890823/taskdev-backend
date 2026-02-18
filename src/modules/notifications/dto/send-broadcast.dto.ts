import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsEnum,
  IsArray,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { NotificationPriority } from '../entities/notification.entity';

/**
 * Audiencia del broadcast
 */
export enum BroadcastAudience {
  ALL_USERS = 'all_users',
  ALL_OWNERS = 'all_owners',
  ALL_EMPLOYEES = 'all_employees',
  BUSINESS_MEMBERS = 'business_members',
  SPECIFIC_USERS = 'specific_users',
}

/**
 * DTO para enviar notificación masiva
 */
export class SendBroadcastDto {
  @ApiProperty({
    example: 'Mantenimiento programado',
    description: 'Título del anuncio',
  })
  @IsNotEmpty({ message: 'El título es obligatorio' })
  @IsString()
  @MaxLength(255)
  title: string;

  @ApiProperty({
    example: 'El sistema estará en mantenimiento el día...',
    description: 'Mensaje del anuncio',
  })
  @IsNotEmpty({ message: 'El mensaje es obligatorio' })
  @IsString()
  message: string;

  @ApiProperty({
    example: 'all_users',
    description: 'Audiencia del broadcast',
    enum: BroadcastAudience,
  })
  @IsNotEmpty()
  @IsEnum(BroadcastAudience)
  audience: BroadcastAudience;

  @ApiPropertyOptional({
    example: ['uuid1', 'uuid2'],
    description: 'IDs de usuarios (si audience es specific_users)',
  })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  userIds?: string[];

  @ApiPropertyOptional({
    example: 'high',
    description: 'Prioridad del mensaje',
    enum: NotificationPriority,
  })
  @IsOptional()
  @IsEnum(NotificationPriority)
  priority?: NotificationPriority;

  @ApiPropertyOptional({
    example: '/announcements/123',
    description: 'URL de acción',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  actionUrl?: string;

  @ApiPropertyOptional({
    example: 'Más información',
    description: 'Texto del botón de acción',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  actionText?: string;

  @ApiPropertyOptional({
    example: true,
    description: 'Enviar también por email',
  })
  @IsOptional()
  sendEmail?: boolean;
}
