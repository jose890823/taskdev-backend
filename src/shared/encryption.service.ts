import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

@Injectable()
export class EncryptionService {
  private readonly logger = new Logger(EncryptionService.name);
  private readonly algorithm = 'aes-256-cbc';
  private readonly encryptionKey: Buffer;
  private readonly ivLength = 16; // For AES, this is always 16

  constructor(private configService: ConfigService) {
    // Get encryption key from environment or use a default for development
    const keyString =
      this.configService.get<string>('ENCRYPTION_KEY') ||
      'michambita_default_encryption_key_32chars_long!!';

    // Ensure the key is exactly 32 bytes (256 bits) for AES-256
    this.encryptionKey = crypto.createHash('sha256').update(keyString).digest();

    this.logger.log('🔐 EncryptionService initialized with AES-256-CBC');
  }

  /**
   * Encrypts a string using AES-256-CBC
   * @param text - Plain text to encrypt
   * @returns Encrypted text in format: iv:encryptedData (both in hex)
   */
  encrypt(text: string): string {
    if (!text) {
      return text;
    }

    try {
      // Generate a random initialization vector
      const iv = crypto.randomBytes(this.ivLength);

      // Create cipher
      const cipher = crypto.createCipheriv(
        this.algorithm,
        this.encryptionKey,
        iv,
      );

      // Encrypt the text
      let encrypted = cipher.update(text, 'utf8', 'hex');
      encrypted += cipher.final('hex');

      // Return iv + encrypted data (separated by :)
      return `${iv.toString('hex')}:${encrypted}`;
    } catch (error) {
      this.logger.error('Error encrypting data', error.stack);
      throw new Error('Failed to encrypt data');
    }
  }

  /**
   * Decrypts an encrypted string
   * @param encryptedText - Encrypted text in format: iv:encryptedData
   * @returns Decrypted plain text
   */
  decrypt(encryptedText: string): string {
    if (!encryptedText) {
      return encryptedText;
    }

    try {
      // Split iv and encrypted data
      const parts = encryptedText.split(':');
      if (parts.length !== 2) {
        throw new Error('Invalid encrypted text format');
      }

      const iv = Buffer.from(parts[0], 'hex');
      const encrypted = parts[1];

      // Create decipher
      const decipher = crypto.createDecipheriv(
        this.algorithm,
        this.encryptionKey,
        iv,
      );

      // Decrypt the text
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      this.logger.error('Error decrypting data', error.stack);
      throw new Error('Failed to decrypt data');
    }
  }

  /**
   * Encrypts a JSON object
   * @param data - Object to encrypt
   * @returns Encrypted string
   */
  encryptObject<T>(data: T): string | null {
    if (!data) {
      return null;
    }

    try {
      const jsonString = JSON.stringify(data);
      return this.encrypt(jsonString);
    } catch (error) {
      this.logger.error('Error encrypting object', error.stack);
      throw new Error('Failed to encrypt object');
    }
  }

  /**
   * Decrypts a JSON object
   * @param encryptedText - Encrypted string
   * @returns Decrypted object
   */
  decryptObject<T>(encryptedText: string): T | null {
    if (!encryptedText) {
      return null;
    }

    try {
      const decrypted = this.decrypt(encryptedText);
      return JSON.parse(decrypted) as T;
    } catch (error) {
      this.logger.error('Error decrypting object', error.stack);
      throw new Error('Failed to decrypt object');
    }
  }

  /**
   * Hashes a string using SHA-256 (one-way hash, cannot be decrypted)
   * Useful for comparing sensitive data without storing the original
   * @param text - Text to hash
   * @returns SHA-256 hash in hex format
   */
  hash(text: string): string {
    if (!text) {
      return text;
    }

    return crypto.createHash('sha256').update(text).digest('hex');
  }

  /**
   * Compares a plain text with a hash
   * @param text - Plain text
   * @param hash - Hash to compare with
   * @returns True if they match
   */
  compareHash(text: string, hash: string): boolean {
    if (!text || !hash) {
      return false;
    }

    const textHash = this.hash(text);
    return textHash === hash;
  }

  /**
   * Generates a cryptographically secure random token
   * @param length - Length of the token in bytes (default: 32)
   * @returns Random token in hex format
   */
  generateToken(length = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }
}
