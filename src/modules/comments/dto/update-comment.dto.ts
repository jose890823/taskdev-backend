import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class UpdateCommentDto {
  @ApiProperty({ example: 'Comentario editado' })
  @IsNotEmpty({ message: 'El contenido es obligatorio' })
  @IsString()
  content: string;
}
