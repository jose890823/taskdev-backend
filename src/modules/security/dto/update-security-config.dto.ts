import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsOptional, IsEnum } from 'class-validator';

export class UpdateSecurityConfigDto {
  @ApiProperty({
    example: 'rate_limit_login',
    description: 'Clave de la configuracion',
  })
  @IsNotEmpty({ message: 'La clave es obligatoria' })
  @IsString()
  key: string;

  @ApiProperty({
    example: '10',
    description: 'Nuevo valor de la configuracion',
  })
  @IsNotEmpty({ message: 'El valor es obligatorio' })
  @IsString()
  value: string;
}

export class CreateSecurityConfigDto {
  @ApiProperty({
    example: 'custom_config',
    description: 'Clave de la configuracion',
  })
  @IsNotEmpty({ message: 'La clave es obligatoria' })
  @IsString()
  key: string;

  @ApiProperty({
    example: 'valor',
    description: 'Valor de la configuracion',
  })
  @IsNotEmpty({ message: 'El valor es obligatorio' })
  @IsString()
  value: string;

  @ApiProperty({
    example: 'string',
    description: 'Tipo de dato',
    enum: ['string', 'number', 'boolean', 'json'],
  })
  @IsOptional()
  @IsEnum(['string', 'number', 'boolean', 'json'])
  valueType?: 'string' | 'number' | 'boolean' | 'json' = 'string';

  @ApiProperty({
    example: 'Descripcion de la configuracion',
    description: 'Descripcion',
  })
  @IsNotEmpty({ message: 'La descripcion es obligatoria' })
  @IsString()
  description: string;

  @ApiProperty({
    example: 'general',
    description: 'Categoria',
  })
  @IsOptional()
  @IsString()
  category?: string = 'general';
}
