import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { FeatureFlagsModule } from '../feature-flags/feature-flags.module';
import { User } from '../auth/entities/user.entity';
import { ProjectMember } from '../projects/entities/project-member.entity';
import { ApiKeyFeatureFlagService } from './api-key-feature-flag.service';
import { ApiKeyService } from './api-key.service';
import { ApiKeysController } from './api-keys.controller';
import { ApiKeyMetadataController } from './api-key-metadata.controller';
import { McpApiKey } from './entities';
import { ApiKeyGuard, CombinedAuthGuard } from './guards';
import { ApiKeyStrategy } from './strategies';
import { SecurityModule } from '../security/security.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([McpApiKey, User, ProjectMember]),
    forwardRef(() => AuthModule),
    FeatureFlagsModule,
    SecurityModule,
  ],
  controllers: [ApiKeysController, ApiKeyMetadataController],
  providers: [
    ApiKeyFeatureFlagService,
    ApiKeyService,
    ApiKeyGuard,
    CombinedAuthGuard,
    ApiKeyStrategy,
  ],
  exports: [ApiKeyService, ApiKeyGuard, CombinedAuthGuard, ApiKeyStrategy],
})
export class ApiKeysModule {}
