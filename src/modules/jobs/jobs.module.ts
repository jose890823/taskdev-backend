import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { JobExecution } from './entities/job-execution.entity';
import { JobsService } from './jobs.service';
import { JobsAdminController } from './jobs-admin.controller';
import { TaskhubJobsProcessor } from './processors/taskhub-jobs.processor';

/**
 * Modulo de jobs en background de TaskHub
 *
 * Scaffolding para tareas programadas y manuales usando Bull + Redis.
 * Actualmente sin jobs activos — se agregaran segun necesidades del proyecto.
 * NOTA: Este modulo no esta importado en AppModule hasta que haya jobs definidos.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([JobExecution]),
    BullModule.registerQueueAsync({
      name: 'taskhub-jobs',
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        redis: {
          host: configService.get('REDIS_HOST', 'localhost'),
          port: configService.get('REDIS_PORT', 6379),
          password: configService.get('REDIS_PASSWORD', ''),
        },
        defaultJobOptions: {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
          removeOnComplete: 200,
          removeOnFail: 100,
        },
      }),
    }),
    ConfigModule,
  ],
  controllers: [JobsAdminController],
  providers: [JobsService, TaskhubJobsProcessor],
  exports: [JobsService],
})
export class JobsModule {}
