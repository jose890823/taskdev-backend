import { ApiProperty } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  IsEnum,
  IsBoolean,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import type {
  TranslationLocale,
  TranslationModule,
} from '../entities/translation.entity';

export class TranslationFilterDto {
  @ApiProperty({
    example: 'errors.user',
    description: 'Busqueda parcial por clave de traduccion',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'La clave debe ser una cadena de texto' })
  key?: string;

  @ApiProperty({
    example: 'es',
    description: 'Filtrar por idioma',
    enum: ['es', 'en'],
    required: false,
  })
  @IsOptional()
  @IsEnum(['es', 'en'] as any, {
    message: 'El idioma debe ser uno de: es, en',
  })
  locale?: TranslationLocale;

  @ApiProperty({
    example: 'errors',
    description: 'Filtrar por modulo',
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
    required: false,
  })
  @IsOptional()
  @IsEnum(
    [
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
    ] as any,
    {
      message:
        'El modulo debe ser uno de: auth, users, stores, products, orders, cart, payments, shipping, notifications, coupons, reviews, disputes, wishlist, commissions, common, errors, emails',
    },
  )
  module?: TranslationModule;

  @ApiProperty({
    example: 'usuario',
    description: 'Busqueda parcial en el valor de la traduccion',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'El valor debe ser una cadena de texto' })
  search?: string;

  @ApiProperty({
    example: true,
    description: 'Filtrar por traducciones del sistema',
    required: false,
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  @IsBoolean({
    message: 'El filtro isSystem debe ser un valor booleano',
  })
  isSystem?: boolean;

  @ApiProperty({
    example: 1,
    description: 'Numero de pagina',
    required: false,
    default: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'La pagina debe ser un numero entero' })
  @Min(1, { message: 'La pagina minima es 1' })
  page?: number;

  @ApiProperty({
    example: 20,
    description: 'Cantidad de resultados por pagina',
    required: false,
    default: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'El limite debe ser un numero entero' })
  @Min(1, { message: 'El limite minimo es 1' })
  @Max(100, { message: 'El limite maximo es 100' })
  limit?: number;
}
