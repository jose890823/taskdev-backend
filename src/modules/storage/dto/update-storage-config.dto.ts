import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { StorageProviderType } from '../interfaces/storage-provider.interface';

/**
 * DTO para configuración S3
 */
export class S3ConfigDto {
  @ApiProperty({ example: 'my-bucket', description: 'Nombre del bucket S3' })
  @IsNotEmpty({ message: 'El bucket es obligatorio' })
  @IsString()
  bucket: string;

  @ApiProperty({ example: 'us-east-1', description: 'Región de AWS' })
  @IsNotEmpty({ message: 'La región es obligatoria' })
  @IsString()
  region: string;

  @ApiProperty({
    example: 'AKIAIOSFODNN7EXAMPLE',
    description: 'Access Key ID',
  })
  @IsNotEmpty({ message: 'El Access Key ID es obligatorio' })
  @IsString()
  accessKeyId: string;

  @ApiProperty({
    example: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
    description: 'Secret Access Key',
  })
  @IsNotEmpty({ message: 'El Secret Access Key es obligatorio' })
  @IsString()
  secretAccessKey: string;

  @ApiPropertyOptional({
    example: 'https://s3.amazonaws.com',
    description: 'Endpoint personalizado (para S3-compatible)',
  })
  @IsOptional()
  @IsUrl({}, { message: 'El endpoint debe ser una URL válida' })
  endpoint?: string;

  @ApiPropertyOptional({
    example: false,
    description: 'Usar path style para URLs (requerido para MinIO)',
  })
  @IsOptional()
  @IsBoolean()
  forcePathStyle?: boolean;
}

/**
 * DTO para credenciales de cuenta de servicio GCS
 */
export class GCSCredentialsDto {
  @ApiProperty({ example: 'service-account@project.iam.gserviceaccount.com' })
  @IsNotEmpty()
  @IsString()
  client_email: string;

  @ApiProperty({ example: '-----BEGIN PRIVATE KEY-----\n...' })
  @IsNotEmpty()
  @IsString()
  private_key: string;
}

/**
 * DTO para configuración GCS
 */
export class GCSConfigDto {
  @ApiProperty({
    example: 'my-project-id',
    description: 'ID del proyecto de GCP',
  })
  @IsNotEmpty({ message: 'El Project ID es obligatorio' })
  @IsString()
  projectId: string;

  @ApiProperty({ example: 'my-bucket', description: 'Nombre del bucket GCS' })
  @IsNotEmpty({ message: 'El bucket es obligatorio' })
  @IsString()
  bucket: string;

  @ApiPropertyOptional({
    example: '/path/to/keyfile.json',
    description: 'Path al archivo de credenciales',
  })
  @IsOptional()
  @IsString()
  keyFilename?: string;

  @ApiPropertyOptional({
    description:
      'Credenciales de cuenta de servicio (alternativa a keyFilename)',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => GCSCredentialsDto)
  credentials?: GCSCredentialsDto;
}

/**
 * DTO para configuración Cloudinary
 */
export class CloudinaryConfigDto {
  @ApiProperty({ example: 'my-cloud-name', description: 'Nombre del cloud' })
  @IsNotEmpty({ message: 'El Cloud Name es obligatorio' })
  @IsString()
  cloudName: string;

  @ApiProperty({ example: '123456789012345', description: 'API Key' })
  @IsNotEmpty({ message: 'El API Key es obligatorio' })
  @IsString()
  apiKey: string;

  @ApiProperty({
    example: 'abcdefghijklmnopqrstuvwxyz',
    description: 'API Secret',
  })
  @IsNotEmpty({ message: 'El API Secret es obligatorio' })
  @IsString()
  apiSecret: string;

  @ApiPropertyOptional({
    example: 'michambita',
    description: 'Carpeta base en Cloudinary',
  })
  @IsOptional()
  @IsString()
  folder?: string;
}

/**
 * DTO para configuración Local
 */
export class LocalConfigDto {
  @ApiProperty({
    example: './uploads',
    description: 'Ruta base para almacenar archivos',
  })
  @IsNotEmpty({ message: 'El basePath es obligatorio' })
  @IsString()
  basePath: string;

  @ApiProperty({
    example: 'http://localhost:3001/uploads',
    description: 'URL base para acceder a los archivos',
  })
  @IsNotEmpty({ message: 'El baseUrl es obligatorio' })
  @IsUrl({}, { message: 'El baseUrl debe ser una URL válida' })
  baseUrl: string;

  @ApiPropertyOptional({
    example: true,
    description: 'Si se deben servir los archivos estáticamente',
  })
  @IsOptional()
  @IsBoolean()
  serveStatic?: boolean;
}

/**
 * DTO para configuración de límites
 */
export class StorageSettingsDto {
  @ApiPropertyOptional({
    example: 104857600,
    description: 'Tamaño máximo de archivo en bytes (default: 100MB)',
  })
  @IsOptional()
  @IsNumber()
  @Min(1024, { message: 'El tamaño mínimo es 1KB' })
  maxFileSize?: number;

  @ApiPropertyOptional({
    example: ['image/jpeg', 'image/png', 'application/pdf'],
    description: 'Tipos MIME permitidos',
  })
  @IsOptional()
  @IsString({ each: true })
  allowedMimeTypes?: string[];

  @ApiPropertyOptional({
    example: false,
    description: 'Si los archivos son públicos por defecto',
  })
  @IsOptional()
  @IsBoolean()
  defaultPublic?: boolean;

  @ApiPropertyOptional({
    example: 3600,
    description: 'Tiempo de expiración de URLs firmadas en segundos',
  })
  @IsOptional()
  @IsNumber()
  @Min(60, { message: 'El tiempo mínimo de expiración es 60 segundos' })
  urlExpiration?: number;

  @ApiPropertyOptional({
    example: 'courses',
    description: 'Prefijo para las rutas de archivos',
  })
  @IsOptional()
  @IsString()
  pathPrefix?: string;
}

/**
 * DTO para actualizar la configuración de un proveedor de storage
 */
export class UpdateStorageConfigDto {
  @ApiPropertyOptional({
    example: 'Amazon S3 - Producción',
    description: 'Nombre descriptivo del proveedor',
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({
    description: 'Configuración específica del proveedor',
  })
  @IsOptional()
  @IsObject()
  config?: S3ConfigDto | GCSConfigDto | CloudinaryConfigDto | LocalConfigDto;

  @ApiPropertyOptional({
    description: 'Configuración de límites y opciones',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => StorageSettingsDto)
  settings?: StorageSettingsDto;
}

/**
 * DTO para activar un proveedor
 */
export class ActivateProviderDto {
  @ApiProperty({
    enum: StorageProviderType,
    example: StorageProviderType.S3,
    description: 'Tipo de proveedor a activar',
  })
  @IsNotEmpty({ message: 'El proveedor es obligatorio' })
  @IsEnum(StorageProviderType, { message: 'Proveedor no válido' })
  provider: StorageProviderType;
}

/**
 * DTO de respuesta para configuración de proveedor
 */
export class StorageConfigResponseDto {
  @ApiProperty({ description: 'ID de la configuración' })
  id: string;

  @ApiProperty({ enum: StorageProviderType, description: 'Tipo de proveedor' })
  provider: StorageProviderType;

  @ApiProperty({ description: 'Nombre descriptivo' })
  name: string | null;

  @ApiProperty({ description: 'Si está activo' })
  isActive: boolean;

  @ApiProperty({ description: 'Si está configurado' })
  isConfigured: boolean;

  @ApiProperty({ description: 'Última validación' })
  lastValidatedAt: Date | null;

  @ApiProperty({ description: 'Error de última validación' })
  lastValidationError: string | null;

  @ApiProperty({ description: 'Configuración (sin datos sensibles)' })
  config: Record<string, any>;

  @ApiProperty({ description: 'Configuración de límites' })
  settings: StorageSettingsDto;

  @ApiProperty({ description: 'Fecha de creación' })
  createdAt: Date;

  @ApiProperty({ description: 'Fecha de actualización' })
  updatedAt: Date;
}

/**
 * DTO de respuesta para lista de proveedores
 */
export class StorageProvidersListDto {
  @ApiProperty({ type: [StorageConfigResponseDto] })
  providers: StorageConfigResponseDto[];

  @ApiProperty({ description: 'Proveedor actualmente activo' })
  activeProvider: StorageProviderType | null;
}

/**
 * DTO de respuesta para test de conexión
 */
export class StorageTestResultDto {
  @ApiProperty({ description: 'Si la prueba fue exitosa' })
  success: boolean;

  @ApiProperty({ description: 'Mensaje de resultado' })
  message: string;

  @ApiProperty({ description: 'Tiempo de respuesta en ms', required: false })
  responseTime?: number;

  @ApiProperty({ description: 'Detalles adicionales', required: false })
  details?: Record<string, any>;
}
