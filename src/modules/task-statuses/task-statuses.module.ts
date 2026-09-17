import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TaskStatus } from './entities/task-status.entity';
import { TaskStatusesService } from './task-statuses.service';
import { TaskStatusesController } from './task-statuses.controller';
import { ProjectsModule } from '../projects/projects.module';
import { ApiKeysModule } from '../api-keys/api-keys.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([TaskStatus]),
    ProjectsModule,
    ApiKeysModule,
    AuthModule,
  ],
  controllers: [TaskStatusesController],
  providers: [TaskStatusesService],
  exports: [TaskStatusesService],
})
export class TaskStatusesModule {}
