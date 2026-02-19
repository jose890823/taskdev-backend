import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Task } from './entities/task.entity';
import { TaskAssignee } from './entities/task-assignee.entity';
import { TasksService } from './tasks.service';
import { TasksController } from './tasks.controller';
import { TaskStatusesModule } from '../task-statuses/task-statuses.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Task, TaskAssignee]),
    TaskStatusesModule,
  ],
  controllers: [TasksController],
  providers: [TasksService],
  exports: [TasksService],
})
export class TasksModule {}
