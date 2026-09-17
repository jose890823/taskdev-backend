import { applyDecorators, SetMetadata } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { ApiKeyScope } from '../api-key.constants';

export const API_KEY_SCOPES_KEY = 'api_key_scopes';
export const API_KEY_PROJECT_PARAM_KEY = 'api_key_project_param';
export const API_KEY_METADATA_ONLY_KEY = 'api_key_metadata_only';

export const ApiKeyScopes = (...scopes: ApiKeyScope[]) =>
  applyDecorators(
    SetMetadata(API_KEY_SCOPES_KEY, scopes),
    ApiBearerAuth('api-key'),
  );

export const ApiKeyProjectParam = (parameter = 'projectId') =>
  SetMetadata(API_KEY_PROJECT_PARAM_KEY, parameter);

export const ApiKeyMetadataOnly = () =>
  applyDecorators(
    SetMetadata(API_KEY_METADATA_ONLY_KEY, true),
    ApiBearerAuth('api-key'),
  );
