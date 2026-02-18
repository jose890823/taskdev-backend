import { ApiProperty } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  IsEnum,
  IsBoolean,
  MaxLength,
} from 'class-validator';
import type { TranslationLocale } from '../entities/translation.entity';
import { TranslationModule } from '../entities/translation.entity';

export class UpdateTranslationDto {
  @ApiProperty({
    example: 'errors.payment_failed',
    description: 'Clave unica de la traduccion',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'La clave debe ser una cadena de texto' })
  @MaxLength(255, { message: 'La clave no puede exceder 255 caracteres' })
  key?: string;

  @ApiProperty({
    example: 'es',
    description: 'Idioma de la traduccion',
    enum: ['es', 'en'],
    required: false,
  })
  @IsOptional()
  @IsEnum(['es', 'en'] as any, {
    message: 'El idioma debe ser uno de: es, en',
  })
  locale?: TranslationLocale;

  @ApiProperty({
    example: 'El pago ha fallado. Intente de nuevo.',
    description: 'Texto traducido actualizado',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'El valor debe ser una cadena de texto' })
  value?: string;

  @ApiProperty({
    example: 'errors',
    description: 'Modulo al que pertenece la traduccion',
    enum: TranslationModule,
    required: false,
  })
  @IsOptional()
  @IsEnum(TranslationModule, {
    message: `El modulo debe ser uno de: ${Object.values(TranslationModule).join(', ')}`,
  })
  module?: TranslationModule;

  @ApiProperty({
    example: 'Mensaje de error actualizado para fallos de pago',
    description: 'Contexto o pista para traductores',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'El contexto debe ser una cadena de texto' })
  @MaxLength(255, { message: 'El contexto no puede exceder 255 caracteres' })
  context?: string;

  @ApiProperty({
    example: false,
    description: 'Indica si es una traduccion del sistema',
    required: false,
  })
  @IsOptional()
  @IsBoolean({ message: 'El campo isSystem debe ser un valor booleano' })
  isSystem?: boolean;
}
