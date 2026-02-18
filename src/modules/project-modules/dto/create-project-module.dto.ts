import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateProjectModuleDto {
  @ApiProperty({ example: 'Frontend', description: 'Nombre del modulo' })
  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  @IsString()
  @MaxLength(255)
  name: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: '#8b5cf6', required: false })
  @IsOptional()
  @IsString()
  color?: string;
}
