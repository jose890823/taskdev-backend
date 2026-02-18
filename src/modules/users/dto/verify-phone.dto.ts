import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Length, Matches } from 'class-validator';

/**
 * DTO for initiating phone verification
 */
export class SendPhoneOtpDto {
  @ApiProperty({
    example: '+1234567890',
    description: 'Teléfono a verificar en formato internacional',
  })
  @IsNotEmpty()
  @IsString()
  @Matches(/^\+[1-9]\d{1,14}$/, {
    message: 'Phone must be in E.164 format (e.g., +1234567890)',
  })
  phone: string;
}

/**
 * DTO for verifying phone with OTP code
 */
export class VerifyPhoneDto {
  @ApiProperty({
    example: '123456',
    description: 'Código OTP de 6 dígitos enviado al teléfono',
  })
  @IsNotEmpty()
  @IsString()
  @Length(6, 6)
  @Matches(/^\d{6}$/, {
    message: 'OTP code must be 6 digits',
  })
  otpCode: string;
}
