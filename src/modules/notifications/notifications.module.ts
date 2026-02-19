import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { ConfigModule, ConfigService } from '@nestjs/config';

// Entities
import { Notification, NotificationPreference, NotificationEventConfig } from './entities';
import { User } from '../auth/entities/user.entity';

// Services
import {
  NotificationsService,
  NotificationEventsService,
  NotificationConfigService,
  NotificationCleanupService,
} from './services';

// Gateway
import { NotificationsGateway } from './gateways/notifications.gateway';

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
    TypeOrmModule.forFeature([Notification, NotificationPreference, NotificationEventConfig, User]),
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
    NotificationConfigService,
    NotificationCleanupService,
    NotificationsGateway,
    NotificationProcessor,
  ],
  exports: [NotificationsService, NotificationsGateway],
})
export class NotificationsModule {}
