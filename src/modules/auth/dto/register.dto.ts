import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsString,
  MinLength,
  MaxLength,
  Matches,
  IsPhoneNumber,
} from 'class-validator';

export class RegisterDto {
  @ApiProperty({
    example: 'juan.perez@example.com',
    description: 'Email del usuario (debe ser único)',
  })
  @IsNotEmpty({ message: 'El email es obligatorio' })
  @IsEmail({}, { message: 'El email debe tener un formato válido' })
  email: string;

  @ApiProperty({
    example: 'P@ssw0rd123!',
    description:
      'Contraseña (mínimo 8 caracteres, debe incluir mayúsculas, minúsculas, números y símbolos)',
    minLength: 8,
  })
  @IsNotEmpty({ message: 'La contraseña es obligatoria' })
  @IsString({ message: 'La contraseña debe ser una cadena de texto' })
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres' })
  @Matches(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d\s]).+$/,
    {
      message:
        'La contraseña debe contener al menos una mayúscula, una minúscula, un número y un carácter especial',
    },
  )
  password: string;

  @ApiProperty({
    example: 'Juan',
    description: 'Nombre del usuario',
  })
  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  @IsString({ message: 'El nombre debe ser una cadena de texto' })
  @MinLength(2, { message: 'El nombre debe tener al menos 2 caracteres' })
  @MaxLength(100, { message: 'El nombre no debe exceder 100 caracteres' })
  firstName: string;

  @ApiProperty({
    example: 'Pérez',
    description: 'Apellido del usuario',
  })
  @IsNotEmpty({ message: 'El apellido es obligatorio' })
  @IsString({ message: 'El apellido debe ser una cadena de texto' })
  @MinLength(2, { message: 'El apellido debe tener al menos 2 caracteres' })
  @MaxLength(100, { message: 'El apellido no debe exceder 100 caracteres' })
  lastName: string;

  @ApiProperty({
    example: '+17868391882',
    description: 'Teléfono del usuario en formato internacional',
  })
  @IsNotEmpty({ message: 'El teléfono es obligatorio' })
  @IsString({ message: 'El teléfono debe ser una cadena de texto' })
  @Matches(/^\+?[1-9]\d{1,14}$/, {
    message:
      'El teléfono debe estar en formato internacional (ej: +17868391882)',
  })
  phone: string;
}
