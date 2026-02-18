import { Injectable, Logger } from '@nestjs/common';
import { Readable } from 'stream';
import {
  Storage,
  Bucket,
  File,
  GetSignedUrlConfig,
} from '@google-cloud/storage';
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
import { GCSConfig } from '../entities/storage-config.entity';

/**
 * Proveedor de almacenamiento Google Cloud Storage
 */
@Injectable()
export class GCSStorageProvider implements IStorageProvider {
  private readonly logger = new Logger(GCSStorageProvider.name);
  readonly providerType = StorageProviderType.GCS;

  private storage: Storage | null = null;
  private bucket: Bucket | null = null;
  private bucketName: string = '';
  private defaultExpiration = 3600;
  private initialized = false;

  /**
   * Inicializar el proveedor con su configuración
   */
  async initialize(providerConfig: StorageProviderConfig): Promise<void> {
    const config = providerConfig.config as GCSConfig;

    this.bucketName = config.bucket;
    this.defaultExpiration = providerConfig.settings?.urlExpiration || 3600;

    const storageOptions: any = {
      projectId: config.projectId,
    };

    // Usar archivo de credenciales o credenciales directas
    if (config.keyFilename) {
      storageOptions.keyFilename = config.keyFilename;
    } else if (config.credentials) {
      storageOptions.credentials = config.credentials;
    }

    this.storage = new Storage(storageOptions);
    this.bucket = this.storage.bucket(config.bucket);

    this.initialized = true;
    this.logger.log(
      `GCSStorageProvider initialized for bucket: ${config.bucket}`,
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

    const filename =
      options.filename || this.generateFilename(options.mimeType);
    const key = this.normalizeKey(`${options.path}/${filename}`);

    const gcsFile = this.bucket!.file(key);

    const uploadOptions: any = {
      metadata: {
        contentType: options.mimeType || 'application/octet-stream',
        metadata: options.metadata,
      },
      resumable: false,
    };

    if (options.isPublic) {
      uploadOptions.predefinedAcl = 'publicRead';
    }

    if (Buffer.isBuffer(file)) {
      await gcsFile.save(file, uploadOptions);
    } else {
      await this.uploadStream(file, gcsFile, uploadOptions);
    }

    // Obtener metadatos del archivo subido
    const [metadata] = await gcsFile.getMetadata();

    const result: StorageResult = {
      path: key,
      url: options.isPublic
        ? this.getPublicUrl(key)
        : await this.getSignedUrl(key),
      publicUrl: options.isPublic ? this.getPublicUrl(key) : undefined,
      size: Number(metadata.size) || (Buffer.isBuffer(file) ? file.length : 0),
      mimeType: options.mimeType || 'application/octet-stream',
      provider: this.providerType,
      etag: metadata.etag,
      metadata: options.metadata,
    };

    this.logger.log(`File uploaded to GCS: ${key}`);
    return result;
  }

  /**
   * Descargar un archivo
   */
  async download(filePath: string): Promise<Buffer> {
    this.ensureInitialized();

    const key = this.normalizeKey(filePath);
    const gcsFile = this.bucket!.file(key);

    const [buffer] = await gcsFile.download();
    return buffer;
  }

  /**
   * Obtener un stream de lectura del archivo
   */
  async getReadStream(filePath: string): Promise<Readable> {
    this.ensureInitialized();

    const key = this.normalizeKey(filePath);
    const gcsFile = this.bucket!.file(key);

    return gcsFile.createReadStream();
  }

  /**
   * Eliminar un archivo
   */
  async delete(filePath: string): Promise<boolean> {
    this.ensureInitialized();

    const key = this.normalizeKey(filePath);
    const gcsFile = this.bucket!.file(key);

    try {
      await gcsFile.delete();
      this.logger.log(`File deleted from GCS: ${key}`);
      return true;
    } catch (error: any) {
      if (error.code === 404) {
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

    let deleted = 0;

    // GCS no tiene una operación de eliminación masiva nativa
    // Usamos Promise.all para paralelizar
    const results = await Promise.allSettled(paths.map((p) => this.delete(p)));

    for (const result of results) {
      if (result.status === 'fulfilled' && result.value) {
        deleted++;
      }
    }

    return deleted;
  }

  /**
   * Verificar si un archivo existe
   */
  async exists(filePath: string): Promise<boolean> {
    this.ensureInitialized();

    const key = this.normalizeKey(filePath);
    const gcsFile = this.bucket!.file(key);

    const [exists] = await gcsFile.exists();
    return exists;
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
    const gcsFile = this.bucket!.file(key);

    const options: GetSignedUrlConfig = {
      version: 'v4',
      action: 'read',
      expires: Date.now() + (expiresIn || this.defaultExpiration) * 1000,
    };

    const [url] = await gcsFile.getSignedUrl(options);
    return url;
  }

  /**
   * Obtener metadatos de un archivo
   */
  async getMetadata(filePath: string): Promise<FileMetadata> {
    this.ensureInitialized();

    const key = this.normalizeKey(filePath);
    const gcsFile = this.bucket!.file(key);

    const [metadata] = await gcsFile.getMetadata();

    return {
      path: key,
      size: Number(metadata.size) || 0,
      mimeType: metadata.contentType || 'application/octet-stream',
      lastModified: new Date(
        metadata.updated || metadata.timeCreated || Date.now(),
      ),
      etag: metadata.etag,
      metadata: metadata.metadata as Record<string, string> | undefined,
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

    const sourceFile = this.bucket!.file(sourceKey);
    const destFile = this.bucket!.file(destKey);

    await sourceFile.copy(destFile);

    // Obtener metadatos del archivo copiado
    const metadata = await this.getMetadata(destKey);

    return {
      path: destKey,
      url: await this.getSignedUrl(destKey),
      size: metadata.size,
      mimeType: metadata.mimeType,
      provider: this.providerType,
      etag: metadata.etag,
    };
  }

  /**
   * Mover un archivo
   */
  async move(
    sourcePath: string,
    destinationPath: string,
  ): Promise<StorageResult> {
    this.ensureInitialized();

    const sourceKey = this.normalizeKey(sourcePath);
    const destKey = this.normalizeKey(destinationPath);

    const sourceFile = this.bucket!.file(sourceKey);
    const destFile = this.bucket!.file(destKey);

    await sourceFile.move(destFile);

    const metadata = await this.getMetadata(destKey);

    return {
      path: destKey,
      url: await this.getSignedUrl(destKey),
      size: metadata.size,
      mimeType: metadata.mimeType,
      provider: this.providerType,
      etag: metadata.etag,
    };
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

    const listOptions: any = {
      prefix: prefix ? `${prefix}/` : undefined,
      maxResults: options?.limit || 1000,
    };

    if (!options?.recursive) {
      listOptions.delimiter = '/';
    }

    const [gcsFiles] = await this.bucket!.getFiles(listOptions);

    for (const gcsFile of gcsFiles) {
      const [metadata] = await gcsFile.getMetadata();
      files.push({
        path: gcsFile.name,
        size: Number(metadata.size) || 0,
        mimeType: metadata.contentType || 'application/octet-stream',
        lastModified: new Date(
          metadata.updated || metadata.timeCreated || Date.now(),
        ),
        etag: metadata.etag,
      });

      if (options?.limit && files.length >= options.limit) {
        break;
      }
    }

    return files;
  }

  /**
   * Validar la configuración del proveedor
   */
  async validateConfig(): Promise<boolean> {
    try {
      this.ensureInitialized();

      // Intentar verificar si el bucket existe
      const [exists] = await this.bucket!.exists();
      return exists;
    } catch (error) {
      this.logger.error('GCS validation failed', error);
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
    // GCS no tiene límites de espacio tradicionales
    // Tendríamos que sumar el tamaño de todos los archivos
    return { used: 0 };
  }

  // ===== Métodos privados =====

  private ensureInitialized(): void {
    if (!this.initialized || !this.storage || !this.bucket) {
      throw new Error('GCSStorageProvider not initialized');
    }
  }

  private normalizeKey(key: string): string {
    return key.replace(/^\/+/, '').replace(/\/+/g, '/');
  }

  private getPublicUrl(key: string): string {
    return `https://storage.googleapis.com/${this.bucketName}/${key}`;
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

  private uploadStream(
    stream: Readable,
    gcsFile: File,
    options: any,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const writeStream = gcsFile.createWriteStream(options);
      stream.pipe(writeStream).on('finish', resolve).on('error', reject);
    });
  }
}
