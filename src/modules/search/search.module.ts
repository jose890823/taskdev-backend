import { Module } from '@nestjs/common';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';
import { ProjectsModule } from '../projects/projects.module';
import { OrganizationsModule } from '../organizations/organizations.module';

@Module({
  imports: [ProjectsModule, OrganizationsModule],
  controllers: [SearchController],
  providers: [SearchService],
})
export class SearchModule {}
