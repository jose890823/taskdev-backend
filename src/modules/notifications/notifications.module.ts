import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { ConfigModule, ConfigService } from '@nestjs/config';

// Entities
import { Notification, NotificationPreference } from './entities';
import { User } from '../auth/entities/user.entity';

// Services
import { NotificationsService, NotificationEventsService } from './services';

// Processors
import { NotificationProcessor } from './processors/notification.processor';

// Controllers
import {
  NotificationsController,
  NotificationsAdminController,
} from './controllers';

// Auth Module (para guards)
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Notification, NotificationPreference, User]),
    BullModule.registerQueueAsync({
      name: 'notifications',
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
            delay: 1000,
          },
          removeOnComplete: 100,
          removeOnFail: 50,
        },
      }),
    }),
    forwardRef(() => AuthModule),
  ],
  controllers: [NotificationsController, NotificationsAdminController],
  providers: [
    NotificationsService,
    NotificationEventsService,
    NotificationProcessor,
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
