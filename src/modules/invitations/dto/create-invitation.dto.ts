import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsEnum, IsNotEmpty, IsOptional } from 'class-validator';
import { OrganizationRole } from '../../organizations/entities/organization-member.entity';

export class CreateInvitationDto {
  @ApiProperty({ example: 'user@example.com', description: 'Email del invitado' })
  @IsNotEmpty({ message: 'El email es obligatorio' })
  @IsEmail({}, { message: 'Email no valido' })
  email: string;

  @ApiProperty({ enum: OrganizationRole, example: 'member', required: false })
  @IsOptional()
  @IsEnum(OrganizationRole, { message: 'Rol no valido' })
  role?: OrganizationRole;
}
