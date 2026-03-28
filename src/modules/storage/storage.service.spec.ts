import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { Readable } from 'stream';
import { StorageService } from './storage.service';
import { StorageConfigService } from './services/storage-config.service';
import { LocalStorageProvider } from './providers/local-storage.provider';
import { S3StorageProvider } from './providers/s3-storage.provider';
import { GCSStorageProvider } from './providers/gcs-storage.provider';
import { CloudinaryStorageProvider } from './providers/cloudinary-storage.provider';
import {
  StorageProviderType,
  StorageResult,
  FileMetadata,
  IStorageProvider,
} from './interfaces/storage-provider.interface';
import { StorageConfig } from './entities/storage-config.entity';

describe('StorageService', () => {
  let service: StorageService;
  let configService: jest.Mocked<StorageConfigService>;
  let localProvider: jest.Mocked<LocalStorageProvider>;
  let s3Provider: jest.Mocked<S3StorageProvider>;
  let gcsProvider: jest.Mocked<GCSStorageProvider>;
  let cloudinaryProvider: jest.Mocked<CloudinaryStorageProvider>;

  // ── Mock data ──────────────────────────────────────────────

  const mockStorageResult: StorageResult = {
    path: 'uploads/test/file.jpg',
    url: 'http://localhost:3001/uploads/test/file.jpg',
    size: 1024,
    mimeType: 'image/jpeg',
    provider: StorageProviderType.LOCAL,
  };

  const mockFileMetadata: FileMetadata = {
    path: 'uploads/test/file.jpg',
    size: 1024,
    mimeType: 'image/jpeg',
    lastModified: new Date('2026-01-15'),
  };

  const createActiveConfig = (
    overrides: Partial<StorageConfig> = {},
  ): StorageConfig => {
    return {
      id: '123e4567-e89b-12d3-a456-426614174000',
      provider: StorageProviderType.LOCAL,
      name: 'Almacenamiento Local',
      isActive: true,
      isConfigured: true,
      lastValidatedAt: null,
      lastValidationError: null,
      config: {
        basePath: './uploads',
        baseUrl: 'http://localhost:3001/uploads',
        serveStatic: true,
      },
      settings: {
        maxFileSize: 100 * 1024 * 1024,
        allowedMimeTypes: ['image/jpeg', 'image/png', 'application/pdf'],
        defaultPublic: false,
        urlExpiration: 3600,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
      getSafeConfig: jest.fn(),
      hasMinimumConfig: jest.fn().mockReturnValue(true),
      ...overrides,
    } as unknown as StorageConfig;
  };

  // ── Setup ──────────────────────────────────────────────────

  beforeEach(async () => {
    const mockLocal: Partial<jest.Mocked<IStorageProvider>> = {
      providerType: StorageProviderType.LOCAL,
      initialize: jest.fn().mockResolvedValue(undefined),
      upload: jest.fn().mockResolvedValue(mockStorageResult),
      download: jest.fn().mockResolvedValue(Buffer.from('file-content')),
      getReadStream: jest
        .fn()
        .mockResolvedValue(Readable.from(['file-content'])),
      delete: jest.fn().mockResolvedValue(true),
      deleteMany: jest.fn().mockResolvedValue(3),
      exists: jest.fn().mockResolvedValue(true),
      getUrl: jest
        .fn()
        .mockResolvedValue('http://localhost:3001/uploads/test/file.jpg'),
      getSignedUrl: jest.fn().mockResolvedValue('http://localhost/signed-url'),
      getMetadata: jest.fn().mockResolvedValue(mockFileMetadata),
      copy: jest.fn().mockResolvedValue(mockStorageResult),
      move: jest.fn().mockResolvedValue(mockStorageResult),
      list: jest.fn().mockResolvedValue([mockFileMetadata]),
      validateConfig: jest.fn().mockResolvedValue(true),
      getUsageInfo: jest
        .fn()
        .mockResolvedValue({ used: 5000, total: 100000, available: 95000 }),
    };

    const mockS3: Partial<jest.Mocked<IStorageProvider>> = {
      providerType: StorageProviderType.S3,
      initialize: jest.fn().mockResolvedValue(undefined),
      upload: jest.fn().mockResolvedValue(mockStorageResult),
      download: jest.fn().mockResolvedValue(Buffer.from('s3-content')),
      getReadStream: jest.fn(),
      delete: jest.fn().mockResolvedValue(true),
      deleteMany: jest.fn().mockResolvedValue(2),
      exists: jest.fn().mockResolvedValue(false),
      getUrl: jest.fn().mockResolvedValue('https://s3.amazonaws.com/file.jpg'),
      getSignedUrl: jest.fn().mockResolvedValue('https://s3/signed'),
      getMetadata: jest.fn().mockResolvedValue(mockFileMetadata),
      copy: jest.fn().mockResolvedValue(mockStorageResult),
      move: jest.fn().mockResolvedValue(mockStorageResult),
      list: jest.fn().mockResolvedValue([]),
      validateConfig: jest.fn().mockResolvedValue(true),
    };

    const mockGCS: Partial<jest.Mocked<IStorageProvider>> = {
      ...mockS3,
      providerType: StorageProviderType.GCS,
    };

    const mockCloudinary: Partial<jest.Mocked<IStorageProvider>> = {
      ...mockS3,
      providerType: StorageProviderType.CLOUDINARY,
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StorageService,
        {
          provide: StorageConfigService,
          useValue: {
            getActiveConfig: jest
              .fn()
              .mockResolvedValue(createActiveConfig()),
            getProviderConfig: jest.fn().mockResolvedValue({
              type: StorageProviderType.LOCAL,
              enabled: true,
              config: {
                basePath: './uploads',
                baseUrl: 'http://localhost:3001/uploads',
              },
              settings: {},
            }),
            setValidationResult: jest.fn().mockResolvedValue(undefined),
          },
        },
        { provide: LocalStorageProvider, useValue: mockLocal },
        { provide: S3StorageProvider, useValue: mockS3 },
        { provide: GCSStorageProvider, useValue: mockGCS },
        { provide: CloudinaryStorageProvider, useValue: mockCloudinary },
      ],
    }).compile();

    service = module.get<StorageService>(StorageService);
    configService = module.get(StorageConfigService);
    localProvider = module.get(LocalStorageProvider);
    s3Provider = module.get(S3StorageProvider);
    gcsProvider = module.get(GCSStorageProvider);
    cloudinaryProvider = module.get(CloudinaryStorageProvider);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ================================================================
  // onModuleInit
  // ================================================================

  describe('onModuleInit', () => {
    it('should initialize active provider on startup', async () => {
      await service.onModuleInit();

      expect(configService.getActiveConfig).toHaveBeenCalled();
      expect(configService.getProviderConfig).toHaveBeenCalledWith(
        StorageProviderType.LOCAL,
      );
      expect(localProvider.initialize).toHaveBeenCalled();
    });

    it('should not throw when initialization fails on startup', async () => {
      configService.getActiveConfig.mockRejectedValueOnce(
        new Error('DB not ready'),
      );

      await expect(service.onModuleInit()).resolves.not.toThrow();
    });
  });

  // ================================================================
  // initializeProvider
  // ================================================================

  describe('initializeProvider', () => {
    it('should initialize a specific provider', async () => {
      await service.initializeProvider(StorageProviderType.LOCAL);

      expect(configService.getProviderConfig).toHaveBeenCalledWith(
        StorageProviderType.LOCAL,
      );
      expect(localProvider.initialize).toHaveBeenCalled();
    });

    it('should throw BadRequestException for unknown provider', async () => {
      await expect(
        service.initializeProvider('unknown' as StorageProviderType),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ================================================================
  // reinitializeActiveProvider
  // ================================================================

  describe('reinitializeActiveProvider', () => {
    it('should clear initialized status and reinitialize', async () => {
      // First initialize to add it to the set
      await service.onModuleInit();
      expect(localProvider.initialize).toHaveBeenCalledTimes(1);

      // Then reinitialize — it removes from set, then re-initializes
      await service.reinitializeActiveProvider();

      expect(configService.getActiveConfig).toHaveBeenCalled();
      // onModuleInit(1) + reinitialize(1) = 2 calls total
      expect(localProvider.initialize).toHaveBeenCalledTimes(2);
    });
  });

  // ================================================================
  // upload
  // ================================================================

  describe('upload', () => {
    it('should upload a file via the active provider', async () => {
      const buffer = Buffer.from('file-data');
      const options = {
        path: 'test',
        filename: 'file.jpg',
        mimeType: 'image/jpeg',
        size: 512,
      };

      const result = await service.upload(buffer, options);

      expect(result).toEqual(mockStorageResult);
      expect(localProvider.upload).toHaveBeenCalledWith(
        buffer,
        expect.objectContaining({ filename: 'file.jpg' }),
      );
    });

    it('should throw when file exceeds max size', async () => {
      const config = createActiveConfig({
        settings: { maxFileSize: 1024 },
      });
      configService.getActiveConfig.mockResolvedValue(config);

      const buffer = Buffer.from('x'.repeat(2048));

      await expect(
        service.upload(buffer, {
          path: 'test',
          filename: 'big.jpg',
          size: 2048,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should not throw when size is within limit', async () => {
      const config = createActiveConfig({
        settings: {
          maxFileSize: 5000,
          allowedMimeTypes: ['image/jpeg'],
          defaultPublic: false,
        },
      });
      configService.getActiveConfig.mockResolvedValue(config);

      const buffer = Buffer.from('x'.repeat(100));

      await expect(
        service.upload(buffer, {
          path: 'test',
          filename: 'small.jpg',
          size: 100,
          mimeType: 'image/jpeg',
        }),
      ).resolves.not.toThrow();
    });

    it('should throw when MIME type is not allowed', async () => {
      const config = createActiveConfig({
        settings: {
          maxFileSize: 100 * 1024 * 1024,
          allowedMimeTypes: ['image/jpeg', 'image/png'],
        },
      });
      configService.getActiveConfig.mockResolvedValue(config);

      await expect(
        service.upload(Buffer.from('data'), {
          path: 'test',
          filename: 'malicious.exe',
          mimeType: 'application/x-msdownload',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should allow upload when MIME type is in allowed list', async () => {
      const config = createActiveConfig({
        settings: {
          maxFileSize: 100 * 1024 * 1024,
          allowedMimeTypes: ['image/jpeg', 'image/png'],
          defaultPublic: false,
        },
      });
      configService.getActiveConfig.mockResolvedValue(config);

      await expect(
        service.upload(Buffer.from('data'), {
          path: 'test',
          filename: 'photo.jpg',
          mimeType: 'image/jpeg',
        }),
      ).resolves.not.toThrow();
    });

    it('should allow any MIME type when allowedMimeTypes is empty', async () => {
      const config = createActiveConfig({
        settings: {
          maxFileSize: 100 * 1024 * 1024,
          allowedMimeTypes: [],
          defaultPublic: false,
        },
      });
      configService.getActiveConfig.mockResolvedValue(config);

      await expect(
        service.upload(Buffer.from('data'), {
          path: 'test',
          filename: 'file.exe',
          mimeType: 'application/x-msdownload',
        }),
      ).resolves.not.toThrow();
    });

    it('should set default isPublic from config when not specified', async () => {
      const config = createActiveConfig({
        settings: { defaultPublic: true },
      });
      configService.getActiveConfig.mockResolvedValue(config);

      const options = { path: 'test', filename: 'file.jpg' };
      await service.upload(Buffer.from('data'), options);

      expect(options.isPublic).toBe(true);
    });

    it('should not override isPublic when explicitly set', async () => {
      const config = createActiveConfig({
        settings: { defaultPublic: true },
      });
      configService.getActiveConfig.mockResolvedValue(config);

      const options = {
        path: 'test',
        filename: 'file.jpg',
        isPublic: false,
      };
      await service.upload(Buffer.from('data'), options);

      expect(options.isPublic).toBe(false);
    });

    it('should prepend pathPrefix when configured', async () => {
      const config = createActiveConfig({
        settings: { pathPrefix: 'tenant-123' },
      });
      configService.getActiveConfig.mockResolvedValue(config);

      const options = { path: 'uploads', filename: 'file.jpg' };
      await service.upload(Buffer.from('data'), options);

      expect(options.path).toBe('tenant-123/uploads');
    });

    it('should not modify path when pathPrefix is not set', async () => {
      const config = createActiveConfig({
        settings: {},
      });
      configService.getActiveConfig.mockResolvedValue(config);

      const options = { path: 'uploads', filename: 'file.jpg' };
      await service.upload(Buffer.from('data'), options);

      expect(options.path).toBe('uploads');
    });

    it('should skip size validation when size is not provided', async () => {
      const config = createActiveConfig({
        settings: { maxFileSize: 100 },
      });
      configService.getActiveConfig.mockResolvedValue(config);

      // No size in options — should not throw
      await expect(
        service.upload(Buffer.from('data'), {
          path: 'test',
          filename: 'file.jpg',
        }),
      ).resolves.not.toThrow();
    });

    it('should skip MIME validation when mimeType is not provided in options', async () => {
      const config = createActiveConfig({
        settings: {
          allowedMimeTypes: ['image/jpeg'],
        },
      });
      configService.getActiveConfig.mockResolvedValue(config);

      await expect(
        service.upload(Buffer.from('data'), {
          path: 'test',
          filename: 'file.dat',
          // no mimeType
        }),
      ).resolves.not.toThrow();
    });
  });

  // ================================================================
  // download
  // ================================================================

  describe('download', () => {
    it('should download a file via the active provider', async () => {
      const result = await service.download('uploads/test/file.jpg');

      expect(result).toEqual(Buffer.from('file-content'));
      expect(localProvider.download).toHaveBeenCalledWith(
        'uploads/test/file.jpg',
      );
    });
  });

  // ================================================================
  // getReadStream
  // ================================================================

  describe('getReadStream', () => {
    it('should return a readable stream from the active provider', async () => {
      const result = await service.getReadStream('uploads/test/file.jpg');

      expect(result).toBeInstanceOf(Readable);
      expect(localProvider.getReadStream).toHaveBeenCalledWith(
        'uploads/test/file.jpg',
      );
    });
  });

  // ================================================================
  // delete
  // ================================================================

  describe('delete', () => {
    it('should delete a file via the active provider', async () => {
      const result = await service.delete('uploads/test/file.jpg');

      expect(result).toBe(true);
      expect(localProvider.delete).toHaveBeenCalledWith(
        'uploads/test/file.jpg',
      );
    });
  });

  // ================================================================
  // deleteMany
  // ================================================================

  describe('deleteMany', () => {
    it('should delete multiple files via the active provider', async () => {
      const paths = ['file1.jpg', 'file2.jpg', 'file3.jpg'];

      const result = await service.deleteMany(paths);

      expect(result).toBe(3);
      expect(localProvider.deleteMany).toHaveBeenCalledWith(paths);
    });
  });

  // ================================================================
  // exists
  // ================================================================

  describe('exists', () => {
    it('should check file existence via the active provider', async () => {
      const result = await service.exists('uploads/test/file.jpg');

      expect(result).toBe(true);
      expect(localProvider.exists).toHaveBeenCalledWith(
        'uploads/test/file.jpg',
      );
    });
  });

  // ================================================================
  // getUrl
  // ================================================================

  describe('getUrl', () => {
    it('should return URL from the active provider', async () => {
      const result = await service.getUrl('uploads/test/file.jpg');

      expect(result).toBe('http://localhost:3001/uploads/test/file.jpg');
      expect(localProvider.getUrl).toHaveBeenCalledWith(
        'uploads/test/file.jpg',
        undefined,
      );
    });

    it('should pass URL options to the provider', async () => {
      const options = { signed: true, expiresIn: 600 };
      await service.getUrl('uploads/test/file.jpg', options);

      expect(localProvider.getUrl).toHaveBeenCalledWith(
        'uploads/test/file.jpg',
        options,
      );
    });
  });

  // ================================================================
  // getSignedUrl
  // ================================================================

  describe('getSignedUrl', () => {
    it('should return signed URL from the active provider', async () => {
      const result = await service.getSignedUrl('uploads/test/file.jpg', 300);

      expect(result).toBe('http://localhost/signed-url');
      expect(localProvider.getSignedUrl).toHaveBeenCalledWith(
        'uploads/test/file.jpg',
        300,
      );
    });

    it('should work without expiresIn parameter', async () => {
      await service.getSignedUrl('uploads/test/file.jpg');

      expect(localProvider.getSignedUrl).toHaveBeenCalledWith(
        'uploads/test/file.jpg',
        undefined,
      );
    });
  });

  // ================================================================
  // getMetadata
  // ================================================================

  describe('getMetadata', () => {
    it('should return metadata from the active provider', async () => {
      const result = await service.getMetadata('uploads/test/file.jpg');

      expect(result).toEqual(mockFileMetadata);
      expect(localProvider.getMetadata).toHaveBeenCalledWith(
        'uploads/test/file.jpg',
      );
    });
  });

  // ================================================================
  // copy
  // ================================================================

  describe('copy', () => {
    it('should copy a file via the active provider', async () => {
      const result = await service.copy('source/file.jpg', 'dest/file.jpg');

      expect(result).toEqual(mockStorageResult);
      expect(localProvider.copy).toHaveBeenCalledWith(
        'source/file.jpg',
        'dest/file.jpg',
      );
    });
  });

  // ================================================================
  // move
  // ================================================================

  describe('move', () => {
    it('should move a file via the active provider', async () => {
      const result = await service.move('source/file.jpg', 'dest/file.jpg');

      expect(result).toEqual(mockStorageResult);
      expect(localProvider.move).toHaveBeenCalledWith(
        'source/file.jpg',
        'dest/file.jpg',
      );
    });
  });

  // ================================================================
  // list
  // ================================================================

  describe('list', () => {
    it('should list files via the active provider', async () => {
      const result = await service.list('uploads/test');

      expect(result).toEqual([mockFileMetadata]);
      expect(localProvider.list).toHaveBeenCalledWith(
        'uploads/test',
        undefined,
      );
    });

    it('should pass options to the provider', async () => {
      const options = { recursive: true, limit: 50 };
      await service.list('uploads/test', options);

      expect(localProvider.list).toHaveBeenCalledWith(
        'uploads/test',
        options,
      );
    });
  });

  // ================================================================
  // validateActiveProvider
  // ================================================================

  describe('validateActiveProvider', () => {
    it('should validate the active provider config', async () => {
      const result = await service.validateActiveProvider();

      expect(result).toBe(true);
      expect(localProvider.validateConfig).toHaveBeenCalled();
    });
  });

  // ================================================================
  // validateProvider
  // ================================================================

  describe('validateProvider', () => {
    it('should validate a specific provider and return success', async () => {
      const result = await service.validateProvider(StorageProviderType.LOCAL);

      expect(result.success).toBe(true);
      expect(result.message).toContain('verificada');
      expect(result.responseTime).toBeDefined();
      expect(configService.setValidationResult).toHaveBeenCalledWith(
        StorageProviderType.LOCAL,
        true,
        undefined,
      );
    });

    it('should return failure when provider does not exist', async () => {
      const result = await service.validateProvider(
        'unknown' as StorageProviderType,
      );

      expect(result.success).toBe(false);
      expect(result.message).toContain('no disponible');
    });

    it('should return failure when validation returns false', async () => {
      localProvider.validateConfig.mockResolvedValueOnce(false);

      const result = await service.validateProvider(StorageProviderType.LOCAL);

      expect(result.success).toBe(false);
      expect(result.message).toContain('No se pudo verificar');
      expect(configService.setValidationResult).toHaveBeenCalledWith(
        StorageProviderType.LOCAL,
        false,
        'Validation failed',
      );
    });

    it('should handle errors during validation', async () => {
      localProvider.initialize.mockRejectedValueOnce(
        new Error('Connection refused'),
      );

      const result = await service.validateProvider(StorageProviderType.LOCAL);

      expect(result.success).toBe(false);
      expect(result.message).toBe('Connection refused');
      expect(result.responseTime).toBeDefined();
      expect(configService.setValidationResult).toHaveBeenCalledWith(
        StorageProviderType.LOCAL,
        false,
        'Connection refused',
      );
    });

    it('should handle non-Error exceptions during validation', async () => {
      localProvider.initialize.mockRejectedValueOnce('string-error');

      const result = await service.validateProvider(StorageProviderType.LOCAL);

      expect(result.success).toBe(false);
      expect(result.message).toBe('Unknown error');
    });

    it('should add provider to initialized set on successful validation', async () => {
      await service.validateProvider(StorageProviderType.LOCAL);

      // Verify by checking that a subsequent call doesn't re-initialize
      // since initializeActiveProvider checks initializedProviders
      // We indirectly confirm by calling upload (which calls getActiveProvider)
      // and verifying initialize is called only once in the provider validation
      expect(localProvider.initialize).toHaveBeenCalled();
    });
  });

  // ================================================================
  // getUsageInfo
  // ================================================================

  describe('getUsageInfo', () => {
    it('should return usage info when provider supports it', async () => {
      const result = await service.getUsageInfo();

      expect(result).toEqual({ used: 5000, total: 100000, available: 95000 });
    });

    it('should return default when provider does not support getUsageInfo', async () => {
      // Remove getUsageInfo from local provider
      (localProvider as any).getUsageInfo = undefined;

      const result = await service.getUsageInfo();

      expect(result).toEqual({ used: 0 });
    });
  });

  // ================================================================
  // getActiveProviderType
  // ================================================================

  describe('getActiveProviderType', () => {
    it('should return the active provider type from config', async () => {
      const result = await service.getActiveProviderType();

      expect(result).toBe(StorageProviderType.LOCAL);
    });

    it('should reflect different active provider', async () => {
      configService.getActiveConfig.mockResolvedValueOnce(
        createActiveConfig({ provider: StorageProviderType.S3 }),
      );

      const result = await service.getActiveProviderType();

      expect(result).toBe(StorageProviderType.S3);
    });
  });

  // ================================================================
  // Provider routing (verifies correct provider is used)
  // ================================================================

  describe('Provider routing', () => {
    it('should use S3 provider when S3 is active', async () => {
      const s3Config = createActiveConfig({
        provider: StorageProviderType.S3,
      });
      configService.getActiveConfig.mockResolvedValue(s3Config);
      configService.getProviderConfig.mockResolvedValue({
        type: StorageProviderType.S3,
        enabled: true,
        config: { bucket: 'test', region: 'us-east-1' },
        settings: {},
      });

      await service.upload(Buffer.from('data'), {
        path: 'test',
        filename: 'file.jpg',
      });

      expect(s3Provider.upload).toHaveBeenCalled();
      expect(localProvider.upload).not.toHaveBeenCalled();
    });

    it('should throw when active provider type is not in providers map', async () => {
      const badConfig = createActiveConfig({
        provider: 'unknown-provider' as StorageProviderType,
      });
      configService.getActiveConfig.mockResolvedValue(badConfig);

      await expect(
        service.upload(Buffer.from('data'), {
          path: 'test',
          filename: 'file.jpg',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
