import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class RequestChangePasswordDto {
  @ApiProperty({
    example: 'OldP@ssw0rd123!',
    description: 'Contraseña actual del usuario para verificar identidad',
  })
  @IsNotEmpty({ message: 'La contraseña actual es obligatoria' })
  @IsString({ message: 'La contraseña debe ser una cadena de texto' })
  oldPassword: string;
}
