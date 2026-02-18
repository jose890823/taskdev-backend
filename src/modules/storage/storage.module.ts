import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { CacheModule } from '@nestjs/cache-manager';

// Entity
import { StorageConfig } from './entities/storage-config.entity';

// Services
import { StorageService } from './storage.service';
import { StorageConfigService } from './services/storage-config.service';

// Providers
import { LocalStorageProvider } from './providers/local-storage.provider';
import { S3StorageProvider } from './providers/s3-storage.provider';
import { GCSStorageProvider } from './providers/gcs-storage.provider';
import { CloudinaryStorageProvider } from './providers/cloudinary-storage.provider';

// Controllers
import { StorageAdminController } from './controllers/storage-admin.controller';

// Shared
import { EncryptionService } from '../../shared/encryption.service';

@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([StorageConfig]),
    ConfigModule,
    CacheModule.register(),
  ],
  controllers: [StorageAdminController],
  providers: [
    // Services
    StorageService,
    StorageConfigService,

    // Providers
    LocalStorageProvider,
    S3StorageProvider,
    GCSStorageProvider,
    CloudinaryStorageProvider,

    // Shared
    EncryptionService,
  ],
  exports: [
    StorageService,
    StorageConfigService,
    LocalStorageProvider,
    S3StorageProvider,
    GCSStorageProvider,
    CloudinaryStorageProvider,
  ],
})
export class StorageModule {}
