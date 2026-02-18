import {
  Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn,
  DeleteDateColumn, Index, BeforeInsert,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { generateSystemCode } from '../../../common/utils/system-code-generator.util';

@Entity('organizations')
@Index(['slug'], { unique: true })
@Index(['ownerId'])
export class Organization {
  @ApiProperty({ example: 'uuid', description: 'ID unico' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ example: 'ORG-260218-X1Y2', description: 'Codigo del sistema' })
  @Column({ type: 'varchar', length: 20, unique: true, nullable: true })
  systemCode: string;

  @BeforeInsert()
  generateSystemCode() {
    if (!this.systemCode) {
      this.systemCode = generateSystemCode('Organization');
    }
  }

  @ApiProperty({ example: 'Acme Corp', description: 'Nombre de la organizacion' })
  @Column({ type: 'varchar', length: 255 })
  name: string;

  @ApiProperty({ example: 'acme-corp', description: 'Slug unico' })
  @Column({ type: 'varchar', length: 255, unique: true })
  slug: string;

  @ApiProperty({ example: 'Empresa de tecnologia', description: 'Descripcion', required: false })
  @Column({ type: 'text', nullable: true })
  description: string | null;

  @ApiProperty({ example: 'https://example.com/logo.png', description: 'URL del logo', required: false })
  @Column({ type: 'text', nullable: true })
  logo: string | null;

  @Column({ type: 'uuid' })
  ownerId: string;

  @ApiProperty({ example: true, description: 'Si la organizacion esta activa' })
  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date | null;

  constructor(partial: Partial<Organization>) {
    Object.assign(this, partial);
  }
}
