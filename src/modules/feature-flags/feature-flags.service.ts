import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FeatureFlag } from './entities/feature-flag.entity';
import { CreateFeatureFlagDto, UpdateFeatureFlagDto } from './dto';

@Injectable()
export class FeatureFlagsService {
  private readonly logger = new Logger(FeatureFlagsService.name);

  constructor(
    @InjectRepository(FeatureFlag)
    private readonly featureFlagRepository: Repository<FeatureFlag>,
  ) {}

  // ============================================
  // CRUD
  // ============================================

  /**
   * Obtener todos los feature flags
   */
  async findAll(): Promise<FeatureFlag[]> {
    return this.featureFlagRepository.find({
      order: { key: 'ASC' },
    });
  }

  /**
   * Buscar un feature flag por su clave única
   * @throws NotFoundException si no se encuentra
   */
  async findByKey(key: string): Promise<FeatureFlag> {
    const flag = await this.featureFlagRepository.findOne({ where: { key } });

    if (!flag) {
      throw new NotFoundException(
        `Feature flag con clave "${key}" no encontrado`,
      );
    }

    return flag;
  }

  /**
   * Crear un nuevo feature flag
   * @throws ConflictException si la clave ya existe
   */
  async create(dto: CreateFeatureFlagDto): Promise<FeatureFlag> {
    const existing = await this.featureFlagRepository.findOne({
      where: { key: dto.key },
    });

    if (existing) {
      throw new ConflictException(
        `Ya existe un feature flag con la clave "${dto.key}"`,
      );
    }

    const flag = this.featureFlagRepository.create(dto);
    const saved = await this.featureFlagRepository.save(flag);

    this.logger.log(`Feature flag creado: ${saved.key} (${saved.id})`);
    return saved;
  }

  /**
   * Actualizar un feature flag existente por ID
   * @throws NotFoundException si no se encuentra
   */
  async update(id: string, dto: UpdateFeatureFlagDto): Promise<FeatureFlag> {
    const flag = await this.featureFlagRepository.findOne({ where: { id } });

    if (!flag) {
      throw new NotFoundException(`Feature flag con ID "${id}" no encontrado`);
    }

    // Si se intenta cambiar la clave, verificar que no exista
    if (dto.key && dto.key !== flag.key) {
      const existing = await this.featureFlagRepository.findOne({
        where: { key: dto.key },
      });

      if (existing) {
        throw new ConflictException(
          `Ya existe un feature flag con la clave "${dto.key}"`,
        );
      }
    }

    Object.assign(flag, dto);
    const updated = await this.featureFlagRepository.save(flag);

    this.logger.log(`Feature flag actualizado: ${updated.key} (${updated.id})`);
    return updated;
  }

  /**
   * Eliminar un feature flag por ID
   * @throws NotFoundException si no se encuentra
   */
  async remove(id: string): Promise<void> {
    const flag = await this.featureFlagRepository.findOne({ where: { id } });

    if (!flag) {
      throw new NotFoundException(`Feature flag con ID "${id}" no encontrado`);
    }

    await this.featureFlagRepository.remove(flag);
    this.logger.log(`Feature flag eliminado: ${flag.key} (${id})`);
  }

  // ============================================
  // VERIFICACIÓN DE ESTADO
  // ============================================

  /**
   * Verifica si un feature flag está habilitado, considerando
   * el estado global, roles, tiendas y dependencias.
   *
   * @param key - Clave del feature flag
   * @param context - Contexto opcional con roles y storeId del usuario
   * @returns true si el feature flag está habilitado para el contexto dado
   */
  async isEnabled(
    key: string,
    context?: { roles?: string[]; storeId?: string },
  ): Promise<boolean> {
    const flag = await this.featureFlagRepository.findOne({ where: { key } });

    // Si no existe el flag, retornar false
    if (!flag) {
      return false;
    }

    // Si está deshabilitado globalmente, retornar false
    if (!flag.isEnabled) {
      return false;
    }

    // Verificar restricción por roles
    if (
      flag.enabledForRoles &&
      flag.enabledForRoles.length > 0 &&
      context?.roles
    ) {
      const hasMatchingRole = flag.enabledForRoles.some((role) =>
        context.roles!.includes(role),
      );
      if (!hasMatchingRole) {
        return false;
      }
    }

    // Verificar restricción por tiendas
    if (
      flag.enabledForStores &&
      flag.enabledForStores.length > 0 &&
      context?.storeId
    ) {
      if (!flag.enabledForStores.includes(context.storeId)) {
        return false;
      }
    }

    // Verificar dependencia
    if (flag.dependsOn) {
      const dependencyEnabled = await this.isEnabled(flag.dependsOn, context);
      if (!dependencyEnabled) {
        return false;
      }
    }

    return true;
  }

  // ============================================
  // CONFIGURACIÓN
  // ============================================

  /**
   * Obtener la configuración JSONB de un feature flag
   * @returns El objeto de configuración tipado o null si no existe
   */
  async getConfig<T = Record<string, any>>(key: string): Promise<T | null> {
    const flag = await this.featureFlagRepository.findOne({ where: { key } });

    if (!flag || !flag.config) {
      return null;
    }

    return flag.config as T;
  }
}
