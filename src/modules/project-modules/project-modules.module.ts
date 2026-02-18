import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProjectModule } from './entities/project-module.entity';
import { ProjectModulesService } from './project-modules.service';
import { ProjectModulesController } from './project-modules.controller';

@Module({
  imports: [TypeOrmModule.forFeature([ProjectModule])],
  controllers: [ProjectModulesController],
  providers: [ProjectModulesService],
  exports: [ProjectModulesService],
})
export class ProjectModulesModule {}
