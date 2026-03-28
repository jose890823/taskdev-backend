import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { StorageConfigService } from './storage-config.service';
import {
  StorageConfig,
  S3Config,
  CloudinaryConfig,
  LocalConfig,
} from '../entities/storage-config.entity';
import { StorageProviderType } from '../interfaces/storage-provider.interface';
import { EncryptionService } from '../../../shared/encryption.service';

describe('StorageConfigService', () => {
  let service: StorageConfigService;
  let repository: jest.Mocked<Repository<StorageConfig>>;
  let cacheManager: jest.Mocked<Cache>;
  let encryptionService: jest.Mocked<EncryptionService>;
  let configService: jest.Mocked<ConfigService>;

  // ── Mock data ──────────────────────────────────────────────

  const mockConfigId = '123e4567-e89b-12d3-a456-426614174000';
  const mockConfigId2 = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

  const createMockStorageConfig = (
    overrides: Partial<StorageConfig> = {},
  ): StorageConfig => {
    return {
      id: mockConfigId,
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
      } as LocalConfig,
      settings: {
        maxFileSize: 100 * 1024 * 1024,
        allowedMimeTypes: ['image/jpeg', 'image/png'],
        defaultPublic: false,
        urlExpiration: 3600,
      },
      createdAt: new Date('2026-01-01'),
      updatedAt: new Date('2026-01-01'),
      getSafeConfig: jest.fn(),
      hasMinimumConfig: jest.fn().mockReturnValue(true),
      ...overrides,
    } as unknown as StorageConfig;
  };

  const createMockS3Config = (): StorageConfig =>
    createMockStorageConfig({
      id: mockConfigId2,
      provider: StorageProviderType.S3,
      name: 'Amazon S3',
      isActive: false,
      config: {
        bucket: 'my-bucket',
        region: 'us-east-1',
        accessKeyId: 'AKIAXXXXXXXX',
        secretAccessKey: 'secret123',
      } as S3Config,
    });

  const createMockCloudinaryConfig = (): StorageConfig =>
    createMockStorageConfig({
      id: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
      provider: StorageProviderType.CLOUDINARY,
      name: 'Cloudinary',
      isActive: false,
      isConfigured: true,
      config: {
        cloudName: 'my-cloud',
        apiKey: 'api-key-123',
        apiSecret: 'api-secret-456',
        folder: 'michambita',
      } as CloudinaryConfig,
    });

  // ── Setup ──────────────────────────────────────────────────

  beforeEach(async () => {
    const mockRepository = {
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn().mockImplementation((data) => ({
        ...data,
        hasMinimumConfig: jest.fn().mockReturnValue(true),
      })),
      save: jest.fn().mockImplementation(async (entity) => entity),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    };

    const mockCacheManager = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
      del: jest.fn().mockResolvedValue(undefined),
    };

    const mockEncryptionService = {
      encrypt: jest
        .fn()
        .mockImplementation((v: string) => `encrypted:${v}`),
      decrypt: jest
        .fn()
        .mockImplementation((v: string) =>
          v.startsWith('encrypted:') ? v.replace('encrypted:', '') : v,
        ),
    };

    const mockConfigService = {
      get: jest.fn().mockReturnValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StorageConfigService,
        {
          provide: getRepositoryToken(StorageConfig),
          useValue: mockRepository,
        },
        { provide: CACHE_MANAGER, useValue: mockCacheManager },
        { provide: EncryptionService, useValue: mockEncryptionService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<StorageConfigService>(StorageConfigService);
    repository = module.get(getRepositoryToken(StorageConfig));
    cacheManager = module.get(CACHE_MANAGER);
    encryptionService = module.get(EncryptionService);
    configService = module.get(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ================================================================
  // onModuleInit (seedDefaultConfigs)
  // ================================================================

  describe('onModuleInit', () => {
    it('should seed default configs for all provider types', async () => {
      repository.findOne.mockResolvedValue(null);

      await service.onModuleInit();

      // Should create configs for LOCAL, S3, GCS, CLOUDINARY
      const providerCount = Object.values(StorageProviderType).length;
      expect(repository.save).toHaveBeenCalledTimes(providerCount);
    });

    it('should not re-create configs that already exist', async () => {
      repository.findOne.mockResolvedValue(createMockStorageConfig());

      await service.onModuleInit();

      expect(repository.save).not.toHaveBeenCalled();
    });

    it('should set LOCAL as active and configured by default', async () => {
      repository.findOne.mockResolvedValue(null);

      await service.onModuleInit();

      // Find the call that created LOCAL config
      const saveCalls = repository.save.mock.calls;
      const localCall = saveCalls.find(
        (call) =>
          (call[0] as Partial<StorageConfig>).provider ===
          StorageProviderType.LOCAL,
      );

      expect(localCall).toBeDefined();
      expect((localCall![0] as Partial<StorageConfig>).isActive).toBe(true);
      expect((localCall![0] as Partial<StorageConfig>).isConfigured).toBe(
        true,
      );
    });

    it('should set non-LOCAL providers as inactive by default', async () => {
      repository.findOne.mockResolvedValue(null);

      await service.onModuleInit();

      const saveCalls = repository.save.mock.calls;
      const s3Call = saveCalls.find(
        (call) =>
          (call[0] as Partial<StorageConfig>).provider ===
          StorageProviderType.S3,
      );

      expect(s3Call).toBeDefined();
      expect((s3Call![0] as Partial<StorageConfig>).isActive).toBe(false);
    });

    it('should use environment variables for default local config', async () => {
      repository.findOne.mockResolvedValue(null);
      configService.get.mockImplementation((key: string) => {
        if (key === 'LOCAL_STORAGE_PATH') return '/custom/path';
        if (key === 'LOCAL_STORAGE_URL') return 'https://cdn.example.com';
        return undefined;
      });

      await service.onModuleInit();

      const saveCalls = repository.save.mock.calls;
      const localCall = saveCalls.find(
        (call) =>
          (call[0] as Partial<StorageConfig>).provider ===
          StorageProviderType.LOCAL,
      );
      const config = (localCall![0] as any).config as LocalConfig;
      expect(config.basePath).toBe('/custom/path');
      expect(config.baseUrl).toBe('https://cdn.example.com');
    });

    it('should use environment variables for S3 default config', async () => {
      repository.findOne.mockResolvedValue(null);
      configService.get.mockImplementation((key: string) => {
        if (key === 'AWS_S3_BUCKET') return 'my-bucket';
        if (key === 'AWS_S3_REGION') return 'eu-west-1';
        if (key === 'AWS_ACCESS_KEY_ID') return 'AKIA_TEST';
        if (key === 'AWS_SECRET_ACCESS_KEY') return 'secret';
        return undefined;
      });

      await service.onModuleInit();

      const saveCalls = repository.save.mock.calls;
      const s3Call = saveCalls.find(
        (call) =>
          (call[0] as Partial<StorageConfig>).provider ===
          StorageProviderType.S3,
      );
      const config = (s3Call![0] as any).config as S3Config;
      expect(config.bucket).toBe('my-bucket');
      expect(config.region).toBe('eu-west-1');
    });
  });

  // ================================================================
  // getActiveConfig
  // ================================================================

  describe('getActiveConfig', () => {
    it('should return cached config when available', async () => {
      const cached = createMockStorageConfig();
      cacheManager.get.mockResolvedValue(cached);

      const result = await service.getActiveConfig();

      expect(result).toEqual(cached);
      expect(repository.findOne).not.toHaveBeenCalled();
    });

    it('should query DB when cache misses', async () => {
      const dbConfig = createMockStorageConfig();
      repository.findOne.mockResolvedValueOnce(dbConfig);

      const result = await service.getActiveConfig();

      expect(result).toEqual(dbConfig);
      expect(cacheManager.set).toHaveBeenCalledWith(
        'storage:active',
        dbConfig,
        300000,
      );
    });

    it('should fallback to LOCAL when no active config exists', async () => {
      const localConfig = createMockStorageConfig({
        isActive: false,
      });

      // First call: no active config
      repository.findOne
        .mockResolvedValueOnce(null)
        // Second call: find LOCAL
        .mockResolvedValueOnce(localConfig);

      const result = await service.getActiveConfig();

      expect(result.isActive).toBe(true);
      expect(repository.save).toHaveBeenCalled();
      expect(cacheManager.set).toHaveBeenCalled();
    });

    it('should throw NotFoundException when no config exists at all', async () => {
      repository.findOne.mockResolvedValue(null);

      await expect(service.getActiveConfig()).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ================================================================
  // getConfig
  // ================================================================

  describe('getConfig', () => {
    it('should return cached config when available', async () => {
      const cached = createMockS3Config();
      cacheManager.get.mockResolvedValue(cached);

      const result = await service.getConfig(StorageProviderType.S3);

      expect(result).toEqual(cached);
      expect(repository.findOne).not.toHaveBeenCalled();
    });

    it('should query DB and cache when cache misses', async () => {
      const dbConfig = createMockS3Config();
      repository.findOne.mockResolvedValueOnce(dbConfig);

      const result = await service.getConfig(StorageProviderType.S3);

      expect(result).toEqual(dbConfig);
      expect(cacheManager.set).toHaveBeenCalledWith(
        'storage:config:s3',
        dbConfig,
        300000,
      );
    });

    it('should throw NotFoundException when config not found', async () => {
      cacheManager.get.mockResolvedValue(null);
      repository.findOne.mockResolvedValue(null);

      await expect(
        service.getConfig(StorageProviderType.S3),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ================================================================
  // getAllConfigs
  // ================================================================

  describe('getAllConfigs', () => {
    it('should return all configs ordered by provider', async () => {
      const configs = [
        createMockStorageConfig(),
        createMockS3Config(),
      ];
      repository.find.mockResolvedValue(configs);

      const result = await service.getAllConfigs();

      expect(result).toEqual(configs);
      expect(repository.find).toHaveBeenCalledWith({
        order: { provider: 'ASC' },
      });
    });

    it('should return empty array when no configs exist', async () => {
      repository.find.mockResolvedValue([]);

      const result = await service.getAllConfigs();

      expect(result).toEqual([]);
    });
  });

  // ================================================================
  // updateConfig
  // ================================================================

  describe('updateConfig', () => {
    it('should update name of a provider config', async () => {
      const existing = createMockStorageConfig();
      cacheManager.get.mockResolvedValue(null);
      repository.findOne.mockResolvedValue(existing);

      const result = await service.updateConfig(StorageProviderType.LOCAL, {
        name: 'Custom Local Storage',
      });

      expect(result.name).toBe('Custom Local Storage');
      expect(repository.save).toHaveBeenCalled();
    });

    it('should merge config fields and encrypt sensitive fields', async () => {
      const existing = createMockS3Config();
      cacheManager.get.mockResolvedValue(null);
      repository.findOne.mockResolvedValue(existing);

      await service.updateConfig(StorageProviderType.S3, {
        config: {
          bucket: 'new-bucket',
          secretAccessKey: 'new-secret',
        },
      });

      expect(encryptionService.encrypt).toHaveBeenCalledWith('new-secret');
      expect(repository.save).toHaveBeenCalled();
    });

    it('should not encrypt fields with value "********"', async () => {
      const existing = createMockS3Config();
      cacheManager.get.mockResolvedValue(null);
      repository.findOne.mockResolvedValue(existing);

      await service.updateConfig(StorageProviderType.S3, {
        config: {
          secretAccessKey: '********',
        },
      });

      // Should not encrypt the masked value
      expect(encryptionService.encrypt).not.toHaveBeenCalledWith('********');
    });

    it('should merge settings when provided', async () => {
      const existing = createMockStorageConfig();
      cacheManager.get.mockResolvedValue(null);
      repository.findOne.mockResolvedValue(existing);

      await service.updateConfig(StorageProviderType.LOCAL, {
        settings: { maxFileSize: 50 * 1024 * 1024 },
      });

      expect(existing.settings.maxFileSize).toBe(50 * 1024 * 1024);
      // Other settings should be preserved
      expect(existing.settings.allowedMimeTypes).toBeDefined();
    });

    it('should check hasMinimumConfig after update', async () => {
      const existing = createMockStorageConfig();
      cacheManager.get.mockResolvedValue(null);
      repository.findOne.mockResolvedValue(existing);

      await service.updateConfig(StorageProviderType.LOCAL, {
        name: 'Updated',
      });

      expect(existing.hasMinimumConfig).toHaveBeenCalled();
    });

    it('should clear lastValidationError on update', async () => {
      const existing = createMockStorageConfig({
        lastValidationError: 'Previous error',
      });
      cacheManager.get.mockResolvedValue(null);
      repository.findOne.mockResolvedValue(existing);

      await service.updateConfig(StorageProviderType.LOCAL, {
        name: 'Updated',
      });

      expect(existing.lastValidationError).toBeNull();
    });

    it('should invalidate cache after update', async () => {
      const existing = createMockStorageConfig();
      cacheManager.get.mockResolvedValue(null);
      repository.findOne.mockResolvedValue(existing);

      await service.updateConfig(StorageProviderType.LOCAL, {
        name: 'New Name',
      });

      expect(cacheManager.del).toHaveBeenCalledWith('storage:config:local');
      expect(cacheManager.del).toHaveBeenCalledWith('storage:active');
    });

    it('should throw NotFoundException when provider config does not exist', async () => {
      cacheManager.get.mockResolvedValue(null);
      repository.findOne.mockResolvedValue(null);

      await expect(
        service.updateConfig(StorageProviderType.S3, { name: 'Test' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should encrypt S3 sensitive fields (accessKeyId, secretAccessKey)', async () => {
      const existing = createMockS3Config();
      cacheManager.get.mockResolvedValue(null);
      repository.findOne.mockResolvedValue(existing);

      await service.updateConfig(StorageProviderType.S3, {
        config: {
          accessKeyId: 'new-access-key',
          secretAccessKey: 'new-secret-key',
        },
      });

      expect(encryptionService.encrypt).toHaveBeenCalledWith('new-access-key');
      expect(encryptionService.encrypt).toHaveBeenCalledWith('new-secret-key');
    });

    it('should encrypt Cloudinary sensitive fields (apiKey, apiSecret)', async () => {
      const existing = createMockCloudinaryConfig();
      cacheManager.get.mockResolvedValue(null);
      repository.findOne.mockResolvedValue(existing);

      await service.updateConfig(StorageProviderType.CLOUDINARY, {
        config: {
          apiKey: 'new-api-key',
          apiSecret: 'new-api-secret',
        },
      });

      expect(encryptionService.encrypt).toHaveBeenCalledWith('new-api-key');
      expect(encryptionService.encrypt).toHaveBeenCalledWith('new-api-secret');
    });

    it('should handle GCS nested credentials encryption', async () => {
      const gcsConfig = createMockStorageConfig({
        provider: StorageProviderType.GCS,
        config: {
          projectId: 'my-project',
          bucket: 'my-bucket',
          credentials: {
            client_email: 'sa@project.iam.gserviceaccount.com',
            private_key: '-----BEGIN PRIVATE KEY-----',
          },
        } as any,
      });
      cacheManager.get.mockResolvedValue(null);
      repository.findOne.mockResolvedValue(gcsConfig);

      await service.updateConfig(StorageProviderType.GCS, {
        config: {
          credentials: {
            client_email: 'new@project.iam.gserviceaccount.com',
            private_key: '-----NEW PRIVATE KEY-----',
          },
        } as any,
      });

      expect(encryptionService.encrypt).toHaveBeenCalledWith(
        '-----NEW PRIVATE KEY-----',
      );
    });
  });

  // ================================================================
  // activateProvider
  // ================================================================

  describe('activateProvider', () => {
    it('should activate a configured provider', async () => {
      const s3Config = createMockS3Config();
      s3Config.isConfigured = true;
      cacheManager.get.mockResolvedValue(null);
      repository.findOne.mockResolvedValue(s3Config);

      const result = await service.activateProvider(StorageProviderType.S3);

      expect(result.isActive).toBe(true);
      expect(repository.update).toHaveBeenCalledWith(
        {},
        { isActive: false },
      );
      expect(repository.save).toHaveBeenCalled();
    });

    it('should throw BadRequestException when provider is not configured', async () => {
      const unconfigured = createMockS3Config();
      unconfigured.isConfigured = false;
      cacheManager.get.mockResolvedValue(null);
      repository.findOne.mockResolvedValue(unconfigured);

      await expect(
        service.activateProvider(StorageProviderType.S3),
      ).rejects.toThrow(BadRequestException);
    });

    it('should deactivate all other providers before activating', async () => {
      const config = createMockStorageConfig({ isConfigured: true });
      cacheManager.get.mockResolvedValue(null);
      repository.findOne.mockResolvedValue(config);

      await service.activateProvider(StorageProviderType.LOCAL);

      expect(repository.update).toHaveBeenCalledWith(
        {},
        { isActive: false },
      );
    });

    it('should invalidate all cache after activation', async () => {
      const config = createMockStorageConfig({ isConfigured: true });
      cacheManager.get.mockResolvedValue(null);
      repository.findOne.mockResolvedValue(config);

      await service.activateProvider(StorageProviderType.LOCAL);

      // Should clear all provider caches + active cache
      expect(cacheManager.del).toHaveBeenCalledWith('storage:active');
      expect(cacheManager.del).toHaveBeenCalledWith('storage:config:local');
      expect(cacheManager.del).toHaveBeenCalledWith('storage:config:s3');
      expect(cacheManager.del).toHaveBeenCalledWith('storage:config:gcs');
      expect(cacheManager.del).toHaveBeenCalledWith(
        'storage:config:cloudinary',
      );
    });

    it('should throw NotFoundException when provider does not exist', async () => {
      cacheManager.get.mockResolvedValue(null);
      repository.findOne.mockResolvedValue(null);

      await expect(
        service.activateProvider(StorageProviderType.GCS),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ================================================================
  // setValidationResult
  // ================================================================

  describe('setValidationResult', () => {
    it('should store successful validation result', async () => {
      await service.setValidationResult(StorageProviderType.LOCAL, true);

      expect(repository.update).toHaveBeenCalledWith(
        { provider: StorageProviderType.LOCAL },
        {
          lastValidatedAt: expect.any(Date),
          lastValidationError: null,
          isConfigured: true,
        },
      );
    });

    it('should store failed validation result with error message', async () => {
      await service.setValidationResult(
        StorageProviderType.S3,
        false,
        'Connection timeout',
      );

      expect(repository.update).toHaveBeenCalledWith(
        { provider: StorageProviderType.S3 },
        {
          lastValidatedAt: expect.any(Date),
          lastValidationError: 'Connection timeout',
          isConfigured: false,
        },
      );
    });

    it('should use default error message when none provided', async () => {
      await service.setValidationResult(StorageProviderType.S3, false);

      expect(repository.update).toHaveBeenCalledWith(
        { provider: StorageProviderType.S3 },
        expect.objectContaining({
          lastValidationError: 'Validation failed',
        }),
      );
    });

    it('should invalidate cache after storing result', async () => {
      await service.setValidationResult(StorageProviderType.S3, true);

      expect(cacheManager.del).toHaveBeenCalledWith('storage:config:s3');
      expect(cacheManager.del).toHaveBeenCalledWith('storage:active');
    });
  });

  // ================================================================
  // getProviderConfig
  // ================================================================

  describe('getProviderConfig', () => {
    it('should return decrypted provider config', async () => {
      const s3Config = createMockS3Config();
      cacheManager.get.mockResolvedValue(null);
      repository.findOne.mockResolvedValue(s3Config);

      const result = await service.getProviderConfig(StorageProviderType.S3);

      expect(result.type).toBe(StorageProviderType.S3);
      expect(result.enabled).toBe(true); // isConfigured
      expect(result.settings).toEqual(s3Config.settings);
    });

    it('should decrypt sensitive fields for S3', async () => {
      const s3Config = createMockS3Config();
      (s3Config.config as S3Config).accessKeyId = 'encrypted:AKIA_KEY';
      (s3Config.config as S3Config).secretAccessKey =
        'encrypted:SECRET_KEY';

      cacheManager.get.mockResolvedValue(null);
      repository.findOne.mockResolvedValue(s3Config);

      await service.getProviderConfig(StorageProviderType.S3);

      expect(encryptionService.decrypt).toHaveBeenCalledWith(
        'encrypted:AKIA_KEY',
      );
      expect(encryptionService.decrypt).toHaveBeenCalledWith(
        'encrypted:SECRET_KEY',
      );
    });

    it('should handle decryption failure gracefully (leave value as-is)', async () => {
      const s3Config = createMockS3Config();
      (s3Config.config as S3Config).secretAccessKey = 'plain-text-value';

      cacheManager.get.mockResolvedValue(null);
      repository.findOne.mockResolvedValue(s3Config);

      encryptionService.decrypt.mockImplementation((v: string) => {
        if (v === 'plain-text-value') throw new Error('Invalid format');
        return v;
      });

      const result = await service.getProviderConfig(StorageProviderType.S3);

      // Should not throw — the value stays as-is
      expect(result.config).toBeDefined();
    });

    it('should decrypt GCS nested credentials', async () => {
      const gcsConfig = createMockStorageConfig({
        provider: StorageProviderType.GCS,
        isConfigured: true,
        config: {
          projectId: 'my-project',
          bucket: 'my-bucket',
          credentials: {
            client_email: 'sa@project.iam.gserviceaccount.com',
            private_key: 'encrypted:PRIVATE_KEY_VALUE',
          },
        } as any,
      });
      cacheManager.get.mockResolvedValue(null);
      repository.findOne.mockResolvedValue(gcsConfig);

      await service.getProviderConfig(StorageProviderType.GCS);

      expect(encryptionService.decrypt).toHaveBeenCalledWith(
        'encrypted:PRIVATE_KEY_VALUE',
      );
    });

    it('should handle GCS credentials decryption failure gracefully', async () => {
      const gcsConfig = createMockStorageConfig({
        provider: StorageProviderType.GCS,
        isConfigured: true,
        config: {
          projectId: 'my-project',
          bucket: 'my-bucket',
          credentials: {
            client_email: 'sa@project.iam.gserviceaccount.com',
            private_key: 'bad-encrypted-data',
          },
        } as any,
      });
      cacheManager.get.mockResolvedValue(null);
      repository.findOne.mockResolvedValue(gcsConfig);

      encryptionService.decrypt.mockImplementation(() => {
        throw new Error('Decrypt failed');
      });

      // Should not throw
      const result = await service.getProviderConfig(StorageProviderType.GCS);
      expect(result).toBeDefined();
    });

    it('should throw NotFoundException when config not found', async () => {
      cacheManager.get.mockResolvedValue(null);
      repository.findOne.mockResolvedValue(null);

      await expect(
        service.getProviderConfig(StorageProviderType.S3),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
