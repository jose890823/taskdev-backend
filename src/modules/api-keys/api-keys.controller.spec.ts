import { Test, TestingModule } from '@nestjs/testing';
import { ApiKeysController } from './api-keys.controller';
import { ApiKeyService } from './api-key.service';

describe('ApiKeysController', () => {
  let controller: ApiKeysController;
  const apiKeyService = { recover: jest.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ApiKeysController],
      providers: [{ provide: ApiKeyService, useValue: apiKeyService }],
    }).compile();

    controller = module.get(ApiKeysController);
    jest.clearAllMocks();
  });

  it('delegates lost-secret recovery to the service with the JWT actor and request', async () => {
    const actor = { id: 'owner-1' } as never;
    const request = { path: '/api/api-keys/key-1/recover' } as never;

    await controller.recover('key-1', actor, request);

    expect(apiKeyService.recover).toHaveBeenCalledWith('key-1', actor, request);
  });
});
