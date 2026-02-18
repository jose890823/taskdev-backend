import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsUUID } from 'class-validator';
import { ProjectRole } from '../entities/project-member.entity';

export class AddProjectMemberDto {
  @ApiProperty({ example: 'uuid' })
  @IsNotEmpty({ message: 'El userId es obligatorio' })
  @IsUUID('4')
  userId: string;

  @ApiProperty({ enum: ProjectRole, example: 'member' })
  @IsNotEmpty({ message: 'El rol es obligatorio' })
  @IsEnum(ProjectRole, { message: 'Rol no valido' })
  role: ProjectRole;
}
