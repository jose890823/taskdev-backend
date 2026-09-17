import { ForbiddenException } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from '../services/notifications.service';
import type { ApiKeyRequest } from '../../api-keys/api-key.types';
import type { User } from '../../auth/entities/user.entity';
import type { UpdatePreferencesDto } from '../dto';

describe('NotificationsController', () => {
  let controller: NotificationsController;
  let notificationsService: {
    getOrCreatePreferences: jest.Mock;
    updatePreferences: jest.Mock;
  };

  const user = { id: 'user-1' } as User;
  const apiKeyRequest = {
    identity: { authType: 'api-key', projectId: 'project-1' },
  } as ApiKeyRequest;
  const jwtRequest = {
    identity: { authType: 'jwt' },
  } as ApiKeyRequest;

  beforeEach(async () => {
    notificationsService = {
      getOrCreatePreferences: jest.fn(),
      updatePreferences: jest.fn(),
    };

    controller = new NotificationsController(
      notificationsService as unknown as NotificationsService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('rejects project-bound API keys from both global preference operations', async () => {
    await expect(
      controller.getPreferences(user, apiKeyRequest),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'PROJECT_ACCESS_DENIED' }),
    });
    await expect(
      controller.updatePreferences(
        user,
        { emailEnabled: false } as UpdatePreferencesDto,
        apiKeyRequest,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(notificationsService.getOrCreatePreferences).not.toHaveBeenCalled();
    expect(notificationsService.updatePreferences).not.toHaveBeenCalled();
  });

  it('preserves JWT access to both global preference operations', async () => {
    const preferences = { userId: user.id };
    const dto = { emailEnabled: false } as UpdatePreferencesDto;
    notificationsService.getOrCreatePreferences.mockResolvedValue(preferences);
    notificationsService.updatePreferences.mockResolvedValue(preferences);

    await expect(controller.getPreferences(user, jwtRequest)).resolves.toBe(
      preferences,
    );
    await expect(
      controller.updatePreferences(user, dto, jwtRequest),
    ).resolves.toBe(preferences);

    expect(notificationsService.getOrCreatePreferences).toHaveBeenCalledWith(
      user.id,
    );
    expect(notificationsService.updatePreferences).toHaveBeenCalledWith(
      user.id,
      dto,
    );
  });
});
