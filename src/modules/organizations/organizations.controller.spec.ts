import { ForbiddenException } from '@nestjs/common';
import { OrganizationsController } from './organizations.controller';
import { OrganizationsService } from './organizations.service';
import { ProjectsService } from '../projects/projects.service';
import type { ApiKeyRequest } from '../api-keys/api-key.types';
import type { User } from '../auth/entities/user.entity';

describe('OrganizationsController', () => {
  let controller: OrganizationsController;
  let organizationsService: {
    findById: jest.Mock;
    verifyMemberAccess: jest.Mock;
    getMembers: jest.Mock;
  };
  let projectsService: {
    findById: jest.Mock;
  };

  const organization = { id: 'organization-1' };
  const organizationMembers = [
    { userId: 'bound-project-member' },
    { userId: 'outside-bound-project-member' },
  ];
  const user = {
    id: 'owner-1',
    isSuperAdmin: jest.fn().mockReturnValue(false),
  } as unknown as User;
  const apiKeyRequest = {
    headers: {},
    identity: {
      authType: 'api-key',
      projectId: 'bound-project-1',
    },
  } as ApiKeyRequest;
  const jwtRequest = {
    headers: {},
    identity: { authType: 'jwt' },
  } as ApiKeyRequest;

  beforeEach(() => {
    organizationsService = {
      findById: jest.fn(),
      verifyMemberAccess: jest.fn(),
      getMembers: jest.fn(),
    };
    projectsService = {
      findById: jest.fn(),
    };

    controller = new OrganizationsController(
      organizationsService as unknown as OrganizationsService,
      projectsService as unknown as ProjectsService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('rejects project-bound API keys before listing parent organization members', async () => {
    await expect(
      controller.getMembers(organization.id, user, apiKeyRequest),
    ).rejects.toMatchObject({
      response: {
        code: 'PROJECT_ACCESS_DENIED',
      },
    });

    await expect(
      controller.getMembers(organization.id, user, apiKeyRequest),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(organizationsService.getMembers).not.toHaveBeenCalled();
    expect(organizationsService.findById).not.toHaveBeenCalled();
  });

  it('preserves JWT access to the complete organization member list', async () => {
    organizationsService.findById.mockResolvedValue(organization);
    organizationsService.getMembers.mockResolvedValue(organizationMembers);

    await expect(
      controller.getMembers(organization.id, user, jwtRequest),
    ).resolves.toBe(organizationMembers);

    expect(organizationsService.verifyMemberAccess).toHaveBeenCalledWith(
      organization.id,
      user.id,
      false,
    );
    expect(organizationsService.getMembers).toHaveBeenCalledWith(
      organization.id,
    );
  });
});
