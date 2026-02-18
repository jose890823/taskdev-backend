import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class CreateCommentDto {
  @ApiProperty({ example: 'uuid', description: 'ID de la tarea' })
  @IsNotEmpty({ message: 'El taskId es obligatorio' })
  @IsUUID('4')
  taskId: string;

  @ApiProperty({ example: 'Excelente avance', description: 'Contenido del comentario' })
  @IsNotEmpty({ message: 'El contenido es obligatorio' })
  @IsString()
  content: string;
}
