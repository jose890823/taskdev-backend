import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty } from 'class-validator';

/**
 * DTO para actualizar configuración de evento de notificación
 */
export class UpdateEventConfigDto {
  @ApiProperty({
    example: true,
    description: 'Si el evento está habilitado',
  })
  @IsNotEmpty({ message: 'El campo isEnabled es obligatorio' })
  @IsBoolean({ message: 'isEnabled debe ser un booleano' })
  isEnabled: boolean;
}
