import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MinLength, Matches } from 'class-validator';

export class ChangePasswordDto {
  @ApiProperty({
    example: 'OldP@ssw0rd123!',
    description: 'Contraseña actual del usuario',
  })
  @IsNotEmpty({ message: 'La contraseña actual es obligatoria' })
  @IsString({ message: 'La contraseña debe ser una cadena de texto' })
  oldPassword: string;

  @ApiProperty({
    example: 'NewP@ssw0rd123!',
    description:
      'Nueva contraseña (mínimo 8 caracteres, debe incluir mayúsculas, minúsculas, números y símbolos)',
    minLength: 8,
  })
  @IsNotEmpty({ message: 'La nueva contraseña es obligatoria' })
  @IsString({ message: 'La contraseña debe ser una cadena de texto' })
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d\s]).+$/, {
    message:
      'La contraseña debe contener al menos una mayúscula, una minúscula, un número y un carácter especial',
  })
  newPassword: string;
}
