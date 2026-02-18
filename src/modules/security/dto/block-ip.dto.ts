import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  IsBoolean,
  IsOptional,
  IsInt,
  Min,
  Matches,
} from 'class-validator';

export class BlockIpDto {
  @ApiProperty({
    example: '192.168.1.100',
    description: 'Direccion IP a bloquear',
  })
  @IsNotEmpty({ message: 'La IP es obligatoria' })
  @IsString()
  @Matches(
    /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$|^([a-fA-F0-9:]+)$/,
    {
      message: 'Debe ser una direccion IP valida (IPv4 o IPv6)',
    },
  )
  ipAddress: string;

  @ApiProperty({
    example: 'Multiples intentos de login fallidos',
    description: 'Razon del bloqueo',
  })
  @IsNotEmpty({ message: 'La razon es obligatoria' })
  @IsString()
  reason: string;

  @ApiProperty({
    example: false,
    description: 'Si es un bloqueo permanente',
    required: false,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  permanent?: boolean = false;

  @ApiProperty({
    example: 60,
    description: 'Duracion del bloqueo en minutos (si no es permanente)',
    required: false,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  durationMinutes?: number;
}

export class UnblockIpDto {
  @ApiProperty({
    example: '192.168.1.100',
    description: 'Direccion IP a desbloquear',
  })
  @IsNotEmpty({ message: 'La IP es obligatoria' })
  @IsString()
  ipAddress: string;
}
