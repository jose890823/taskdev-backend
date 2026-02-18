import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateProjectDto {
  @ApiProperty({ example: 'Mi Proyecto', description: 'Nombre del proyecto' })
  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  @IsString()
  @MaxLength(255)
  name: string;

  @ApiProperty({ example: 'Descripcion', required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: '#3b82f6', required: false })
  @IsOptional()
  @IsString()
  color?: string;

  @ApiProperty({ description: 'ID de organizacion (omitir para proyecto personal)', required: false })
  @IsOptional()
  @IsUUID('4', { message: 'organizationId debe ser UUID valido' })
  organizationId?: string;
}
