import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsUUID } from 'class-validator';

export class ReorderModulesDto {
  @ApiProperty({ description: 'Array de IDs en el nuevo orden', type: [String] })
  @IsArray()
  @IsUUID('4', { each: true })
  ids: string[];
}
