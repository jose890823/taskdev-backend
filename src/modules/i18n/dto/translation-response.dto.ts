import { ApiProperty } from '@nestjs/swagger';
import type {
  TranslationLocale,
  TranslationModule,
} from '../entities/translation.entity';

export class TranslationResponseDto {
  @ApiProperty({
    example: '123e4567-e89b-12d3-a456-426614174000',
    description: 'ID unico de la traduccion',
  })
  id: string;

  @ApiProperty({
    example: 'TRN-260207-A3K7',
    description: 'Codigo unico legible del sistema',
  })
  systemCode: string;

  @ApiProperty({
    example: 'errors.user_not_found',
    description: 'Clave unica de la traduccion',
  })
  key: string;

  @ApiProperty({
    example: 'es',
    description: 'Idioma de la traduccion',
    enum: ['es', 'en'],
  })
  locale: TranslationLocale;

  @ApiProperty({
    example: 'Usuario no encontrado',
    description: 'Texto traducido',
  })
  value: string;

  @ApiProperty({
    example: 'errors',
    description: 'Modulo al que pertenece la traduccion',
    enum: [
      'auth',
      'users',
      'stores',
      'products',
      'orders',
      'cart',
      'payments',
      'shipping',
      'notifications',
      'coupons',
      'reviews',
      'disputes',
      'wishlist',
      'commissions',
      'common',
      'errors',
      'emails',
    ],
  })
  module: TranslationModule;

  @ApiProperty({
    example: 'Mensaje cuando no se encuentra un usuario',
    description: 'Contexto o pista para traductores',
    required: false,
  })
  context: string | null;

  @ApiProperty({
    example: true,
    description: 'Indica si es una traduccion del sistema',
  })
  isSystem: boolean;

  @ApiProperty({
    example: '2026-02-07T10:00:00.000Z',
    description: 'Fecha de creacion',
  })
  createdAt: Date;

  @ApiProperty({
    example: '2026-02-07T10:00:00.000Z',
    description: 'Fecha de ultima actualizacion',
  })
  updatedAt: Date;
}
