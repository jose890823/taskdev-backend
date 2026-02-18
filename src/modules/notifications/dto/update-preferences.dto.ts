import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsBoolean,
  IsString,
  IsIn,
  Matches,
} from 'class-validator';

/**
 * DTO para actualizar preferencias de notificación
 */
export class UpdatePreferencesDto {
  // ============================================
  // CANALES GLOBALES
  // ============================================

  @ApiPropertyOptional({
    example: true,
    description: 'Recibir notificaciones por email',
  })
  @IsOptional()
  @IsBoolean()
  emailEnabled?: boolean;

  @ApiPropertyOptional({
    example: true,
    description: 'Recibir notificaciones in-app',
  })
  @IsOptional()
  @IsBoolean()
  inAppEnabled?: boolean;

  @ApiPropertyOptional({
    example: false,
    description: 'Recibir notificaciones push',
  })
  @IsOptional()
  @IsBoolean()
  pushEnabled?: boolean;

  @ApiPropertyOptional({
    example: false,
    description: 'Recibir notificaciones por SMS',
  })
  @IsOptional()
  @IsBoolean()
  smsEnabled?: boolean;

  // ============================================
  // PREFERENCIAS POR CATEGORÍA - EMAIL
  // ============================================

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  emailEnrollments?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  emailPayments?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  emailEvaluations?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  emailCertificates?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  emailWorkshops?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  emailProgress?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  emailAnnouncements?: boolean;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  emailMarketing?: boolean;

  // ============================================
  // PREFERENCIAS POR CATEGORÍA - IN-APP
  // ============================================

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  inAppEnrollments?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  inAppPayments?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  inAppEvaluations?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  inAppCertificates?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  inAppWorkshops?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  inAppProgress?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  inAppAnnouncements?: boolean;

  // ============================================
  // FRECUENCIA
  // ============================================

  @ApiPropertyOptional({
    example: 'instant',
    description: 'Frecuencia de emails: instant, daily, weekly',
  })
  @IsOptional()
  @IsIn(['instant', 'daily', 'weekly'])
  emailFrequency?: 'instant' | 'daily' | 'weekly';

  @ApiPropertyOptional({
    example: '09:00',
    description: 'Hora preferida para digest (HH:mm)',
  })
  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: 'Formato de hora inválido. Use HH:mm',
  })
  digestTime?: string;

  @ApiPropertyOptional({
    example: 'America/New_York',
    description: 'Zona horaria',
  })
  @IsOptional()
  @IsString()
  timezone?: string;

  // ============================================
  // QUIET HOURS
  // ============================================

  @ApiPropertyOptional({
    example: false,
    description: 'Activar horas silenciosas',
  })
  @IsOptional()
  @IsBoolean()
  quietHoursEnabled?: boolean;

  @ApiPropertyOptional({
    example: '22:00',
    description: 'Inicio de horas silenciosas (HH:mm)',
  })
  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/)
  quietHoursStart?: string;

  @ApiPropertyOptional({
    example: '08:00',
    description: 'Fin de horas silenciosas (HH:mm)',
  })
  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/)
  quietHoursEnd?: string;
}
