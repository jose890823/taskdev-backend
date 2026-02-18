import { ApiProperty } from '@nestjs/swagger';
import {
  IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength, IsDateString,
} from 'class-validator';
import { TaskType, TaskPriority } from '../entities/task.entity';

export class CreateTaskDto {
  @ApiProperty({ example: 'Implementar login', description: 'Titulo de la tarea' })
  @IsNotEmpty({ message: 'El titulo es obligatorio' })
  @IsString()
  @MaxLength(500)
  title: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ enum: TaskType, example: 'project', required: false })
  @IsOptional()
  @IsEnum(TaskType)
  type?: TaskType;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID('4')
  projectId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID('4')
  moduleId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID('4')
  parentId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID('4')
  statusId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID('4')
  assignedToId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID('4')
  organizationId?: string;

  @ApiProperty({ enum: TaskPriority, example: 'medium', required: false })
  @IsOptional()
  @IsEnum(TaskPriority)
  priority?: TaskPriority;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString({}, { message: 'scheduledDate debe ser una fecha valida' })
  scheduledDate?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString({}, { message: 'dueDate debe ser una fecha valida' })
  dueDate?: string;
}
