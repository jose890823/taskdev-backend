import { ApiProperty } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  IsDateString,
  MaxLength,
  MinLength,
  Matches,
} from 'class-validator';

/**
 * DTO for updating user profile
 */
export class UpdateProfileDto {
  @ApiProperty({
    example: 'Juan',
    description: 'Nombre del usuario',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  firstName?: string;

  @ApiProperty({
    example: 'Pérez',
    description: 'Apellido del usuario',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  lastName?: string;

  @ApiProperty({
    example: '+1234567890',
    description: 'Teléfono en formato internacional',
    required: false,
  })
  @IsOptional()
  @IsString()
  @Matches(/^\+[1-9]\d{1,14}$/, {
    message: 'Phone must be in E.164 format (e.g., +1234567890)',
  })
  phone?: string;

  @ApiProperty({
    example: '123 Main Street, Apt 4B',
    description: 'Dirección completa',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string;

  @ApiProperty({
    example: 'Miami',
    description: 'Ciudad',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;

  @ApiProperty({
    example: 'Florida',
    description: 'Estado/Provincia',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  state?: string;

  @ApiProperty({
    example: '33166',
    description: 'Código postal',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  zipCode?: string;

  @ApiProperty({
    example: 'United States',
    description: 'País',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  country?: string;

  @ApiProperty({
    example: '1990-05-15',
    description: 'Fecha de nacimiento (YYYY-MM-DD)',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @ApiProperty({
    example: 'V-12345678',
    description: 'Número de identificación',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  identificationNumber?: string;
}
