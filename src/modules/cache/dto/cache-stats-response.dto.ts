import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO de respuesta con estadisticas del cache Redis
 */
export class CacheStatsResponseDto {
  @ApiProperty({
    example: 1523,
    description: 'Numero total de claves almacenadas en cache',
  })
  keys: number;

  @ApiProperty({
    example: '2.45M',
    description: 'Memoria utilizada por Redis',
  })
  memory: string;

  @ApiProperty({
    example: 86400,
    description: 'Tiempo de actividad de Redis en segundos',
  })
  uptime: number;

  @ApiProperty({
    example: '87.32%',
    description: 'Tasa de aciertos del cache (hit rate)',
  })
  hitRate: string;
}
