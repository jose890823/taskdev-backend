import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import {
  API_KEY_EXPIRATION_PRESETS,
  API_KEY_SCOPES,
  MAX_API_KEY_SCOPES,
} from '../api-key.constants';

export class CreateApiKeyDto {
  @ApiProperty({ example: 'CI automation', description: 'Key display name' })
  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  @IsString({ message: 'El nombre debe ser una cadena de texto' })
  name: string;

  @ApiProperty({
    example: '123e4567-e89b-12d3-a456-426614174000',
    description: 'Exactly one bound project ID',
  })
  @IsUUID('4', { message: 'El proyecto debe ser un UUID valido' })
  projectId: string;

  @ApiProperty({
    example: ['tasks:read'],
    enum: API_KEY_SCOPES,
    isArray: true,
    maxItems: MAX_API_KEY_SCOPES,
  })
  @ArrayMinSize(1, { message: 'Debe seleccionar al menos un scope' })
  @ArrayMaxSize(MAX_API_KEY_SCOPES, {
    message: `No se pueden seleccionar mas de ${MAX_API_KEY_SCOPES} scopes`,
  })
  @IsIn(API_KEY_SCOPES, {
    each: true,
    message: 'El scope seleccionado no esta permitido',
  })
  scopes: string[];

  @ApiProperty({
    example: 90,
    enum: API_KEY_EXPIRATION_PRESETS,
    description: 'Expiration preset in days',
  })
  @Type(() => Number)
  @IsIn(API_KEY_EXPIRATION_PRESETS, {
    message: 'La expiracion debe ser de 30, 90, 180 o 365 dias',
  })
  expirationDays: number;

  @ApiProperty({
    required: false,
    example: '123e4567-e89b-12d3-a456-426614174000',
    description: 'Owner ID; only superadmins may set a different owner',
  })
  @IsOptional()
  @IsUUID('4', { message: 'El propietario debe ser un UUID valido' })
  ownerId?: string;
}
