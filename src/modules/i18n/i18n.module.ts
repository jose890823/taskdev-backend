import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { Translation } from './entities/translation.entity';
import { I18nService } from './i18n.service';
import { I18nController } from './i18n.controller';
import { I18nAdminController } from './i18n-admin.controller';
import { LocaleInterceptor } from './interceptors/locale.interceptor';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([Translation]), ConfigModule],
  controllers: [I18nAdminController, I18nController],
  providers: [I18nService, LocaleInterceptor],
  exports: [I18nService],
})
export class I18nModule {}
