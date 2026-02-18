import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  BeforeInsert,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { generateSystemCode } from '../../../common/utils/system-code-generator.util';

/**
 * Feature Flag — Permite habilitar/deshabilitar funcionalidades
 * de forma granular por roles, tiendas o dependencias.
 */
@Entity('feature_flags')
@Index(['key'], { unique: true })
@Index(['isEnabled'])
export class FeatureFlag {
  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'ID único del feature flag',
  })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({
    example: 'FLG-260207-A3K9',
    description: 'Código único legible del sistema',
  })
  @Column({ type: 'varchar', length: 20, unique: true, nullable: true })
  systemCode: string;

  @BeforeInsert()
  generateSystemCode() {
    if (!this.systemCode) {
      this.systemCode = generateSystemCode('FeatureFlag');
    }
  }

  @ApiProperty({
    example: 'michambita.content_generation',
    description: 'Clave única del feature flag (formato: módulo.funcionalidad)',
  })
  @Column({ type: 'varchar', length: 100 })
  key: string;

  @ApiProperty({
    example: 'Multi-vendedor',
    description: 'Nombre legible del feature flag',
  })
  @Column({ type: 'varchar', length: 255 })
  name: string;

  @ApiProperty({
    example: 'Habilita el soporte para múltiples vendedores en la plataforma',
    description: 'Descripción detallada del feature flag',
    required: false,
  })
  @Column({ type: 'text', nullable: true })
  description: string | null;

  @ApiProperty({
    example: false,
    description: 'Indica si el feature flag está habilitado globalmente',
  })
  @Column({ type: 'boolean', default: false })
  isEnabled: boolean;

  @ApiProperty({
    example: ['admin', 'client'],
    description:
      'Roles para los cuales el feature flag está habilitado (si está vacío, aplica a todos)',
    required: false,
  })
  @Column({ type: 'simple-array', nullable: true })
  enabledForRoles: string[] | null;

  @ApiProperty({
    example: ['550e8400-e29b-41d4-a716-446655440000'],
    description:
      'IDs de tiendas para las cuales el feature flag está habilitado',
    required: false,
  })
  @Column({ type: 'simple-array', nullable: true })
  enabledForStores: string[] | null;

  @ApiProperty({
    example: { maxProducts: 100, trialDays: 30 },
    description: 'Configuración adicional en formato JSON',
    required: false,
  })
  @Column({ type: 'jsonb', nullable: true })
  config: Record<string, any> | null;

  @ApiProperty({
    example: 'michambita.daily_ideas',
    description:
      'Clave de otro feature flag del cual depende (debe estar habilitado para que este funcione)',
    required: false,
  })
  @Column({ type: 'varchar', length: 100, nullable: true })
  dependsOn: string | null;

  // ============================================
  // TIMESTAMPS
  // ============================================

  @ApiProperty({
    example: '2026-02-07T10:00:00.000Z',
    description: 'Fecha de creación',
  })
  @CreateDateColumn()
  createdAt: Date;

  @ApiProperty({
    example: '2026-02-07T10:00:00.000Z',
    description: 'Fecha de última actualización',
  })
  @UpdateDateColumn()
  updatedAt: Date;

  // ============================================
  // CONSTRUCTOR
  // ============================================

  constructor(partial: Partial<FeatureFlag>) {
    Object.assign(this, partial);
  }
}
