import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AppService } from './app.service';
import { StandardResponseDto } from './common/dto/standard-response.dto';
import { Public } from './modules/auth/decorators/public.decorator';

@Controller()
@ApiTags('api')
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @Public()
  @ApiOperation({
    summary: 'Endpoint de bienvenida',
    description:
      'Endpoint básico que muestra un mensaje de bienvenida y el estado de la aplicación.',
  })
  @ApiResponse({
    status: 200,
    description: 'Mensaje de bienvenida obtenido exitosamente',
    type: StandardResponseDto,
    schema: {
      example: {
        success: true,
        data: 'Hello World!',
        message: 'Aplicación funcionando correctamente',
        timestamp: '2024-01-01T00:00:00.000Z',
        path: '/',
      },
    },
  })
  getHello() {
    return this.appService.getHello();
  }

  @Get('health')
  @Public()
  @ApiOperation({
    summary: 'Verificación de salud',
    description:
      'Endpoint para verificar el estado de salud de la aplicación y sus módulos.',
  })
  @ApiResponse({
    status: 200,
    description: 'Estado de salud verificado',
    type: StandardResponseDto,
    schema: {
      example: {
        success: true,
        data: {
          status: 'ok',
          timestamp: '2024-01-01T00:00:00.000Z',
          uptime: 3600,
          modules: {
            users: 'loaded',
          },
        },
        message: 'Aplicación saludable',
        timestamp: '2024-01-01T00:00:00.000Z',
        path: '/health',
      },
    },
  })
  getHealth() {
    return this.appService.getHealthStatus();
  }
}
