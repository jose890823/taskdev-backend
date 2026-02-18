import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsInt, Min, Max } from 'class-validator';

export class RetryWebhookDto {
  @ApiProperty({
    example: 3,
    description:
      'Numero maximo de intentos adicionales permitidos (opcional, por defecto mantiene el actual)',
    required: false,
  })
  @IsOptional()
  @IsInt({ message: 'El numero maximo de intentos debe ser un entero' })
  @Min(1, { message: 'El numero maximo de intentos debe ser al menos 1' })
  @Max(10, { message: 'El numero maximo de intentos no puede superar 10' })
  maxAttempts?: number;
}
