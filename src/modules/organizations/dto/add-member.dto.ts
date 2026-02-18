import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsUUID } from 'class-validator';
import { OrganizationRole } from '../entities/organization-member.entity';

export class AddMemberDto {
  @ApiProperty({ example: 'uuid', description: 'ID del usuario' })
  @IsNotEmpty({ message: 'El userId es obligatorio' })
  @IsUUID('4', { message: 'userId debe ser un UUID valido' })
  userId: string;

  @ApiProperty({ enum: OrganizationRole, example: 'member', description: 'Rol en la organizacion' })
  @IsNotEmpty({ message: 'El rol es obligatorio' })
  @IsEnum(OrganizationRole, { message: 'Rol no valido' })
  role: OrganizationRole;
}
