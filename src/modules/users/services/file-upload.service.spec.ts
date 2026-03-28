import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FileUploadService } from './file-upload.service';
import * as fs from 'fs';
import * as crypto from 'crypto';

// Mock fs module
jest.mock('fs', () => ({
  existsSync: jest.fn(),
  mkdirSync: jest.fn(),
  writeFileSync: jest.fn(),
  unlinkSync: jest.fn(),
}));

// Mock crypto module
jest.mock('crypto', () => ({
  randomBytes: jest.fn().mockReturnValue({
    toString: jest.fn().mockReturnValue('a1b2c3d4e5f6g7h8'),
  }),
}));

describe('FileUploadService', () => {
  let service: FileUploadService;
  let configService: jest.Mocked<ConfigService>;

  // Valid UUIDs for mock data
  const USER_ID = '123e4567-e89b-12d3-a456-426614174000';

  const createMockFile = (
    overrides: Partial<Express.Multer.File> = {},
  ): Express.Multer.File =>
    ({
      fieldname: 'photo',
      originalname: 'profile.jpg',
      encoding: '7bit',
      mimetype: 'image/jpeg',
      size: 1024 * 100, // 100KB
      buffer: Buffer.from('fake-image-data'),
      destination: '',
      filename: '',
      path: '',
      stream: null as any,
      ...overrides,
    }) as Express.Multer.File;

  beforeEach(async () => {
    // Reset all mocks (including implementations) before each test
    jest.resetAllMocks();

    // Re-apply crypto mock after reset
    (crypto.randomBytes as jest.Mock).mockReturnValue({
      toString: jest.fn().mockReturnValue('a1b2c3d4e5f6g7h8'),
    });

    // Default: upload directory exists (avoid mkdirSync in constructor)
    (fs.existsSync as jest.Mock).mockReturnValue(true);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FileUploadService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockImplementation((key: string) => {
              if (key === 'APP_URL') return 'http://localhost:3001';
              return undefined;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<FileUploadService>(FileUploadService);
    configService = module.get(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ─────────────────────────────────────────────────────
  // Constructor behavior
  // ─────────────────────────────────────────────────────
  describe('constructor', () => {
    it('should create upload directory if it does not exist', async () => {
      jest.clearAllMocks();
      (fs.existsSync as jest.Mock).mockReturnValue(false);

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          FileUploadService,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn().mockReturnValue('http://localhost:3001'),
            },
          },
        ],
      }).compile();

      module.get<FileUploadService>(FileUploadService);

      expect(fs.mkdirSync).toHaveBeenCalledWith(
        expect.stringContaining('uploads/profile-photos'),
        { recursive: true },
      );
    });

    it('should NOT create upload directory if it already exists', () => {
      // Default beforeEach has existsSync returning true
      // The constructor was already called in beforeEach
      // mkdirSync should not have been called after clearing mocks
      expect(fs.mkdirSync).not.toHaveBeenCalled();
    });
  });

  // ─────────────────────────────────────────────────────
  // uploadProfilePhoto
  // ─────────────────────────────────────────────────────
  describe('uploadProfilePhoto', () => {
    it('should upload a valid JPEG file and return public URL', async () => {
      const file = createMockFile();

      const result = await service.uploadProfilePhoto(file, USER_ID);

      expect(fs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining('uploads/profile-photos'),
        file.buffer,
      );
      expect(result).toContain('http://localhost:3001/uploads/profile-photos/');
      expect(result).toContain(USER_ID);
      expect(result).toContain('.jpg');
    });

    it('should upload a valid PNG file and return public URL', async () => {
      const file = createMockFile({
        originalname: 'avatar.png',
        mimetype: 'image/png',
      });

      const result = await service.uploadProfilePhoto(file, USER_ID);

      expect(result).toContain('.png');
      expect(fs.writeFileSync).toHaveBeenCalled();
    });

    it('should upload a valid WebP file and return public URL', async () => {
      const file = createMockFile({
        originalname: 'photo.webp',
        mimetype: 'image/webp',
      });

      const result = await service.uploadProfilePhoto(file, USER_ID);

      expect(result).toContain('.webp');
    });

    it('should generate a unique filename with userId, timestamp, and random hex', async () => {
      const file = createMockFile();
      const beforeTs = Date.now();

      const result = await service.uploadProfilePhoto(file, USER_ID);

      // URL should contain the userId
      expect(result).toContain(USER_ID);
      // crypto.randomBytes should have been called for uniqueness
      expect(crypto.randomBytes).toHaveBeenCalledWith(8);
    });

    it('should throw BadRequestException when no file is provided', async () => {
      await expect(
        service.uploadProfilePhoto(null as any, USER_ID),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.uploadProfilePhoto(null as any, USER_ID),
      ).rejects.toThrow('No file provided');
    });

    it('should throw BadRequestException when file is undefined', async () => {
      await expect(
        service.uploadProfilePhoto(undefined as any, USER_ID),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when file exceeds 5MB', async () => {
      const file = createMockFile({
        size: 6 * 1024 * 1024, // 6MB
      });

      await expect(
        service.uploadProfilePhoto(file, USER_ID),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.uploadProfilePhoto(file, USER_ID),
      ).rejects.toThrow(/exceeds maximum allowed size/);
    });

    it('should allow files exactly at 5MB limit', async () => {
      const file = createMockFile({
        size: 5 * 1024 * 1024, // exactly 5MB
      });

      const result = await service.uploadProfilePhoto(file, USER_ID);

      expect(result).toContain('http://localhost:3001/uploads/profile-photos/');
    });

    it('should throw BadRequestException for invalid mime type (application/pdf)', async () => {
      const file = createMockFile({
        mimetype: 'application/pdf',
        originalname: 'document.pdf',
      });

      await expect(
        service.uploadProfilePhoto(file, USER_ID),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.uploadProfilePhoto(file, USER_ID),
      ).rejects.toThrow(/Invalid file type/);
    });

    it('should throw BadRequestException for invalid mime type (image/gif)', async () => {
      const file = createMockFile({
        mimetype: 'image/gif',
        originalname: 'animation.gif',
      });

      await expect(
        service.uploadProfilePhoto(file, USER_ID),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for invalid mime type (image/svg+xml)', async () => {
      const file = createMockFile({
        mimetype: 'image/svg+xml',
        originalname: 'icon.svg',
      });

      await expect(
        service.uploadProfilePhoto(file, USER_ID),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when writeFileSync fails', async () => {
      const file = createMockFile();
      (fs.writeFileSync as jest.Mock).mockImplementation(() => {
        throw new Error('ENOSPC: no space left on device');
      });

      await expect(
        service.uploadProfilePhoto(file, USER_ID),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.uploadProfilePhoto(file, USER_ID),
      ).rejects.toThrow('Failed to upload file');
    });

    it('should handle file with no extension', async () => {
      const file = createMockFile({
        originalname: 'noextensionfile',
        mimetype: 'image/jpeg',
      });

      const result = await service.uploadProfilePhoto(file, USER_ID);

      // Should still work, just no extension in the filename
      expect(result).toContain('http://localhost:3001/uploads/profile-photos/');
      expect(fs.writeFileSync).toHaveBeenCalled();
    });

    it('should handle file with multiple dots in name', async () => {
      const file = createMockFile({
        originalname: 'my.profile.photo.jpg',
        mimetype: 'image/jpeg',
      });

      const result = await service.uploadProfilePhoto(file, USER_ID);

      expect(result).toContain('.jpg');
    });

    it('should use APP_URL from ConfigService for public URL', async () => {
      configService.get.mockImplementation((key: string) => {
        if (key === 'APP_URL') return 'https://api.taskhub.com';
        return undefined;
      });

      const file = createMockFile();
      const result = await service.uploadProfilePhoto(file, USER_ID);

      expect(result).toContain('https://api.taskhub.com/uploads/profile-photos/');
    });
  });

  // ─────────────────────────────────────────────────────
  // deleteProfilePhoto
  // ─────────────────────────────────────────────────────
  describe('deleteProfilePhoto', () => {
    const photoUrl =
      'http://localhost:3001/uploads/profile-photos/123e4567_1234567890_abcdef.jpg';

    it('should delete an existing file', async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(true);

      await service.deleteProfilePhoto(photoUrl);

      expect(fs.unlinkSync).toHaveBeenCalledWith(
        expect.stringContaining('123e4567_1234567890_abcdef.jpg'),
      );
    });

    it('should not throw when file does not exist on disk', async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false);

      await expect(
        service.deleteProfilePhoto(photoUrl),
      ).resolves.toBeUndefined();

      expect(fs.unlinkSync).not.toHaveBeenCalled();
    });

    it('should not throw when photoUrl results in empty filename', async () => {
      // URL ending with / would produce empty string from split('/').pop()
      await expect(
        service.deleteProfilePhoto('http://localhost:3001/uploads/'),
      ).resolves.toBeUndefined();
    });

    it('should not throw when unlinkSync fails', async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.unlinkSync as jest.Mock).mockImplementation(() => {
        throw new Error('EACCES: permission denied');
      });

      // Should NOT throw — errors are logged but swallowed
      await expect(
        service.deleteProfilePhoto(photoUrl),
      ).resolves.toBeUndefined();
    });

    it('should extract correct filename from URL with path segments', async () => {
      const url =
        'http://localhost:3001/uploads/profile-photos/user123_ts_hex.png';
      (fs.existsSync as jest.Mock).mockReturnValue(true);

      await service.deleteProfilePhoto(url);

      expect(fs.unlinkSync).toHaveBeenCalledWith(
        expect.stringContaining('user123_ts_hex.png'),
      );
    });

    it('should handle URLs with query parameters gracefully', async () => {
      // split('/').pop() on a URL like this returns the filename + query
      // The service doesn't strip query params, but it shouldn't crash
      const url =
        'http://localhost:3001/uploads/profile-photos/photo.jpg?v=123';
      (fs.existsSync as jest.Mock).mockReturnValue(false);

      await expect(service.deleteProfilePhoto(url)).resolves.toBeUndefined();
    });
  });

  // ─────────────────────────────────────────────────────
  // uploadToS3 (placeholder — always rejects)
  // ─────────────────────────────────────────────────────
  describe('uploadToS3', () => {
    it('should reject with "not yet implemented" error', async () => {
      const file = createMockFile();

      await expect(service.uploadToS3(file, USER_ID)).rejects.toThrow(
        'S3 upload not yet implemented',
      );
    });

    it('should reject with an Error instance', async () => {
      const file = createMockFile();

      await expect(service.uploadToS3(file, USER_ID)).rejects.toBeInstanceOf(
        Error,
      );
    });
  });
});
