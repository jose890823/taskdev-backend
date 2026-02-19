import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsEnum, IsNotEmpty, IsOptional } from 'class-validator';
import { ProjectRole } from '../../projects/entities/project-member.entity';

export class CreateProjectInvitationDto {
  @ApiProperty({ example: 'user@example.com', description: 'Email del invitado al proyecto' })
  @IsNotEmpty({ message: 'El email es obligatorio' })
  @IsEmail({}, { message: 'Email no valido' })
  email: string;

  @ApiProperty({ enum: ProjectRole, example: 'member', required: false, description: 'Rol en el proyecto' })
  @IsOptional()
  @IsEnum(ProjectRole, { message: 'Rol de proyecto no valido' })
  role?: ProjectRole;
}
