import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../auth/entities/user.entity';
import { CacheService } from './cache.service';
import { InvalidateCacheDto, CacheStatsResponseDto } from './dto';

/**
 * Controller de administracion del cache Redis.
 * Todos los endpoints requieren rol ADMIN o SUPER_ADMIN.
 */
@ApiTags('Cache - Admin')
@Controller('v1/admin/cache')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN)
@ApiBearerAuth()
export class CacheAdminController {
  constructor(private readonly cacheService: CacheService) {}

  // ============================================
  // ESTADISTICAS Y MONITOREO
  // ============================================

  @Get('stats')
  @ApiOperation({
    summary: 'Obtener estadisticas del cache',
    description:
      'Retorna estadisticas de Redis: claves almacenadas, memoria, uptime y tasa de aciertos.',
  })
  @ApiResponse({
    status: 200,
    description: 'Estadisticas del cache obtenidas exitosamente',
    type: CacheStatsResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'No autenticado',
  })
  @ApiResponse({
    status: 403,
    description: 'Sin permisos de administrador',
  })
  async getStats(): Promise<CacheStatsResponseDto> {
    return this.cacheService.getStats();
  }

  @Get('health')
  @ApiOperation({
    summary: 'Verificar salud de la conexion Redis',
    description: 'Ejecuta un PING a Redis y retorna el estado de la conexion.',
  })
  @ApiResponse({
    status: 200,
    description: 'Estado de salud del cache',
  })
  @ApiResponse({
    status: 401,
    description: 'No autenticado',
  })
  @ApiResponse({
    status: 403,
    description: 'Sin permisos de administrador',
  })
  async healthCheck(): Promise<{ healthy: boolean; message: string }> {
    const isHealthy = await this.cacheService.isHealthy();
    return {
      healthy: isHealthy,
      message: isHealthy
        ? 'Redis esta operativo'
        : 'Redis no responde o la conexion esta caida',
    };
  }

  // ============================================
  // GESTION DE CLAVES
  // ============================================

  @Get('keys/:pattern')
  @ApiOperation({
    summary: 'Listar claves por patron',
    description:
      'Lista las claves del cache que coincidan con el patron proporcionado. Usa SCAN para no bloquear Redis. Maximo 100 resultados.',
  })
  @ApiParam({
    name: 'pattern',
    description:
      'Patron glob para buscar claves. Ejemplo: products:*, categories:tree, flags:*',
    example: 'products:*',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de claves encontradas',
  })
  @ApiResponse({
    status: 401,
    description: 'No autenticado',
  })
  @ApiResponse({
    status: 403,
    description: 'Sin permisos de administrador',
  })
  async listKeys(
    @Param('pattern') pattern: string,
  ): Promise<{ pattern: string; keys: string[]; count: number }> {
    const keys = await this.cacheService.listKeys(pattern);
    return {
      pattern,
      keys,
      count: keys.length,
    };
  }

  // ============================================
  // INVALIDACION
  // ============================================

  @Post('invalidate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Invalidar cache por prefijo',
    description:
      'Elimina todas las claves del cache que comiencen con el prefijo dado. Ejemplo: "products:" elimina todas las claves products:*',
  })
  @ApiResponse({
    status: 200,
    description: 'Claves invalidadas exitosamente',
  })
  @ApiResponse({
    status: 400,
    description: 'Datos invalidos',
  })
  @ApiResponse({
    status: 401,
    description: 'No autenticado',
  })
  @ApiResponse({
    status: 403,
    description: 'Sin permisos de administrador',
  })
  async invalidate(
    @Body() dto: InvalidateCacheDto,
  ): Promise<{ prefix: string; deletedKeys: number; message: string }> {
    const deletedKeys = await this.cacheService.invalidateByPrefix(dto.prefix);
    return {
      prefix: dto.prefix,
      deletedKeys,
      message: `Se invalidaron ${deletedKeys} claves con prefijo "${dto.prefix}"`,
    };
  }

  @Post('flush')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Vaciar todo el cache (solo no-produccion)',
    description:
      'Elimina TODAS las claves del cache. Solo disponible en entornos de desarrollo y staging. Requiere rol SUPER_ADMIN.',
  })
  @ApiResponse({
    status: 200,
    description: 'Cache vaciado exitosamente',
  })
  @ApiResponse({
    status: 401,
    description: 'No autenticado',
  })
  @ApiResponse({
    status: 403,
    description: 'Sin permisos de super administrador',
  })
  @ApiResponse({
    status: 500,
    description: 'No se permite flush en produccion',
  })
  async flushAll(): Promise<{ message: string }> {
    await this.cacheService.flushAll();
    return {
      message: 'Cache vaciado completamente',
    };
  }
}
