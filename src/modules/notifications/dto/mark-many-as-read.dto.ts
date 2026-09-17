import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsUUID, ArrayMaxSize, ArrayMinSize } from 'class-validator';

export class MarkManyAsReadDto {
  @ApiProperty({
    example: ['550e8400-e29b-41d4-a716-446655440000'],
    description: 'IDs de notificaciones a marcar como leídas (máximo 100)',
    type: [String],
  })
  @IsArray({ message: 'ids debe ser un arreglo' })
  @ArrayMinSize(1, { message: 'Se requiere al menos un ID' })
  @ArrayMaxSize(100, { message: 'Máximo 100 IDs por solicitud' })
  @IsUUID('4', { each: true, message: 'Cada ID debe ser un UUID válido' })
  ids: string[];
}
