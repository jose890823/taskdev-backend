import {
  Injectable,
  Logger,
  BadRequestException,
  OnModuleInit,
} from '@nestjs/common';
import { Readable } from 'stream';
import {
  IStorageProvider,
  StorageProviderType,
  UploadOptions,
  StorageResult,
  UrlOptions,
  FileMetadata,
} from './interfaces/storage-provider.interface';
import { StorageConfigService } from './services/storage-config.service';
import { LocalStorageProvider } from './providers/local-storage.provider';
import { S3StorageProvider } from './providers/s3-storage.provider';
import { GCSStorageProvider } from './providers/gcs-storage.provider';
import { CloudinaryStorageProvider } from './providers/cloudinary-storage.provider';
import { ErrorCodes } from '../../common/dto';

/**
 * Servicio principal de Storage (Facade)
 * Delega las operaciones al proveedor activo configurado
 */
@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private providers: Map<StorageProviderType, IStorageProvider> = new Map();
  private initializedProviders: Set<StorageProviderType> = new Set();

  constructor(
    private readonly configService: StorageConfigService,
    private readonly localProvider: LocalStorageProvider,
    private readonly s3Provider: S3StorageProvider,
    private readonly gcsProvider: GCSStorageProvider,
    private readonly cloudinaryProvider: CloudinaryStorageProvider,
  ) {
    this.providers.set(StorageProviderType.LOCAL, localProvider);
    this.providers.set(StorageProviderType.S3, s3Provider);
    this.providers.set(StorageProviderType.GCS, gcsProvider);
    this.providers.set(StorageProviderType.CLOUDINARY, cloudinaryProvider);
  }

  /**
   * Inicializar el proveedor activo al arrancar
   */
  async onModuleInit(): Promise<void> {
    try {
      await this.initializeActiveProvider();
    } catch (error) {
      this.logger.warn(
        'Failed to initialize storage provider on startup',
        error,
      );
    }
  }

  /**
   * Inicializar el proveedor activo
   */
  private async initializeActiveProvider(): Promise<IStorageProvider> {
    const activeConfig = await this.configService.getActiveConfig();
    const provider = this.providers.get(activeConfig.provider);

    if (!provider) {
      throw new BadRequestException({
        code: ErrorCodes.VALIDATION_ERROR,
        message: `Proveedor no disponible: ${activeConfig.provider}`,
      });
    }

    // Inicializar si no está inicializado
    if (!this.initializedProviders.has(activeConfig.provider)) {
      const providerConfig = await this.configService.getProviderConfig(
        activeConfig.provider,
      );
      await provider.initialize(providerConfig);
      this.initializedProviders.add(activeConfig.provider);
      this.logger.log(`Provider initialized: ${activeConfig.provider}`);
    }

    return provider;
  }

  /**
   * Obtener el proveedor activo (inicializándolo si es necesario)
   */
  private async getActiveProvider(): Promise<IStorageProvider> {
    return this.initializeActiveProvider();
  }

  /**
   * Inicializar un proveedor específico (para testing)
   */
  async initializeProvider(providerType: StorageProviderType): Promise<void> {
    const provider = this.providers.get(providerType);
    if (!provider) {
      throw new BadRequestException({
        code: ErrorCodes.VALIDATION_ERROR,
        message: `Proveedor no disponible: ${providerType}`,
      });
    }

    const providerConfig =
      await this.configService.getProviderConfig(providerType);
    await provider.initialize(providerConfig);
    this.initializedProviders.add(providerType);
  }

  /**
   * Reinicializar el proveedor activo (después de cambiar config)
   */
  async reinitializeActiveProvider(): Promise<void> {
    const activeConfig = await this.configService.getActiveConfig();
    this.initializedProviders.delete(activeConfig.provider);
    await this.initializeActiveProvider();
  }

  // ===== Operaciones de Storage =====

  /**
   * Subir un archivo
   */
  async upload(
    file: Buffer | Readable,
    options: UploadOptions,
  ): Promise<StorageResult> {
    const provider = await this.getActiveProvider();

    // Validar tamaño si se proporciona
    const config = await this.configService.getActiveConfig();
    if (options.size && config.settings.maxFileSize) {
      if (options.size > config.settings.maxFileSize) {
        throw new BadRequestException({
          code: ErrorCodes.VALIDATION_ERROR,
          message: `El archivo excede el tamaño máximo permitido (${Math.round(config.settings.maxFileSize / 1024 / 1024)}MB)`,
        });
      }
    }

    // Validar tipo MIME si hay restricciones
    if (
      options.mimeType &&
      config.settings.allowedMimeTypes &&
      config.settings.allowedMimeTypes.length > 0
    ) {
      if (!config.settings.allowedMimeTypes.includes(options.mimeType)) {
        throw new BadRequestException({
          code: ErrorCodes.VALIDATION_ERROR,
          message: `Tipo de archivo no permitido: ${options.mimeType}`,
        });
      }
    }

    // Aplicar configuración por defecto
    if (options.isPublic === undefined) {
      options.isPublic = config.settings.defaultPublic;
    }

    // Agregar prefijo si está configurado
    if (config.settings.pathPrefix) {
      options.path = `${config.settings.pathPrefix}/${options.path}`;
    }

    return provider.upload(file, options);
  }

  /**
   * Descargar un archivo
   */
  async download(path: string): Promise<Buffer> {
    const provider = await this.getActiveProvider();
    return provider.download(path);
  }

  /**
   * Obtener un stream de lectura del archivo
   */
  async getReadStream(path: string): Promise<Readable> {
    const provider = await this.getActiveProvider();
    return provider.getReadStream(path);
  }

  /**
   * Eliminar un archivo
   */
  async delete(path: string): Promise<boolean> {
    const provider = await this.getActiveProvider();
    return provider.delete(path);
  }

  /**
   * Eliminar múltiples archivos
   */
  async deleteMany(paths: string[]): Promise<number> {
    const provider = await this.getActiveProvider();
    return provider.deleteMany(paths);
  }

  /**
   * Verificar si un archivo existe
   */
  async exists(path: string): Promise<boolean> {
    const provider = await this.getActiveProvider();
    return provider.exists(path);
  }

  /**
   * Obtener la URL de un archivo
   */
  async getUrl(path: string, options?: UrlOptions): Promise<string> {
    const provider = await this.getActiveProvider();
    return provider.getUrl(path, options);
  }

  /**
   * Obtener una URL firmada
   */
  async getSignedUrl(path: string, expiresIn?: number): Promise<string> {
    const provider = await this.getActiveProvider();
    return provider.getSignedUrl(path, expiresIn);
  }

  /**
   * Obtener metadatos de un archivo
   */
  async getMetadata(path: string): Promise<FileMetadata> {
    const provider = await this.getActiveProvider();
    return provider.getMetadata(path);
  }

  /**
   * Copiar un archivo
   */
  async copy(
    sourcePath: string,
    destinationPath: string,
  ): Promise<StorageResult> {
    const provider = await this.getActiveProvider();
    return provider.copy(sourcePath, destinationPath);
  }

  /**
   * Mover un archivo
   */
  async move(
    sourcePath: string,
    destinationPath: string,
  ): Promise<StorageResult> {
    const provider = await this.getActiveProvider();
    return provider.move(sourcePath, destinationPath);
  }

  /**
   * Listar archivos en un directorio
   */
  async list(
    path: string,
    options?: { recursive?: boolean; limit?: number },
  ): Promise<FileMetadata[]> {
    const provider = await this.getActiveProvider();
    return provider.list(path, options);
  }

  /**
   * Validar la configuración del proveedor activo
   */
  async validateActiveProvider(): Promise<boolean> {
    const provider = await this.getActiveProvider();
    return provider.validateConfig();
  }

  /**
   * Validar un proveedor específico
   */
  async validateProvider(providerType: StorageProviderType): Promise<{
    success: boolean;
    message: string;
    responseTime?: number;
  }> {
    const startTime = Date.now();

    try {
      // Inicializar temporalmente el proveedor
      const provider = this.providers.get(providerType);
      if (!provider) {
        return {
          success: false,
          message: `Proveedor no disponible: ${providerType}`,
        };
      }

      const providerConfig =
        await this.configService.getProviderConfig(providerType);
      await provider.initialize(providerConfig);

      const isValid = await provider.validateConfig();
      const responseTime = Date.now() - startTime;

      // Registrar resultado
      await this.configService.setValidationResult(
        providerType,
        isValid,
        isValid ? undefined : 'Validation failed',
      );

      if (isValid) {
        this.initializedProviders.add(providerType);
      }

      return {
        success: isValid,
        message: isValid
          ? 'Conexión verificada correctamente'
          : 'No se pudo verificar la conexión',
        responseTime,
      };
    } catch (error: any) {
      const responseTime = Date.now() - startTime;

      // Registrar error
      await this.configService.setValidationResult(
        providerType,
        false,
        error.message || 'Unknown error',
      );

      return {
        success: false,
        message: error.message || 'Error al validar el proveedor',
        responseTime,
      };
    }
  }

  /**
   * Obtener información del espacio usado
   */
  async getUsageInfo(): Promise<{
    used: number;
    total?: number;
    available?: number;
  }> {
    const provider = await this.getActiveProvider();
    if (provider.getUsageInfo) {
      return provider.getUsageInfo();
    }
    return { used: 0 };
  }

  /**
   * Obtener el proveedor activo actual
   */
  async getActiveProviderType(): Promise<StorageProviderType> {
    const config = await this.configService.getActiveConfig();
    return config.provider;
  }
}
