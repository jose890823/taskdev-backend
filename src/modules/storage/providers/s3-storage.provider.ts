import { Injectable, Logger } from '@nestjs/common';
import { Readable } from 'stream';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  HeadObjectCommand,
  CopyObjectCommand,
  ListObjectsV2Command,
  PutObjectCommandInput,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
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
import { S3Config } from '../entities/storage-config.entity';

/**
 * Proveedor de almacenamiento S3 (Amazon S3 y compatibles)
 */
@Injectable()
export class S3StorageProvider implements IStorageProvider {
  private readonly logger = new Logger(S3StorageProvider.name);
  readonly providerType = StorageProviderType.S3;

  private client: S3Client | null = null;
  private bucket: string = '';
  private region: string = 'us-east-1';
  private endpoint?: string;
  private defaultExpiration = 3600; // 1 hora
  private initialized = false;

  /**
   * Inicializar el proveedor con su configuración
   */
  async initialize(providerConfig: StorageProviderConfig): Promise<void> {
    const config = providerConfig.config as S3Config;

    this.bucket = config.bucket;
    this.region = config.region;
    this.endpoint = config.endpoint;
    this.defaultExpiration = providerConfig.settings?.urlExpiration || 3600;

    const clientConfig: any = {
      region: this.region,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    };

    // Para S3-compatible (MinIO, DigitalOcean, etc.)
    if (config.endpoint) {
      clientConfig.endpoint = config.endpoint;
      clientConfig.forcePathStyle = config.forcePathStyle ?? true;
    }

    this.client = new S3Client(clientConfig);
    this.initialized = true;

    this.logger.log(`S3StorageProvider initialized for bucket: ${this.bucket}`);
  }

  /**
   * Subir un archivo
   */
  async upload(
    file: Buffer | Readable,
    options: UploadOptions,
  ): Promise<StorageResult> {
    this.ensureInitialized();

    const filename =
      options.filename || this.generateFilename(options.mimeType);
    const key = this.normalizeKey(`${options.path}/${filename}`);

    const params: PutObjectCommandInput = {
      Bucket: this.bucket,
      Key: key,
      Body: file,
      ContentType: options.mimeType || 'application/octet-stream',
      Metadata: options.metadata,
    };

    // Configurar ACL si es público
    if (options.isPublic) {
      params.ACL = 'public-read';
    }

    const command = new PutObjectCommand(params);
    const response = await this.client!.send(command);

    const size = options.size || (Buffer.isBuffer(file) ? file.length : 0);

    const result: StorageResult = {
      path: key,
      url: await this.getUrl(key),
      publicUrl: options.isPublic ? this.getPublicUrl(key) : undefined,
      size,
      mimeType: options.mimeType || 'application/octet-stream',
      provider: this.providerType,
      etag: response.ETag?.replace(/"/g, ''),
      metadata: options.metadata,
    };

    this.logger.log(`File uploaded to S3: ${key}`);
    return result;
  }

  /**
   * Descargar un archivo
   */
  async download(filePath: string): Promise<Buffer> {
    this.ensureInitialized();

    const key = this.normalizeKey(filePath);
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    const response = await this.client!.send(command);

    if (!response.Body) {
      throw new Error(`File not found: ${filePath}`);
    }

    // Convertir stream a buffer
    const chunks: Buffer[] = [];
    for await (const chunk of response.Body as Readable) {
      chunks.push(Buffer.from(chunk));
    }

    return Buffer.concat(chunks);
  }

  /**
   * Obtener un stream de lectura del archivo
   */
  async getReadStream(filePath: string): Promise<Readable> {
    this.ensureInitialized();

    const key = this.normalizeKey(filePath);
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    const response = await this.client!.send(command);

    if (!response.Body) {
      throw new Error(`File not found: ${filePath}`);
    }

    return response.Body as Readable;
  }

  /**
   * Eliminar un archivo
   */
  async delete(filePath: string): Promise<boolean> {
    this.ensureInitialized();

    const key = this.normalizeKey(filePath);

    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });

      await this.client!.send(command);
      this.logger.log(`File deleted from S3: ${key}`);
      return true;
    } catch (error: any) {
      if (error.name === 'NoSuchKey') {
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

    const objects = paths.map((p) => ({ Key: this.normalizeKey(p) }));

    const command = new DeleteObjectsCommand({
      Bucket: this.bucket,
      Delete: { Objects: objects },
    });

    const response = await this.client!.send(command);
    return response.Deleted?.length || 0;
  }

  /**
   * Verificar si un archivo existe
   */
  async exists(filePath: string): Promise<boolean> {
    this.ensureInitialized();

    const key = this.normalizeKey(filePath);

    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });

      await this.client!.send(command);
      return true;
    } catch (error: any) {
      if (
        error.name === 'NotFound' ||
        error.$metadata?.httpStatusCode === 404
      ) {
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

    const key = this.normalizeKey(filePath);

    if (options?.signed !== false) {
      return this.getSignedUrl(key, options?.expiresIn);
    }

    return this.getPublicUrl(key);
  }

  /**
   * Obtener una URL firmada
   */
  async getSignedUrl(filePath: string, expiresIn?: number): Promise<string> {
    this.ensureInitialized();

    const key = this.normalizeKey(filePath);
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    return getSignedUrl(this.client!, command, {
      expiresIn: expiresIn || this.defaultExpiration,
    });
  }

  /**
   * Obtener metadatos de un archivo
   */
  async getMetadata(filePath: string): Promise<FileMetadata> {
    this.ensureInitialized();

    const key = this.normalizeKey(filePath);
    const command = new HeadObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    const response = await this.client!.send(command);

    return {
      path: key,
      size: response.ContentLength || 0,
      mimeType: response.ContentType || 'application/octet-stream',
      lastModified: response.LastModified || new Date(),
      etag: response.ETag?.replace(/"/g, ''),
      metadata: response.Metadata,
    };
  }

  /**
   * Copiar un archivo
   */
  async copy(
    sourcePath: string,
    destinationPath: string,
  ): Promise<StorageResult> {
    this.ensureInitialized();

    const sourceKey = this.normalizeKey(sourcePath);
    const destKey = this.normalizeKey(destinationPath);

    const command = new CopyObjectCommand({
      Bucket: this.bucket,
      CopySource: `${this.bucket}/${sourceKey}`,
      Key: destKey,
    });

    const response = await this.client!.send(command);

    // Obtener metadatos del archivo copiado
    const metadata = await this.getMetadata(destKey);

    return {
      path: destKey,
      url: await this.getUrl(destKey),
      size: metadata.size,
      mimeType: metadata.mimeType,
      provider: this.providerType,
      etag: response.CopyObjectResult?.ETag?.replace(/"/g, ''),
    };
  }

  /**
   * Mover un archivo
   */
  async move(
    sourcePath: string,
    destinationPath: string,
  ): Promise<StorageResult> {
    const result = await this.copy(sourcePath, destinationPath);
    await this.delete(sourcePath);
    return result;
  }

  /**
   * Listar archivos en un directorio
   */
  async list(
    dirPath: string,
    options?: { recursive?: boolean; limit?: number },
  ): Promise<FileMetadata[]> {
    this.ensureInitialized();

    const prefix = this.normalizeKey(dirPath);
    const files: FileMetadata[] = [];

    let continuationToken: string | undefined;

    do {
      const command = new ListObjectsV2Command({
        Bucket: this.bucket,
        Prefix: prefix ? `${prefix}/` : undefined,
        Delimiter: options?.recursive ? undefined : '/',
        MaxKeys: options?.limit
          ? Math.min(options.limit - files.length, 1000)
          : 1000,
        ContinuationToken: continuationToken,
      });

      const response = await this.client!.send(command);

      if (response.Contents) {
        for (const item of response.Contents) {
          if (item.Key) {
            files.push({
              path: item.Key,
              size: item.Size || 0,
              mimeType: this.getMimeType(item.Key),
              lastModified: item.LastModified || new Date(),
              etag: item.ETag?.replace(/"/g, ''),
            });
          }
        }
      }

      continuationToken = response.NextContinuationToken;

      // Si hay límite y ya lo alcanzamos, salir
      if (options?.limit && files.length >= options.limit) {
        break;
      }
    } while (continuationToken);

    return files;
  }

  /**
   * Validar la configuración del proveedor
   */
  async validateConfig(): Promise<boolean> {
    try {
      this.ensureInitialized();

      // Intentar listar objetos (sin límite de permisos mínimos)
      const command = new ListObjectsV2Command({
        Bucket: this.bucket,
        MaxKeys: 1,
      });

      await this.client!.send(command);
      return true;
    } catch (error) {
      this.logger.error('S3 validation failed', error);
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
    // S3 no tiene límites de espacio tradicionales
    // Podríamos sumar el tamaño de todos los objetos, pero sería costoso
    return { used: 0 };
  }

  // ===== Métodos privados =====

  private ensureInitialized(): void {
    if (!this.initialized || !this.client) {
      throw new Error('S3StorageProvider not initialized');
    }
  }

  private normalizeKey(key: string): string {
    // Remover slashes iniciales y normalizar
    return key.replace(/^\/+/, '').replace(/\/+/g, '/');
  }

  private getPublicUrl(key: string): string {
    if (this.endpoint) {
      return `${this.endpoint}/${this.bucket}/${key}`;
    }
    return `https://${this.bucket}.s3.${this.region}.amazonaws.com/${key}`;
  }

  private generateFilename(mimeType?: string): string {
    const ext = this.getExtensionFromMimeType(mimeType);
    return `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ext}`;
  }

  private getExtensionFromMimeType(mimeType?: string): string {
    if (!mimeType) return '';

    const mimeToExt: Record<string, string> = {
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/gif': '.gif',
      'image/webp': '.webp',
      'application/pdf': '.pdf',
      'video/mp4': '.mp4',
      'audio/mpeg': '.mp3',
    };

    return mimeToExt[mimeType] || '';
  }

  private getMimeType(key: string): string {
    const ext = key.split('.').pop()?.toLowerCase() || '';

    const extToMime: Record<string, string> = {
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      gif: 'image/gif',
      webp: 'image/webp',
      pdf: 'application/pdf',
      mp4: 'video/mp4',
      mp3: 'audio/mpeg',
    };

    return extToMime[ext] || 'application/octet-stream';
  }
}
