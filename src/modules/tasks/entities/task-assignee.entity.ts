import {
  Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, Index,
  ManyToOne, JoinColumn,
} from 'typeorm';
import { User } from '../../auth/entities/user.entity';

@Entity('task_assignees')
@Index(['taskId', 'userId'], { unique: true })
@Index(['userId'])
export class TaskAssignee {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  taskId: string;

  @Column({ type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { eager: false })
  @JoinColumn({ name: 'userId' })
  user?: User;

  @CreateDateColumn()
  createdAt: Date;

  constructor(partial: Partial<TaskAssignee>) {
    Object.assign(this, partial);
  }
}
