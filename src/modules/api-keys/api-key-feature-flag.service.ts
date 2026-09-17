import { Injectable, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FeatureFlagsService } from '../feature-flags/feature-flags.service';
import {
  API_KEY_AUTHENTICATION_FLAG,
  API_KEY_EMERGENCY_DISABLE_ENV,
  API_KEY_MANAGEMENT_FLAG,
} from './api-key.constants';

@Injectable()
export class ApiKeyFeatureFlagService {
  constructor(
    private readonly configService: ConfigService,
    @Optional() private readonly featureFlagsService?: FeatureFlagsService,
  ) {}

  async isAuthenticationEnabled(): Promise<boolean> {
    return this.isEnabled(
      API_KEY_AUTHENTICATION_FLAG,
      'TASKHUB_MCP_API_KEY_AUTHENTICATION_ENABLED',
    );
  }

  async isManagementEnabled(): Promise<boolean> {
    return this.isEnabled(
      API_KEY_MANAGEMENT_FLAG,
      'TASKHUB_MCP_API_KEY_MANAGEMENT_ENABLED',
    );
  }

  private async isEnabled(flag: string, environmentOverride: string) {
    if (
      this.configService.get<string>(API_KEY_EMERGENCY_DISABLE_ENV) === 'true'
    ) {
      return false;
    }

    if (this.configService.get<string>(environmentOverride) === 'true') {
      return true;
    }

    return this.featureFlagsService?.isEnabled(flag) ?? false;
  }
}
