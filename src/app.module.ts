import { Module, Logger, Global } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ModuleLoaderService } from './shared/module-loader.service';
import { ModuleManagerService } from './shared/module-manager.service';
import { DatabaseModule } from './shared/database.module';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { existsSync } from 'fs';
import { join } from 'path';

// Importar modulos de infraestructura
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { SeederModule } from './shared/seeder.module';
import { SecurityModule } from './modules/security/security.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { StorageModule } from './modules/storage/storage.module';
import { FeatureFlagsModule } from './modules/feature-flags/feature-flags.module';
import { WebhooksModule } from './modules/webhooks/webhooks.module';
import { CacheModule } from './modules/cache/cache.module';
import { JobsModule } from './modules/jobs/jobs.module';
import { I18nModule } from './modules/i18n/i18n.module';

// Importar modulos de dominio TaskHub
import { OrganizationsModule } from './modules/organizations/organizations.module';
import { InvitationsModule } from './modules/invitations/invitations.module';
import { ProjectsModule } from './modules/projects/projects.module';
import { ProjectModulesModule } from './modules/project-modules/project-modules.module';
import { TaskStatusesModule } from './modules/task-statuses/task-statuses.module';
import { TasksModule } from './modules/tasks/tasks.module';
import { CommentsModule } from './modules/comments/comments.module';
import { ActivityModule } from './modules/activity/activity.module';
import { SearchModule } from './modules/search/search.module';

// Importacion condicional de modulos opcionales
let EmailModule: any = null;
const emailModulePath = join(__dirname, 'modules/email/email.module');
if (
  existsSync(emailModulePath + '.ts') ||
  existsSync(emailModulePath + '.js')
) {
  try {
    EmailModule = require('./modules/email/email.module').EmailModule;
  } catch (error) {
    // EmailModule no disponible
  }
}

@Global()
@Module({
  imports: [
    DatabaseModule,
    ScheduleModule.forRoot(),
    EventEmitterModule.forRoot({
      wildcard: false,
      delimiter: '.',
      newListener: false,
      removeListener: false,
      maxListeners: 10,
      verboseMemoryLeak: false,
      ignoreErrors: false,
    }),
    // Infraestructura
    AuthModule,
    UsersModule,
    SeederModule,
    SecurityModule,
    NotificationsModule,
    StorageModule,
    FeatureFlagsModule,
    WebhooksModule,
    CacheModule,
    JobsModule,
    I18nModule,
    // Dominio TaskHub
    OrganizationsModule,
    InvitationsModule,
    ProjectsModule,
    ProjectModulesModule,
    TaskStatusesModule,
    TasksModule,
    CommentsModule,
    ActivityModule,
    SearchModule,
    // Modulos opcionales
    ...(EmailModule ? [EmailModule] : []),
  ],
  controllers: [AppController],
  providers: [
    AppService,
    ModuleLoaderService,
    ModuleManagerService,
    {
      provide: APP_INTERCEPTOR,
      useClass: ResponseInterceptor,
    },
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
  ],
  exports: [ModuleManagerService],
})
export class AppModule {
  private static readonly logger = new Logger(AppModule.name);

  constructor(private moduleManager: ModuleManagerService) {
    AppModule.logger.log('AppModule inicializado - TaskHub');
    AppModule.logger.log('DatabaseModule configurado con PostgreSQL');
    AppModule.logger.log('AuthModule integrado - Autenticacion JWT completa');
    AppModule.logger.log('UsersModule integrado - Gestion de usuarios');
    AppModule.logger.log(
      'SeederModule integrado - Creacion automatica de Super Admin',
    );

    if (EmailModule) {
      AppModule.logger.log('EmailModule detectado y cargado');
    } else {
      AppModule.logger.warn(
        'EmailModule no disponible - sistema funcionara sin envio de emails',
      );
    }

    AppModule.logger.log('Modulos TaskHub cargados: Organizations, Projects, Tasks, Comments, Activity');
    AppModule.logger.log('ModuleManagerService activado');
  }
}
