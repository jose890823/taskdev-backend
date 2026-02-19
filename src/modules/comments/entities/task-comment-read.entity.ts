import {
  Entity, Column, PrimaryGeneratedColumn, UpdateDateColumn, Index,
} from 'typeorm';

@Entity('task_comment_reads')
@Index(['userId', 'taskId'], { unique: true })
export class TaskCommentRead {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'uuid' })
  taskId: string;

  @UpdateDateColumn()
  lastReadAt: Date;

  constructor(partial: Partial<TaskCommentRead>) {
    Object.assign(this, partial);
  }
}
