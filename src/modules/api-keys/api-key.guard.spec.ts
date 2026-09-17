import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ApiKeyGuard } from './guards/api-key.guard';
import {
  API_KEY_PROJECT_PARAM_KEY,
  API_KEY_SCOPES_KEY,
} from './decorators/api-key.decorator';

describe('ApiKeyGuard project context', () => {
  it('passes declared route/query project context to authentication before the controller runs', async () => {
    const request = {
      headers: { authorization: 'Bearer thk_public_secret' },
      params: { id: 'resource-id' },
      query: { projectId: 'project-1', projectIds: 'project-1,project-1' },
      body: {},
      res: { setHeader: jest.fn() },
    };
    const reflector = {
      getAllAndOverride: jest.fn((metadataKey: string) => {
        if (metadataKey === API_KEY_SCOPES_KEY) return ['tasks:read'];
        if (metadataKey === API_KEY_PROJECT_PARAM_KEY) return 'projectId';
        return undefined;
      }),
    };
    const identity = {
      user: { id: 'owner-1' },
      authType: 'api-key',
      keyId: 'key-1',
      projectId: 'project-1',
      scopes: ['tasks:read'],
    };
    const apiKeyService = {
      authenticate: jest.fn().mockResolvedValue(identity),
    };
    const guard = new ApiKeyGuard(
      reflector as unknown as Reflector,
      apiKeyService as never,
    );
    const context = {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(apiKeyService.authenticate).toHaveBeenCalledWith(
      'thk_public_secret',
      ['tasks:read'],
      ['project-1'],
      expect.objectContaining({ endpoint: undefined }),
    );
  });
});
