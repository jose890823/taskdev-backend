import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Task } from './entities/task.entity';
import { TasksService } from './tasks.service';
import { TasksController } from './tasks.controller';
import { TaskStatusesModule } from '../task-statuses/task-statuses.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Task]),
    TaskStatusesModule,
  ],
  controllers: [TasksController],
  providers: [TasksService],
  exports: [TasksService],
})
export class TasksModule {}
