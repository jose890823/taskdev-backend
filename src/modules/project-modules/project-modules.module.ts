import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProjectModule } from './entities/project-module.entity';
import { ProjectModulesService } from './project-modules.service';
import { ProjectModulesController } from './project-modules.controller';
import { ProjectsModule } from '../projects/projects.module';
import { ApiKeysModule } from '../api-keys/api-keys.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ProjectModule]),
    ProjectsModule,
    ApiKeysModule,
    AuthModule,
  ],
  controllers: [ProjectModulesController],
  providers: [ProjectModulesService],
  exports: [ProjectModulesService],
})
export class ProjectModulesModule {}
