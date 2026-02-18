import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { WebhookEvent } from './entities/webhook-event.entity';
import { WebhooksService } from './webhooks.service';
import { WebhooksAdminController } from './webhooks-admin.controller';

@Module({
  imports: [TypeOrmModule.forFeature([WebhookEvent]), ConfigModule],
  controllers: [WebhooksAdminController],
  providers: [WebhooksService],
  exports: [WebhooksService],
})
export class WebhooksModule {}
