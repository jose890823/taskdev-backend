import { Injectable } from '@nestjs/common';
import { ApiKeyService } from '../api-key.service';
import { ApiKeyScope } from '../api-key.constants';
import { RequestIdentity } from '../api-key.types';

@Injectable()
export class ApiKeyStrategy {
  constructor(private readonly apiKeyService: ApiKeyService) {}

  authenticate(
    token: string,
    scopes: ApiKeyScope[],
    projectIds: string[],
  ): Promise<RequestIdentity> {
    return this.apiKeyService.authenticate(token, scopes, projectIds);
  }
}
