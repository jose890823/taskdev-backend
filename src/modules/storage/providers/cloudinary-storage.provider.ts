import { Injectable, Logger } from '@nestjs/common';
import { Readable } from 'stream';
import {
  v2 as cloudinary,
  UploadApiResponse,
  UploadApiOptions,
} from 'cloudinary';
import * as crypto from 'crypto';
import {
  IStorageProvider,
  StorageProviderType,
  StorageProviderConfig,
  UploadOptions,
  StorageResult,
  UrlOptions,
  FileMetadata,
} from '../interfaces/storage-provider.interface';
import { CloudinaryConfig } from '../entities/storage-config.entity';

/**
 * Proveedor de almacenamiento Cloudinary
 * Optimizado para imágenes y videos con transformaciones automáticas
 */
@Injectable()
export class CloudinaryStorageProvider implements IStorageProvider {
  private readonly logger = new Logger(CloudinaryStorageProvider.name);
  readonly providerType = StorageProviderType.CLOUDINARY;

  private folder: string = '';
  private cloudName: string = '';
  private defaultExpiration = 3600;
  private initialized = false;

  /**
   * Inicializar el proveedor con su configuración
   */
  async initialize(providerConfig: StorageProviderConfig): Promise<void> {
    const config = providerConfig.config as CloudinaryConfig;

    this.cloudName = config.cloudName;
    this.folder = config.folder || '';
    this.defaultExpiration = providerConfig.settings?.urlExpiration || 3600;

    cloudinary.config({
      cloud_name: config.cloudName,
      api_key: config.apiKey,
      api_secret: config.apiSecret,
      secure: true,
    });

    this.initialized = true;
    this.logger.log(
      `CloudinaryStorageProvider initialized for cloud: ${config.cloudName}`,
    );
  }

  /**
   * Subir un archivo
   */
  async upload(
    file: Buffer | Readable,
    options: UploadOptions,
  ): Promise<StorageResult> {
    this.ensureInitialized();

    const filename = options.filename || this.generateFilename();
    const publicId = this.buildPublicId(options.path, filename);

    const uploadOptions: UploadApiOptions = {
      public_id: publicId,
      resource_type: this.getResourceType(options.mimeType),
      folder: this.folder || undefined,
      access_mode: options.isPublic ? 'public' : 'authenticated',
      context: options.metadata
        ? Object.entries(options.metadata)
            .map(([k, v]) => `${k}=${v}`)
            .join('|')
        : undefined,
    };

    let response: UploadApiResponse;

    if (Buffer.isBuffer(file)) {
      response = await this.uploadBuffer(file, uploadOptions);
    } else {
      response = await this.uploadStream(file, uploadOptions);
    }

    const result: StorageResult = {
      path: response.public_id,
      url: response.secure_url,
      publicUrl: options.isPublic ? response.secure_url : undefined,
      size: response.bytes,
      mimeType: options.mimeType || this.getMimeTypeFromFormat(response.format),
      provider: this.providerType,
      etag: response.etag,
      metadata: {
        format: response.format,
        width: response.width?.toString(),
        height: response.height?.toString(),
        resourceType: response.resource_type,
      },
    };

    this.logger.log(`File uploaded to Cloudinary: ${response.public_id}`);
    return result;
  }

  /**
   * Descargar un archivo
   */
  async download(filePath: string): Promise<Buffer> {
    this.ensureInitialized();

    const url = cloudinary.url(filePath, {
      secure: true,
      resource_type: 'auto',
    });

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`File not found: ${filePath}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  /**
   * Obtener un stream de lectura del archivo
   */
  async getReadStream(filePath: string): Promise<Readable> {
    this.ensureInitialized();

    const url = cloudinary.url(filePath, {
      secure: true,
      resource_type: 'auto',
    });

    const response = await fetch(url);
    if (!response.ok || !response.body) {
      throw new Error(`File not found: ${filePath}`);
    }

    // Convertir web stream a Node.js Readable
    return Readable.fromWeb(response.body as any);
  }

  /**
   * Eliminar un archivo
   */
  async delete(filePath: string): Promise<boolean> {
    this.ensureInitialized();

    try {
      const result = await cloudinary.uploader.destroy(filePath, {
        resource_type: 'auto',
        invalidate: true,
      });

      this.logger.log(`File deleted from Cloudinary: ${filePath}`);
      return result.result === 'ok';
    } catch (error: any) {
      if (error.http_code === 404) {
        return false;
      }
      throw error;
    }
  }

  /**
   * Eliminar múltiples archivos
   */
  async deleteMany(paths: string[]): Promise<number> {
    this.ensureInitialized();

    if (paths.length === 0) return 0;

    const result = await cloudinary.api.delete_resources(paths, {
      resource_type: 'auto',
      invalidate: true,
    });

    return Object.values(result.deleted || {}).filter((v) => v === 'deleted')
      .length;
  }

  /**
   * Verificar si un archivo existe
   */
  async exists(filePath: string): Promise<boolean> {
    this.ensureInitialized();

    try {
      await cloudinary.api.resource(filePath, {
        resource_type: 'auto',
      });
      return true;
    } catch (error: any) {
      if (error.http_code === 404) {
        return false;
      }
      throw error;
    }
  }

  /**
   * Obtener la URL de un archivo
   */
  async getUrl(filePath: string, options?: UrlOptions): Promise<string> {
    this.ensureInitialized();

    const urlOptions: any = {
      secure: true,
      resource_type: 'auto',
    };

    if (options?.forceDownload) {
      urlOptions.flags = 'attachment';
      if (options.downloadFilename) {
        urlOptions.flags += `:${options.downloadFilename}`;
      }
    }

    if (options?.signed) {
      return this.getSignedUrl(filePath, options.expiresIn);
    }

    return cloudinary.url(filePath, urlOptions);
  }

  /**
   * Obtener una URL firmada
   */
  async getSignedUrl(filePath: string, expiresIn?: number): Promise<string> {
    this.ensureInitialized();

    const expiration = expiresIn || this.defaultExpiration;
    const timestamp = Math.floor(Date.now() / 1000) + expiration;

    return cloudinary.url(filePath, {
      secure: true,
      resource_type: 'auto',
      sign_url: true,
      type: 'authenticated',
      expires_at: timestamp,
    });
  }

  /**
   * Obtener metadatos de un archivo
   */
  async getMetadata(filePath: string): Promise<FileMetadata> {
    this.ensureInitialized();

    const resource = await cloudinary.api.resource(filePath, {
      resource_type: 'auto',
    });

    return {
      path: resource.public_id,
      size: resource.bytes,
      mimeType: this.getMimeTypeFromFormat(resource.format),
      lastModified: new Date(resource.created_at),
      etag: resource.etag,
      metadata: {
        format: resource.format,
        width: resource.width?.toString(),
        height: resource.height?.toString(),
        resourceType: resource.resource_type,
      },
    };
  }

  /**
   * Copiar un archivo
   * Cloudinary no tiene copia directa, usamos rename con overwrite
   */
  async copy(
    sourcePath: string,
    destinationPath: string,
  ): Promise<StorageResult> {
    this.ensureInitialized();

    // Descargar y volver a subir
    const buffer = await this.download(sourcePath);
    const metadata = await this.getMetadata(sourcePath);

    return this.upload(buffer, {
      path: '',
      filename: destinationPath,
      mimeType: metadata.mimeType,
    });
  }

  /**
   * Mover un archivo (rename)
   */
  async move(
    sourcePath: string,
    destinationPath: string,
  ): Promise<StorageResult> {
    this.ensureInitialized();

    const result = await cloudinary.uploader.rename(
      sourcePath,
      destinationPath,
      {
        resource_type: 'auto',
        overwrite: true,
      },
    );

    return {
      path: result.public_id,
      url: result.secure_url,
      size: result.bytes,
      mimeType: this.getMimeTypeFromFormat(result.format),
      provider: this.providerType,
      etag: result.etag,
    };
  }

  /**
   * Listar archivos en un directorio (prefijo)
   */
  async list(
    dirPath: string,
    options?: { recursive?: boolean; limit?: number },
  ): Promise<FileMetadata[]> {
    this.ensureInitialized();

    const prefix = this.folder ? `${this.folder}/${dirPath}` : dirPath;
    const files: FileMetadata[] = [];

    let nextCursor: string | undefined;

    do {
      const result = await cloudinary.api.resources({
        type: 'upload',
        prefix: prefix || undefined,
        max_results: options?.limit
          ? Math.min(options.limit - files.length, 500)
          : 500,
        next_cursor: nextCursor,
      });

      for (const resource of result.resources) {
        files.push({
          path: resource.public_id,
          size: resource.bytes,
          mimeType: this.getMimeTypeFromFormat(resource.format),
          lastModified: new Date(resource.created_at),
        });
      }

      nextCursor = result.next_cursor;

      if (options?.limit && files.length >= options.limit) {
        break;
      }
    } while (nextCursor);

    return files;
  }

  /**
   * Validar la configuración del proveedor
   */
  async validateConfig(): Promise<boolean> {
    try {
      this.ensureInitialized();

      // Intentar obtener uso de cuenta
      await cloudinary.api.usage();
      return true;
    } catch (error) {
      this.logger.error('Cloudinary validation failed', error);
      return false;
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
    this.ensureInitialized();

    const usage = await cloudinary.api.usage();

    return {
      used: usage.storage?.usage || 0,
      total: usage.storage?.limit,
      available: usage.storage?.limit
        ? usage.storage.limit - usage.storage.usage
        : undefined,
    };
  }

  // ===== Métodos privados =====

  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('CloudinaryStorageProvider not initialized');
    }
  }

  private buildPublicId(path: string, filename: string): string {
    // Remover extensión del filename para public_id
    const nameWithoutExt = filename.replace(/\.[^/.]+$/, '');
    const cleanPath = path.replace(/^\/+|\/+$/g, '');

    if (cleanPath) {
      return `${cleanPath}/${nameWithoutExt}`;
    }
    return nameWithoutExt;
  }

  private getResourceType(
    mimeType?: string,
  ): 'image' | 'video' | 'raw' | 'auto' {
    if (!mimeType) return 'auto';

    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType.startsWith('video/')) return 'video';
    if (mimeType.startsWith('audio/')) return 'video'; // Cloudinary maneja audio como video

    return 'raw';
  }

  private getMimeTypeFromFormat(format: string): string {
    const formatToMime: Record<string, string> = {
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      gif: 'image/gif',
      webp: 'image/webp',
      svg: 'image/svg+xml',
      pdf: 'application/pdf',
      mp4: 'video/mp4',
      webm: 'video/webm',
      mp3: 'audio/mpeg',
    };

    return formatToMime[format] || 'application/octet-stream';
  }

  private generateFilename(): string {
    return `${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
  }

  private uploadBuffer(
    buffer: Buffer,
    options: UploadApiOptions,
  ): Promise<UploadApiResponse> {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        options,
        (error, result) => {
          if (error) reject(error);
          else if (result) resolve(result);
          else reject(new Error('Upload failed'));
        },
      );

      const readable = new Readable();
      readable.push(buffer);
      readable.push(null);
      readable.pipe(uploadStream);
    });
  }

  private uploadStream(
    stream: Readable,
    options: UploadApiOptions,
  ): Promise<UploadApiResponse> {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        options,
        (error, result) => {
          if (error) reject(error);
          else if (result) resolve(result);
          else reject(new Error('Upload failed'));
        },
      );

      stream.pipe(uploadStream);
    });
  }
}
