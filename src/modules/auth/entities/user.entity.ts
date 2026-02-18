import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  Index,
  BeforeInsert,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { Exclude } from 'class-transformer';
import { generateSystemCode } from '../../../common/utils/system-code-generator.util';

export enum UserRole {
  SUPER_ADMIN = 'super_admin',
  USER = 'user',
}

@Entity('users')
@Index(['email'], { unique: true })
@Index(['isActive'])
export class User {
  @ApiProperty({
    example: '123e4567-e89b-12d3-a456-426614174000',
    description: 'ID unico del usuario',
  })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({
    example: 'USR-260206-A3K7',
    description: 'Codigo unico legible del sistema',
  })
  @Column({ type: 'varchar', length: 20, unique: true, nullable: true })
  systemCode: string;

  @BeforeInsert()
  generateSystemCode() {
    if (!this.systemCode) {
      this.systemCode = generateSystemCode('User');
    }
  }

  @ApiProperty({
    example: 'juan.perez@example.com',
    description: 'Email del usuario (unico)',
  })
  @Column({ type: 'varchar', length: 255, unique: true })
  email: string;

  @Exclude()
  @Column({ type: 'varchar', length: 255 })
  password: string;

  @ApiProperty({
    example: 'Juan',
    description: 'Nombre del usuario',
  })
  @Column({ type: 'varchar', length: 255 })
  firstName: string;

  @ApiProperty({
    example: 'Perez',
    description: 'Apellido del usuario',
  })
  @Column({ type: 'varchar', length: 255 })
  lastName: string;

  @ApiProperty({
    example: 'juan-perez',
    description: 'Slug unico para URLs amigables (generado automaticamente)',
  })
  @Column({ type: 'varchar', length: 255, unique: true, nullable: true })
  slug: string | null;

  @ApiProperty({
    example: '+1234567890',
    description: 'Telefono del usuario (formato internacional)',
  })
  @Column({ type: 'varchar', length: 20 })
  phone: string;

  @ApiProperty({
    example: ['user'],
    description: 'Roles del usuario',
    enum: UserRole,
    isArray: true,
  })
  @Column({
    type: 'simple-array',
    default: UserRole.USER,
  })
  roles: UserRole[];

  /**
   * Retorna el rol principal (el primero del array o el de mayor jerarquia)
   */
  get role(): UserRole {
    if (!this.roles || this.roles.length === 0) return UserRole.USER;
    const hierarchy = [
      UserRole.SUPER_ADMIN,
      UserRole.USER,
    ];
    for (const role of hierarchy) {
      if (this.roles.includes(role)) return role;
    }
    return this.roles[0];
  }

  @ApiProperty({
    example: false,
    description: 'Indica si el email ha sido verificado',
  })
  @Column({ type: 'boolean', default: false })
  emailVerified: boolean;

  @ApiProperty({
    example: false,
    description: 'Indica si el telefono ha sido verificado',
  })
  @Column({ type: 'boolean', default: false })
  phoneVerified: boolean;

  @ApiProperty({
    example: true,
    description: 'Indica si el usuario esta activo',
  })
  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @ApiProperty({
    example: false,
    description:
      'Indica si es un usuario del sistema (no se puede eliminar desde la UI)',
  })
  @Column({ type: 'boolean', default: false })
  isSystemUser: boolean;

  @ApiProperty({
    example: '2025-01-01T10:30:00.000Z',
    description: 'Fecha y hora del ultimo login',
    required: false,
  })
  @Column({ type: 'timestamp', nullable: true })
  lastLoginAt: Date | null;

  // ============================================
  // CAMPOS DE PERFIL EXTENDIDO
  // ============================================

  @ApiProperty({
    example: 'https://storage.example.com/profile-photos/user123.jpg',
    description: 'URL de la foto de perfil del usuario',
    required: false,
  })
  @Column({ type: 'text', nullable: true })
  profilePhoto: string | null;

  @ApiProperty({
    example: '123 Main Street, Apt 4B',
    description: 'Direccion completa del usuario',
    required: false,
  })
  @Column({ type: 'varchar', length: 500, nullable: true })
  address: string | null;

  @ApiProperty({
    example: 'Miami',
    description: 'Ciudad',
    required: false,
  })
  @Column({ type: 'varchar', length: 100, nullable: true })
  city: string | null;

  @ApiProperty({
    example: 'Florida',
    description: 'Estado/Provincia',
    required: false,
  })
  @Column({ type: 'varchar', length: 100, nullable: true })
  state: string | null;

  @ApiProperty({
    example: '33166',
    description: 'Codigo postal',
    required: false,
  })
  @Column({ type: 'varchar', length: 20, nullable: true })
  zipCode: string | null;

  @ApiProperty({
    example: 'United States',
    description: 'Pais',
    required: false,
  })
  @Column({ type: 'varchar', length: 100, nullable: true })
  country: string | null;

  @ApiProperty({
    example: '1990-05-15',
    description: 'Fecha de nacimiento',
    required: false,
  })
  @Column({ type: 'date', nullable: true })
  dateOfBirth: Date | null;

  @ApiProperty({
    example: 'V-12345678',
    description: 'Numero de identificacion (encriptado)',
    required: false,
  })
  @Column({ type: 'text', nullable: true })
  identificationNumber: string | null;

  // ============================================
  // PREFERENCIAS DEL USUARIO
  // ============================================

  @ApiProperty({
    example: 'es',
    description: 'Idioma preferido del usuario',
  })
  @Column({ type: 'varchar', length: 5, default: 'es' })
  preferredLanguage: string;

  @ApiProperty({
    example: 'USD',
    description: 'Moneda preferida del usuario',
  })
  @Column({ type: 'varchar', length: 3, default: 'USD' })
  preferredCurrency: string;

  @ApiProperty({
    example: 'America/New_York',
    description: 'Zona horaria preferida del usuario',
  })
  @Column({ type: 'varchar', length: 50, default: 'America/New_York' })
  preferredTimezone: string;

  @Exclude()
  @Column({ type: 'varchar', length: 500, nullable: true })
  refreshToken: string | null;

  @Exclude()
  @Column({ type: 'timestamp', nullable: true })
  refreshTokenExpiresAt: Date | null;

  @Exclude()
  @Column({ type: 'varchar', length: 6, nullable: true })
  otpCode: string | null;

  @Exclude()
  @Column({ type: 'timestamp', nullable: true })
  otpExpiresAt: Date | null;

  @Exclude()
  @Column({ type: 'int', default: 0 })
  otpAttempts: number;

  @Exclude()
  @Column({ type: 'varchar', length: 255, nullable: true })
  resetPasswordToken: string | null;

  @Exclude()
  @Column({ type: 'timestamp', nullable: true })
  resetPasswordExpiresAt: Date | null;

  @ApiProperty({
    example: '2025-01-01T00:00:00.000Z',
    description: 'Fecha de creacion del usuario',
  })
  @CreateDateColumn()
  createdAt: Date;

  @ApiProperty({
    example: '2025-01-01T00:00:00.000Z',
    description: 'Fecha de ultima actualizacion',
  })
  @UpdateDateColumn()
  updatedAt: Date;

  @ApiProperty({
    example: null,
    description: 'Fecha de eliminacion (soft delete)',
    required: false,
  })
  @DeleteDateColumn()
  deletedAt: Date | null;

  constructor(partial: Partial<User>) {
    Object.assign(this, partial);
  }

  get fullName(): string {
    return `${this.firstName} ${this.lastName}`;
  }

  isOtpExpired(): boolean {
    if (!this.otpExpiresAt) return true;
    return new Date() > this.otpExpiresAt;
  }

  isResetTokenExpired(): boolean {
    if (!this.resetPasswordExpiresAt) return true;
    return new Date() > this.resetPasswordExpiresAt;
  }

  hasReachedMaxOtpAttempts(maxAttempts: number): boolean {
    return this.otpAttempts >= maxAttempts;
  }

  hasRole(role: UserRole): boolean {
    return this.roles?.includes(role) ?? false;
  }

  hasAnyRole(roles: UserRole[]): boolean {
    return roles.some((role) => this.hasRole(role));
  }

  isAdmin(): boolean {
    return this.hasRole(UserRole.SUPER_ADMIN);
  }

  isSuperAdmin(): boolean {
    return this.hasRole(UserRole.SUPER_ADMIN);
  }

  isUser(): boolean {
    return this.hasRole(UserRole.USER);
  }
}
