import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CombinedAuthGuard } from './guards/combined-auth.guard';
import { API_KEY_METADATA_ONLY_KEY } from './decorators/api-key.decorator';

describe('CombinedAuthGuard', () => {
  const context = (authorization = 'Bearer jwt-token') =>
    ({
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: () => ({
        getRequest: () => ({ headers: { authorization } }),
      }),
    }) as unknown as ExecutionContext;

  it('delegates unannotated browser routes to the existing JWT guard', async () => {
    const jwtGuard = { canActivate: jest.fn().mockResolvedValue(true) };
    const apiKeyGuard = { canActivate: jest.fn() };
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(undefined),
    };
    const guard = new CombinedAuthGuard(
      reflector as unknown as Reflector,
      jwtGuard as never,
      apiKeyGuard as never,
    );

    const result = await guard.canActivate(context());

    expect(result).toBe(true);
    expect(jwtGuard.canActivate).toHaveBeenCalledTimes(1);
    expect(apiKeyGuard.canActivate).not.toHaveBeenCalled();
  });

  it('uses the API-key guard for a scope-annotated route', async () => {
    const jwtGuard = { canActivate: jest.fn() };
    const apiKeyGuard = { canActivate: jest.fn().mockResolvedValue(true) };
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(['tasks:read']),
    };
    const guard = new CombinedAuthGuard(
      reflector as unknown as Reflector,
      jwtGuard as never,
      apiKeyGuard as never,
    );

    const result = await guard.canActivate(context('Bearer thk_public_secret'));

    expect(result).toBe(true);
    expect(apiKeyGuard.canActivate).toHaveBeenCalledTimes(1);
    expect(jwtGuard.canActivate).not.toHaveBeenCalled();
  });

  it('uses the API-key guard for a metadata-only route', async () => {
    const jwtGuard = { canActivate: jest.fn() };
    const apiKeyGuard = { canActivate: jest.fn().mockResolvedValue(true) };
    const reflector = {
      getAllAndOverride: jest.fn((metadataKey: string) =>
        metadataKey === API_KEY_METADATA_ONLY_KEY ? true : undefined,
      ),
    };
    const guard = new CombinedAuthGuard(
      reflector as unknown as Reflector,
      jwtGuard as never,
      apiKeyGuard as never,
    );

    const result = await guard.canActivate(context('Bearer thk_metadata_key'));

    expect(result).toBe(true);
    expect(apiKeyGuard.canActivate).toHaveBeenCalledTimes(1);
    expect(jwtGuard.canActivate).not.toHaveBeenCalled();
  });

  it('keeps using the JWT guard for JWTs on metadata-only routes', async () => {
    const jwtGuard = { canActivate: jest.fn().mockResolvedValue(true) };
    const apiKeyGuard = { canActivate: jest.fn() };
    const reflector = {
      getAllAndOverride: jest.fn((metadataKey: string) =>
        metadataKey === API_KEY_METADATA_ONLY_KEY ? true : undefined,
      ),
    };
    const guard = new CombinedAuthGuard(
      reflector as unknown as Reflector,
      jwtGuard as never,
      apiKeyGuard as never,
    );

    const result = await guard.canActivate(context('Bearer jwt-token'));

    expect(result).toBe(true);
    expect(jwtGuard.canActivate).toHaveBeenCalledTimes(1);
    expect(apiKeyGuard.canActivate).not.toHaveBeenCalled();
  });
});
