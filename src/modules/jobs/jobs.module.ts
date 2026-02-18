import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { JobExecution } from './entities/job-execution.entity';
import { JobsService } from './jobs.service';
import { JobsAdminController } from './jobs-admin.controller';
import { MichambitaJobsProcessor } from './processors/michambita-jobs.processor';

/**
 * Modulo de jobs en background de MiChambita
 *
 * Gestiona tareas programadas y manuales usando Bull + Redis:
 * - cart-cleanup: Limpieza de carritos expirados (cada hora)
 * - payout-processing: Procesamiento de pagos a vendedores (diario 2 AM)
 * - stock-alert: Alertas de stock bajo (cada 6 horas)
 * - wishlist-price-check: Verificacion de precios en wishlists (cada 12 horas)
 * - order-auto-complete: Auto-completar ordenes entregadas (diario 3 AM)
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([JobExecution]),
    BullModule.registerQueueAsync({
      name: 'michambita-jobs',
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
  providers: [JobsService, MichambitaJobsProcessor],
  exports: [JobsService],
})
export class JobsModule {}
