import { PartialType } from '@nestjs/swagger';
import { CreateTaskStatusDto } from './create-task-status.dto';
import { IsNumber, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateTaskStatusDto extends PartialType(CreateTaskStatusDto) {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  position?: number;
}
