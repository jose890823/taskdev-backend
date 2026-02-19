import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray, IsInt, IsOptional, IsUUID, Min, ValidateNested,
} from 'class-validator';

export class BulkPositionItemDto {
  @ApiProperty({ description: 'ID de la tarea', example: 'uuid-here' })
  @IsUUID('4', { message: 'El id debe ser un UUID valido' })
  id: string;

  @ApiProperty({ description: 'Nueva posicion', example: 0 })
  @IsInt({ message: 'La posicion debe ser un entero' })
  @Min(0)
  position: number;

  @ApiProperty({ description: 'Nuevo statusId (si cambio de columna)', required: false })
  @IsOptional()
  @IsUUID('4', { message: 'statusId debe ser un UUID valido' })
  statusId?: string;
}

export class BulkUpdatePositionsDto {
  @ApiProperty({ type: [BulkPositionItemDto], description: 'Lista de tareas con nuevas posiciones' })
  @IsArray({ message: 'items debe ser un arreglo' })
  @ValidateNested({ each: true })
  @Type(() => BulkPositionItemDto)
  items: BulkPositionItemDto[];
}
