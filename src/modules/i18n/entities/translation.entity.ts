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
import {
  generateSystemCode,
  ENTITY_PREFIX_MAP,
} from '../../../common/utils/system-code-generator.util';

// Registrar prefijo para la entidad Translation
ENTITY_PREFIX_MAP['Translation'] = 'TRN';

export enum TranslationLocale {
  ES = 'es',
  EN = 'en',
}

export enum TranslationModule {
  AUTH = 'auth',
  USERS = 'users',
  PRODUCTS = 'products',
  ORDERS = 'orders',
  PAYMENTS = 'payments',
  NOTIFICATIONS = 'notifications',
  COMMON = 'common',
  ERRORS = 'errors',
  EMAILS = 'emails',
}

@Entity('translations')
@Index(['key', 'locale'], { unique: true })
@Index(['module', 'locale'])
export class Translation {
  @ApiProperty({
    example: '123e4567-e89b-12d3-a456-426614174000',
    description: 'ID unico de la traduccion',
  })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({
    example: 'TRN-260207-A3K7',
    description: 'Codigo unico legible del sistema',
  })
  @Column({ type: 'varchar', length: 50, unique: true })
  systemCode: string;

  @ApiProperty({
    example: 'errors.user_not_found',
    description: 'Clave unica de la traduccion (formato: modulo.clave)',
  })
  @Column({ type: 'varchar', length: 255 })
  key: string;

  @ApiProperty({
    example: 'es',
    description: 'Idioma de la traduccion',
    enum: TranslationLocale,
  })
  @Column({ type: 'enum', enum: TranslationLocale })
  locale: TranslationLocale;

  @ApiProperty({
    example: 'Usuario no encontrado',
    description: 'Texto traducido. Soporta placeholders con {{param}}',
  })
  @Column({ type: 'text' })
  value: string;

  @ApiProperty({
    example: 'errors',
    description: 'Modulo al que pertenece la traduccion',
    enum: TranslationModule,
  })
  @Column({
    type: 'enum',
    enum: TranslationModule,
    default: TranslationModule.COMMON,
  })
  module: TranslationModule;

  @ApiProperty({
    example: 'Mensaje cuando no se encuentra un usuario en la base de datos',
    description: 'Contexto o pista para traductores',
    required: false,
  })
  @Column({ type: 'varchar', length: 255, nullable: true })
  context: string | null;

  @ApiProperty({
    example: false,
    description:
      'Indica si es una traduccion del sistema (no se puede eliminar por admin)',
  })
  @Column({ type: 'boolean', default: false })
  isSystem: boolean;

  @ApiProperty({
    example: '2026-02-07T10:00:00.000Z',
    description: 'Fecha de creacion',
  })
  @CreateDateColumn()
  createdAt: Date;

  @ApiProperty({
    example: '2026-02-07T10:00:00.000Z',
    description: 'Fecha de ultima actualizacion',
  })
  @UpdateDateColumn()
  updatedAt: Date;

  @BeforeInsert()
  generateSystemCode() {
    if (!this.systemCode) {
      this.systemCode = generateSystemCode('Translation');
    }
  }

  constructor(partial: Partial<Translation>) {
    Object.assign(this, partial);
  }
}
