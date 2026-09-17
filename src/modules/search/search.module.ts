import { Module } from '@nestjs/common';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';
import { ProjectsModule } from '../projects/projects.module';
import { OrganizationsModule } from '../organizations/organizations.module';
import { ApiKeysModule } from '../api-keys/api-keys.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [ProjectsModule, OrganizationsModule, ApiKeysModule, AuthModule],
  controllers: [SearchController],
  providers: [SearchService],
})
export class SearchModule {}
