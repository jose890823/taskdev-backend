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
  // PREFERENCIAS POR CATEGORÍA - IN-APP
  // ============================================

  @ApiPropertyOptional({ example: true, description: 'Notificaciones de tareas' })
  @IsOptional()
  @IsBoolean()
  inAppTasks?: boolean;

  @ApiPropertyOptional({ example: true, description: 'Notificaciones de proyectos' })
  @IsOptional()
  @IsBoolean()
  inAppProjects?: boolean;

  @ApiPropertyOptional({ example: true, description: 'Notificaciones de organizaciones' })
  @IsOptional()
  @IsBoolean()
  inAppOrganizations?: boolean;

  @ApiPropertyOptional({ example: true, description: 'Notificaciones de anuncios' })
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
