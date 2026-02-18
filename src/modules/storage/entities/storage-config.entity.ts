import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { StorageProviderType } from '../interfaces/storage-provider.interface';

/**
 * Configuración de credenciales S3
 */
export interface S3Config {
  bucket: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  endpoint?: string; // Para S3-compatible (MinIO, DigitalOcean Spaces)
  forcePathStyle?: boolean;
}

/**
 * Configuración de credenciales GCS
 */
export interface GCSConfig {
  projectId: string;
  bucket: string;
  keyFilename?: string;
  credentials?: {
    client_email: string;
    private_key: string;
  };
}

/**
 * Configuración de credenciales Cloudinary
 */
export interface CloudinaryConfig {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
  folder?: string;
}

/**
 * Configuración de almacenamiento local
 */
export interface LocalConfig {
  basePath: string;
  baseUrl: string;
  serveStatic?: boolean;
}

/**
 * Tipo unión de todas las configuraciones
 */
export type ProviderConfig =
  | S3Config
  | GCSConfig
  | CloudinaryConfig
  | LocalConfig;

/**
 * Configuración de límites y opciones del proveedor
 */
export interface StorageSettings {
  /** Tamaño máximo de archivo en bytes (default: 100MB) */
  maxFileSize?: number;
  /** Tipos MIME permitidos */
  allowedMimeTypes?: string[];
  /** Si los archivos son públicos por defecto */
  defaultPublic?: boolean;
  /** Tiempo de expiración de URLs firmadas en segundos */
  urlExpiration?: number;
  /** Prefijo para las rutas de archivos */
  pathPrefix?: string;
}

/**
 * Entidad para almacenar la configuración de proveedores de storage
 */
@Entity('storage_configs')
@Index(['provider'], { unique: true })
@Index(['isActive'])
export class StorageConfig {
  @ApiProperty({ description: 'ID único de la configuración' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({
    description: 'Tipo de proveedor',
    enum: StorageProviderType,
    example: StorageProviderType.LOCAL,
  })
  @Column({
    type: 'enum',
    enum: StorageProviderType,
  })
  provider: StorageProviderType;

  @ApiProperty({
    description: 'Nombre descriptivo del proveedor',
    example: 'Amazon S3 - Producción',
  })
  @Column({ type: 'varchar', length: 255, nullable: true })
  name: string | null;

  @ApiProperty({
    description: 'Si este proveedor está activo (solo uno puede estar activo)',
    example: true,
  })
  @Column({ type: 'boolean', default: false })
  isActive: boolean;

  @ApiProperty({
    description: 'Si el proveedor está correctamente configurado',
    example: true,
  })
  @Column({ type: 'boolean', default: false })
  isConfigured: boolean;

  @ApiProperty({
    description: 'Última vez que se validó la conexión',
    example: '2026-02-05T10:30:00.000Z',
  })
  @Column({ type: 'timestamp', nullable: true })
  lastValidatedAt: Date | null;

  @ApiProperty({
    description: 'Mensaje del último error de validación',
    example: null,
  })
  @Column({ type: 'text', nullable: true })
  lastValidationError: string | null;

  /**
   * Configuración específica del proveedor (encriptada en campos sensibles)
   * Los campos sensibles como secretAccessKey, apiSecret se almacenan encriptados
   */
  @Column({ type: 'jsonb', default: {} })
  config: ProviderConfig;

  @ApiProperty({
    description: 'Configuración de límites y opciones',
  })
  @Column({ type: 'jsonb', default: {} })
  settings: StorageSettings;

  @ApiProperty({ description: 'Fecha de creación' })
  @CreateDateColumn()
  createdAt: Date;

  @ApiProperty({ description: 'Fecha de última actualización' })
  @UpdateDateColumn()
  updatedAt: Date;

  // Constructor
  constructor(partial: Partial<StorageConfig>) {
    Object.assign(this, partial);
  }

  /**
   * Obtener configuración sin datos sensibles
   */
  getSafeConfig(): Partial<ProviderConfig> {
    const config = { ...this.config } as Record<string, any>;

    // Ocultar campos sensibles según el tipo de proveedor
    const sensitiveFields = [
      'secretAccessKey',
      'accessKeyId',
      'apiSecret',
      'apiKey',
      'private_key',
      'credentials',
    ];

    for (const field of sensitiveFields) {
      if (config[field]) {
        config[field] = '********';
      }
      if (config.credentials && typeof config.credentials === 'object') {
        const creds = config.credentials as Record<string, any>;
        if (creds.private_key) {
          creds.private_key = '********';
        }
      }
    }

    return config;
  }

  /**
   * Verificar si tiene la configuración mínima requerida
   */
  hasMinimumConfig(): boolean {
    const config = this.config as Record<string, any>;

    switch (this.provider) {
      case StorageProviderType.S3:
        return !!(
          config.bucket &&
          config.region &&
          config.accessKeyId &&
          config.secretAccessKey
        );

      case StorageProviderType.GCS:
        return !!(
          config.projectId &&
          config.bucket &&
          (config.keyFilename || config.credentials)
        );

      case StorageProviderType.CLOUDINARY:
        return !!(config.cloudName && config.apiKey && config.apiSecret);

      case StorageProviderType.LOCAL:
        return !!(config.basePath && config.baseUrl);

      default:
        return false;
    }
  }
}
