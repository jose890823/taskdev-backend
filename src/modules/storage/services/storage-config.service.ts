import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject } from '@nestjs/common';
import type { Cache } from 'cache-manager';
import {
  StorageConfig,
  S3Config,
  GCSConfig,
  CloudinaryConfig,
  LocalConfig,
  StorageSettings,
} from '../entities/storage-config.entity';
import {
  StorageProviderType,
  StorageProviderConfig,
} from '../interfaces/storage-provider.interface';
import { EncryptionService } from '../../../shared/encryption.service';
import { ErrorCodes } from '../../../common/dto';

const CACHE_KEY_ACTIVE = 'storage:active';
const CACHE_KEY_PREFIX = 'storage:config:';
const CACHE_TTL = 300000; // 5 minutos

/**
 * Servicio para gestionar la configuración dinámica de proveedores de storage
 */
@Injectable()
export class StorageConfigService implements OnModuleInit {
  private readonly logger = new Logger(StorageConfigService.name);

  constructor(
    @InjectRepository(StorageConfig)
    private readonly configRepository: Repository<StorageConfig>,
    private readonly configService: ConfigService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    private readonly encryptionService: EncryptionService,
  ) {}

  /**
   * Inicializar configuraciones por defecto al arrancar
   */
  async onModuleInit(): Promise<void> {
    await this.seedDefaultConfigs();
  }

  /**
   * Crear configuraciones por defecto para cada proveedor
   */
  private async seedDefaultConfigs(): Promise<void> {
    const providers = Object.values(StorageProviderType);

    for (const provider of providers) {
      const exists = await this.configRepository.findOne({
        where: { provider },
      });

      if (!exists) {
        const defaultConfig = this.getDefaultConfig(provider);
        await this.configRepository.save(
          this.configRepository.create({
            provider,
            name: this.getProviderDisplayName(provider),
            isActive: provider === StorageProviderType.LOCAL,
            isConfigured: provider === StorageProviderType.LOCAL,
            config: defaultConfig.config,
            settings: defaultConfig.settings,
          }),
        );

        this.logger.log(`Created default config for ${provider}`);
      }
    }
  }

  /**
   * Obtener configuración por defecto para un proveedor
   */
  private getDefaultConfig(provider: StorageProviderType): {
    config: any;
    settings: StorageSettings;
  } {
    const defaultSettings: StorageSettings = {
      maxFileSize: 100 * 1024 * 1024, // 100MB
      allowedMimeTypes: [
        'image/jpeg',
        'image/png',
        'image/gif',
        'image/webp',
        'application/pdf',
        'video/mp4',
        'video/webm',
        'audio/mpeg',
        'audio/wav',
      ],
      defaultPublic: false,
      urlExpiration: 3600,
    };

    switch (provider) {
      case StorageProviderType.LOCAL:
        return {
          config: {
            basePath:
              this.configService.get<string>('LOCAL_STORAGE_PATH') ||
              './uploads',
            baseUrl:
              this.configService.get<string>('LOCAL_STORAGE_URL') ||
              'http://localhost:3001/uploads',
            serveStatic: true,
          } as LocalConfig,
          settings: defaultSettings,
        };

      case StorageProviderType.S3:
        return {
          config: {
            bucket: this.configService.get<string>('AWS_S3_BUCKET') || '',
            region:
              this.configService.get<string>('AWS_S3_REGION') || 'us-east-1',
            accessKeyId:
              this.configService.get<string>('AWS_ACCESS_KEY_ID') || '',
            secretAccessKey:
              this.configService.get<string>('AWS_SECRET_ACCESS_KEY') || '',
            endpoint: this.configService.get<string>('AWS_S3_ENDPOINT'),
          } as S3Config,
          settings: defaultSettings,
        };

      case StorageProviderType.GCS:
        return {
          config: {
            projectId: this.configService.get<string>('GCS_PROJECT_ID') || '',
            bucket: this.configService.get<string>('GCS_BUCKET') || '',
            keyFilename: this.configService.get<string>('GCS_KEY_FILE'),
          } as GCSConfig,
          settings: defaultSettings,
        };

      case StorageProviderType.CLOUDINARY:
        return {
          config: {
            cloudName:
              this.configService.get<string>('CLOUDINARY_CLOUD_NAME') || '',
            apiKey: this.configService.get<string>('CLOUDINARY_API_KEY') || '',
            apiSecret:
              this.configService.get<string>('CLOUDINARY_API_SECRET') || '',
            folder: 'michambita',
          } as CloudinaryConfig,
          settings: defaultSettings,
        };

      default:
        return { config: {}, settings: defaultSettings };
    }
  }

  /**
   * Obtener nombre para mostrar del proveedor
   */
  private getProviderDisplayName(provider: StorageProviderType): string {
    const names: Record<StorageProviderType, string> = {
      [StorageProviderType.LOCAL]: 'Almacenamiento Local',
      [StorageProviderType.S3]: 'Amazon S3',
      [StorageProviderType.GCS]: 'Google Cloud Storage',
      [StorageProviderType.CLOUDINARY]: 'Cloudinary',
    };
    return names[provider] || provider;
  }

  /**
   * Obtener la configuración activa
   */
  async getActiveConfig(): Promise<StorageConfig> {
    // Intentar obtener de cache
    const cached = await this.cacheManager.get<StorageConfig>(CACHE_KEY_ACTIVE);
    if (cached) {
      return cached;
    }

    const config = await this.configRepository.findOne({
      where: { isActive: true },
    });

    if (!config) {
      // Si no hay activo, activar Local por defecto
      const localConfig = await this.configRepository.findOne({
        where: { provider: StorageProviderType.LOCAL },
      });

      if (localConfig) {
        localConfig.isActive = true;
        await this.configRepository.save(localConfig);
        await this.cacheManager.set(CACHE_KEY_ACTIVE, localConfig, CACHE_TTL);
        return localConfig;
      }

      throw new NotFoundException({
        code: ErrorCodes.NOT_FOUND,
        message: 'No hay proveedor de storage configurado',
      });
    }

    await this.cacheManager.set(CACHE_KEY_ACTIVE, config, CACHE_TTL);
    return config;
  }

  /**
   * Obtener configuración de un proveedor específico
   */
  async getConfig(provider: StorageProviderType): Promise<StorageConfig> {
    const cacheKey = `${CACHE_KEY_PREFIX}${provider}`;

    const cached = await this.cacheManager.get<StorageConfig>(cacheKey);
    if (cached) {
      return cached;
    }

    const config = await this.configRepository.findOne({
      where: { provider },
    });

    if (!config) {
      throw new NotFoundException({
        code: ErrorCodes.NOT_FOUND,
        message: `Configuración no encontrada para el proveedor: ${provider}`,
      });
    }

    await this.cacheManager.set(cacheKey, config, CACHE_TTL);
    return config;
  }

  /**
   * Obtener todas las configuraciones
   */
  async getAllConfigs(): Promise<StorageConfig[]> {
    return this.configRepository.find({
      order: { provider: 'ASC' },
    });
  }

  /**
   * Actualizar configuración de un proveedor
   */
  async updateConfig(
    provider: StorageProviderType,
    update: {
      name?: string;
      config?: Partial<S3Config | GCSConfig | CloudinaryConfig | LocalConfig>;
      settings?: Partial<StorageSettings>;
    },
  ): Promise<StorageConfig> {
    const config = await this.getConfig(provider);

    if (update.name !== undefined) {
      config.name = update.name;
    }

    if (update.config) {
      // Encriptar campos sensibles antes de guardar
      const encryptedConfig = this.encryptSensitiveFields(
        { ...config.config, ...update.config },
        provider,
      );
      config.config = encryptedConfig as any;
    }

    if (update.settings) {
      config.settings = { ...config.settings, ...update.settings };
    }

    // Verificar si está configurado
    config.isConfigured = config.hasMinimumConfig();
    config.lastValidationError = null;

    await this.configRepository.save(config);
    await this.invalidateCache(provider);

    this.logger.log(`Config updated for provider: ${provider}`);
    return config;
  }

  /**
   * Activar un proveedor
   */
  async activateProvider(
    provider: StorageProviderType,
  ): Promise<StorageConfig> {
    const config = await this.getConfig(provider);

    if (!config.isConfigured) {
      throw new BadRequestException({
        code: ErrorCodes.VALIDATION_ERROR,
        message: 'El proveedor no está configurado correctamente',
      });
    }

    // Desactivar todos los demás
    await this.configRepository.update({}, { isActive: false });

    // Activar el seleccionado
    config.isActive = true;
    await this.configRepository.save(config);

    // Limpiar cache
    await this.invalidateAllCache();

    this.logger.log(`Provider activated: ${provider}`);
    return config;
  }

  /**
   * Registrar resultado de validación
   */
  async setValidationResult(
    provider: StorageProviderType,
    success: boolean,
    error?: string,
  ): Promise<void> {
    await this.configRepository.update(
      { provider },
      {
        lastValidatedAt: new Date(),
        lastValidationError: success ? null : error || 'Validation failed',
        isConfigured: success,
      },
    );

    await this.invalidateCache(provider);
  }

  /**
   * Obtener configuración formateada para el provider
   */
  async getProviderConfig(
    provider: StorageProviderType,
  ): Promise<StorageProviderConfig> {
    const config = await this.getConfig(provider);

    // Desencriptar campos sensibles
    const decryptedConfig = this.decryptSensitiveFields(
      config.config,
      provider,
    );

    return {
      type: provider,
      enabled: config.isConfigured,
      config: decryptedConfig,
      settings: config.settings,
    };
  }

  /**
   * Encriptar campos sensibles
   */
  private encryptSensitiveFields(
    config: Record<string, any>,
    provider: StorageProviderType,
  ): Record<string, any> {
    const result = { ...config };
    const sensitiveFields = this.getSensitiveFields(provider);

    for (const field of sensitiveFields) {
      if (
        result[field] &&
        typeof result[field] === 'string' &&
        result[field] !== '********'
      ) {
        result[field] = this.encryptionService.encrypt(result[field]);
      }
    }

    // Manejar credenciales anidadas de GCS
    if (result.credentials && typeof result.credentials === 'object') {
      const creds = result.credentials as Record<string, any>;
      if (creds.private_key && creds.private_key !== '********') {
        creds.private_key = this.encryptionService.encrypt(creds.private_key);
      }
    }

    return result;
  }

  /**
   * Desencriptar campos sensibles
   */
  private decryptSensitiveFields(
    config: Record<string, any>,
    provider: StorageProviderType,
  ): Record<string, any> {
    const result = { ...config };
    const sensitiveFields = this.getSensitiveFields(provider);

    for (const field of sensitiveFields) {
      if (result[field] && typeof result[field] === 'string') {
        try {
          result[field] = this.encryptionService.decrypt(result[field]);
        } catch {
          // Si no se puede desencriptar, dejar como está (puede ser texto plano)
        }
      }
    }

    // Manejar credenciales anidadas de GCS
    if (result.credentials && typeof result.credentials === 'object') {
      const creds = result.credentials as Record<string, any>;
      if (creds.private_key) {
        try {
          creds.private_key = this.encryptionService.decrypt(creds.private_key);
        } catch {
          // Dejar como está
        }
      }
    }

    return result;
  }

  /**
   * Obtener lista de campos sensibles por proveedor
   */
  private getSensitiveFields(provider: StorageProviderType): string[] {
    switch (provider) {
      case StorageProviderType.S3:
        return ['accessKeyId', 'secretAccessKey'];
      case StorageProviderType.GCS:
        return []; // credentials se maneja aparte
      case StorageProviderType.CLOUDINARY:
        return ['apiKey', 'apiSecret'];
      default:
        return [];
    }
  }

  /**
   * Invalidar cache de un proveedor
   */
  private async invalidateCache(provider: StorageProviderType): Promise<void> {
    await this.cacheManager.del(`${CACHE_KEY_PREFIX}${provider}`);
    await this.cacheManager.del(CACHE_KEY_ACTIVE);
  }

  /**
   * Invalidar todo el cache de storage
   */
  private async invalidateAllCache(): Promise<void> {
    for (const provider of Object.values(StorageProviderType)) {
      await this.cacheManager.del(`${CACHE_KEY_PREFIX}${provider}`);
    }
    await this.cacheManager.del(CACHE_KEY_ACTIVE);
  }
}
