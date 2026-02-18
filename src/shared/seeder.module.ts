import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { SeederService } from './seeder.service';
import { User } from '../modules/auth/entities/user.entity';
import { TaskStatusesModule } from '../modules/task-statuses/task-statuses.module';

@Module({
  imports: [TypeOrmModule.forFeature([User]), ConfigModule, TaskStatusesModule],
  providers: [SeederService],
  exports: [SeederService],
})
export class SeederModule {}
