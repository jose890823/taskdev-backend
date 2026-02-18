import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { User } from '../../auth/entities/user.entity';

export enum DeviceType {
  DESKTOP = 'desktop',
  MOBILE = 'mobile',
  TABLET = 'tablet',
  UNKNOWN = 'unknown',
}

@Entity('active_sessions')
@Index(['userId'])
@Index(['refreshTokenHash'])
@Index(['isActive'])
@Index(['expiresAt'])
export class ActiveSession {
  @ApiProperty({ description: 'ID unico de la sesion' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ description: 'ID del usuario' })
  @Column({ type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @ApiProperty({ description: 'Hash del refresh token' })
  @Column({ type: 'varchar', length: 255 })
  refreshTokenHash: string;

  @ApiProperty({ description: 'Direccion IP' })
  @Column({ type: 'varchar', length: 45 })
  ipAddress: string;

  @ApiProperty({ description: 'User Agent del navegador' })
  @Column({ type: 'text', nullable: true })
  userAgent: string | null;

  @ApiProperty({ description: 'Tipo de dispositivo', enum: DeviceType })
  @Column({ type: 'varchar', length: 20 })
  deviceType: DeviceType;

  @ApiProperty({ description: 'Navegador' })
  @Column({ type: 'varchar', length: 100, nullable: true })
  browser: string | null;

  @ApiProperty({ description: 'Sistema operativo' })
  @Column({ type: 'varchar', length: 100, nullable: true })
  os: string | null;

  @ApiProperty({ description: 'Pais' })
  @Column({ type: 'varchar', length: 100, nullable: true })
  country: string | null;

  @ApiProperty({ description: 'Ciudad' })
  @Column({ type: 'varchar', length: 100, nullable: true })
  city: string | null;

  @ApiProperty({ description: 'Si la sesion esta activa' })
  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @ApiProperty({ description: 'Ultima actividad' })
  @Column({ type: 'timestamp' })
  lastActivityAt: Date;

  @ApiProperty({ description: 'Fecha de expiracion' })
  @Column({ type: 'timestamp' })
  expiresAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  constructor(partial: Partial<ActiveSession>) {
    Object.assign(this, partial);
  }

  /**
   * Verifica si la sesion ha expirado
   */
  isExpired(): boolean {
    return new Date() > this.expiresAt;
  }
}
