import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ProjectsService } from './projects.service';
import { Project } from './entities/project.entity';
import { ProjectMember, ProjectRole } from './entities/project-member.entity';
import { CreateProjectDto, UpdateProjectDto, AddProjectMemberDto } from './dto';
import { User } from '../auth/entities/user.entity';

describe('ProjectsService', () => {
  let service: ProjectsService;
  let projectRepository: jest.Mocked<Repository<Project>>;
  let memberRepository: jest.Mocked<Repository<ProjectMember>>;
  let eventEmitter: jest.Mocked<EventEmitter2>;
  let dataSource: jest.Mocked<DataSource>;

  const mockUserId = '11111111-1111-1111-1111-111111111111';
  const mockProjectId = '22222222-2222-2222-2222-222222222222';
  const mockOrgId = '33333333-3333-3333-3333-333333333333';
  const mockMemberUserId = '44444444-4444-4444-4444-444444444444';

  const mockUser = {
    id: mockUserId,
    email: 'owner@test.com',
    firstName: 'Test',
    lastName: 'Owner',
    isSuperAdmin: jest.fn().mockReturnValue(false),
  } as unknown as User;

  const mockProject: Project = {
    id: mockProjectId,
    systemCode: 'PRJ-260328-A1B2',
    name: 'Test Project',
    slug: 'test-project-a1b2',
    description: 'Test description',
    color: '#3b82f6',
    ownerId: mockUserId,
    organizationId: null,
    parentId: null,
    parent: null,
    children: [],
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    generateSystemCode: jest.fn(),
  } as unknown as Project;

  const mockMember: ProjectMember = {
    id: '55555555-5555-5555-5555-555555555555',
    projectId: mockProjectId,
    userId: mockUserId,
    role: ProjectRole.OWNER,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as unknown as ProjectMember;

  beforeEach(async () => {
    const mockProjectRepository = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      find: jest.fn(),
      count: jest.fn(),
      softDelete: jest.fn(),
      createQueryBuilder: jest.fn(),
    };

    const mockMemberRepository = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      find: jest.fn(),
      delete: jest.fn(),
      remove: jest.fn(),
    };

    const mockDataSource = {
      transaction: jest.fn(),
      getRepository: jest.fn().mockReturnValue({
        findOne: jest.fn(),
      }),
    };

    const mockEventEmitter = {
      emit: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectsService,
        {
          provide: getRepositoryToken(Project),
          useValue: mockProjectRepository,
        },
        {
          provide: getRepositoryToken(ProjectMember),
          useValue: mockMemberRepository,
        },
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
        {
          provide: EventEmitter2,
          useValue: mockEventEmitter,
        },
      ],
    }).compile();

    service = module.get<ProjectsService>(ProjectsService);
    projectRepository = module.get(getRepositoryToken(Project));
    memberRepository = module.get(getRepositoryToken(ProjectMember));
    eventEmitter = module.get(EventEmitter2);
    dataSource = module.get(DataSource);
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  it('debe estar definido', () => {
    expect(service).toBeDefined();
  });

  // ─── create ───────────────────────────────────────────

  describe('create', () => {
    const createDto: CreateProjectDto = {
      name: 'Nuevo Proyecto',
      description: 'Descripcion del proyecto',
    };

    it('debe crear un proyecto personal con owner member en transaccion', async () => {
      (dataSource.transaction as jest.Mock).mockImplementation(async (cb) => {
        const manager = {
          create: jest.fn().mockImplementation((_Entity, data) => ({
            ...data,
            id: mockProjectId,
          })),
          save: jest.fn().mockImplementation((entity) =>
            Promise.resolve(entity),
          ),
        };
        return cb(manager);
      });

      const result = await service.create(createDto, mockUser);

      expect(dataSource.transaction).toHaveBeenCalled();
      expect(eventEmitter.emit).toHaveBeenCalledWith('project.created', {
        projectId: mockProjectId,
      });
      expect(result.id).toBe(mockProjectId);
      expect(result.ownerId).toBe(mockUserId);
    });

    it('debe crear un proyecto de organizacion', async () => {
      const orgDto: CreateProjectDto = {
        name: 'Org Project',
        organizationId: mockOrgId,
      };

      (dataSource.transaction as jest.Mock).mockImplementation(async (cb) => {
        const manager = {
          create: jest.fn().mockImplementation((_Entity, data) => ({
            ...data,
            id: mockProjectId,
          })),
          save: jest.fn().mockImplementation((entity) =>
            Promise.resolve(entity),
          ),
        };
        return cb(manager);
      });

      const result = await service.create(orgDto, mockUser);

      expect(result.organizationId).toBe(mockOrgId);
      expect(eventEmitter.emit).toHaveBeenCalledWith('project.created', {
        projectId: mockProjectId,
      });
    });

    it('debe crear sub-proyecto si el padre existe y no tiene padre', async () => {
      const parentProject = { ...mockProject, parentId: null };
      const childDto: CreateProjectDto = {
        name: 'Sub Proyecto',
        parentId: mockProjectId,
      };

      projectRepository.findOne.mockResolvedValue(parentProject as Project);
      memberRepository.findOne.mockResolvedValue(mockMember as ProjectMember);

      const savedChild = {
        ...mockProject,
        id: '66666666-6666-6666-6666-666666666666',
        name: childDto.name,
        parentId: mockProjectId,
      };

      (dataSource.transaction as jest.Mock).mockImplementation(async (cb) => {
        const manager = {
          create: jest.fn().mockImplementation((_Entity, data) => data),
          save: jest.fn().mockResolvedValue(savedChild),
        };
        return cb(manager);
      });

      const result = await service.create(childDto, mockUser);

      expect(result.parentId).toBe(mockProjectId);
    });

    it('debe lanzar NotFoundException si el proyecto padre no existe', async () => {
      const childDto: CreateProjectDto = {
        name: 'Sub Proyecto',
        parentId: mockProjectId,
      };

      projectRepository.findOne.mockResolvedValue(null);

      await expect(service.create(childDto, mockUser)).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.create(childDto, mockUser)).rejects.toThrow(
        'Proyecto padre no encontrado',
      );
    });

    it('debe lanzar BadRequestException si el padre ya tiene padre (profundidad > 2)', async () => {
      const parentWithParent = {
        ...mockProject,
        parentId: '99999999-9999-9999-9999-999999999999',
      };
      const childDto: CreateProjectDto = {
        name: 'Sub Sub Proyecto',
        parentId: mockProjectId,
      };

      projectRepository.findOne.mockResolvedValue(
        parentWithParent as Project,
      );

      await expect(service.create(childDto, mockUser)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.create(childDto, mockUser)).rejects.toThrow(
        '2 niveles',
      );
    });
  });

  // ─── findAll ──────────────────────────────────────────

  describe('findAll', () => {
    it('debe retornar los proyectos del usuario', async () => {
      const mockQb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([mockProject]),
      };
      projectRepository.createQueryBuilder.mockReturnValue(mockQb as any);

      const result = await service.findAll(mockUserId);

      expect(projectRepository.createQueryBuilder).toHaveBeenCalledWith('p');
      expect(result).toEqual([mockProject]);
      // default: isActive, user filter, parentId IS NULL
      expect(mockQb.where).toHaveBeenCalled();
      expect(mockQb.andWhere).toHaveBeenCalled();
    });

    it('debe filtrar por organizationId si se proporciona', async () => {
      const mockQb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };
      projectRepository.createQueryBuilder.mockReturnValue(mockQb as any);

      await service.findAll(mockUserId, mockOrgId);

      // Should have andWhere for organizationId
      expect(mockQb.andWhere).toHaveBeenCalledWith(
        'p.organizationId = :organizationId',
        { organizationId: mockOrgId },
      );
    });

    it('debe filtrar proyectos personales si personal=true', async () => {
      const mockQb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };
      projectRepository.createQueryBuilder.mockReturnValue(mockQb as any);

      await service.findAll(mockUserId, undefined, true);

      expect(mockQb.andWhere).toHaveBeenCalledWith(
        'p.organizationId IS NULL',
      );
    });

    it('debe incluir sub-proyectos si includeChildren=true', async () => {
      const mockQb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };
      projectRepository.createQueryBuilder.mockReturnValue(mockQb as any);

      await service.findAll(mockUserId, undefined, false, true);

      // Should NOT have parentId IS NULL filter
      const andWhereCalls = mockQb.andWhere.mock.calls.map((c) => c[0]);
      expect(andWhereCalls).not.toContain('p.parentId IS NULL');
    });
  });

  // ─── findById ─────────────────────────────────────────

  describe('findById', () => {
    it('debe retornar proyecto con meta (childCount) por UUID', async () => {
      const projectWithParent = { ...mockProject, parent: null };
      projectRepository.findOne.mockResolvedValue(
        projectWithParent as Project,
      );
      projectRepository.count.mockResolvedValue(2);

      const result = await service.findById(mockProjectId);

      expect(projectRepository.findOne).toHaveBeenCalledWith({
        where: { id: mockProjectId },
        relations: ['parent'],
      });
      expect(result.childCount).toBe(2);
      expect(result.parent).toBeNull();
    });

    it('debe retornar proyecto con parent ref si tiene padre', async () => {
      const parentRef = {
        id: '77777777-7777-7777-7777-777777777777',
        name: 'Parent Project',
        systemCode: 'PRJ-260328-P1P2',
      };
      const projectWithParent = { ...mockProject, parent: parentRef };
      projectRepository.findOne.mockResolvedValue(
        projectWithParent as unknown as Project,
      );
      projectRepository.count.mockResolvedValue(0);

      const result = await service.findById(mockProjectId);

      expect(result.parent).toEqual({
        id: parentRef.id,
        name: parentRef.name,
        systemCode: parentRef.systemCode,
      });
    });

    it('debe buscar por systemCode si no es UUID', async () => {
      const code = 'PRJ-260328-A1B2';
      projectRepository.findOne.mockResolvedValue({
        ...mockProject,
        parent: null,
      } as Project);
      projectRepository.count.mockResolvedValue(0);

      await service.findById(code);

      expect(projectRepository.findOne).toHaveBeenCalledWith({
        where: { systemCode: code },
        relations: ['parent'],
      });
    });

    it('debe lanzar NotFoundException si el proyecto no existe', async () => {
      projectRepository.findOne.mockResolvedValue(null);

      await expect(service.findById(mockProjectId)).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.findById(mockProjectId)).rejects.toThrow(
        'Proyecto no encontrado',
      );
    });
  });

  // ─── update ───────────────────────────────────────────

  describe('update', () => {
    const updateDto: UpdateProjectDto = {
      name: 'Proyecto Actualizado',
    };

    it('debe actualizar el proyecto exitosamente', async () => {
      projectRepository.findOne.mockResolvedValue({ ...mockProject } as Project);
      // verifyAdminAccess — needs member with admin/owner role
      memberRepository.findOne.mockResolvedValue(mockMember as ProjectMember);
      projectRepository.save.mockResolvedValue({
        ...mockProject,
        ...updateDto,
        slug: 'proyecto-actualizado-xxxx',
      } as Project);

      const result = await service.update(mockProjectId, updateDto, mockUserId);

      expect(projectRepository.save).toHaveBeenCalled();
      expect(result.name).toBe('Proyecto Actualizado');
    });

    it('debe lanzar NotFoundException si el proyecto no existe', async () => {
      projectRepository.findOne.mockResolvedValue(null);

      await expect(
        service.update(mockProjectId, updateDto, mockUserId),
      ).rejects.toThrow(NotFoundException);
    });

    it('debe lanzar ForbiddenException si no es admin del proyecto', async () => {
      projectRepository.findOne.mockResolvedValue({ ...mockProject } as Project);
      memberRepository.findOne.mockResolvedValue({
        ...mockMember,
        role: ProjectRole.MEMBER,
      } as ProjectMember);

      await expect(
        service.update(mockProjectId, updateDto, mockUserId),
      ).rejects.toThrow(ForbiddenException);
    });

    it('debe lanzar BadRequestException si parentId apunta a si mismo', async () => {
      projectRepository.findOne.mockResolvedValue({ ...mockProject } as Project);
      memberRepository.findOne.mockResolvedValue(mockMember as ProjectMember);

      await expect(
        service.update(
          mockProjectId,
          { parentId: mockProjectId },
          mockUserId,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ─── remove ───────────────────────────────────────────

  describe('remove', () => {
    it('debe eliminar el proyecto si es el dueno', async () => {
      projectRepository.findOne.mockResolvedValue({ ...mockProject } as Project);
      (dataSource.transaction as jest.Mock).mockImplementation(async (cb) => {
        const manager = {
          update: jest.fn().mockResolvedValue(undefined),
          softDelete: jest.fn().mockResolvedValue(undefined),
        };
        return cb(manager);
      });

      await service.remove(mockProjectId, mockUserId);

      expect(dataSource.transaction).toHaveBeenCalled();
    });

    it('debe lanzar NotFoundException si el proyecto no existe', async () => {
      projectRepository.findOne.mockResolvedValue(null);

      await expect(
        service.remove(mockProjectId, mockUserId),
      ).rejects.toThrow(NotFoundException);
    });

    it('debe lanzar ForbiddenException si no es el dueno', async () => {
      projectRepository.findOne.mockResolvedValue({
        ...mockProject,
        ownerId: 'otro-usuario-id',
      } as Project);

      await expect(
        service.remove(mockProjectId, mockUserId),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ─── addMember ────────────────────────────────────────

  describe('addMember', () => {
    const addMemberDto: AddProjectMemberDto = {
      userId: mockMemberUserId,
      role: ProjectRole.MEMBER,
    };

    it('debe agregar un miembro al proyecto', async () => {
      // findById internal
      projectRepository.findOne.mockResolvedValue({
        ...mockProject,
        parent: null,
      } as Project);
      projectRepository.count.mockResolvedValue(0);

      // verifyAdminAccess
      memberRepository.findOne
        .mockResolvedValueOnce(mockMember as ProjectMember) // hasAdminAccess
        .mockResolvedValueOnce(null); // existing member check

      const newMember = {
        ...mockMember,
        userId: mockMemberUserId,
        role: ProjectRole.MEMBER,
      };
      memberRepository.create.mockReturnValue(newMember as ProjectMember);
      memberRepository.save.mockResolvedValue(newMember as ProjectMember);

      // getMinimalUser for event
      (dataSource.getRepository as jest.Mock).mockReturnValue({
        findOne: jest.fn().mockResolvedValue({
          id: mockUserId,
          firstName: 'Test',
          lastName: 'Owner',
        }),
      });

      const result = await service.addMember(
        mockProjectId,
        addMemberDto,
        mockUserId,
      );

      expect(memberRepository.save).toHaveBeenCalled();
      expect(result.userId).toBe(mockMemberUserId);
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'project.member_added',
        expect.objectContaining({
          projectId: mockProjectId,
          addedUserId: mockMemberUserId,
        }),
      );
    });

    it('debe lanzar ConflictException si ya es miembro', async () => {
      // findById
      projectRepository.findOne.mockResolvedValue({
        ...mockProject,
        parent: null,
      } as Project);
      projectRepository.count.mockResolvedValue(0);

      // verifyAdminAccess + existing member check
      memberRepository.findOne
        .mockResolvedValueOnce(mockMember as ProjectMember) // hasAdminAccess
        .mockResolvedValueOnce({
          ...mockMember,
          userId: mockMemberUserId,
        } as ProjectMember); // existing: ya es miembro

      await expect(
        service.addMember(mockProjectId, addMemberDto, mockUserId),
      ).rejects.toThrow(ConflictException);
    });

    it('debe lanzar NotFoundException si el proyecto no existe', async () => {
      projectRepository.findOne.mockResolvedValue(null);

      await expect(
        service.addMember(mockProjectId, addMemberDto, mockUserId),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─── removeMember ─────────────────────────────────────

  describe('removeMember', () => {
    it('debe eliminar un miembro del proyecto', async () => {
      // findById
      projectRepository.findOne.mockResolvedValue({
        ...mockProject,
        parent: null,
      } as Project);
      projectRepository.count.mockResolvedValue(0);

      // verifyAdminAccess + find member to remove
      memberRepository.findOne
        .mockResolvedValueOnce(mockMember as ProjectMember) // hasAdminAccess
        .mockResolvedValueOnce({
          ...mockMember,
          id: '88888888-8888-8888-8888-888888888888',
          userId: mockMemberUserId,
          role: ProjectRole.MEMBER,
        } as ProjectMember); // member to remove

      memberRepository.remove.mockResolvedValue({} as any);

      // getMinimalUser for event
      (dataSource.getRepository as jest.Mock).mockReturnValue({
        findOne: jest.fn().mockResolvedValue({
          id: mockUserId,
          firstName: 'Test',
          lastName: 'Owner',
        }),
      });

      await service.removeMember(mockProjectId, mockMemberUserId, mockUserId);

      expect(memberRepository.remove).toHaveBeenCalled();
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'project.member_removed',
        expect.objectContaining({
          projectId: mockProjectId,
          removedUserId: mockMemberUserId,
        }),
      );
    });

    it('debe lanzar NotFoundException si el miembro no existe', async () => {
      // findById
      projectRepository.findOne.mockResolvedValue({
        ...mockProject,
        parent: null,
      } as Project);
      projectRepository.count.mockResolvedValue(0);

      // verifyAdminAccess + member not found
      memberRepository.findOne
        .mockResolvedValueOnce(mockMember as ProjectMember) // hasAdminAccess
        .mockResolvedValueOnce(null); // member not found

      await expect(
        service.removeMember(mockProjectId, mockMemberUserId, mockUserId),
      ).rejects.toThrow(NotFoundException);
    });

    it('debe lanzar ForbiddenException al intentar eliminar al owner', async () => {
      // findById
      projectRepository.findOne.mockResolvedValue({
        ...mockProject,
        parent: null,
      } as Project);
      projectRepository.count.mockResolvedValue(0);

      // verifyAdminAccess + find owner member
      memberRepository.findOne
        .mockResolvedValueOnce(mockMember as ProjectMember) // hasAdminAccess
        .mockResolvedValueOnce({
          ...mockMember,
          role: ProjectRole.OWNER,
        } as ProjectMember); // member is owner

      await expect(
        service.removeMember(mockProjectId, mockUserId, mockUserId),
      ).rejects.toThrow(
        'No se puede eliminar al dueno del proyecto',
      );
    });
  });

  // ─── getMembers ───────────────────────────────────────

  describe('getMembers', () => {
    it('debe retornar los miembros del proyecto con info de usuario', async () => {
      // findById internal
      projectRepository.findOne.mockResolvedValue({
        ...mockProject,
        parent: null,
      } as Project);
      projectRepository.count.mockResolvedValue(0);

      const members = [
        { ...mockMember, user: { firstName: 'Test', lastName: 'Owner' } },
      ];
      memberRepository.find.mockResolvedValue(
        members as unknown as ProjectMember[],
      );

      const result = await service.getMembers(mockProjectId);

      expect(memberRepository.find).toHaveBeenCalledWith({
        where: { projectId: mockProjectId },
        relations: ['user'],
        order: { createdAt: 'ASC' },
      });
      expect(result).toEqual(members);
    });
  });

  // ─── getMemberRole ────────────────────────────────────

  describe('getMemberRole', () => {
    it('debe retornar el rol del usuario en el proyecto', async () => {
      memberRepository.findOne.mockResolvedValue(mockMember as ProjectMember);

      const result = await service.getMemberRole(mockProjectId, mockUserId);

      expect(result).toBe(ProjectRole.OWNER);
      expect(memberRepository.findOne).toHaveBeenCalledWith({
        where: { projectId: mockProjectId, userId: mockUserId },
      });
    });

    it('debe retornar null si el usuario no es miembro', async () => {
      memberRepository.findOne.mockResolvedValue(null);

      const result = await service.getMemberRole(mockProjectId, mockUserId);

      expect(result).toBeNull();
    });
  });

  // ─── verifyMemberAccess ───────────────────────────────

  describe('verifyMemberAccess', () => {
    it('debe permitir acceso si el usuario es miembro', async () => {
      memberRepository.findOne.mockResolvedValue(mockMember as ProjectMember);

      await expect(
        service.verifyMemberAccess(mockProjectId, mockUserId),
      ).resolves.toBeUndefined();
    });

    it('debe lanzar ForbiddenException si no es miembro', async () => {
      memberRepository.findOne.mockResolvedValue(null);

      await expect(
        service.verifyMemberAccess(mockProjectId, mockUserId),
      ).rejects.toThrow(ForbiddenException);
      await expect(
        service.verifyMemberAccess(mockProjectId, mockUserId),
      ).rejects.toThrow('No tienes acceso');
    });

    it('debe permitir acceso si es super admin (bypass)', async () => {
      // No se consulta el repositorio para super admin
      await expect(
        service.verifyMemberAccess(mockProjectId, mockUserId, true),
      ).resolves.toBeUndefined();

      expect(memberRepository.findOne).not.toHaveBeenCalled();
    });
  });

  // ─── findChildren ─────────────────────────────────────

  describe('findChildren', () => {
    it('debe retornar los sub-proyectos del proyecto padre', async () => {
      const children = [
        { ...mockProject, id: 'child-1', parentId: mockProjectId },
        { ...mockProject, id: 'child-2', parentId: mockProjectId },
      ];

      projectRepository.findOne.mockResolvedValue(mockProject as Project);
      projectRepository.find.mockResolvedValue(children as Project[]);

      const result = await service.findChildren(mockProjectId);

      expect(projectRepository.find).toHaveBeenCalledWith({
        where: { parentId: mockProjectId, isActive: true },
        order: { createdAt: 'ASC' },
      });
      expect(result).toHaveLength(2);
    });

    it('debe lanzar NotFoundException si el proyecto padre no existe', async () => {
      projectRepository.findOne.mockResolvedValue(null);

      await expect(service.findChildren(mockProjectId)).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.findChildren(mockProjectId)).rejects.toThrow(
        'Proyecto padre no encontrado',
      );
    });
  });

  // ─── findBySlug ───────────────────────────────────────

  describe('findBySlug', () => {
    it('debe retornar el proyecto por slug', async () => {
      projectRepository.findOne.mockResolvedValue(mockProject as Project);

      const result = await service.findBySlug('test-project-a1b2');

      expect(projectRepository.findOne).toHaveBeenCalledWith({
        where: { slug: 'test-project-a1b2' },
      });
      expect(result).toEqual(mockProject);
    });

    it('debe lanzar NotFoundException si el slug no existe', async () => {
      projectRepository.findOne.mockResolvedValue(null);

      await expect(service.findBySlug('no-existe')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ─── isMember ─────────────────────────────────────────

  describe('isMember', () => {
    it('debe retornar true si el usuario es miembro', async () => {
      memberRepository.findOne.mockResolvedValue(mockMember as ProjectMember);

      const result = await service.isMember(mockProjectId, mockUserId);

      expect(result).toBe(true);
    });

    it('debe retornar false si el usuario no es miembro', async () => {
      memberRepository.findOne.mockResolvedValue(null);

      const result = await service.isMember(mockProjectId, mockUserId);

      expect(result).toBe(false);
    });
  });

  // ─── hasAdminAccess ───────────────────────────────────

  describe('hasAdminAccess', () => {
    it('debe retornar true si el usuario es owner', async () => {
      memberRepository.findOne.mockResolvedValue(mockMember as ProjectMember);

      const result = await service.hasAdminAccess(mockProjectId, mockUserId);

      expect(result).toBe(true);
    });

    it('debe retornar true si el usuario es admin', async () => {
      memberRepository.findOne.mockResolvedValue({
        ...mockMember,
        role: ProjectRole.ADMIN,
      } as ProjectMember);

      const result = await service.hasAdminAccess(mockProjectId, mockUserId);

      expect(result).toBe(true);
    });

    it('debe retornar false si el usuario es member (no admin)', async () => {
      memberRepository.findOne.mockResolvedValue({
        ...mockMember,
        role: ProjectRole.MEMBER,
      } as ProjectMember);

      const result = await service.hasAdminAccess(mockProjectId, mockUserId);

      expect(result).toBe(false);
    });

    it('debe retornar false si el usuario no es miembro', async () => {
      memberRepository.findOne.mockResolvedValue(null);

      const result = await service.hasAdminAccess(mockProjectId, mockUserId);

      expect(result).toBe(false);
    });
  });
});
