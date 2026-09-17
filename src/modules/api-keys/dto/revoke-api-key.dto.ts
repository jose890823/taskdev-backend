import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class RevokeApiKeyDto {
  @ApiPropertyOptional({
    example: 'Credential compromised',
    description: 'Safe reason recorded in the security audit event',
  })
  @IsOptional()
  @IsString({ message: 'La razon debe ser una cadena de texto' })
  @MaxLength(255, { message: 'La razon no puede superar 255 caracteres' })
  reason?: string;
}
