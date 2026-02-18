import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsInt, Min, Max, IsString, IsEnum, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';

export enum SortOrder {
  ASC = 'ASC',
  DESC = 'DESC',
}

export class PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Filtrar por negocio (usado por super_admin)' })
  @IsOptional()
  @IsUUID()
  businessId?: string;
  @ApiPropertyOptional({ example: 1, description: 'Numero de pagina', minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'La pagina debe ser un numero entero' })
  @Min(1, { message: 'La pagina minima es 1' })
  page?: number = 1;

  @ApiPropertyOptional({ example: 20, description: 'Registros por pagina', minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'El limite debe ser un numero entero' })
  @Min(1, { message: 'El limite minimo es 1' })
  @Max(100, { message: 'El limite maximo es 100' })
  limit?: number = 20;

  @ApiPropertyOptional({ description: 'Texto de busqueda general' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Campo por el cual ordenar' })
  @IsOptional()
  @IsString()
  sortBy?: string;

  @ApiPropertyOptional({ enum: SortOrder, description: 'Direccion del ordenamiento' })
  @IsOptional()
  @IsEnum(SortOrder, { message: 'sortOrder debe ser ASC o DESC' })
  sortOrder?: SortOrder = SortOrder.DESC;
}
