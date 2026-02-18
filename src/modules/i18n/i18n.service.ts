import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
  BadRequestException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Translation,
  TranslationLocale,
  TranslationModule,
} from './entities/translation.entity';
import {
  CreateTranslationDto,
  UpdateTranslationDto,
  TranslationFilterDto,
} from './dto';
import { SEED_TRANSLATIONS } from './data/seed-translations';

@Injectable()
export class I18nService implements OnModuleInit {
  private readonly logger = new Logger(I18nService.name);
  private cache: Map<string, string> = new Map();

  constructor(
    @InjectRepository(Translation)
    private readonly translationRepository: Repository<Translation>,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.seedDefaultTranslations();
    await this.loadTranslations();
  }

  // ============================================
  // TRADUCCION
  // ============================================

  /**
   * Traducir una clave al idioma especificado.
   * Soporta interpolacion de parametros: {{name}}, {{count}}, etc.
   *
   * @param key - Clave de la traduccion (ej: 'errors.user_not_found')
   * @param locale - Idioma ('es' o 'en'), por defecto 'es'
   * @param params - Parametros opcionales para interpolar en el texto
   * @returns El texto traducido o la clave si no se encuentra
   */
  t(
    key: string,
    locale: string = 'es',
    params?: Record<string, string | number>,
  ): string {
    const cacheKey = `${locale}:${key}`;
    let value = this.cache.get(cacheKey);

    if (!value) {
      // Fallback a espanol si la clave no existe en el locale solicitado
      value = this.cache.get(`es:${key}`);
    }

    if (!value) {
      // Retornar la clave como ultimo recurso
      return key;
    }

    // Interpolar parametros
    if (params) {
      for (const [param, val] of Object.entries(params)) {
        value = value.replace(
          new RegExp(`\\{\\{${param}\\}\\}`, 'g'),
          String(val),
        );
      }
    }

    return value;
  }

  // ============================================
  // CACHE
  // ============================================

  /**
   * Cargar todas las traducciones a cache en memoria
   */
  async loadTranslations(): Promise<void> {
    const translations = await this.translationRepository.find();
    this.cache.clear();
    for (const t of translations) {
      this.cache.set(`${t.locale}:${t.key}`, t.value);
    }
    this.logger.log(`Cargadas ${translations.length} traducciones en cache`);
  }

  /**
   * Recargar cache (para uso despues de CRUD admin)
   */
  async reloadCache(): Promise<void> {
    await this.loadTranslations();
    this.logger.log('Cache de traducciones recargado');
  }

  // ============================================
  // CONSULTAS PUBLICAS
  // ============================================

  /**
   * Obtener todas las traducciones de un modulo/locale como objeto plano
   */
  async getTranslationsByModule(
    module: TranslationModule,
    locale: string,
  ): Promise<Record<string, string>> {
    const translations = await this.translationRepository.find({
      where: {
        module,
        locale: locale as TranslationLocale,
      },
    });

    const result: Record<string, string> = {};
    for (const t of translations) {
      result[t.key] = t.value;
    }
    return result;
  }

  /**
   * Obtener todas las traducciones de un locale como objeto plano
   */
  async getTranslationsByLocale(
    locale: string,
  ): Promise<Record<string, string>> {
    const translations = await this.translationRepository.find({
      where: {
        locale: locale as TranslationLocale,
      },
    });

    const result: Record<string, string> = {};
    for (const t of translations) {
      result[t.key] = t.value;
    }
    return result;
  }

  // ============================================
  // CRUD (Admin)
  // ============================================

  /**
   * Crear una nueva traduccion
   */
  async create(dto: CreateTranslationDto): Promise<Translation> {
    // Verificar si ya existe la combinacion key+locale
    const existing = await this.translationRepository.findOne({
      where: {
        key: dto.key,
        locale: dto.locale,
      },
    });

    if (existing) {
      throw new ConflictException(
        `Ya existe una traduccion con la clave '${dto.key}' para el idioma '${dto.locale}'`,
      );
    }

    const translation = this.translationRepository.create(dto);
    const saved = await this.translationRepository.save(translation);

    // Actualizar cache
    this.cache.set(`${saved.locale}:${saved.key}`, saved.value);
    this.logger.log(`Traduccion creada: ${saved.key} [${saved.locale}]`);

    return saved;
  }

  /**
   * Actualizar una traduccion existente
   */
  async update(id: string, dto: UpdateTranslationDto): Promise<Translation> {
    const translation = await this.findById(id);

    // Si se cambia key o locale, verificar que no exista conflicto
    if (dto.key || dto.locale) {
      const newKey = dto.key || translation.key;
      const newLocale = dto.locale || translation.locale;

      const existing = await this.translationRepository.findOne({
        where: {
          key: newKey,
          locale: newLocale,
        },
      });

      if (existing && existing.id !== id) {
        throw new ConflictException(
          `Ya existe una traduccion con la clave '${newKey}' para el idioma '${newLocale}'`,
        );
      }
    }

    // Remover entrada vieja del cache antes de actualizar
    this.cache.delete(`${translation.locale}:${translation.key}`);

    Object.assign(translation, dto);
    const saved = await this.translationRepository.save(translation);

    // Actualizar cache con nueva entrada
    this.cache.set(`${saved.locale}:${saved.key}`, saved.value);
    this.logger.log(`Traduccion actualizada: ${saved.key} [${saved.locale}]`);

    return saved;
  }

  /**
   * Eliminar una traduccion. No permite eliminar traducciones del sistema.
   */
  async delete(id: string): Promise<void> {
    const translation = await this.findById(id);

    if (translation.isSystem) {
      throw new BadRequestException(
        'No se puede eliminar una traduccion del sistema. Desmarque isSystem primero.',
      );
    }

    // Remover del cache
    this.cache.delete(`${translation.locale}:${translation.key}`);

    await this.translationRepository.remove(translation);
    this.logger.log(
      `Traduccion eliminada: ${translation.key} [${translation.locale}]`,
    );
  }

  /**
   * Listar traducciones con filtros y paginacion
   */
  async findAll(filters: TranslationFilterDto): Promise<{
    data: Translation[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> {
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const skip = (page - 1) * limit;

    const queryBuilder = this.translationRepository.createQueryBuilder('t');

    if (filters.key) {
      queryBuilder.andWhere('t.key ILIKE :key', { key: `%${filters.key}%` });
    }

    if (filters.locale) {
      queryBuilder.andWhere('t.locale = :locale', { locale: filters.locale });
    }

    if (filters.module) {
      queryBuilder.andWhere('t.module = :module', { module: filters.module });
    }

    if (filters.search) {
      queryBuilder.andWhere('t.value ILIKE :search', {
        search: `%${filters.search}%`,
      });
    }

    if (filters.isSystem !== undefined) {
      queryBuilder.andWhere('t.isSystem = :isSystem', {
        isSystem: filters.isSystem,
      });
    }

    queryBuilder.orderBy('t.module', 'ASC').addOrderBy('t.key', 'ASC');

    const [data, total] = await queryBuilder
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Buscar traduccion por ID
   */
  async findById(id: string): Promise<Translation> {
    const translation = await this.translationRepository.findOne({
      where: { id },
    });

    if (!translation) {
      throw new NotFoundException(`Traduccion con ID '${id}' no encontrada`);
    }

    return translation;
  }

  // ============================================
  // IMPORTACION / EXPORTACION
  // ============================================

  /**
   * Importar traducciones masivamente (upsert: crea o actualiza)
   */
  async bulkImport(
    translations: {
      key: string;
      locale: string;
      value: string;
      module?: string;
    }[],
  ): Promise<{ created: number; updated: number }> {
    let created = 0;
    let updated = 0;

    for (const item of translations) {
      const existing = await this.translationRepository.findOne({
        where: {
          key: item.key,
          locale: item.locale as TranslationLocale,
        },
      });

      if (existing) {
        existing.value = item.value;
        if (item.module) {
          existing.module = item.module as TranslationModule;
        }
        await this.translationRepository.save(existing);
        updated++;
      } else {
        const translation = this.translationRepository.create({
          key: item.key,
          locale: item.locale as TranslationLocale,
          value: item.value,
          module:
            (item.module as TranslationModule) || TranslationModule.COMMON,
        });
        await this.translationRepository.save(translation);
        created++;
      }
    }

    // Recargar cache despues de la importacion masiva
    await this.loadTranslations();

    this.logger.log(
      `Importacion masiva completada: ${created} creadas, ${updated} actualizadas`,
    );

    return { created, updated };
  }

  /**
   * Exportar todas las traducciones de un locale como JSON plano
   */
  async exportByLocale(locale: string): Promise<Record<string, string>> {
    return this.getTranslationsByLocale(locale);
  }

  // ============================================
  // ESTADISTICAS
  // ============================================

  /**
   * Obtener estadisticas de traducciones por modulo y locale
   */
  async getStats(): Promise<{
    total: number;
    byLocale: Record<string, number>;
    byModule: Record<string, { es: number; en: number; total: number }>;
  }> {
    const translations = await this.translationRepository.find();

    const byLocale: Record<string, number> = {};
    const byModule: Record<string, { es: number; en: number; total: number }> =
      {};

    for (const t of translations) {
      // Contar por locale
      byLocale[t.locale] = (byLocale[t.locale] || 0) + 1;

      // Contar por modulo
      if (!byModule[t.module]) {
        byModule[t.module] = { es: 0, en: 0, total: 0 };
      }
      byModule[t.module][t.locale as 'es' | 'en']++;
      byModule[t.module].total++;
    }

    return {
      total: translations.length,
      byLocale,
      byModule,
    };
  }

  // ============================================
  // SEED
  // ============================================

  /**
   * Seed traducciones por defecto usando upsert (INSERT ON CONFLICT UPDATE)
   */
  private async seedDefaultTranslations(): Promise<void> {
    let seeded = 0;
    let skipped = 0;

    for (const seed of SEED_TRANSLATIONS) {
      try {
        const existing = await this.translationRepository.findOne({
          where: {
            key: seed.key,
            locale: seed.locale as TranslationLocale,
          },
        });

        if (existing) {
          // Actualizar valor si es traduccion del sistema
          if (existing.isSystem) {
            existing.value = seed.value;
            if (seed.context) {
              existing.context = seed.context;
            }
            await this.translationRepository.save(existing);
          }
          skipped++;
          continue;
        }

        const translation = this.translationRepository.create({
          key: seed.key,
          locale: seed.locale as TranslationLocale,
          value: seed.value,
          module: seed.module as TranslationModule,
          context: seed.context || null,
          isSystem: true,
        });

        await this.translationRepository.save(translation);
        seeded++;
      } catch (error) {
        // Ignorar errores de duplicados (race condition en arranque)
        if (error instanceof Error && error.message?.includes('duplicate')) {
          skipped++;
        } else {
          this.logger.warn(
            `Error al insertar seed '${seed.key}' [${seed.locale}]: ${error instanceof Error ? error.message : error}`,
          );
        }
      }
    }

    if (seeded > 0) {
      this.logger.log(
        `Seed de traducciones: ${seeded} creadas, ${skipped} ya existentes`,
      );
    } else {
      this.logger.log(`Seed de traducciones: todas ya existentes (${skipped})`);
    }
  }
}
