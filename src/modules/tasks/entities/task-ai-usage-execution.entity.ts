import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Task } from './task.entity';

export enum TaskAiUsageStatus {
  RECORDED = 'recorded',
  NOT_REGISTERED = 'not_registered',
  PARTIAL = 'partial',
  NOT_APPLICABLE = 'not_applicable',
}

@Entity('task_ai_usage_executions')
@Index(['taskId', 'createdAt'])
@Index(['taskId', 'executionId'], {
  unique: true,
  where: '"executionId" IS NOT NULL',
})
export class TaskAiUsageExecution {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  taskId: string;

  @ManyToOne(() => Task, (task) => task.aiUsageExecutions, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'taskId' })
  task: Task;

  @Column({ type: 'varchar', length: 100, nullable: true })
  provider: string | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  model: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  source: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  executionId: string | null;

  @Column({ type: 'bigint', nullable: true })
  inputTokens: string | null;

  @Column({ type: 'bigint', nullable: true })
  outputTokens: string | null;

  @Column({ type: 'bigint', nullable: true })
  totalTokens: string | null;

  @Column({
    type: 'enum',
    enum: TaskAiUsageStatus,
    enumName: 'task_ai_usage_status_enum',
  })
  status: TaskAiUsageStatus;

  @Column({ type: 'varchar', length: 100, nullable: true })
  reasonCode: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  reason: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  constructor(partial: Partial<TaskAiUsageExecution>) {
    Object.assign(this, partial);
  }
}
