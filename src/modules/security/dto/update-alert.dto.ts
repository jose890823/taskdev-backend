import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsEnum,
  IsUUID,
} from 'class-validator';
import { SecurityAlertStatus } from '../entities/security-alert.entity';

export class UpdateAlertStatusDto {
  @ApiProperty({
    example: 'investigating',
    description: 'Nuevo estado de la alerta',
    enum: SecurityAlertStatus,
  })
  @IsNotEmpty({ message: 'El estado es obligatorio' })
  @IsEnum(SecurityAlertStatus)
  status: SecurityAlertStatus;

  @ApiProperty({
    example: 'Se detecto un patron de ataque desde esta IP',
    description: 'Notas o resolucion',
    required: false,
  })
  @IsOptional()
  @IsString()
  resolution?: string;
}

export class AssignAlertDto {
  @ApiProperty({
    example: '123e4567-e89b-12d3-a456-426614174000',
    description: 'ID del admin a asignar',
  })
  @IsNotEmpty({ message: 'El ID del admin es obligatorio' })
  @IsUUID()
  assignedToId: string;
}

export class ReviewEventDto {
  @ApiProperty({
    example: 'Verificado, fue un usuario legitimo que olvido su contrasena',
    description: 'Notas de la revision',
    required: false,
  })
  @IsOptional()
  @IsString()
  notes?: string;
}
