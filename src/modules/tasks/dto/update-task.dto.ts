import { ApiProperty } from '@nestjs/swagger';
import {
  IsEnum, IsOptional, IsString, IsUUID, MaxLength, IsDateString, IsInt, Min, ValidateIf,
  IsArray,
} from 'class-validator';
import { TaskPriority } from '../entities/task.entity';

export class UpdateTaskDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  title?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID('4')
  statusId?: string;

  @ApiProperty({ required: false, nullable: true, description: 'UUID del usuario asignado (legacy, usar assignedToIds)' })
  @IsOptional()
  @ValidateIf((o) => o.assignedToId !== null)
  @IsUUID('4', { message: 'assignedToId debe ser un UUID valido o null' })
  assignedToId?: string | null;

  @ApiProperty({
    required: false,
    type: [String],
    description: 'UUIDs de los usuarios asignados',
    example: ['uuid-1', 'uuid-2'],
  })
  @IsOptional()
  @IsArray({ message: 'assignedToIds debe ser un arreglo' })
  @IsUUID('4', { each: true, message: 'Cada assignedToId debe ser un UUID valido' })
  assignedToIds?: string[];

  @ApiProperty({ enum: TaskPriority, required: false })
  @IsOptional()
  @IsEnum(TaskPriority)
  priority?: TaskPriority;

  @ApiProperty({ required: false })
  @IsOptional()
  @ValidateIf((o) => o.scheduledDate !== null)
  @IsDateString({}, { message: 'scheduledDate debe ser una fecha valida' })
  scheduledDate?: string | null;

  @ApiProperty({ required: false })
  @IsOptional()
  @ValidateIf((o) => o.dueDate !== null)
  @IsDateString({}, { message: 'dueDate debe ser una fecha valida' })
  dueDate?: string | null;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Min(0)
  position?: number;
}
