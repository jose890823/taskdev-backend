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
  // eslint-disable-next-line @typescript-eslint/require-await
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

    return Readable.fromWeb(
      response.body as Parameters<typeof Readable.fromWeb>[0],
    );
  }

  /**
   * Eliminar un archivo
   */
  async delete(filePath: string): Promise<boolean> {
    this.ensureInitialized();

    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- cloudinary SDK uploader.destroy returns untyped result
      const result = await cloudinary.uploader.destroy(filePath, {
        resource_type: 'auto',
        invalidate: true,
      });

      this.logger.log(`File deleted from Cloudinary: ${filePath}`);

      return (result as Record<string, unknown>).result === 'ok';
    } catch (error: unknown) {
      if ((error as Record<string, unknown>).http_code === 404) {
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

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- cloudinary SDK api.delete_resources returns untyped result
    const result = await cloudinary.api.delete_resources(paths, {
      resource_type: 'auto',
      invalidate: true,
    });

    const deleted = (result as Record<string, unknown>).deleted;
    return Object.values((deleted as Record<string, unknown>) || {}).filter(
      (v) => v === 'deleted',
    ).length;
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
    } catch (error: unknown) {
      if ((error as Record<string, unknown>).http_code === 404) {
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

    let flags: string | undefined;

    if (options?.forceDownload) {
      flags = options.downloadFilename
        ? `attachment:${options.downloadFilename}`
        : 'attachment';
    }

    if (options?.signed) {
      return this.getSignedUrl(filePath, options.expiresIn);
    }

    return cloudinary.url(filePath, {
      secure: true,
      resource_type: 'auto',
      ...(flags ? { flags } : {}),
    });
  }

  /**
   * Obtener una URL firmada
   */
  // eslint-disable-next-line @typescript-eslint/require-await -- cloudinary.url is synchronous; async keeps interface contract
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

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- cloudinary SDK returns untyped resource objects
    const resource = await cloudinary.api.resource(filePath, {
      resource_type: 'auto',
    });

    const r = resource as Record<string, unknown>;
    return {
      path: r.public_id as string,
      size: r.bytes as number,
      mimeType: this.getMimeTypeFromFormat(r.format as string),
      lastModified: new Date(r.created_at as string),
      etag: r.etag as string | undefined,
      metadata: {
        format: r.format as string,
        width: (r.width as number | undefined)?.toString() ?? '',
        height: (r.height as number | undefined)?.toString() ?? '',
        resourceType: r.resource_type as string,
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

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- cloudinary SDK returns untyped rename result
    const result = await cloudinary.uploader.rename(
      sourcePath,
      destinationPath,
      {
        resource_type: 'auto',
        overwrite: true,
      },
    );

    const r = result as Record<string, unknown>;
    return {
      path: r.public_id as string,
      url: r.secure_url as string,
      size: r.bytes as number,
      mimeType: this.getMimeTypeFromFormat(r.format as string),
      provider: this.providerType,
      etag: r.etag as string | undefined,
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
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- cloudinary SDK returns untyped resources list
      const result = await cloudinary.api.resources({
        type: 'upload',
        prefix: prefix || undefined,
        max_results: options?.limit
          ? Math.min(options.limit - files.length, 500)
          : 500,
        next_cursor: nextCursor,
      });

      const r = result as Record<string, unknown>;
      const resources = (r.resources as Record<string, unknown>[]) ?? [];
      for (const resource of resources) {
        files.push({
          path: resource.public_id as string,
          size: resource.bytes as number,
          mimeType: this.getMimeTypeFromFormat(resource.format as string),
          lastModified: new Date(resource.created_at as string),
        });
      }

      nextCursor = r.next_cursor as string | undefined;

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

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- cloudinary SDK returns untyped usage object
    const usageRaw = await cloudinary.api.usage();
    const usage = usageRaw as Record<string, unknown>;
    const storage = usage.storage as Record<string, number> | undefined;

    return {
      used: storage?.usage ?? 0,
      total: storage?.limit,
      available:
        storage?.limit != null
          ? storage.limit - (storage.usage ?? 0)
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
    return new Promise<UploadApiResponse>((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        options,
        (error, result) => {
          if (error)
            reject(new Error(error.message ?? 'Cloudinary upload error'));
          else if (result) resolve(result);
          else reject(new Error('Upload failed: no result returned'));
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
    return new Promise<UploadApiResponse>((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        options,
        (error, result) => {
          if (error)
            reject(new Error(error.message ?? 'Cloudinary upload error'));
          else if (result) resolve(result);
          else reject(new Error('Upload failed: no result returned'));
        },
      );

      stream.pipe(uploadStream);
    });
  }
}
