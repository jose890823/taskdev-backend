import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsArray,
  IsObject,
  MaxLength,
  Matches,
} from 'class-validator';

export class CreateFeatureFlagDto {
  @ApiProperty({
    example: 'michambita.content_generation',
    description:
      'Clave única del feature flag (formato: módulo.funcionalidad, solo letras minúsculas, números, puntos y guiones bajos)',
  })
  @IsNotEmpty({ message: 'La clave del feature flag es obligatoria' })
  @IsString({ message: 'La clave debe ser una cadena de texto' })
  @MaxLength(100, { message: 'La clave no puede exceder 100 caracteres' })
  @Matches(/^[a-z0-9._]+$/, {
    message:
      'La clave solo puede contener letras minúsculas, números, puntos y guiones bajos',
  })
  key: string;

  @ApiProperty({
    example: 'Multi-vendedor',
    description: 'Nombre legible del feature flag',
  })
  @IsNotEmpty({ message: 'El nombre del feature flag es obligatorio' })
  @IsString({ message: 'El nombre debe ser una cadena de texto' })
  @MaxLength(255, { message: 'El nombre no puede exceder 255 caracteres' })
  name: string;

  @ApiProperty({
    example: 'Habilita el soporte para múltiples vendedores en la plataforma',
    description: 'Descripción detallada del feature flag',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'La descripción debe ser una cadena de texto' })
  description?: string;

  @ApiProperty({
    example: false,
    description: 'Indica si el feature flag está habilitado globalmente',
    required: false,
    default: false,
  })
  @IsOptional()
  @IsBoolean({ message: 'El campo isEnabled debe ser un valor booleano' })
  isEnabled?: boolean;

  @ApiProperty({
    example: ['admin', 'client'],
    description: 'Roles para los cuales el feature flag está habilitado',
    required: false,
    type: [String],
  })
  @IsOptional()
  @IsArray({ message: 'enabledForRoles debe ser un arreglo de cadenas' })
  @IsString({ each: true, message: 'Cada rol debe ser una cadena de texto' })
  enabledForRoles?: string[];

  @ApiProperty({
    example: ['550e8400-e29b-41d4-a716-446655440000'],
    description:
      'IDs de tiendas para las cuales el feature flag está habilitado',
    required: false,
    type: [String],
  })
  @IsOptional()
  @IsArray({ message: 'enabledForStores debe ser un arreglo de cadenas' })
  @IsString({
    each: true,
    message: 'Cada ID de tienda debe ser una cadena de texto',
  })
  enabledForStores?: string[];

  @ApiProperty({
    example: { maxProducts: 100, trialDays: 30 },
    description: 'Configuración adicional en formato JSON',
    required: false,
  })
  @IsOptional()
  @IsObject({ message: 'El campo config debe ser un objeto JSON válido' })
  config?: Record<string, any>;

  @ApiProperty({
    example: 'michambita.daily_ideas',
    description: 'Clave de otro feature flag del cual depende',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'dependsOn debe ser una cadena de texto' })
  @MaxLength(100, {
    message: 'dependsOn no puede exceder 100 caracteres',
  })
  dependsOn?: string;
}
