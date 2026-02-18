import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { existsSync, mkdirSync, writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import * as crypto from 'crypto';

/**
 * Service for handling file uploads
 * Currently uses local filesystem, can be extended to use S3/CloudStorage
 */
@Injectable()
export class FileUploadService {
  private readonly logger = new Logger(FileUploadService.name);
  private readonly uploadDir: string;
  private readonly maxFileSize: number = 5 * 1024 * 1024; // 5MB
  private readonly allowedMimeTypes: string[] = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
  ];

  constructor(private configService: ConfigService) {
    this.uploadDir = join(process.cwd(), 'uploads', 'profile-photos');

    // Ensure upload directory exists
    if (!existsSync(this.uploadDir)) {
      mkdirSync(this.uploadDir, { recursive: true });
      this.logger.log(`📁 Created upload directory: ${this.uploadDir}`);
    }

    this.logger.log('📤 FileUploadService initialized');
  }

  /**
   * Upload profile photo
   */
  async uploadProfilePhoto(
    file: Express.Multer.File,
    userId: string,
  ): Promise<string> {
    // Validate file
    this.validateFile(file);

    // Generate unique filename
    const ext = this.getFileExtension(file.originalname);
    const filename = `${userId}_${Date.now()}_${crypto.randomBytes(8).toString('hex')}${ext}`;
    const filepath = join(this.uploadDir, filename);

    try {
      // Write file to disk
      writeFileSync(filepath, file.buffer);

      // Return public URL
      const publicUrl = `${this.configService.get('APP_URL')}/uploads/profile-photos/${filename}`;

      this.logger.log(`✅ Profile photo uploaded: ${filename}`);

      return publicUrl;
    } catch (error) {
      this.logger.error('Error uploading file', error.stack);
      throw new BadRequestException('Failed to upload file');
    }
  }

  /**
   * Delete profile photo
   */
  async deleteProfilePhoto(photoUrl: string): Promise<void> {
    try {
      // Extract filename from URL
      const filename = photoUrl.split('/').pop();
      if (!filename) return;

      const filepath = join(this.uploadDir, filename);

      // Delete file if exists
      if (existsSync(filepath)) {
        unlinkSync(filepath);
        this.logger.log(`🗑️  Profile photo deleted: ${filename}`);
      }
    } catch (error) {
      this.logger.error('Error deleting file', error.stack);
      // Don't throw error, just log it
    }
  }

  /**
   * Validate uploaded file
   */
  private validateFile(file: Express.Multer.File): void {
    // Check if file exists
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    // Check file size
    if (file.size > this.maxFileSize) {
      throw new BadRequestException(
        `File size exceeds maximum allowed size of ${this.maxFileSize / 1024 / 1024}MB`,
      );
    }

    // Check mime type
    if (!this.allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        `Invalid file type. Allowed types: ${this.allowedMimeTypes.join(', ')}`,
      );
    }
  }

  /**
   * Get file extension from filename
   */
  private getFileExtension(filename: string): string {
    const parts = filename.split('.');
    if (parts.length > 1) {
      return `.${parts.pop()}`;
    }
    return '';
  }

  /**
   * TODO: Implement S3 upload
   * This method would upload to AWS S3 or similar cloud storage
   */
  async uploadToS3(file: Express.Multer.File, userId: string): Promise<string> {
    // Placeholder for S3 implementation
    throw new Error('S3 upload not yet implemented');

    // Example implementation:
    // const s3 = new AWS.S3();
    // const key = `profile-photos/${userId}/${Date.now()}-${file.originalname}`;
    // await s3.upload({
    //   Bucket: this.configService.get('AWS_S3_BUCKET'),
    //   Key: key,
    //   Body: file.buffer,
    //   ContentType: file.mimetype,
    //   ACL: 'public-read',
    // }).promise();
    // return `https://${bucket}.s3.amazonaws.com/${key}`;
  }
}
