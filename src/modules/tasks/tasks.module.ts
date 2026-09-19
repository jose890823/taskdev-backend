import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Task } from './entities/task.entity';
import { TaskAssignee } from './entities/task-assignee.entity';
import { TaskAiUsageExecution } from './entities/task-ai-usage-execution.entity';
import { TasksService } from './tasks.service';
import { TaskAiUsageService } from './task-ai-usage.service';
import { TasksController } from './tasks.controller';
import { TaskStatusesModule } from '../task-statuses/task-statuses.module';
import { ProjectsModule } from '../projects/projects.module';
import { OrganizationsModule } from '../organizations/organizations.module';
import { ApiKeysModule } from '../api-keys/api-keys.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Task, TaskAssignee, TaskAiUsageExecution]),
    TaskStatusesModule,
    ProjectsModule,
    OrganizationsModule,
    ApiKeysModule,
    AuthModule,
  ],
  controllers: [TasksController],
  providers: [TasksService, TaskAiUsageService],
  exports: [TasksService],
})
export class TasksModule {}
