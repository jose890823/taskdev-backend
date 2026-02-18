import { Readable } from 'stream';

/**
 * Tipos de proveedores de almacenamiento soportados
 */
export enum StorageProviderType {
  LOCAL = 'local',
  S3 = 's3',
  GCS = 'gcs',
  CLOUDINARY = 'cloudinary',
}

/**
 * Opciones para subir un archivo
 */
export interface UploadOptions {
  /** Ruta destino (sin el nombre del archivo) */
  path: string;
  /** Nombre del archivo (si no se especifica, se genera uno) */
  filename?: string;
  /** Tipo MIME del archivo */
  mimeType?: string;
  /** Si el archivo debe ser público */
  isPublic?: boolean;
  /** Metadatos adicionales */
  metadata?: Record<string, string>;
  /** Tamaño del archivo en bytes (para validación) */
  size?: number;
}

/**
 * Resultado de una operación de subida
 */
export interface StorageResult {
  /** Ruta completa del archivo en el storage */
  path: string;
  /** URL de acceso al archivo */
  url: string;
  /** URL pública (si aplica) */
  publicUrl?: string;
  /** Tamaño del archivo en bytes */
  size: number;
  /** Tipo MIME del archivo */
  mimeType: string;
  /** Proveedor usado */
  provider: StorageProviderType;
  /** ETag o hash del archivo (si está disponible) */
  etag?: string;
  /** Metadatos del archivo */
  metadata?: Record<string, string>;
}

/**
 * Opciones para obtener URL
 */
export interface UrlOptions {
  /** Si debe ser una URL firmada */
  signed?: boolean;
  /** Tiempo de expiración en segundos (para URLs firmadas) */
  expiresIn?: number;
  /** Forzar descarga (Content-Disposition: attachment) */
  forceDownload?: boolean;
  /** Nombre de archivo para descarga */
  downloadFilename?: string;
}

/**
 * Metadatos de un archivo
 */
export interface FileMetadata {
  /** Ruta del archivo */
  path: string;
  /** Tamaño en bytes */
  size: number;
  /** Tipo MIME */
  mimeType: string;
  /** Fecha de última modificación */
  lastModified: Date;
  /** ETag o hash */
  etag?: string;
  /** Metadatos personalizados */
  metadata?: Record<string, string>;
  /** Si es público */
  isPublic?: boolean;
}

/**
 * Configuración base para un proveedor
 */
export interface StorageProviderConfig {
  /** Tipo de proveedor */
  type: StorageProviderType;
  /** Si está habilitado */
  enabled: boolean;
  /** Configuración específica del proveedor */
  config: Record<string, any>;
  /** Configuración de límites */
  settings: {
    maxFileSize?: number;
    allowedMimeTypes?: string[];
    defaultPublic?: boolean;
    urlExpiration?: number;
  };
}

/**
 * Interfaz que deben implementar todos los proveedores de almacenamiento
 */
export interface IStorageProvider {
  /** Tipo de proveedor */
  readonly providerType: StorageProviderType;

  /**
   * Inicializar el proveedor con su configuración
   */
  initialize(config: StorageProviderConfig): Promise<void>;

  /**
   * Subir un archivo
   * @param file Buffer o Stream del archivo
   * @param options Opciones de subida
   * @returns Resultado con la información del archivo subido
   */
  upload(
    file: Buffer | Readable,
    options: UploadOptions,
  ): Promise<StorageResult>;

  /**
   * Descargar un archivo
   * @param path Ruta del archivo
   * @returns Buffer con el contenido del archivo
   */
  download(path: string): Promise<Buffer>;

  /**
   * Obtener un stream de lectura del archivo
   * @param path Ruta del archivo
   * @returns Stream de lectura
   */
  getReadStream(path: string): Promise<Readable>;

  /**
   * Eliminar un archivo
   * @param path Ruta del archivo
   * @returns true si se eliminó correctamente
   */
  delete(path: string): Promise<boolean>;

  /**
   * Eliminar múltiples archivos
   * @param paths Rutas de los archivos
   * @returns Número de archivos eliminados
   */
  deleteMany(paths: string[]): Promise<number>;

  /**
   * Verificar si un archivo existe
   * @param path Ruta del archivo
   * @returns true si existe
   */
  exists(path: string): Promise<boolean>;

  /**
   * Obtener la URL de un archivo
   * @param path Ruta del archivo
   * @param options Opciones de URL
   * @returns URL del archivo
   */
  getUrl(path: string, options?: UrlOptions): Promise<string>;

  /**
   * Obtener una URL firmada (con expiración)
   * @param path Ruta del archivo
   * @param expiresIn Tiempo de expiración en segundos
   * @returns URL firmada
   */
  getSignedUrl(path: string, expiresIn?: number): Promise<string>;

  /**
   * Obtener metadatos de un archivo
   * @param path Ruta del archivo
   * @returns Metadatos del archivo
   */
  getMetadata(path: string): Promise<FileMetadata>;

  /**
   * Copiar un archivo
   * @param sourcePath Ruta origen
   * @param destinationPath Ruta destino
   * @returns Resultado con la información del archivo copiado
   */
  copy(sourcePath: string, destinationPath: string): Promise<StorageResult>;

  /**
   * Mover un archivo
   * @param sourcePath Ruta origen
   * @param destinationPath Ruta destino
   * @returns Resultado con la información del archivo movido
   */
  move(sourcePath: string, destinationPath: string): Promise<StorageResult>;

  /**
   * Listar archivos en un directorio
   * @param path Ruta del directorio
   * @param options Opciones de listado
   * @returns Lista de metadatos de archivos
   */
  list(
    path: string,
    options?: { recursive?: boolean; limit?: number },
  ): Promise<FileMetadata[]>;

  /**
   * Validar la configuración del proveedor
   * @returns true si la configuración es válida y el proveedor puede conectarse
   */
  validateConfig(): Promise<boolean>;

  /**
   * Obtener información del espacio usado
   * @returns Información de uso (si está disponible)
   */
  getUsageInfo?(): Promise<{
    used: number;
    total?: number;
    available?: number;
  }>;
}

/**
 * Token para inyección de dependencias
 */
export const STORAGE_PROVIDER = 'STORAGE_PROVIDER';
