import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

/**
 * DTO para invalidar cache por prefijo
 */
export class InvalidateCacheDto {
  @ApiProperty({
    example: 'products:',
    description:
      'Prefijo de las claves a invalidar. Ejemplo: "products:", "categories:", "stores:"',
  })
  @IsNotEmpty({ message: 'El prefijo es obligatorio' })
  @IsString({ message: 'El prefijo debe ser una cadena de texto' })
  prefix: string;
}
