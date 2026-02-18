import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere } from 'typeorm';
import { User, UserRole } from '../../auth/entities/user.entity';
import { UpdateProfileDto } from '../dto/update-profile.dto';
import { UpdateUserAdminDto } from '../dto/update-user-admin.dto';
import { SendPhoneOtpDto, VerifyPhoneDto } from '../dto/verify-phone.dto';
import { UserFilterDto } from '../dto/user-filter.dto';
import { SmsService } from './sms.service';
import { EncryptionService } from '../../../shared/encryption.service';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';

/**
 * Users Service
 * Handles user profile management, verification, and administration
 */
@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);
  private readonly OTP_EXPIRATION_MINUTES = 10;
  private readonly OTP_MAX_ATTEMPTS = 3;

  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private smsService: SmsService,
    private encryptionService: EncryptionService,
  ) {}

  // ============================================
  // USER PROFILE MANAGEMENT
  // ============================================

  /**
   * Get user profile by ID
   */
  async findById(userId: string): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  /**
   * Update user profile
   */
  async updateProfile(
    userId: string,
    updateDto: UpdateProfileDto,
  ): Promise<User> {
    const user = await this.findById(userId);

    // Update basic fields
    if (updateDto.firstName) user.firstName = updateDto.firstName;
    if (updateDto.lastName) user.lastName = updateDto.lastName;
    if (updateDto.address) user.address = updateDto.address;
    if (updateDto.city) user.city = updateDto.city;
    if (updateDto.state) user.state = updateDto.state;
    if (updateDto.zipCode) user.zipCode = updateDto.zipCode;
    if (updateDto.country) user.country = updateDto.country;
    if (updateDto.dateOfBirth)
      user.dateOfBirth = new Date(updateDto.dateOfBirth);

    // Encrypt identification number if provided
    if (updateDto.identificationNumber) {
      user.identificationNumber = this.encryptionService.encrypt(
        updateDto.identificationNumber,
      );
    }

    // If phone changed, mark as unverified
    if (updateDto.phone && updateDto.phone !== user.phone) {
      user.phone = updateDto.phone;
      user.phoneVerified = false;
      this.logger.log(`Phone changed for user ${userId}, marked as unverified`);
    }

    const updated = await this.userRepository.save(user);
    this.logger.log(`✅ Profile updated for user ${userId}`);

    return updated;
  }

  /**
   * Update profile photo
   */
  async updateProfilePhoto(userId: string, photoUrl: string): Promise<User> {
    const user = await this.findById(userId);
    user.profilePhoto = photoUrl;

    const updated = await this.userRepository.save(user);
    this.logger.log(`📸 Profile photo updated for user ${userId}`);

    return updated;
  }

  /**
   * Delete profile photo
   */
  async deleteProfilePhoto(userId: string): Promise<User> {
    const user = await this.findById(userId);
    user.profilePhoto = null;

    const updated = await this.userRepository.save(user);
    this.logger.log(`🗑️  Profile photo deleted for user ${userId}`);

    return updated;
  }

  // ============================================
  // PHONE VERIFICATION
  // ============================================

  /**
   * Send phone verification OTP
   */
  async sendPhoneOtp(userId: string, dto: SendPhoneOtpDto): Promise<void> {
    const user = await this.findById(userId);

    // Check if phone is already verified
    if (user.phoneVerified && user.phone === dto.phone) {
      throw new BadRequestException('Phone already verified');
    }

    // Generate OTP code
    const otpCode = this.generateOtpCode();
    const otpExpiresAt = new Date(
      Date.now() + this.OTP_EXPIRATION_MINUTES * 60 * 1000,
    );

    // Save OTP to user
    user.otpCode = otpCode;
    user.otpExpiresAt = otpExpiresAt;
    user.otpAttempts = 0;

    // Update phone if different
    if (user.phone !== dto.phone) {
      user.phone = dto.phone;
      user.phoneVerified = false;
    }

    await this.userRepository.save(user);

    // Log OTP in development for testing when SMS doesn't work
    if (process.env.NODE_ENV === 'development') {
      this.logger.log(`🔐 [DEV] OTP Code for ${dto.phone}: ${otpCode}`);
    }

    // Send OTP via SMS
    await this.smsService.sendPhoneVerificationOtp(dto.phone, otpCode);

    this.logger.log(`📱 OTP sent to ${dto.phone} for user ${userId}`);
  }

  /**
   * Verify phone with OTP
   */
  async verifyPhone(userId: string, dto: VerifyPhoneDto): Promise<User> {
    const user = await this.findById(userId);

    // Check if already verified
    if (user.phoneVerified) {
      throw new BadRequestException('Phone already verified');
    }

    // Check if OTP exists
    if (!user.otpCode || !user.otpExpiresAt) {
      throw new BadRequestException('No OTP found. Please request a new one');
    }

    // Check if OTP expired
    if (user.isOtpExpired()) {
      throw new BadRequestException('OTP expired. Please request a new one');
    }

    // Check max attempts
    if (user.hasReachedMaxOtpAttempts(this.OTP_MAX_ATTEMPTS)) {
      throw new BadRequestException(
        'Maximum OTP attempts reached. Please request a new one',
      );
    }

    // Verify OTP
    if (user.otpCode !== dto.otpCode) {
      user.otpAttempts += 1;
      await this.userRepository.save(user);

      throw new BadRequestException(
        `Invalid OTP. ${this.OTP_MAX_ATTEMPTS - user.otpAttempts} attempts remaining`,
      );
    }

    // Mark phone as verified
    user.phoneVerified = true;
    user.otpCode = null;
    user.otpExpiresAt = null;
    user.otpAttempts = 0;

    const updated = await this.userRepository.save(user);

    this.logger.log(`✅ Phone verified for user ${userId}`);

    return updated;
  }

  // ============================================
  // ADMIN OPERATIONS
  // ============================================

  /**
   * Find all users with filters (admin)
   */
  async findAll(filter: UserFilterDto): Promise<{
    data: User[];
    pagination: { total: number; page: number; limit: number; totalPages: number };
  }> {
    const queryBuilder = this.userRepository.createQueryBuilder('user');

    // Search filter
    if (filter.search) {
      queryBuilder.andWhere(
        '(user.firstName ILIKE :search OR user.lastName ILIKE :search OR user.email ILIKE :search)',
        { search: `%${filter.search}%` },
      );
    }

    // Filter by business
    if (filter.businessId) {
      queryBuilder.andWhere('user.businessId = :businessId', {
        businessId: filter.businessId,
      });
    }

    // Filter by role (busca usuarios que tengan este rol en su array de roles)
    if (filter.role) {
      queryBuilder.andWhere('user.roles LIKE :role', {
        role: `%${filter.role}%`,
      });
    }
    if (filter.isActive !== undefined) {
      queryBuilder.andWhere('user.isActive = :isActive', {
        isActive: filter.isActive,
      });
    }
    if (filter.emailVerified !== undefined) {
      queryBuilder.andWhere('user.emailVerified = :emailVerified', {
        emailVerified: filter.emailVerified,
      });
    }
    if (filter.phoneVerified !== undefined) {
      queryBuilder.andWhere('user.phoneVerified = :phoneVerified', {
        phoneVerified: filter.phoneVerified,
      });
    }

    // Sorting
    queryBuilder.orderBy(
      `user.${filter.sortBy || 'createdAt'}`,
      filter.sortOrder || 'DESC',
    );

    // Pagination
    const page = filter.page || 1;
    const limit = filter.limit || 20;
    queryBuilder.skip((page - 1) * limit).take(limit);

    const [data, total] = await queryBuilder.getManyAndCount();

    return {
      data,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  /**
   * Update user roles (admin)
   * @param userId - User ID
   * @param roles - Array of roles to assign
   */
  async updateRoles(userId: string, roles: UserRole[]): Promise<User> {
    const user = await this.findById(userId);

    // Prevent removing super_admin from the last super admin
    if (
      user.hasRole(UserRole.SUPER_ADMIN) &&
      !roles.includes(UserRole.SUPER_ADMIN)
    ) {
      const superAdminCount = await this.countUsersWithRole(
        UserRole.SUPER_ADMIN,
      );

      if (superAdminCount <= 1) {
        throw new BadRequestException(
          'Cannot remove super_admin role from the last super admin',
        );
      }
    }

    user.roles = roles;
    const updated = await this.userRepository.save(user);

    this.logger.log(
      `👤 Roles updated to [${roles.join(', ')}] for user ${userId}`,
    );

    return updated;
  }

  /**
   * Update user role (admin) - DEPRECATED, use updateRoles instead
   * Mantenido para compatibilidad con código existente
   * @deprecated Use updateRoles instead
   */
  async updateRole(userId: string, role: UserRole): Promise<User> {
    return this.updateRoles(userId, [role]);
  }

  /**
   * Add a role to user
   */
  async addRole(userId: string, role: UserRole): Promise<User> {
    const user = await this.findById(userId);

    if (!user.roles.includes(role)) {
      user.roles = [...user.roles, role];
      await this.userRepository.save(user);
      this.logger.log(`👤 Role ${role} added to user ${userId}`);
    }

    return user;
  }

  /**
   * Remove a role from user
   */
  async removeRole(userId: string, role: UserRole): Promise<User> {
    const user = await this.findById(userId);

    // Prevent removing super_admin from the last super admin
    if (role === UserRole.SUPER_ADMIN && user.hasRole(UserRole.SUPER_ADMIN)) {
      const superAdminCount = await this.countUsersWithRole(
        UserRole.SUPER_ADMIN,
      );

      if (superAdminCount <= 1) {
        throw new BadRequestException(
          'Cannot remove super_admin role from the last super admin',
        );
      }
    }

    // Ensure user has at least one role
    if (user.roles.length <= 1) {
      throw new BadRequestException('User must have at least one role');
    }

    user.roles = user.roles.filter((r) => r !== role);
    await this.userRepository.save(user);
    this.logger.log(`👤 Role ${role} removed from user ${userId}`);

    return user;
  }

  /**
   * Count users with a specific role
   */
  private async countUsersWithRole(role: UserRole): Promise<number> {
    return this.userRepository
      .createQueryBuilder('user')
      .where('user.roles LIKE :role', { role: `%${role}%` })
      .getCount();
  }

  /**
   * Activate/deactivate user (admin)
   */
  async toggleActive(userId: string, isActive: boolean): Promise<User> {
    const user = await this.findById(userId);

    // Prevent deactivating super admins
    if (user.hasRole(UserRole.SUPER_ADMIN) && !isActive) {
      throw new BadRequestException('Cannot deactivate super admin');
    }

    user.isActive = isActive;
    const updated = await this.userRepository.save(user);

    this.logger.log(
      `${isActive ? '✅' : '❌'} User ${userId} ${isActive ? 'activated' : 'deactivated'}`,
    );

    return updated;
  }

  /**
   * Delete user (admin - soft delete)
   */
  async deleteUser(userId: string): Promise<void> {
    const user = await this.findById(userId);

    // Prevent deleting system users (created by seeder)
    if (user.isSystemUser) {
      throw new BadRequestException(
        'Cannot delete system user. This user can only be deleted directly in the database.',
      );
    }

    // Prevent deleting super admins
    if (user.hasRole(UserRole.SUPER_ADMIN)) {
      throw new BadRequestException('Cannot delete super admin');
    }

    await this.userRepository.softRemove(user);

    this.logger.log(`🗑️  User ${userId} soft deleted`);
  }

  /**
   * Update user by admin (any field)
   */
  async updateUserAdmin(
    userId: string,
    updateDto: UpdateUserAdminDto,
    currentUser: User,
  ): Promise<User> {
    const user = await this.findById(userId);

    // Only super admins can change verification status (only if actually changing the value)
    const isChangingEmailVerification =
      updateDto.emailVerified !== undefined &&
      updateDto.emailVerified !== user.emailVerified;
    const isChangingPhoneVerification =
      updateDto.phoneVerified !== undefined &&
      updateDto.phoneVerified !== user.phoneVerified;

    if (
      (isChangingEmailVerification || isChangingPhoneVerification) &&
      !currentUser.hasRole(UserRole.SUPER_ADMIN)
    ) {
      throw new ForbiddenException(
        'Only super admins can change email or phone verification status',
      );
    }

    // Check email uniqueness if changing email
    if (updateDto.email && updateDto.email !== user.email) {
      const existingUser = await this.userRepository.findOne({
        where: { email: updateDto.email },
      });

      if (existingUser) {
        throw new ConflictException('Email already in use');
      }

      user.email = updateDto.email;
      // Only auto-unverify if emailVerified wasn't explicitly provided
      if (updateDto.emailVerified === undefined) {
        user.emailVerified = false;
      }
    }

    // Update basic fields
    if (updateDto.firstName !== undefined) user.firstName = updateDto.firstName;
    if (updateDto.lastName !== undefined) user.lastName = updateDto.lastName;

    // Update phone
    if (updateDto.phone && updateDto.phone !== user.phone) {
      user.phone = updateDto.phone;
      // Only auto-unverify if phoneVerified wasn't explicitly provided
      if (updateDto.phoneVerified === undefined) {
        user.phoneVerified = false;
      }
    }

    // Update verification status (admin can always change these)
    if (updateDto.emailVerified !== undefined) {
      user.emailVerified = updateDto.emailVerified;
    }
    if (updateDto.phoneVerified !== undefined) {
      user.phoneVerified = updateDto.phoneVerified;
    }

    // Update roles (with validation)
    if (updateDto.roles !== undefined && updateDto.roles.length > 0) {
      // Prevent removing super_admin from the last super admin
      if (
        user.hasRole(UserRole.SUPER_ADMIN) &&
        !updateDto.roles.includes(UserRole.SUPER_ADMIN)
      ) {
        const superAdminCount = await this.countUsersWithRole(
          UserRole.SUPER_ADMIN,
        );

        if (superAdminCount <= 1) {
          throw new BadRequestException(
            'Cannot remove super_admin role from the last super admin',
          );
        }
      }
      user.roles = updateDto.roles;
    }
    // Soporte para el campo legacy 'role' (convierte a array)
    else if (updateDto.role !== undefined) {
      // Prevent demoting the last super admin
      if (
        user.hasRole(UserRole.SUPER_ADMIN) &&
        updateDto.role !== UserRole.SUPER_ADMIN
      ) {
        const superAdminCount = await this.countUsersWithRole(
          UserRole.SUPER_ADMIN,
        );

        if (superAdminCount <= 1) {
          throw new BadRequestException(
            'Cannot remove super_admin role from the last super admin',
          );
        }
      }
      user.roles = [updateDto.role];
    }

    // Update active status (with validation)
    if (updateDto.isActive !== undefined) {
      // Prevent deactivating super admins
      if (user.hasRole(UserRole.SUPER_ADMIN) && !updateDto.isActive) {
        throw new BadRequestException('Cannot deactivate super admin');
      }
      user.isActive = updateDto.isActive;
    }

    // Update profile fields
    if (updateDto.address !== undefined) user.address = updateDto.address;
    if (updateDto.city !== undefined) user.city = updateDto.city;
    if (updateDto.state !== undefined) user.state = updateDto.state;
    if (updateDto.zipCode !== undefined) user.zipCode = updateDto.zipCode;
    if (updateDto.country !== undefined) user.country = updateDto.country;
    if (updateDto.dateOfBirth !== undefined) {
      user.dateOfBirth = new Date(updateDto.dateOfBirth);
    }

    // Encrypt identification number if provided
    if (updateDto.identificationNumber !== undefined) {
      user.identificationNumber = updateDto.identificationNumber
        ? this.encryptionService.encrypt(updateDto.identificationNumber)
        : null;
    }

    // Hash and update password if provided
    if (updateDto.password) {
      user.password = await bcrypt.hash(updateDto.password, 10);
      this.logger.log(`🔐 Password updated for user ${userId} by admin`);
    }

    const updated = await this.userRepository.save(user);
    this.logger.log(`✏️  User ${userId} updated by admin`);

    return updated;
  }

  /**
   * Get user statistics (admin)
   */
  async getStats(): Promise<{
    total: number;
    active: number;
    inactive: number;
    byRole: Record<UserRole, number>;
    emailVerified: number;
    phoneVerified: number;
  }> {
    const all = await this.userRepository.find();

    const stats = {
      total: all.length,
      active: all.filter((u) => u.isActive).length,
      inactive: all.filter((u) => !u.isActive).length,
      byRole: {} as Record<UserRole, number>,
      emailVerified: all.filter((u) => u.emailVerified).length,
      phoneVerified: all.filter((u) => u.phoneVerified).length,
    };

    // Count by role (usuarios que tienen este rol en su array)
    Object.values(UserRole).forEach((role) => {
      stats.byRole[role] = all.filter((u) => u.hasRole(role)).length;
    });

    return stats;
  }


  // ============================================
  // HELPER METHODS
  // ============================================

  /**
   * Generate 6-digit OTP code
   */
  private generateOtpCode(): string {
    return crypto.randomInt(100000, 999999).toString();
  }

  /**
   * Search users by email or name (admin)
   */
  async searchUsers(query: string, limit: number = 10): Promise<User[]> {
    return this.userRepository
      .createQueryBuilder('user')
      .where('user.email ILIKE :query', { query: `%${query}%` })
      .orWhere('user.firstName ILIKE :query', { query: `%${query}%` })
      .orWhere('user.lastName ILIKE :query', { query: `%${query}%` })
      .take(limit)
      .getMany();
  }

  // ============================================
  // SLUG AND FULL NAME SEARCH
  // ============================================

  /**
   * Find user by slug
   * @param slug - URL-friendly identifier (e.g., "juan-perez")
   */
  async findBySlug(slug: string): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { slug },
    });

    if (!user) {
      throw new NotFoundException(`User with slug "${slug}" not found`);
    }

    return user;
  }

  /**
   * Search users by full name (combines firstName and lastName)
   * Searches in both firstName, lastName, and the concatenation of both
   * @param fullName - Full name to search (e.g., "Juan Pérez" or "laura ubeda")
   * @param limit - Maximum number of results
   */
  async searchByFullName(
    fullName: string,
    limit: number = 10,
  ): Promise<User[]> {
    // Normalizar búsqueda: quitar acentos y convertir a minúsculas para mejor matching
    const normalizedSearch = this.normalizeForSearch(fullName);

    return this.userRepository
      .createQueryBuilder('user')
      .where(
        // Búsqueda en nombre completo concatenado
        "LOWER(UNACCENT(CONCAT(user.firstName, ' ', user.lastName))) LIKE :search",
        { search: `%${normalizedSearch}%` },
      )
      .orWhere(
        // Búsqueda solo en firstName
        'LOWER(UNACCENT(user.firstName)) LIKE :search',
        { search: `%${normalizedSearch}%` },
      )
      .orWhere(
        // Búsqueda solo en lastName
        'LOWER(UNACCENT(user.lastName)) LIKE :search',
        { search: `%${normalizedSearch}%` },
      )
      .orWhere(
        // Búsqueda en slug (ya está normalizado)
        'user.slug LIKE :slugSearch',
        { slugSearch: `%${normalizedSearch.replace(/\s+/g, '-')}%` },
      )
      .take(limit)
      .getMany();
  }

  /**
   * Generate slug from full name
   * @param firstName
   * @param lastName
   * @returns URL-friendly slug
   */
  generateSlugFromName(firstName: string, lastName: string): string {
    return `${firstName} ${lastName}`
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remover acentos
      .replace(/[^a-z0-9\s-]/g, '') // Solo letras, números, espacios y guiones
      .trim()
      .replace(/\s+/g, '-') // Espacios a guiones
      .replace(/-+/g, '-'); // Múltiples guiones a uno solo
  }

  /**
   * Generate unique slug for a user
   * @param firstName
   * @param lastName
   * @param excludeUserId - Exclude this user ID when checking for uniqueness
   */
  async generateUniqueSlug(
    firstName: string,
    lastName: string,
    excludeUserId?: string,
  ): Promise<string> {
    const baseSlug = this.generateSlugFromName(firstName, lastName);
    let slug = baseSlug;
    let counter = 1;

    while (true) {
      const existing = await this.userRepository.findOne({ where: { slug } });
      if (!existing || existing.id === excludeUserId) {
        return slug;
      }
      slug = `${baseSlug}-${counter}`;
      counter++;
    }
  }

  /**
   * Update user slug (regenerate from name)
   * @param userId
   */
  async regenerateSlug(userId: string): Promise<User> {
    const user = await this.findById(userId);

    user.slug = await this.generateUniqueSlug(
      user.firstName,
      user.lastName,
      user.id,
    );

    const updated = await this.userRepository.save(user);
    this.logger.log(`🔗 Slug regenerated for user ${userId}: ${user.slug}`);

    return updated;
  }

  /**
   * Normalize text for search (remove accents, lowercase)
   */
  private normalizeForSearch(text: string): string {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remover acentos
      .trim();
  }
}
