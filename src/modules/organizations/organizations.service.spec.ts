import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  ConflictException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { Repository, DataSource } from 'typeorm';
import { OrganizationsService } from './organizations.service';
import { Organization } from './entities/organization.entity';
import {
  OrganizationMember,
  OrganizationRole,
} from './entities/organization-member.entity';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { AddMemberDto } from './dto/add-member.dto';
import { User } from '../auth/entities/user.entity';

describe('OrganizationsService', () => {
  let service: OrganizationsService;
  let orgRepository: jest.Mocked<Repository<Organization>>;
  let memberRepository: jest.Mocked<Repository<OrganizationMember>>;
  let _dataSource: jest.Mocked<DataSource>;

  const mockUser = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    email: 'test@example.com',
    firstName: 'Test',
    lastName: 'User',
  } as User;

  const mockOrg: Organization = {
    id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    systemCode: 'ORG-260218-X1Y2',
    name: 'Acme Corp',
    slug: 'acme-corp',
    description: 'Empresa de tecnologia',
    logo: null,
    ownerId: mockUser.id,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    generateSystemCode: jest.fn(),
  } as unknown as Organization;

  const mockMember: OrganizationMember = {
    id: 'member-uuid-1',
    organizationId: mockOrg.id,
    userId: mockUser.id,
    role: OrganizationRole.OWNER,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as unknown as OrganizationMember;

  const mockDataSource = {
    transaction: jest.fn().mockImplementation(async (cb) => {
      const mockManager = {
        save: jest.fn().mockImplementation((entity) => Promise.resolve(entity)),
        create: jest.fn().mockImplementation((_EntityClass, data) => data),
      };
      return cb(mockManager);
    }),
  };

  beforeEach(async () => {
    const mockOrgRepository = {
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      softDelete: jest.fn(),
      createQueryBuilder: jest.fn(),
    };

    const mockMemberRepository = {
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      remove: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrganizationsService,
        {
          provide: getRepositoryToken(Organization),
          useValue: mockOrgRepository,
        },
        {
          provide: getRepositoryToken(OrganizationMember),
          useValue: mockMemberRepository,
        },
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
      ],
    }).compile();

    service = module.get<OrganizationsService>(OrganizationsService);
    orgRepository = module.get(getRepositoryToken(Organization));
    memberRepository = module.get(getRepositoryToken(OrganizationMember));
    _dataSource = module.get(DataSource);
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  describe('create', () => {
    const createDto: CreateOrganizationDto = {
      name: 'Acme Corp',
      description: 'Empresa de tecnologia',
    };

    it('debe crear una organizacion y agregar al owner como miembro', async () => {
      orgRepository.findOne.mockResolvedValue(null);

      const result = await service.create(createDto, mockUser);

      expect(orgRepository.findOne).toHaveBeenCalledWith({
        where: { slug: 'acme-corp' },
      });
      expect(mockDataSource.transaction).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('debe lanzar ConflictException si ya existe una organizacion con ese slug', async () => {
      orgRepository.findOne.mockResolvedValue(mockOrg);

      await expect(service.create(createDto, mockUser)).rejects.toThrow(
        ConflictException,
      );
      await expect(service.create(createDto, mockUser)).rejects.toThrow(
        'Ya existe una organizacion con ese nombre',
      );
    });
  });

  describe('findAll', () => {
    it('debe retornar las organizaciones del usuario', async () => {
      memberRepository.find.mockResolvedValue([mockMember]);

      const mockQb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([mockOrg]),
      };
      orgRepository.createQueryBuilder.mockReturnValue(mockQb as any);

      const result = await service.findAll(mockUser.id);

      expect(memberRepository.find).toHaveBeenCalledWith({
        where: { userId: mockUser.id },
      });
      expect(result).toEqual([mockOrg]);
    });

    it('debe retornar array vacio si el usuario no tiene membresías', async () => {
      memberRepository.find.mockResolvedValue([]);

      const result = await service.findAll(mockUser.id);

      expect(result).toEqual([]);
    });
  });

  describe('findById', () => {
    it('debe retornar la organizacion si existe (por UUID)', async () => {
      orgRepository.findOne.mockResolvedValue(mockOrg);

      const result = await service.findById(mockOrg.id);

      expect(orgRepository.findOne).toHaveBeenCalledWith({
        where: { id: mockOrg.id },
      });
      expect(result).toEqual(mockOrg);
    });

    it('debe buscar por systemCode si no es UUID', async () => {
      orgRepository.findOne.mockResolvedValue(mockOrg);

      const result = await service.findById('ORG-260218-X1Y2');

      expect(orgRepository.findOne).toHaveBeenCalledWith({
        where: { systemCode: 'ORG-260218-X1Y2' },
      });
      expect(result).toEqual(mockOrg);
    });

    it('debe lanzar NotFoundException si la organizacion no existe', async () => {
      orgRepository.findOne.mockResolvedValue(null);

      await expect(service.findById('non-existent-uuid')).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.findById('non-existent-uuid')).rejects.toThrow(
        'Organizacion no encontrada',
      );
    });
  });

  describe('update', () => {
    const updateDto: UpdateOrganizationDto = { name: 'New Name' };

    it('debe actualizar la organizacion correctamente', async () => {
      // findById
      orgRepository.findOne.mockResolvedValueOnce(mockOrg);
      // verifyAdminAccess
      memberRepository.findOne.mockResolvedValueOnce(mockMember);
      // slug check (new name → new slug doesn't conflict)
      orgRepository.findOne.mockResolvedValueOnce(null);
      // save
      orgRepository.save.mockResolvedValue({ ...mockOrg, ...updateDto });

      const result = await service.update(mockOrg.id, updateDto, mockUser.id);

      expect(result.name).toBe('New Name');
      expect(orgRepository.save).toHaveBeenCalled();
    });

    it('debe lanzar NotFoundException si la organizacion no existe', async () => {
      orgRepository.findOne.mockResolvedValue(null);

      await expect(
        service.update('non-existent', updateDto, mockUser.id),
      ).rejects.toThrow(NotFoundException);
    });

    it('debe lanzar ConflictException si el nuevo slug ya existe en otra org', async () => {
      // Return a fresh copy to avoid mutation from previous tests
      const freshOrg = { ...mockOrg, name: 'Acme Corp', slug: 'acme-corp' };
      // findById
      orgRepository.findOne.mockResolvedValueOnce(freshOrg as Organization);
      // verifyAdminAccess
      memberRepository.findOne.mockResolvedValueOnce(mockMember);
      // slug check: returns a DIFFERENT org with same slug
      const otherOrg = {
        ...mockOrg,
        id: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
      };
      orgRepository.findOne.mockResolvedValueOnce(otherOrg as Organization);

      await expect(
        service.update(mockOrg.id, updateDto, mockUser.id),
      ).rejects.toThrow(ConflictException);
    });

    it('debe lanzar ForbiddenException si el usuario no es admin/owner', async () => {
      // findById
      orgRepository.findOne.mockResolvedValueOnce(mockOrg);
      // verifyAdminAccess — user is just a member
      memberRepository.findOne.mockResolvedValueOnce({
        ...mockMember,
        role: OrganizationRole.MEMBER,
      } as OrganizationMember);

      await expect(
        service.update(mockOrg.id, updateDto, mockUser.id),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('remove', () => {
    it('debe eliminar la organizacion si el usuario es el owner', async () => {
      orgRepository.findOne.mockResolvedValue(mockOrg);
      orgRepository.softDelete.mockResolvedValue({ affected: 1 } as any);

      await service.remove(mockOrg.id, mockUser.id);

      expect(orgRepository.softDelete).toHaveBeenCalledWith(mockOrg.id);
    });

    it('debe lanzar NotFoundException si la organizacion no existe', async () => {
      orgRepository.findOne.mockResolvedValue(null);

      await expect(service.remove('non-existent', mockUser.id)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('debe lanzar ForbiddenException si el usuario no es el owner', async () => {
      orgRepository.findOne.mockResolvedValue(mockOrg);

      await expect(
        service.remove(mockOrg.id, 'another-user-id'),
      ).rejects.toThrow(ForbiddenException);
      await expect(
        service.remove(mockOrg.id, 'another-user-id'),
      ).rejects.toThrow('Solo el dueno puede eliminar la organizacion');
    });
  });

  describe('addMember', () => {
    const addMemberDto: AddMemberDto = {
      userId: 'new-user-uuid',
      role: OrganizationRole.MEMBER,
    };

    it('debe agregar un nuevo miembro correctamente', async () => {
      // findById
      orgRepository.findOne.mockResolvedValue(mockOrg);
      // verifyAdminAccess
      memberRepository.findOne.mockResolvedValueOnce(mockMember);
      // check existing member — not found
      memberRepository.findOne.mockResolvedValueOnce(null);
      // create + save
      const newMember = {
        id: 'new-member-uuid',
        organizationId: mockOrg.id,
        ...addMemberDto,
      };
      memberRepository.create.mockReturnValue(newMember as any);
      memberRepository.save.mockResolvedValue(newMember as any);

      const result = await service.addMember(
        mockOrg.id,
        addMemberDto,
        mockUser.id,
      );

      expect(result).toEqual(newMember);
      expect(memberRepository.save).toHaveBeenCalled();
    });

    it('debe lanzar ConflictException si el usuario ya es miembro', async () => {
      // findById
      orgRepository.findOne.mockResolvedValue(mockOrg);
      // verifyAdminAccess (call 1) → owner, existing member check (call 2) → found
      memberRepository.findOne
        .mockResolvedValueOnce(mockMember) // verifyAdminAccess
        .mockResolvedValueOnce(mockMember); // existing member check

      await expect(
        service.addMember(mockOrg.id, addMemberDto, mockUser.id),
      ).rejects.toThrow('El usuario ya es miembro');
    });
  });

  describe('removeMember', () => {
    const memberToRemove = {
      id: 'member-to-remove',
      organizationId: mockOrg.id,
      userId: 'user-to-remove',
      role: OrganizationRole.MEMBER,
    } as OrganizationMember;

    it('debe eliminar un miembro correctamente', async () => {
      // findById
      orgRepository.findOne.mockResolvedValue(mockOrg);
      // verifyAdminAccess
      memberRepository.findOne.mockResolvedValueOnce(mockMember);
      // find member to remove
      memberRepository.findOne.mockResolvedValueOnce(memberToRemove);
      memberRepository.remove.mockResolvedValue(memberToRemove);

      await service.removeMember(
        mockOrg.id,
        memberToRemove.userId,
        mockUser.id,
      );

      expect(memberRepository.remove).toHaveBeenCalledWith(memberToRemove);
    });

    it('debe lanzar NotFoundException si el miembro no existe', async () => {
      // findById
      orgRepository.findOne.mockResolvedValue(mockOrg);
      // verifyAdminAccess → owner, find member → not found
      memberRepository.findOne
        .mockResolvedValueOnce(mockMember) // verifyAdminAccess
        .mockResolvedValueOnce(null); // member lookup

      await expect(
        service.removeMember(mockOrg.id, 'non-existent', mockUser.id),
      ).rejects.toThrow('Miembro no encontrado');
    });

    it('debe lanzar ForbiddenException si se intenta eliminar al owner', async () => {
      const ownerMember = {
        ...mockMember,
        role: OrganizationRole.OWNER,
      } as OrganizationMember;

      // findById
      orgRepository.findOne.mockResolvedValue(mockOrg);
      // verifyAdminAccess → owner, find member → the owner
      memberRepository.findOne
        .mockResolvedValueOnce(mockMember) // verifyAdminAccess
        .mockResolvedValueOnce(ownerMember); // member lookup

      await expect(
        service.removeMember(mockOrg.id, mockUser.id, mockUser.id),
      ).rejects.toThrow('No se puede eliminar al dueno');
    });
  });

  describe('getMembers', () => {
    it('debe retornar la lista de miembros de la organizacion', async () => {
      // findById
      orgRepository.findOne.mockResolvedValue(mockOrg);
      memberRepository.find.mockResolvedValue([mockMember]);

      const result = await service.getMembers(mockOrg.id);

      expect(result).toEqual([mockMember]);
      expect(memberRepository.find).toHaveBeenCalledWith({
        where: { organizationId: mockOrg.id },
        relations: ['user'],
        order: { createdAt: 'ASC' },
      });
    });
  });

  describe('getMemberRole', () => {
    it('debe retornar el rol del miembro', async () => {
      memberRepository.findOne.mockResolvedValue(mockMember);

      const result = await service.getMemberRole(mockOrg.id, mockUser.id);

      expect(result).toBe(OrganizationRole.OWNER);
    });

    it('debe retornar null si el usuario no es miembro', async () => {
      memberRepository.findOne.mockResolvedValue(null);

      const result = await service.getMemberRole(mockOrg.id, 'unknown-user');

      expect(result).toBeNull();
    });
  });

  describe('isMember', () => {
    it('debe retornar true si el usuario es miembro', async () => {
      memberRepository.findOne.mockResolvedValue(mockMember);

      const result = await service.isMember(mockOrg.id, mockUser.id);

      expect(result).toBe(true);
    });

    it('debe retornar false si el usuario no es miembro', async () => {
      memberRepository.findOne.mockResolvedValue(null);

      const result = await service.isMember(mockOrg.id, 'unknown-user');

      expect(result).toBe(false);
    });
  });

  describe('verifyMemberAccess', () => {
    it('debe permitir acceso si el usuario es miembro', async () => {
      memberRepository.findOne.mockResolvedValue(mockMember);

      await expect(
        service.verifyMemberAccess(mockOrg.id, mockUser.id),
      ).resolves.not.toThrow();
    });

    it('debe permitir acceso directo si es super admin', async () => {
      await expect(
        service.verifyMemberAccess(mockOrg.id, 'any-user', true),
      ).resolves.not.toThrow();

      expect(memberRepository.findOne).not.toHaveBeenCalled();
    });

    it('debe lanzar ForbiddenException si el usuario no es miembro', async () => {
      memberRepository.findOne.mockResolvedValue(null);

      await expect(
        service.verifyMemberAccess(mockOrg.id, 'unknown-user'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('findAllAdmin', () => {
    it('debe retornar todas las organizaciones (admin)', async () => {
      orgRepository.find.mockResolvedValue([mockOrg]);

      const result = await service.findAllAdmin();

      expect(orgRepository.find).toHaveBeenCalledWith({
        order: { createdAt: 'DESC' },
      });
      expect(result).toEqual([mockOrg]);
    });
  });
});
