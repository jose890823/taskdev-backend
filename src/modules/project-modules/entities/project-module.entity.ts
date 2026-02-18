import {
  Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn,
  DeleteDateColumn, Index, BeforeInsert,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { generateSystemCode } from '../../../common/utils/system-code-generator.util';

@Entity('project_modules')
@Index(['projectId'])
export class ProjectModule {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 20, unique: true, nullable: true })
  systemCode: string;

  @BeforeInsert()
  generateSystemCode() {
    if (!this.systemCode) {
      this.systemCode = generateSystemCode('ProjectModule');
    }
  }

  @Column({ type: 'uuid' })
  projectId: string;

  @ApiProperty({ example: 'Frontend' })
  @Column({ type: 'varchar', length: 255 })
  name: string;

  @ApiProperty({ example: 'Modulo de interfaz de usuario', required: false })
  @Column({ type: 'text', nullable: true })
  description: string | null;

  @ApiProperty({ example: '#8b5cf6', required: false })
  @Column({ type: 'varchar', length: 7, default: '#8b5cf6' })
  color: string;

  @ApiProperty({ example: 0 })
  @Column({ type: 'int', default: 0 })
  position: number;

  @ApiProperty({ example: true })
  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date | null;

  constructor(partial: Partial<ProjectModule>) {
    Object.assign(this, partial);
  }
}
