import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Exclude } from 'class-transformer';
import { ApiKeyScope } from '../api-key.constants';

@Entity('mcp_api_keys')
@Index(['publicId'], { unique: true })
@Index(['ownerId', 'projectId'])
@Index(['projectId', 'revokedAt'])
export class McpApiKey {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  ownerId: string;

  @Column({ type: 'uuid' })
  projectId: string;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'varchar', length: 64 })
  publicId: string;

  @Column({ type: 'varchar', length: 20 })
  prefix: string;

  @Exclude()
  @Column({ type: 'varchar', length: 64 })
  verifier: string;

  @Column({ type: 'smallint', default: 1 })
  hashVersion: number;

  @Column({ type: 'text', array: true })
  scopes: ApiKeyScope[];

  @Column({ type: 'timestamp with time zone' })
  expiresAt: Date;

  @Column({ type: 'timestamp with time zone', nullable: true })
  revokedAt: Date | null;

  @Column({ type: 'uuid', nullable: true })
  revokedById: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  revokeReason: string | null;

  @Column({ type: 'uuid', nullable: true })
  replacedById: string | null;

  @Column({ type: 'timestamp with time zone', nullable: true })
  lastUsedAt: Date | null;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updatedAt: Date;

  constructor(partial: Partial<McpApiKey>) {
    Object.assign(this, partial);
  }
}
