import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MinLength, Matches } from 'class-validator';

export class ConfirmChangePasswordDto {
  @ApiProperty({
    example: '123456',
    description: 'Código OTP de 6 dígitos enviado al email',
    minLength: 6,
    maxLength: 6,
  })
  @IsNotEmpty({ message: 'El código OTP es obligatorio' })
  @IsString({ message: 'El código OTP debe ser una cadena de texto' })
  @MinLength(6, { message: 'El código OTP debe tener 6 dígitos' })
  otpCode: string;

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
