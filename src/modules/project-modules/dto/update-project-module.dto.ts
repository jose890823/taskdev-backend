import { PartialType } from '@nestjs/swagger';
import { CreateProjectModuleDto } from './create-project-module.dto';
import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsNumber } from 'class-validator';

export class UpdateProjectModuleDto extends PartialType(CreateProjectModuleDto) {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  position?: number;
}
