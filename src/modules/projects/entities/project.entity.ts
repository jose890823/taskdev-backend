import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  Index,
  BeforeInsert,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { generateSystemCode } from '../../../common/utils/system-code-generator.util';

@Entity('projects')
@Index(['slug'])
@Index(['ownerId'])
@Index(['organizationId'])
@Index(['parentId'])
export class Project {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 20, unique: true, nullable: true })
  systemCode: string;

  @BeforeInsert()
  generateSystemCode() {
    if (!this.systemCode) {
      this.systemCode = generateSystemCode('Project');
    }
  }

  @ApiProperty({ example: 'Mi Proyecto', description: 'Nombre del proyecto' })
  @Column({ type: 'varchar', length: 255 })
  name: string;

  @ApiProperty({ example: 'mi-proyecto' })
  @Column({ type: 'varchar', length: 255 })
  slug: string;

  @ApiProperty({ example: 'Descripcion del proyecto', required: false })
  @Column({ type: 'text', nullable: true })
  description: string | null;

  @ApiProperty({ example: '#3b82f6', required: false })
  @Column({ type: 'varchar', length: 7, default: '#3b82f6' })
  color: string;

  @Column({ type: 'uuid' })
  ownerId: string;

  @ApiProperty({
    description: 'ID de la organizacion (null = proyecto personal)',
    required: false,
  })
  @Column({ type: 'uuid', nullable: true })
  organizationId: string | null;

  @ApiProperty({
    description: 'ID del proyecto padre (null = proyecto raiz)',
    required: false,
  })
  @Column({ type: 'uuid', nullable: true })
  parentId: string | null;

  @ManyToOne(() => Project, (p) => p.children, {
    onDelete: 'SET NULL',
    nullable: true,
  })
  @JoinColumn({ name: 'parentId' })
  parent: Project | null;

  @OneToMany(() => Project, (p) => p.parent)
  children: Project[];

  @ApiProperty({ example: true })
  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date | null;

  constructor(partial: Partial<Project>) {
    Object.assign(this, partial);
  }
}
