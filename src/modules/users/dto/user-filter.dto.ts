import { ApiProperty } from '@nestjs/swagger';
import {
  IsOptional,
  IsEnum,
  IsBoolean,
  IsInt,
  Min,
  Max,
  IsString,
  IsUUID,
} from 'class-validator';
import { Type } from 'class-transformer';
import { UserRole } from '../../auth/entities/user.entity';

/**
 * DTO for filtering users (admin)
 */
export class UserFilterDto {
  @ApiProperty({
    example: 'juan',
    description: 'Buscar por nombre o email',
    required: false,
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiProperty({
    description: 'Filtrar por negocio',
    required: false,
  })
  @IsOptional()
  @IsUUID()
  businessId?: string;

  @ApiProperty({
    example: 'client',
    description: 'Filtrar por rol',
    enum: UserRole,
    required: false,
  })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @ApiProperty({
    example: true,
    description: 'Filtrar por usuarios activos',
    required: false,
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isActive?: boolean;

  @ApiProperty({
    example: true,
    description: 'Filtrar por email verificado',
    required: false,
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  emailVerified?: boolean;

  @ApiProperty({
    example: true,
    description: 'Filtrar por teléfono verificado',
    required: false,
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  phoneVerified?: boolean;

  @ApiProperty({
    example: 1,
    description: 'Número de página',
    required: false,
    default: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiProperty({
    example: 20,
    description: 'Registros por página',
    required: false,
    default: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiProperty({
    example: 'createdAt',
    description: 'Campo de ordenamiento',
    required: false,
    default: 'createdAt',
  })
  @IsOptional()
  sortBy?: string = 'createdAt';

  @ApiProperty({
    example: 'DESC',
    description: 'Dirección de ordenamiento',
    required: false,
    default: 'DESC',
  })
  @IsOptional()
  sortOrder?: 'ASC' | 'DESC' = 'DESC';
}
