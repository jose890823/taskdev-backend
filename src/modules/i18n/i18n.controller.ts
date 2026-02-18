import { Controller, Get, Param, UseInterceptors } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { I18nService } from './i18n.service';
import { TranslationModule } from './entities/translation.entity';
import { Public } from '../auth/decorators/public.decorator';
import { LocaleInterceptor } from './interceptors/locale.interceptor';

@ApiTags('i18n - Traducciones')
@Controller('i18n')
@UseInterceptors(LocaleInterceptor)
export class I18nController {
  constructor(private readonly i18nService: I18nService) {}

  @Get(':locale')
  @Public()
  @ApiOperation({
    summary: 'Obtener todas las traducciones de un idioma',
    description:
      'Retorna todas las traducciones para el idioma especificado como un objeto clave-valor. Ideal para cargar todas las traducciones en el frontend.',
  })
  @ApiParam({
    name: 'locale',
    description: 'Codigo del idioma (es o en)',
    enum: ['es', 'en'],
    example: 'es',
  })
  @ApiResponse({
    status: 200,
    description: 'Objeto con todas las traducciones del idioma',
    schema: {
      type: 'object',
      example: {
        'errors.not_found': 'Recurso no encontrado',
        'common.success': 'Operacion realizada exitosamente',
      },
    },
  })
  async getTranslationsByLocale(
    @Param('locale') locale: string,
  ): Promise<Record<string, string>> {
    const validLocale = ['es', 'en'].includes(locale) ? locale : 'es';
    return this.i18nService.getTranslationsByLocale(validLocale);
  }

  @Get(':locale/:module')
  @Public()
  @ApiOperation({
    summary: 'Obtener traducciones de un modulo y idioma',
    description:
      'Retorna las traducciones filtradas por modulo e idioma. Util para cargar traducciones bajo demanda por seccion.',
  })
  @ApiParam({
    name: 'locale',
    description: 'Codigo del idioma (es o en)',
    enum: ['es', 'en'],
    example: 'es',
  })
  @ApiParam({
    name: 'module',
    description: 'Nombre del modulo',
    enum: Object.values(TranslationModule),
    example: 'errors',
  })
  @ApiResponse({
    status: 200,
    description: 'Objeto con las traducciones del modulo e idioma',
    schema: {
      type: 'object',
      example: {
        'errors.not_found': 'Recurso no encontrado',
        'errors.unauthorized': 'No autorizado',
      },
    },
  })
  async getTranslationsByModule(
    @Param('locale') locale: string,
    @Param('module') module: string,
  ): Promise<Record<string, string>> {
    const validLocale = ['es', 'en'].includes(locale) ? locale : 'es';
    const validModule = Object.values(TranslationModule).includes(
      module as TranslationModule,
    )
      ? (module as TranslationModule)
      : TranslationModule.COMMON;

    return this.i18nService.getTranslationsByModule(validModule, validLocale);
  }
}
