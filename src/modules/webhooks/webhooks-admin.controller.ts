import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { WebhooksService } from './webhooks.service';
import {
  WebhookFilterDto,
  RetryWebhookDto,
  WebhookEventResponseDto,
  WebhookStatsResponseDto,
} from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../auth/entities/user.entity';

@ApiTags('Webhooks - Admin')
@Controller('webhooks')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN)
@ApiBearerAuth()
export class WebhooksAdminController {
  constructor(private readonly webhooksService: WebhooksService) {}

  @Get('events')
  @ApiOperation({
    summary: 'Listar eventos de webhook (Admin)',
    description:
      'Retorna todos los eventos de webhook con filtros por origen, estado, tipo de evento, rango de fechas y paginacion',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de eventos de webhook con paginacion',
    schema: {
      example: {
        data: [
          {
            id: '123e4567-e89b-12d3-a456-426614174000',
            systemCode: 'WHK-260207-A3K9',
            source: 'stripe',
            externalEventId: 'evt_1NqXkPLkdIwOt4y7AvGQWs5E',
            eventType: 'payment_intent.succeeded',
            status: 'processed',
            attempts: 1,
            maxAttempts: 3,
            processedAt: '2026-02-07T15:30:00.000Z',
            processingTimeMs: 150,
            createdAt: '2026-02-07T15:00:00.000Z',
          },
        ],
        pagination: { total: 100, page: 1, limit: 20, totalPages: 5 },
      },
    },
  })
  async getEvents(@Query() filters: WebhookFilterDto) {
    const result = await this.webhooksService.getEvents(filters);

    return {
      message: 'Eventos de webhook obtenidos exitosamente',
      data: result.data,
      meta: result.pagination,
    };
  }

  @Get('stats')
  @ApiOperation({
    summary: 'Obtener estadisticas de webhooks (Admin)',
    description:
      'Retorna estadisticas generales de webhooks: totales, promedios, desglose por origen y tipo, datos de las ultimas 24 horas',
  })
  @ApiResponse({
    status: 200,
    description: 'Estadisticas de webhooks',
    type: WebhookStatsResponseDto,
  })
  async getStats() {
    const stats = await this.webhooksService.getStats();

    return {
      message: 'Estadisticas de webhooks obtenidas exitosamente',
      data: stats,
    };
  }

  @Get('events/:id')
  @ApiOperation({
    summary: 'Obtener detalle de un evento de webhook (Admin)',
    description:
      'Retorna el detalle completo de un evento de webhook incluyendo payload, resultado y errores',
  })
  @ApiParam({
    name: 'id',
    description: 'ID del evento de webhook (UUID)',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 200,
    description: 'Detalle del evento de webhook',
    type: WebhookEventResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Evento de webhook no encontrado',
  })
  async getEventById(@Param('id', ParseUUIDPipe) id: string) {
    const event = await this.webhooksService.getEventById(id);

    return {
      message: 'Evento de webhook obtenido exitosamente',
      data: event,
    };
  }

  @Post('events/:id/retry')
  @ApiOperation({
    summary: 'Reintentar un evento de webhook fallido (Admin)',
    description:
      'Marca un evento de webhook fallido para ser reintentado. Resetea el estado a "received" y opcionalmente ajusta el maximo de intentos.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID del evento de webhook (UUID)',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 200,
    description: 'Evento marcado para reintento exitosamente',
    type: WebhookEventResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'No se puede reintentar un evento en su estado actual',
  })
  @ApiResponse({
    status: 404,
    description: 'Evento de webhook no encontrado',
  })
  async retryEvent(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() retryDto: RetryWebhookDto,
  ) {
    const event = await this.webhooksService.retryEvent(
      id,
      retryDto.maxAttempts,
    );

    return {
      message: 'Evento de webhook marcado para reintento exitosamente',
      data: event,
    };
  }

  @Delete('cleanup')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Limpiar eventos antiguos de webhook (Super Admin)',
    description:
      'Elimina permanentemente eventos de webhook procesados o duplicados con mas de N dias de antiguedad. Solo eventos con estado "processed" o "skipped" son eliminados.',
  })
  @ApiQuery({
    name: 'daysToKeep',
    description: 'Dias de antiguedad a conservar (por defecto 90)',
    required: false,
    type: Number,
    example: 90,
  })
  @ApiResponse({
    status: 200,
    description: 'Limpieza completada exitosamente',
    schema: {
      example: {
        message: 'Limpieza de webhooks completada: 150 eventos eliminados',
        data: { deletedCount: 150, daysKept: 90 },
      },
    },
  })
  async cleanOldEvents(@Query('daysToKeep') daysToKeep?: number) {
    const days = daysToKeep ? Number(daysToKeep) : 90;
    const deletedCount = await this.webhooksService.cleanOldEvents(days);

    return {
      message: `Limpieza de webhooks completada: ${deletedCount} eventos eliminados`,
      data: { deletedCount, daysKept: days },
    };
  }
}
