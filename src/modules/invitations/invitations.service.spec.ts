import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import {
  ConflictException,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { Repository, DataSource } from 'typeorm';
import { InvitationsService } from './invitations.service';
import { Invitation, InvitationStatus } from './entities/invitation.entity';
import { OrganizationsService } from '../organizations/organizations.service';
import { OrganizationRole } from '../organizations/entities/organization-member.entity';
import { ProjectsService } from '../projects/projects.service';
import { ProjectRole } from '../projects/entities/project-member.entity';
import { User, UserRole } from '../auth/entities/user.entity';

describe('InvitationsService', () => {
  let service: InvitationsService;
  let invitationRepository: jest.Mocked<Repository<Invitation>>;
  let userRepository: jest.Mocked<Repository<User>>;
  let organizationsService: jest.Mocked<OrganizationsService>;
  let projectsService: jest.Mocked<ProjectsService>;
  let configService: jest.Mocked<ConfigService>;
  let mockEmailService: { sendInvitationEmail: jest.Mock };

  // ── Mock Data ──────────────────────────────────────────────────────────

  const mockUser: User = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    email: 'inviter@example.com',
    firstName: 'Carlos',
    lastName: 'Admin',
    roles: [UserRole.USER],
  } as User;

  const mockSuperAdmin: User = {
    id: 'a1111111-1111-1111-1111-111111111111',
    email: 'superadmin@taskhub.com',
    firstName: 'Super',
    lastName: 'Admin',
    roles: [UserRole.SUPER_ADMIN],
  } as User;

  const mockInvitedUser: User = {
    id: 'b2222222-2222-2222-2222-222222222222',
    email: 'invited@example.com',
    firstName: 'Invited',
    lastName: 'User',
    roles: [UserRole.USER],
  } as User;

  const mockOrganization = {
    id: 'c3333333-3333-3333-3333-333333333333',
    name: 'Acme Corp',
    slug: 'acme-corp',
  };

  const mockProject = {
    id: 'd4444444-4444-4444-4444-444444444444',
    name: 'Project Alpha',
    organizationId: mockOrganization.id,
  };

  const mockPersonalProject = {
    id: 'e5555555-5555-5555-5555-555555555555',
    name: 'Personal Project',
    organizationId: null,
  };

  /** Factory functions to avoid shared mutable state between tests */
  const createMockInvitation = (): Invitation =>
    ({
      id: 'f6666666-6666-6666-6666-666666666666',
      organizationId: mockOrganization.id,
      email: 'invited@example.com',
      role: OrganizationRole.MEMBER,
      token: 'abc123def456abc123def456abc123def456abc123def456abc123def456abcd',
      invitedById: mockUser.id,
      status: InvitationStatus.PENDING,
      projectId: null,
      projectRole: null,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      createdAt: new Date(),
      updatedAt: new Date(),
    }) as Invitation;

  const createMockProjectInvitation = (): Invitation =>
    ({
      ...createMockInvitation(),
      id: 'a7777777-7777-7777-7777-777777777777',
      projectId: mockProject.id,
      projectRole: ProjectRole.MEMBER,
      token: 'project-token-abc123def456abc123def456abc123def456abc123def456',
    }) as Invitation;

  const createMockExpiredInvitation = (): Invitation =>
    ({
      ...createMockInvitation(),
      id: 'b8888888-8888-8888-8888-888888888888',
      expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
      token: 'expired-token-abc123def456abc123def456abc123def456abc123def4',
    }) as Invitation;

  // ── Mock DataSource ────────────────────────────────────────────────────

  const mockDataSource = {
    transaction: jest.fn().mockImplementation(async (cb) => {
      const mockManager = {
        save: jest.fn().mockImplementation((entity) => Promise.resolve(entity)),
      };
      return cb(mockManager);
    }),
  };

  // ── Setup ──────────────────────────────────────────────────────────────

  beforeEach(async () => {
    const mockInvitationRepository = {
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };

    const mockUserRepository = {
      findOne: jest.fn(),
    };

    const mockOrganizationsService = {
      findById: jest.fn(),
      getMemberRole: jest.fn(),
      addMember: jest.fn(),
    };

    const mockProjectsService = {
      findById: jest.fn(),
      hasAdminAccess: jest.fn(),
      addMemberByUserId: jest.fn(),
    };

    const mockConfigService = {
      get: jest.fn(),
    };

    mockEmailService = {
      sendInvitationEmail: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InvitationsService,
        {
          provide: getRepositoryToken(Invitation),
          useValue: mockInvitationRepository,
        },
        {
          provide: getRepositoryToken(User),
          useValue: mockUserRepository,
        },
        {
          provide: OrganizationsService,
          useValue: mockOrganizationsService,
        },
        {
          provide: ProjectsService,
          useValue: mockProjectsService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
        {
          provide: 'EmailService',
          useValue: mockEmailService,
        },
      ],
    }).compile();

    service = module.get<InvitationsService>(InvitationsService);
    invitationRepository = module.get(getRepositoryToken(Invitation));
    userRepository = module.get(getRepositoryToken(User));
    organizationsService = module.get(OrganizationsService);
    projectsService = module.get(ProjectsService);
    configService = module.get(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  it('debe estar definido', () => {
    expect(service).toBeDefined();
  });

  // ═══════════════════════════════════════════════════════════════════════
  // create (organization invitation)
  // ═══════════════════════════════════════════════════════════════════════

  describe('create', () => {
    const createDto = {
      email: 'newuser@example.com',
      role: OrganizationRole.MEMBER,
    };

    beforeEach(() => {
      organizationsService.findById.mockResolvedValue(mockOrganization as any);
      organizationsService.getMemberRole.mockResolvedValue('admin');
      invitationRepository.findOne.mockResolvedValue(null);
      invitationRepository.create.mockImplementation(
        (data) => ({ ...data, id: 'new-inv-id' }) as any,
      );
      invitationRepository.save.mockImplementation((inv) =>
        Promise.resolve(inv as any),
      );
      mockEmailService.sendInvitationEmail.mockResolvedValue({ success: true });
    });

    it('debe crear una invitacion de organizacion exitosamente', async () => {
      const result = await service.create(
        mockOrganization.id,
        createDto,
        mockUser,
      );

      expect(organizationsService.findById).toHaveBeenCalledWith(
        mockOrganization.id,
      );
      expect(organizationsService.getMemberRole).toHaveBeenCalledWith(
        mockOrganization.id,
        mockUser.id,
      );
      expect(invitationRepository.findOne).toHaveBeenCalledWith({
        where: {
          organizationId: mockOrganization.id,
          email: createDto.email,
          status: InvitationStatus.PENDING,
          projectId: null,
        },
      });
      expect(invitationRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: mockOrganization.id,
          email: createDto.email,
          role: OrganizationRole.MEMBER,
          invitedById: mockUser.id,
        }),
      );
      expect(invitationRepository.save).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('debe asignar rol MEMBER por defecto si no se especifica', async () => {
      const dtoWithoutRole = { email: 'newuser@example.com' };

      await service.create(
        mockOrganization.id,
        dtoWithoutRole as any,
        mockUser,
      );

      expect(invitationRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          role: OrganizationRole.MEMBER,
        }),
      );
    });

    it('debe generar un token de 64 caracteres hex', async () => {
      await service.create(mockOrganization.id, createDto, mockUser);

      const createCall = invitationRepository.create.mock.calls[0][0] as any;
      expect(createCall.token).toBeDefined();
      expect(typeof createCall.token).toBe('string');
      expect(createCall.token.length).toBe(64); // 32 bytes → 64 hex chars
    });

    it('debe establecer expiresAt a 7 dias en el futuro', async () => {
      const now = Date.now();

      await service.create(mockOrganization.id, createDto, mockUser);

      const createCall = invitationRepository.create.mock.calls[0][0] as any;
      const expiresAt = createCall.expiresAt as Date;
      const diffDays = (expiresAt.getTime() - now) / (1000 * 60 * 60 * 24);
      expect(diffDays).toBeGreaterThanOrEqual(6.9);
      expect(diffDays).toBeLessThanOrEqual(7.1);
    });

    it('debe enviar email de invitacion cuando EmailService esta disponible', async () => {
      configService.get.mockReturnValue('https://app.taskhub.com');

      await service.create(mockOrganization.id, createDto, mockUser);

      expect(mockEmailService.sendInvitationEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: createDto.email,
          organizationName: mockOrganization.name,
          invitedByName: 'Carlos Admin',
          role: OrganizationRole.MEMBER,
        }),
      );
    });

    it('debe usar FRONTEND_URL del config para construir inviteUrl', async () => {
      configService.get.mockReturnValue('https://custom.domain.com');

      await service.create(mockOrganization.id, createDto, mockUser);

      const emailCall = mockEmailService.sendInvitationEmail.mock.calls[0][0];
      expect(emailCall.inviteUrl).toMatch(
        /^https:\/\/custom\.domain\.com\/invite\//,
      );
    });

    it('debe usar localhost:3000 como fallback si FRONTEND_URL no esta configurado', async () => {
      configService.get.mockReturnValue(undefined);

      await service.create(mockOrganization.id, createDto, mockUser);

      const emailCall = mockEmailService.sendInvitationEmail.mock.calls[0][0];
      expect(emailCall.inviteUrl).toMatch(/^http:\/\/localhost:3000\/invite\//);
    });

    it('debe permitir a super_admin crear invitaciones sin ser miembro de la org', async () => {
      await service.create(mockOrganization.id, createDto, mockSuperAdmin);

      expect(organizationsService.getMemberRole).not.toHaveBeenCalled();
      expect(invitationRepository.save).toHaveBeenCalled();
    });

    it('debe lanzar ForbiddenException si el usuario es solo member de la org', async () => {
      organizationsService.getMemberRole.mockResolvedValue('member');

      await expect(
        service.create(mockOrganization.id, createDto, mockUser),
      ).rejects.toThrow(ForbiddenException);
      await expect(
        service.create(mockOrganization.id, createDto, mockUser),
      ).rejects.toThrow(
        'Solo el propietario o administrador de la organizacion puede invitar',
      );
    });

    it('debe lanzar ForbiddenException si el usuario no es miembro de la org', async () => {
      organizationsService.getMemberRole.mockResolvedValue(null);

      await expect(
        service.create(mockOrganization.id, createDto, mockUser),
      ).rejects.toThrow(ForbiddenException);
    });

    it('debe lanzar ConflictException si ya existe invitacion pendiente para el email', async () => {
      invitationRepository.findOne.mockResolvedValue(createMockInvitation());

      await expect(
        service.create(mockOrganization.id, createDto, mockUser),
      ).rejects.toThrow(ConflictException);
      await expect(
        service.create(mockOrganization.id, createDto, mockUser),
      ).rejects.toThrow('Ya existe una invitacion pendiente para este email');
    });

    it('debe permitir a owner crear invitaciones', async () => {
      organizationsService.getMemberRole.mockResolvedValue('owner');

      await service.create(mockOrganization.id, createDto, mockUser);

      expect(invitationRepository.save).toHaveBeenCalled();
    });

    it('no debe fallar si el email de invitacion no se envia', async () => {
      mockEmailService.sendInvitationEmail.mockResolvedValue({
        success: false,
        error: 'SMTP error',
      });

      const result = await service.create(
        mockOrganization.id,
        createDto,
        mockUser,
      );

      expect(result).toBeDefined();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // createProjectInvitation
  // ═══════════════════════════════════════════════════════════════════════

  describe('createProjectInvitation', () => {
    const createProjectDto = {
      email: 'newcollab@example.com',
      role: ProjectRole.MEMBER,
    };

    beforeEach(() => {
      projectsService.findById.mockResolvedValue(mockProject as any);
      organizationsService.findById.mockResolvedValue(mockOrganization as any);
      projectsService.hasAdminAccess.mockResolvedValue(true);
      userRepository.findOne.mockResolvedValue(null); // user not in system
      invitationRepository.findOne.mockResolvedValue(null);
      invitationRepository.create.mockImplementation(
        (data) => ({ ...data, id: 'new-inv-id' }) as any,
      );
      invitationRepository.save.mockImplementation((inv) =>
        Promise.resolve(inv as any),
      );
      mockEmailService.sendInvitationEmail.mockResolvedValue({ success: true });
      configService.get.mockReturnValue('http://localhost:3000');
    });

    it('debe crear invitacion de proyecto cuando el usuario no existe en el sistema', async () => {
      const result = await service.createProjectInvitation(
        mockProject.id,
        createProjectDto,
        mockUser,
      );

      expect(result.action).toBe('invited');
      expect(result.message).toContain(createProjectDto.email);
      expect(invitationRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: mockOrganization.id,
          email: createProjectDto.email,
          role: OrganizationRole.MEMBER,
          projectId: mockProject.id,
          projectRole: ProjectRole.MEMBER,
          invitedById: mockUser.id,
        }),
      );
      expect(invitationRepository.save).toHaveBeenCalled();
    });

    it('debe agregar directamente si el usuario ya existe en el sistema', async () => {
      userRepository.findOne.mockResolvedValue(mockInvitedUser);
      organizationsService.addMember.mockResolvedValue(undefined as any);
      projectsService.addMemberByUserId.mockResolvedValue(undefined as any);

      const result = await service.createProjectInvitation(
        mockProject.id,
        createProjectDto,
        mockUser,
      );

      expect(result.action).toBe('added');
      expect(result.message).toContain(createProjectDto.email);
      expect(organizationsService.addMember).toHaveBeenCalledWith(
        mockOrganization.id,
        { userId: mockInvitedUser.id, role: OrganizationRole.MEMBER },
        mockUser.id,
      );
      expect(projectsService.addMemberByUserId).toHaveBeenCalledWith(
        mockProject.id,
        mockInvitedUser.id,
        ProjectRole.MEMBER,
      );
      // Should NOT create invitation in the repo
      expect(invitationRepository.create).not.toHaveBeenCalled();
    });

    it('debe ignorar ConflictException al agregar miembro existente a la org', async () => {
      userRepository.findOne.mockResolvedValue(mockInvitedUser);
      organizationsService.addMember.mockRejectedValue(
        new ConflictException('El usuario ya es miembro'),
      );
      projectsService.addMemberByUserId.mockResolvedValue(undefined as any);

      const result = await service.createProjectInvitation(
        mockProject.id,
        createProjectDto,
        mockUser,
      );

      expect(result.action).toBe('added');
      expect(projectsService.addMemberByUserId).toHaveBeenCalled();
    });

    it('debe propagar excepciones no-Conflict al agregar miembro a la org', async () => {
      userRepository.findOne.mockResolvedValue(mockInvitedUser);
      organizationsService.addMember.mockRejectedValue(
        new ForbiddenException('No tienes permisos'),
      );

      await expect(
        service.createProjectInvitation(
          mockProject.id,
          createProjectDto,
          mockUser,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('debe lanzar BadRequestException para proyectos personales', async () => {
      projectsService.findById.mockResolvedValue(mockPersonalProject as any);

      await expect(
        service.createProjectInvitation(
          mockPersonalProject.id,
          createProjectDto,
          mockUser,
        ),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.createProjectInvitation(
          mockPersonalProject.id,
          createProjectDto,
          mockUser,
        ),
      ).rejects.toThrow('No se puede invitar a un proyecto personal');
    });

    it('debe lanzar ForbiddenException si el usuario no es admin del proyecto', async () => {
      projectsService.hasAdminAccess.mockResolvedValue(false);

      await expect(
        service.createProjectInvitation(
          mockProject.id,
          createProjectDto,
          mockUser,
        ),
      ).rejects.toThrow(ForbiddenException);
      await expect(
        service.createProjectInvitation(
          mockProject.id,
          createProjectDto,
          mockUser,
        ),
      ).rejects.toThrow('No tienes permisos de administrador en este proyecto');
    });

    it('debe permitir a super_admin invitar sin verificar permisos de proyecto', async () => {
      const result = await service.createProjectInvitation(
        mockProject.id,
        createProjectDto,
        mockSuperAdmin,
      );

      expect(projectsService.hasAdminAccess).not.toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('debe lanzar ConflictException si ya hay invitacion pendiente para ese email+proyecto', async () => {
      invitationRepository.findOne.mockResolvedValue(
        createMockProjectInvitation(),
      );

      await expect(
        service.createProjectInvitation(
          mockProject.id,
          createProjectDto,
          mockUser,
        ),
      ).rejects.toThrow(ConflictException);
      await expect(
        service.createProjectInvitation(
          mockProject.id,
          createProjectDto,
          mockUser,
        ),
      ).rejects.toThrow(
        'Ya existe una invitacion pendiente para este email en este proyecto',
      );
    });

    it('debe usar ProjectRole.MEMBER como rol por defecto si no se especifica', async () => {
      const dtoWithoutRole = { email: 'newcollab@example.com' };

      await service.createProjectInvitation(
        mockProject.id,
        dtoWithoutRole as any,
        mockUser,
      );

      expect(invitationRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          projectRole: ProjectRole.MEMBER,
        }),
      );
    });

    it('debe enviar email con nombre del proyecto', async () => {
      await service.createProjectInvitation(
        mockProject.id,
        createProjectDto,
        mockUser,
      );

      expect(mockEmailService.sendInvitationEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: createProjectDto.email,
          organizationName: mockOrganization.name,
          projectName: mockProject.name,
          role: ProjectRole.MEMBER,
        }),
      );
    });

    it('no debe fallar si el email no se puede enviar', async () => {
      mockEmailService.sendInvitationEmail.mockResolvedValue({
        success: false,
        error: 'SMTP timeout',
      });

      const result = await service.createProjectInvitation(
        mockProject.id,
        createProjectDto,
        mockUser,
      );

      expect(result.action).toBe('invited');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // findByOrganization
  // ═══════════════════════════════════════════════════════════════════════

  describe('findByOrganization', () => {
    it('debe retornar invitaciones de la organizacion ordenadas por fecha DESC', async () => {
      const invitation = createMockInvitation();
      invitationRepository.find.mockResolvedValue([invitation]);

      const result = await service.findByOrganization(mockOrganization.id);

      expect(invitationRepository.find).toHaveBeenCalledWith({
        where: { organizationId: mockOrganization.id },
        order: { createdAt: 'DESC' },
      });
      expect(result).toEqual([invitation]);
    });

    it('debe retornar array vacio si no hay invitaciones', async () => {
      invitationRepository.find.mockResolvedValue([]);

      const result = await service.findByOrganization(mockOrganization.id);

      expect(result).toEqual([]);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // findByProject
  // ═══════════════════════════════════════════════════════════════════════

  describe('findByProject', () => {
    it('debe retornar solo invitaciones PENDING del proyecto', async () => {
      const projectInvitation = createMockProjectInvitation();
      invitationRepository.find.mockResolvedValue([projectInvitation]);

      const result = await service.findByProject(mockProject.id);

      expect(invitationRepository.find).toHaveBeenCalledWith({
        where: { projectId: mockProject.id, status: InvitationStatus.PENDING },
        order: { createdAt: 'DESC' },
      });
      expect(result).toEqual([projectInvitation]);
    });

    it('debe retornar array vacio si no hay invitaciones pendientes', async () => {
      invitationRepository.find.mockResolvedValue([]);

      const result = await service.findByProject(mockProject.id);

      expect(result).toEqual([]);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // getInfoByToken
  // ═══════════════════════════════════════════════════════════════════════

  describe('getInfoByToken', () => {
    beforeEach(() => {
      organizationsService.findById.mockResolvedValue(mockOrganization as any);
    });

    it('debe retornar info de la invitacion por token', async () => {
      const invitation = createMockInvitation();
      invitationRepository.findOne.mockResolvedValue(invitation);

      const result = await service.getInfoByToken(invitation.token);

      expect(invitationRepository.findOne).toHaveBeenCalledWith({
        where: { token: invitation.token },
      });
      expect(result).toEqual(
        expect.objectContaining({
          email: invitation.email,
          organizationName: mockOrganization.name,
          role: invitation.role,
          status: InvitationStatus.PENDING,
          expired: false,
        }),
      );
    });

    it('debe marcar como expired si la fecha ya paso y status es PENDING', async () => {
      const expiredInvitation = createMockExpiredInvitation();
      invitationRepository.findOne.mockResolvedValue(expiredInvitation);

      const result = await service.getInfoByToken(expiredInvitation.token);

      expect(result.expired).toBe(true);
      expect(result.status).toBe('expired');
    });

    it('debe mantener el status original si no es PENDING aunque este expirada', async () => {
      const acceptedButExpired = {
        ...createMockExpiredInvitation(),
        status: InvitationStatus.ACCEPTED,
      } as Invitation;
      invitationRepository.findOne.mockResolvedValue(acceptedButExpired);

      const result = await service.getInfoByToken(acceptedButExpired.token);

      expect(result.expired).toBe(true);
      expect(result.status).toBe(InvitationStatus.ACCEPTED);
    });

    it('debe incluir info del proyecto si la invitacion tiene projectId', async () => {
      const projectInvitation = createMockProjectInvitation();
      invitationRepository.findOne.mockResolvedValue(projectInvitation);
      projectsService.findById.mockResolvedValue(mockProject as any);

      const result = await service.getInfoByToken(projectInvitation.token);

      expect(result.projectName).toBe(mockProject.name);
      expect(result.projectRole).toBe(projectInvitation.projectRole);
    });

    it('debe omitir info del proyecto si el proyecto fue eliminado', async () => {
      const projectInvitation = createMockProjectInvitation();
      invitationRepository.findOne.mockResolvedValue(projectInvitation);
      projectsService.findById.mockRejectedValue(
        new NotFoundException('Proyecto no encontrado'),
      );

      const result = await service.getInfoByToken(projectInvitation.token);

      expect(result.projectName).toBeUndefined();
      expect(result.projectRole).toBeUndefined();
    });

    it('debe lanzar NotFoundException si el token no existe', async () => {
      invitationRepository.findOne.mockResolvedValue(null);

      await expect(service.getInfoByToken('invalid-token')).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.getInfoByToken('invalid-token')).rejects.toThrow(
        'Invitacion no encontrada',
      );
    });

    it('no debe incluir projectName si projectId es null', async () => {
      const invitation = createMockInvitation();
      invitationRepository.findOne.mockResolvedValue(invitation); // projectId = null

      const result = await service.getInfoByToken(invitation.token);

      expect(result.projectName).toBeUndefined();
      expect(result.projectRole).toBeUndefined();
      expect(projectsService.findById).not.toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // accept
  // ═══════════════════════════════════════════════════════════════════════

  describe('accept', () => {
    const acceptingUser: User = {
      id: 'c9999999-9999-9999-9999-999999999999',
      email: 'invited@example.com',
      firstName: 'Invited',
      lastName: 'User',
      roles: [UserRole.USER],
    } as User;

    beforeEach(() => {
      invitationRepository.findOne.mockResolvedValue(createMockInvitation());
      organizationsService.addMember.mockResolvedValue(undefined as any);
      invitationRepository.save.mockImplementation((inv) =>
        Promise.resolve(inv as any),
      );
    });

    it('debe aceptar la invitacion exitosamente', async () => {
      const invitation = createMockInvitation();
      invitationRepository.findOne.mockResolvedValue(invitation);

      const result = await service.accept(invitation.token, acceptingUser);

      expect(result.message).toBe('Invitacion aceptada exitosamente');
      expect(organizationsService.addMember).toHaveBeenCalledWith(
        invitation.organizationId,
        {
          userId: acceptingUser.id,
          role: invitation.role as OrganizationRole,
        },
        invitation.invitedById,
      );
      expect(mockDataSource.transaction).toHaveBeenCalled();
    });

    it('debe agregar al proyecto si la invitacion tiene projectId y projectRole', async () => {
      const projectInvitation = createMockProjectInvitation();
      invitationRepository.findOne.mockResolvedValue(projectInvitation);
      projectsService.addMemberByUserId.mockResolvedValue(undefined as any);

      await service.accept(projectInvitation.token, acceptingUser);

      expect(projectsService.addMemberByUserId).toHaveBeenCalledWith(
        projectInvitation.projectId,
        acceptingUser.id,
        projectInvitation.projectRole as ProjectRole,
      );
    });

    it('debe ignorar ConflictException al agregar a organizacion (ya miembro)', async () => {
      const invitation = createMockInvitation();
      invitationRepository.findOne.mockResolvedValue(invitation);
      organizationsService.addMember.mockRejectedValue(
        new ConflictException('El usuario ya es miembro'),
      );

      const result = await service.accept(invitation.token, acceptingUser);

      expect(result.message).toBe('Invitacion aceptada exitosamente');
    });

    it('debe ignorar ConflictException al agregar a proyecto (ya miembro)', async () => {
      const projectInvitation = createMockProjectInvitation();
      invitationRepository.findOne.mockResolvedValue(projectInvitation);
      projectsService.addMemberByUserId.mockRejectedValue(
        new ConflictException('Ya es miembro del proyecto'),
      );

      const result = await service.accept(
        projectInvitation.token,
        acceptingUser,
      );

      expect(result.message).toBe('Invitacion aceptada exitosamente');
    });

    it('debe propagar excepciones no-Conflict al agregar a organizacion', async () => {
      const invitation = createMockInvitation();
      invitationRepository.findOne.mockResolvedValue(invitation);
      organizationsService.addMember.mockRejectedValue(
        new ForbiddenException('Error inesperado'),
      );

      await expect(
        service.accept(invitation.token, acceptingUser),
      ).rejects.toThrow(ForbiddenException);
    });

    it('debe propagar excepciones no-Conflict al agregar a proyecto', async () => {
      const projectInvitation = createMockProjectInvitation();
      invitationRepository.findOne.mockResolvedValue(projectInvitation);
      projectsService.addMemberByUserId.mockRejectedValue(
        new BadRequestException('Error inesperado'),
      );

      await expect(
        service.accept(projectInvitation.token, acceptingUser),
      ).rejects.toThrow(BadRequestException);
    });

    it('debe lanzar NotFoundException si la invitacion no existe', async () => {
      invitationRepository.findOne.mockResolvedValue(null);

      await expect(
        service.accept('nonexistent-token', acceptingUser),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.accept('nonexistent-token', acceptingUser),
      ).rejects.toThrow('Invitacion no encontrada o ya fue utilizada');
    });

    it('debe lanzar NotFoundException si la invitacion ya fue aceptada (status != PENDING)', async () => {
      // findOne filters by PENDING status, so already-accepted returns null
      invitationRepository.findOne.mockResolvedValue(null);

      await expect(service.accept('some-token', acceptingUser)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('debe marcar como EXPIRED y lanzar BadRequestException si esta expirada', async () => {
      const expiredInvitation = createMockExpiredInvitation();
      invitationRepository.findOne.mockResolvedValue(expiredInvitation);

      await expect(
        service.accept(expiredInvitation.token, acceptingUser),
      ).rejects.toThrow(BadRequestException);

      const expiredInvitation2 = createMockExpiredInvitation();
      invitationRepository.findOne.mockResolvedValue(expiredInvitation2);

      await expect(
        service.accept(expiredInvitation2.token, acceptingUser),
      ).rejects.toThrow('La invitacion ha expirado');

      expect(invitationRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: InvitationStatus.EXPIRED }),
      );
    });

    it('debe lanzar BadRequestException si el email no coincide con el del usuario', async () => {
      const invitation = createMockInvitation();
      invitationRepository.findOne.mockResolvedValue(invitation);
      const wrongUser = {
        ...acceptingUser,
        email: 'wrong@example.com',
      } as User;

      await expect(service.accept(invitation.token, wrongUser)).rejects.toThrow(
        BadRequestException,
      );

      invitationRepository.findOne.mockResolvedValue(createMockInvitation());

      await expect(service.accept(invitation.token, wrongUser)).rejects.toThrow(
        'Esta invitacion no corresponde a tu email',
      );
    });

    it('debe cambiar el status de la invitacion a ACCEPTED dentro de la transaccion', async () => {
      const invitation = createMockInvitation();
      invitationRepository.findOne.mockResolvedValue(invitation);

      await service.accept(invitation.token, acceptingUser);

      const transactionCallback = mockDataSource.transaction.mock.calls[0][0];
      const mockManager = { save: jest.fn().mockResolvedValue(undefined) };
      await transactionCallback(mockManager);

      expect(mockManager.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: InvitationStatus.ACCEPTED }),
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // resend
  // ═══════════════════════════════════════════════════════════════════════

  describe('resend', () => {
    beforeEach(() => {
      invitationRepository.findOne.mockResolvedValue(createMockInvitation());
      invitationRepository.save.mockImplementation((inv) =>
        Promise.resolve(inv as any),
      );
      organizationsService.findById.mockResolvedValue(mockOrganization as any);
      organizationsService.getMemberRole.mockResolvedValue('admin');
      configService.get.mockReturnValue('http://localhost:3000');
      mockEmailService.sendInvitationEmail.mockResolvedValue({ success: true });
    });

    it('debe reenviar la invitacion y renovar expiracion', async () => {
      const invitation = createMockInvitation();
      invitationRepository.findOne.mockResolvedValue(invitation);
      const now = Date.now();

      const result = await service.resend(invitation.id, mockUser.id);

      expect(result.message).toContain(invitation.email);
      expect(invitationRepository.save).toHaveBeenCalled();
      const savedInvitation = invitationRepository.save.mock.calls[0][0] as any;
      const newExpiry = savedInvitation.expiresAt as Date;
      const diffDays = (newExpiry.getTime() - now) / (1000 * 60 * 60 * 24);
      expect(diffDays).toBeGreaterThanOrEqual(6.9);
      expect(diffDays).toBeLessThanOrEqual(7.1);
    });

    it('debe enviar email con los datos correctos', async () => {
      const invitation = createMockInvitation();
      invitationRepository.findOne.mockResolvedValue(invitation);

      await service.resend(invitation.id, mockUser.id);

      expect(mockEmailService.sendInvitationEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: invitation.email,
          organizationName: mockOrganization.name,
          role: invitation.role,
        }),
      );
    });

    it('debe incluir projectName en el email si la invitacion tiene projectId', async () => {
      const projectInvitation = createMockProjectInvitation();
      invitationRepository.findOne.mockResolvedValue(projectInvitation);
      projectsService.findById.mockResolvedValue(mockProject as any);
      organizationsService.getMemberRole.mockResolvedValue('admin');

      await service.resend(projectInvitation.id, mockUser.id);

      expect(mockEmailService.sendInvitationEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          projectName: mockProject.name,
          role: projectInvitation.projectRole,
        }),
      );
    });

    it('debe manejar proyecto eliminado al reenviar', async () => {
      const projectInvitation = createMockProjectInvitation();
      invitationRepository.findOne.mockResolvedValue(projectInvitation);
      projectsService.findById.mockRejectedValue(
        new NotFoundException('Proyecto no encontrado'),
      );
      organizationsService.getMemberRole.mockResolvedValue('admin');

      const result = await service.resend(projectInvitation.id, mockUser.id);

      expect(result.message).toBeDefined();
      expect(mockEmailService.sendInvitationEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          projectName: undefined,
        }),
      );
    });

    it('debe retornar mensaje de renovacion si el email no se pudo enviar', async () => {
      const invitation = createMockInvitation();
      invitationRepository.findOne.mockResolvedValue(invitation);
      mockEmailService.sendInvitationEmail.mockResolvedValue({
        success: false,
        error: 'SMTP error',
      });

      const result = await service.resend(invitation.id, mockUser.id);

      expect(result.message).toBe(
        'Invitacion renovada pero no se pudo enviar el email',
      );
    });

    it('debe lanzar NotFoundException si la invitacion no existe', async () => {
      invitationRepository.findOne.mockResolvedValue(null);

      await expect(
        service.resend('nonexistent-id', mockUser.id),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.resend('nonexistent-id', mockUser.id),
      ).rejects.toThrow('Invitacion no encontrada');
    });

    it('debe lanzar BadRequestException si la invitacion no esta PENDING', async () => {
      const acceptedInvitation = {
        ...createMockInvitation(),
        status: InvitationStatus.ACCEPTED,
      } as Invitation;
      invitationRepository.findOne.mockResolvedValue(acceptedInvitation);

      await expect(
        service.resend(acceptedInvitation.id, mockUser.id),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.resend(acceptedInvitation.id, mockUser.id),
      ).rejects.toThrow('Solo se pueden reenviar invitaciones pendientes');
    });

    it('debe lanzar ForbiddenException si el usuario no tiene autoridad', async () => {
      const invitation = createMockInvitation();
      invitationRepository.findOne.mockResolvedValue(invitation);
      organizationsService.getMemberRole.mockResolvedValue('member');

      await expect(service.resend(invitation.id, mockUser.id)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // cancel
  // ═══════════════════════════════════════════════════════════════════════

  describe('cancel', () => {
    beforeEach(() => {
      invitationRepository.findOne.mockResolvedValue(createMockInvitation());
      invitationRepository.save.mockImplementation((inv) =>
        Promise.resolve(inv as any),
      );
      organizationsService.getMemberRole.mockResolvedValue('admin');
    });

    it('debe cancelar la invitacion exitosamente', async () => {
      const invitation = createMockInvitation();
      invitationRepository.findOne.mockResolvedValue(invitation);

      await service.cancel(invitation.id, mockUser.id);

      expect(invitationRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: InvitationStatus.CANCELLED }),
      );
    });

    it('debe lanzar NotFoundException si la invitacion no existe', async () => {
      invitationRepository.findOne.mockResolvedValue(null);

      await expect(
        service.cancel('nonexistent-id', mockUser.id),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.cancel('nonexistent-id', mockUser.id),
      ).rejects.toThrow('Invitacion no encontrada');
    });

    it('debe lanzar ForbiddenException si el usuario no tiene autoridad', async () => {
      const invitation = createMockInvitation();
      invitationRepository.findOne.mockResolvedValue(invitation);
      organizationsService.getMemberRole.mockResolvedValue('member');

      await expect(service.cancel(invitation.id, mockUser.id)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('debe permitir a admin de org cancelar invitaciones', async () => {
      const invitation = createMockInvitation();
      invitationRepository.findOne.mockResolvedValue(invitation);
      organizationsService.getMemberRole.mockResolvedValue('admin');

      await service.cancel(invitation.id, mockUser.id);

      expect(invitationRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: InvitationStatus.CANCELLED }),
      );
    });

    it('debe permitir a owner de org cancelar invitaciones', async () => {
      const invitation = createMockInvitation();
      invitationRepository.findOne.mockResolvedValue(invitation);
      organizationsService.getMemberRole.mockResolvedValue('owner');

      await service.cancel(invitation.id, mockUser.id);

      expect(invitationRepository.save).toHaveBeenCalled();
    });

    it('debe permitir cancelar si el usuario es admin del proyecto asociado', async () => {
      const projectInvitation = createMockProjectInvitation();
      invitationRepository.findOne.mockResolvedValue(projectInvitation);
      organizationsService.getMemberRole.mockResolvedValue('member'); // not org admin
      projectsService.hasAdminAccess.mockResolvedValue(true); // but project admin

      await service.cancel(projectInvitation.id, mockUser.id);

      expect(invitationRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: InvitationStatus.CANCELLED }),
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // verifyInvitationAuthority (tested indirectly through resend/cancel)
  // ═══════════════════════════════════════════════════════════════════════

  describe('verifyInvitationAuthority (via cancel)', () => {
    beforeEach(() => {
      invitationRepository.findOne.mockResolvedValue(
        createMockProjectInvitation(),
      );
      invitationRepository.save.mockImplementation((inv) =>
        Promise.resolve(inv as any),
      );
    });

    it('debe permitir acceso si es admin/owner de la organizacion', async () => {
      const projectInvitation = createMockProjectInvitation();
      invitationRepository.findOne.mockResolvedValue(projectInvitation);
      organizationsService.getMemberRole.mockResolvedValue('owner');

      await expect(
        service.cancel(projectInvitation.id, mockUser.id),
      ).resolves.not.toThrow();
    });

    it('debe verificar acceso por proyecto si no es admin de org', async () => {
      const projectInvitation = createMockProjectInvitation();
      invitationRepository.findOne.mockResolvedValue(projectInvitation);
      organizationsService.getMemberRole.mockResolvedValue('member');
      projectsService.hasAdminAccess.mockResolvedValue(true);

      await expect(
        service.cancel(projectInvitation.id, mockUser.id),
      ).resolves.not.toThrow();

      expect(projectsService.hasAdminAccess).toHaveBeenCalledWith(
        projectInvitation.projectId,
        mockUser.id,
      );
    });

    it('debe lanzar ForbiddenException si no es admin de org ni de proyecto', async () => {
      const projectInvitation = createMockProjectInvitation();
      invitationRepository.findOne.mockResolvedValue(projectInvitation);
      organizationsService.getMemberRole.mockResolvedValue('member');
      projectsService.hasAdminAccess.mockResolvedValue(false);

      await expect(
        service.cancel(projectInvitation.id, mockUser.id),
      ).rejects.toThrow(ForbiddenException);

      invitationRepository.findOne.mockResolvedValue(
        createMockProjectInvitation(),
      );

      await expect(
        service.cancel(projectInvitation.id, mockUser.id),
      ).rejects.toThrow('No tienes permisos para gestionar esta invitación');
    });

    it('debe lanzar ForbiddenException si no tiene rol en la org y no hay proyecto', async () => {
      const invitation = createMockInvitation(); // no projectId
      invitationRepository.findOne.mockResolvedValue(invitation);
      organizationsService.getMemberRole.mockResolvedValue(null);

      await expect(service.cancel(invitation.id, mockUser.id)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('no debe verificar acceso de proyecto si no hay projectId', async () => {
      const invitation = createMockInvitation(); // projectId = null
      invitationRepository.findOne.mockResolvedValue(invitation);
      organizationsService.getMemberRole.mockResolvedValue('member');

      await expect(service.cancel(invitation.id, mockUser.id)).rejects.toThrow(
        ForbiddenException,
      );

      expect(projectsService.hasAdminAccess).not.toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // EmailService unavailable scenarios
  // ═══════════════════════════════════════════════════════════════════════

  describe('EmailService no disponible', () => {
    let serviceWithoutEmail: InvitationsService;
    let invRepoNoEmail: jest.Mocked<Repository<Invitation>>;

    beforeEach(async () => {
      const mockInvitationRepo = {
        findOne: jest.fn(),
        find: jest.fn(),
        create: jest.fn(),
        save: jest.fn(),
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          InvitationsService,
          {
            provide: getRepositoryToken(Invitation),
            useValue: mockInvitationRepo,
          },
          {
            provide: getRepositoryToken(User),
            useValue: { findOne: jest.fn() },
          },
          {
            provide: OrganizationsService,
            useValue: {
              findById: jest.fn().mockResolvedValue(mockOrganization),
              getMemberRole: jest.fn().mockResolvedValue('admin'),
            },
          },
          {
            provide: ProjectsService,
            useValue: {
              findById: jest.fn(),
              hasAdminAccess: jest.fn(),
              addMemberByUserId: jest.fn(),
            },
          },
          {
            provide: ConfigService,
            useValue: { get: jest.fn() },
          },
          {
            provide: DataSource,
            useValue: mockDataSource,
          },
          // NO EmailService provided
        ],
      }).compile();

      serviceWithoutEmail = module.get<InvitationsService>(InvitationsService);
      invRepoNoEmail = module.get(getRepositoryToken(Invitation));
    });

    it('debe crear invitacion correctamente sin EmailService', async () => {
      const createDto = { email: 'test@example.com' };
      invRepoNoEmail.findOne.mockResolvedValue(null);
      invRepoNoEmail.create.mockImplementation(
        (data) => ({ ...data, id: 'id' }) as any,
      );
      invRepoNoEmail.save.mockImplementation((inv) =>
        Promise.resolve(inv as any),
      );

      const result = await serviceWithoutEmail.create(
        mockOrganization.id,
        createDto as any,
        mockUser,
      );

      expect(result).toBeDefined();
      expect(invRepoNoEmail.save).toHaveBeenCalled();
    });

    it('debe manejar resend sin EmailService', async () => {
      const orgService = (serviceWithoutEmail as any).organizationsService;
      orgService.getMemberRole = jest.fn().mockResolvedValue('admin');
      orgService.findById = jest.fn().mockResolvedValue(mockOrganization);

      const invitation = createMockInvitation();
      invRepoNoEmail.findOne.mockResolvedValue(invitation);
      invRepoNoEmail.save.mockImplementation((inv) =>
        Promise.resolve(inv as any),
      );

      const result = await serviceWithoutEmail.resend(
        invitation.id,
        mockUser.id,
      );

      expect(result.message).toBe('Invitacion renovada (email no disponible)');
    });
  });
});
