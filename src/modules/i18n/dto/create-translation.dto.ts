import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsEnum,
  IsBoolean,
  MaxLength,
} from 'class-validator';
import {
  TranslationLocale,
  TranslationModule,
} from '../entities/translation.entity';

export class CreateTranslationDto {
  @ApiProperty({
    example: 'errors.payment_failed',
    description: 'Clave unica de la traduccion (formato: modulo.clave)',
  })
  @IsNotEmpty({ message: 'La clave de la traduccion es obligatoria' })
  @IsString({ message: 'La clave debe ser una cadena de texto' })
  @MaxLength(255, { message: 'La clave no puede exceder 255 caracteres' })
  key: string;

  @ApiProperty({
    example: 'es',
    description: 'Idioma de la traduccion',
    enum: TranslationLocale,
  })
  @IsNotEmpty({ message: 'El idioma es obligatorio' })
  @IsEnum(TranslationLocale, {
    message: 'El idioma debe ser uno de: es, en',
  })
  locale: TranslationLocale;

  @ApiProperty({
    example: 'El pago ha fallado',
    description: 'Texto traducido. Soporta placeholders con {{param}}',
  })
  @IsNotEmpty({ message: 'El valor de la traduccion es obligatorio' })
  @IsString({ message: 'El valor debe ser una cadena de texto' })
  value: string;

  @ApiProperty({
    example: 'errors',
    description: 'Modulo al que pertenece la traduccion',
    enum: TranslationModule,
    required: false,
    default: 'common',
  })
  @IsOptional()
  @IsEnum(TranslationModule, {
    message: `El modulo debe ser uno de: ${Object.values(TranslationModule).join(', ')}`,
  })
  module?: TranslationModule;

  @ApiProperty({
    example: 'Mensaje de error cuando falla un pago con Stripe',
    description: 'Contexto o pista para traductores',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'El contexto debe ser una cadena de texto' })
  @MaxLength(255, { message: 'El contexto no puede exceder 255 caracteres' })
  context?: string;

  @ApiProperty({
    example: false,
    description:
      'Indica si es una traduccion del sistema (protegida contra eliminacion)',
    required: false,
    default: false,
  })
  @IsOptional()
  @IsBoolean({ message: 'El campo isSystem debe ser un valor booleano' })
  isSystem?: boolean;
}
