import {
  Controller,
  Get,
  Post,
  Put,
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
  ApiBody,
} from '@nestjs/swagger';
import { I18nService } from './i18n.service';
import {
  CreateTranslationDto,
  UpdateTranslationDto,
  TranslationFilterDto,
  TranslationResponseDto,
} from './dto';
import { Translation } from './entities/translation.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../auth/entities/user.entity';

@ApiTags('i18n - Admin')
@Controller('i18n/admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN)
@ApiBearerAuth()
export class I18nAdminController {
  constructor(private readonly i18nService: I18nService) {}

  // ============================================
  // CRUD
  // ============================================

  @Get('translations')
  @ApiOperation({
    summary: 'Listar traducciones con filtros',
    description:
      'Retorna todas las traducciones con filtros por clave, idioma, modulo, texto y paginacion',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de traducciones con paginacion',
  })
  async findAll(@Query() filters: TranslationFilterDto) {
    return this.i18nService.findAll(filters);
  }

  @Get('translations/:id')
  @ApiOperation({
    summary: 'Obtener traduccion por ID',
    description: 'Retorna una traduccion especifica por su ID',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID de la traduccion',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 200,
    description: 'Traduccion encontrada',
    type: TranslationResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Traduccion no encontrada',
  })
  async findById(@Param('id', ParseUUIDPipe) id: string): Promise<Translation> {
    return this.i18nService.findById(id);
  }

  @Post('translations')
  @ApiOperation({
    summary: 'Crear una nueva traduccion',
    description:
      'Crea una nueva traduccion. La combinacion de clave+idioma debe ser unica.',
  })
  @ApiResponse({
    status: 201,
    description: 'Traduccion creada exitosamente',
    type: TranslationResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Datos invalidos',
  })
  @ApiResponse({
    status: 409,
    description: 'Ya existe una traduccion con esa clave e idioma',
  })
  async create(@Body() createDto: CreateTranslationDto): Promise<Translation> {
    return this.i18nService.create(createDto);
  }

  @Put('translations/:id')
  @ApiOperation({
    summary: 'Actualizar una traduccion',
    description: 'Actualiza una traduccion existente por su ID',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID de la traduccion',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 200,
    description: 'Traduccion actualizada exitosamente',
    type: TranslationResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Traduccion no encontrada',
  })
  @ApiResponse({
    status: 409,
    description: 'Conflicto con clave+idioma existente',
  })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateDto: UpdateTranslationDto,
  ): Promise<Translation> {
    return this.i18nService.update(id, updateDto);
  }

  @Delete('translations/:id')
  @ApiOperation({
    summary: 'Eliminar una traduccion',
    description:
      'Elimina una traduccion por su ID. No permite eliminar traducciones del sistema (isSystem=true).',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID de la traduccion',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 200,
    description: 'Traduccion eliminada exitosamente',
  })
  @ApiResponse({
    status: 400,
    description: 'No se puede eliminar una traduccion del sistema',
  })
  @ApiResponse({
    status: 404,
    description: 'Traduccion no encontrada',
  })
  async delete(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.i18nService.delete(id);
  }

  // ============================================
  // IMPORTACION / EXPORTACION
  // ============================================

  @Post('translations/import')
  @ApiOperation({
    summary: 'Importar traducciones masivamente',
    description:
      'Importa un array de traducciones. Si la combinacion clave+idioma ya existe, actualiza el valor. Si no existe, la crea.',
  })
  @ApiBody({
    description: 'Array de traducciones a importar',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        required: ['key', 'locale', 'value'],
        properties: {
          key: {
            type: 'string',
            example: 'errors.custom_error',
          },
          locale: {
            type: 'string',
            enum: ['es', 'en'],
            example: 'es',
          },
          value: {
            type: 'string',
            example: 'Error personalizado',
          },
          module: {
            type: 'string',
            example: 'errors',
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Resultado de la importacion masiva',
    schema: {
      type: 'object',
      properties: {
        created: { type: 'number', example: 5 },
        updated: { type: 'number', example: 3 },
      },
    },
  })
  async bulkImport(
    @Body()
    translations: {
      key: string;
      locale: string;
      value: string;
      module?: string;
    }[],
  ): Promise<{ created: number; updated: number }> {
    return this.i18nService.bulkImport(translations);
  }

  @Get('export/:locale')
  @ApiOperation({
    summary: 'Exportar traducciones de un idioma como JSON',
    description:
      'Retorna todas las traducciones de un idioma como un objeto JSON plano clave-valor. Util para generar archivos de traduccion.',
  })
  @ApiParam({
    name: 'locale',
    description: 'Codigo del idioma',
    enum: ['es', 'en'],
    example: 'es',
  })
  @ApiResponse({
    status: 200,
    description: 'Objeto JSON con todas las traducciones del idioma',
    schema: {
      type: 'object',
      example: {
        'errors.not_found': 'Recurso no encontrado',
        'common.success': 'Operacion realizada exitosamente',
      },
    },
  })
  async exportByLocale(
    @Param('locale') locale: string,
  ): Promise<Record<string, string>> {
    const validLocale = ['es', 'en'].includes(locale) ? locale : 'es';
    return this.i18nService.exportByLocale(validLocale);
  }

  // ============================================
  // UTILIDADES
  // ============================================

  @Post('reload-cache')
  @ApiOperation({
    summary: 'Recargar cache de traducciones',
    description:
      'Recarga el cache en memoria con las traducciones actuales de la base de datos. Usar despues de cambios directos en BD.',
  })
  @ApiResponse({
    status: 200,
    description: 'Cache recargado exitosamente',
    schema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          example: 'Cache de traducciones recargado exitosamente',
        },
      },
    },
  })
  async reloadCache(): Promise<{ message: string }> {
    await this.i18nService.reloadCache();
    return { message: 'Cache de traducciones recargado exitosamente' };
  }

  @Get('stats')
  @ApiOperation({
    summary: 'Obtener estadisticas de traducciones',
    description:
      'Retorna estadisticas generales: total, cantidad por idioma y cantidad por modulo/idioma',
  })
  @ApiResponse({
    status: 200,
    description: 'Estadisticas de traducciones',
    schema: {
      type: 'object',
      properties: {
        total: { type: 'number', example: 40 },
        byLocale: {
          type: 'object',
          example: { es: 20, en: 20 },
        },
        byModule: {
          type: 'object',
          example: {
            errors: { es: 10, en: 10, total: 20 },
            common: { es: 5, en: 5, total: 10 },
          },
        },
      },
    },
  })
  async getStats() {
    return this.i18nService.getStats();
  }
}
