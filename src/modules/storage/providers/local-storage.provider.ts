import { Injectable, Logger } from '@nestjs/common';
import { Readable } from 'stream';
import * as fs from 'fs';
import * as path from 'path';
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
import { LocalConfig } from '../entities/storage-config.entity';

/**
 * Proveedor de almacenamiento local (sistema de archivos)
 */
@Injectable()
export class LocalStorageProvider implements IStorageProvider {
  private readonly logger = new Logger(LocalStorageProvider.name);
  readonly providerType = StorageProviderType.LOCAL;

  private basePath: string = './uploads';
  private baseUrl: string = 'http://localhost:3001/uploads';
  private initialized = false;

  /**
   * Inicializar el proveedor con su configuración
   */
  async initialize(providerConfig: StorageProviderConfig): Promise<void> {
    const config = providerConfig.config as LocalConfig;

    this.basePath = config.basePath || './uploads';
    this.baseUrl = config.baseUrl || 'http://localhost:3001/uploads';

    // Asegurar que el directorio base existe
    await this.ensureDirectory(this.basePath);

    this.initialized = true;
    this.logger.log(`LocalStorageProvider initialized at ${this.basePath}`);
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
    const relativePath = path.join(options.path, filename);
    const fullPath = path.join(this.basePath, relativePath);

    // Asegurar que el directorio existe
    await this.ensureDirectory(path.dirname(fullPath));

    // Escribir el archivo
    if (Buffer.isBuffer(file)) {
      await fs.promises.writeFile(fullPath, file);
    } else {
      await this.writeStream(file, fullPath);
    }

    // Obtener estadísticas del archivo
    const stats = await fs.promises.stat(fullPath);

    const result: StorageResult = {
      path: relativePath,
      url: this.getPublicUrl(relativePath),
      publicUrl: options.isPublic ? this.getPublicUrl(relativePath) : undefined,
      size: stats.size,
      mimeType: options.mimeType || 'application/octet-stream',
      provider: this.providerType,
      etag: await this.calculateEtag(fullPath),
      metadata: options.metadata,
    };

    this.logger.log(`File uploaded: ${relativePath}`);
    return result;
  }

  /**
   * Descargar un archivo
   */
  async download(filePath: string): Promise<Buffer> {
    this.ensureInitialized();

    const fullPath = path.join(this.basePath, filePath);

    if (!(await this.exists(filePath))) {
      throw new Error(`File not found: ${filePath}`);
    }

    return fs.promises.readFile(fullPath);
  }

  /**
   * Obtener un stream de lectura del archivo
   */
  async getReadStream(filePath: string): Promise<Readable> {
    this.ensureInitialized();

    const fullPath = path.join(this.basePath, filePath);

    if (!(await this.exists(filePath))) {
      throw new Error(`File not found: ${filePath}`);
    }

    return fs.createReadStream(fullPath);
  }

  /**
   * Eliminar un archivo
   */
  async delete(filePath: string): Promise<boolean> {
    this.ensureInitialized();

    const fullPath = path.join(this.basePath, filePath);

    try {
      await fs.promises.unlink(fullPath);
      this.logger.log(`File deleted: ${filePath}`);
      return true;
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        return false; // El archivo no existe
      }
      throw error;
    }
  }

  /**
   * Eliminar múltiples archivos
   */
  async deleteMany(paths: string[]): Promise<number> {
    let deleted = 0;

    for (const filePath of paths) {
      if (await this.delete(filePath)) {
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

    const fullPath = path.join(this.basePath, filePath);

    try {
      await fs.promises.access(fullPath, fs.constants.F_OK);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Obtener la URL de un archivo
   */
  async getUrl(filePath: string, options?: UrlOptions): Promise<string> {
    this.ensureInitialized();

    // Para almacenamiento local, las URLs firmadas no tienen sentido real
    // pero podríamos agregar un token de verificación si se necesita
    const url = this.getPublicUrl(filePath);

    if (options?.forceDownload && options?.downloadFilename) {
      return `${url}?download=${encodeURIComponent(options.downloadFilename)}`;
    }

    return url;
  }

  /**
   * Obtener una URL firmada
   * Nota: Para almacenamiento local, esto simplemente devuelve la URL normal
   * En un entorno real, podrías implementar tokens temporales
   */
  async getSignedUrl(filePath: string, _expiresIn?: number): Promise<string> {
    return this.getUrl(filePath);
  }

  /**
   * Obtener metadatos de un archivo
   */
  async getMetadata(filePath: string): Promise<FileMetadata> {
    this.ensureInitialized();

    const fullPath = path.join(this.basePath, filePath);

    if (!(await this.exists(filePath))) {
      throw new Error(`File not found: ${filePath}`);
    }

    const stats = await fs.promises.stat(fullPath);

    return {
      path: filePath,
      size: stats.size,
      mimeType: this.getMimeType(filePath),
      lastModified: stats.mtime,
      etag: await this.calculateEtag(fullPath),
      isPublic: true, // Archivos locales son accesibles si la ruta es servida
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

    const sourceFullPath = path.join(this.basePath, sourcePath);
    const destFullPath = path.join(this.basePath, destinationPath);

    if (!(await this.exists(sourcePath))) {
      throw new Error(`Source file not found: ${sourcePath}`);
    }

    // Asegurar que el directorio destino existe
    await this.ensureDirectory(path.dirname(destFullPath));

    // Copiar el archivo
    await fs.promises.copyFile(sourceFullPath, destFullPath);

    const stats = await fs.promises.stat(destFullPath);

    return {
      path: destinationPath,
      url: this.getPublicUrl(destinationPath),
      size: stats.size,
      mimeType: this.getMimeType(destinationPath),
      provider: this.providerType,
      etag: await this.calculateEtag(destFullPath),
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

    const sourceFullPath = path.join(this.basePath, sourcePath);
    const destFullPath = path.join(this.basePath, destinationPath);

    if (!(await this.exists(sourcePath))) {
      throw new Error(`Source file not found: ${sourcePath}`);
    }

    // Asegurar que el directorio destino existe
    await this.ensureDirectory(path.dirname(destFullPath));

    // Mover el archivo
    await fs.promises.rename(sourceFullPath, destFullPath);

    const stats = await fs.promises.stat(destFullPath);

    return {
      path: destinationPath,
      url: this.getPublicUrl(destinationPath),
      size: stats.size,
      mimeType: this.getMimeType(destinationPath),
      provider: this.providerType,
      etag: await this.calculateEtag(destFullPath),
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

    const fullPath = path.join(this.basePath, dirPath);
    const files: FileMetadata[] = [];

    try {
      await this.listRecursive(
        fullPath,
        dirPath,
        files,
        options?.recursive ?? false,
      );
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        return [];
      }
      throw error;
    }

    // Aplicar límite si se especifica
    if (options?.limit && files.length > options.limit) {
      return files.slice(0, options.limit);
    }

    return files;
  }

  /**
   * Validar la configuración del proveedor
   */
  async validateConfig(): Promise<boolean> {
    try {
      // Verificar que el directorio base existe o se puede crear
      await this.ensureDirectory(this.basePath);

      // Intentar escribir un archivo de prueba
      const testPath = path.join(this.basePath, '.storage-test');
      await fs.promises.writeFile(testPath, 'test');
      await fs.promises.unlink(testPath);

      return true;
    } catch (error) {
      this.logger.error('LocalStorage validation failed', error);
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

    let used = 0;
    const files = await this.list('', { recursive: true });

    for (const file of files) {
      used += file.size;
    }

    return { used };
  }

  // ===== Métodos privados =====

  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('LocalStorageProvider not initialized');
    }
  }

  private async ensureDirectory(dirPath: string): Promise<void> {
    try {
      await fs.promises.mkdir(dirPath, { recursive: true });
    } catch (error: any) {
      if (error.code !== 'EEXIST') {
        throw error;
      }
    }
  }

  private async writeStream(stream: Readable, filePath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const writeStream = fs.createWriteStream(filePath);
      stream.pipe(writeStream);
      writeStream.on('finish', resolve);
      writeStream.on('error', reject);
    });
  }

  private getPublicUrl(filePath: string): string {
    // Normalizar la ruta para URLs
    const normalizedPath = filePath.replace(/\\/g, '/');
    return `${this.baseUrl}/${normalizedPath}`;
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
      'image/svg+xml': '.svg',
      'application/pdf': '.pdf',
      'video/mp4': '.mp4',
      'video/webm': '.webm',
      'audio/mpeg': '.mp3',
      'audio/wav': '.wav',
      'application/zip': '.zip',
      'text/plain': '.txt',
      'text/html': '.html',
      'application/json': '.json',
    };

    return mimeToExt[mimeType] || '';
  }

  private getMimeType(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();

    const extToMime: Record<string, string> = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.svg': 'image/svg+xml',
      '.pdf': 'application/pdf',
      '.mp4': 'video/mp4',
      '.webm': 'video/webm',
      '.mp3': 'audio/mpeg',
      '.wav': 'audio/wav',
      '.zip': 'application/zip',
      '.txt': 'text/plain',
      '.html': 'text/html',
      '.json': 'application/json',
    };

    return extToMime[ext] || 'application/octet-stream';
  }

  private async calculateEtag(fullPath: string): Promise<string> {
    const buffer = await fs.promises.readFile(fullPath);
    return crypto.createHash('md5').update(buffer).digest('hex');
  }

  private async listRecursive(
    fullPath: string,
    relativePath: string,
    files: FileMetadata[],
    recursive: boolean,
  ): Promise<void> {
    const entries = await fs.promises.readdir(fullPath, {
      withFileTypes: true,
    });

    for (const entry of entries) {
      const entryFullPath = path.join(fullPath, entry.name);
      const entryRelativePath = path.join(relativePath, entry.name);

      if (entry.isFile()) {
        const stats = await fs.promises.stat(entryFullPath);
        files.push({
          path: entryRelativePath,
          size: stats.size,
          mimeType: this.getMimeType(entry.name),
          lastModified: stats.mtime,
        });
      } else if (entry.isDirectory() && recursive) {
        await this.listRecursive(
          entryFullPath,
          entryRelativePath,
          files,
          recursive,
        );
      }
    }
  }
}
