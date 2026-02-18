import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, Length } from 'class-validator';

export class VerifyEmailDto {
  @ApiProperty({
    example: 'juan.perez@example.com',
    description: 'Email del usuario a verificar',
  })
  @IsNotEmpty({ message: 'El email es obligatorio' })
  @IsEmail({}, { message: 'El email debe tener un formato válido' })
  email: string;

  @ApiProperty({
    example: '123456',
    description: 'Código OTP de 6 dígitos',
  })
  @IsNotEmpty({ message: 'El código OTP es obligatorio' })
  @IsString({ message: 'El código OTP debe ser una cadena de texto' })
  @Length(6, 6, { message: 'El código OTP debe tener exactamente 6 dígitos' })
  otpCode: string;
}
