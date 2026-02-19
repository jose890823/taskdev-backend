import {
  Injectable, Logger, NotFoundException, ConflictException, ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Organization } from './entities/organization.entity';
import { OrganizationMember, OrganizationRole } from './entities/organization-member.entity';
import { CreateOrganizationDto, UpdateOrganizationDto, AddMemberDto } from './dto';
import { User } from '../auth/entities/user.entity';

@Injectable()
export class OrganizationsService {
  private readonly logger = new Logger(OrganizationsService.name);

  constructor(
    @InjectRepository(Organization)
    private readonly orgRepository: Repository<Organization>,
    @InjectRepository(OrganizationMember)
    private readonly memberRepository: Repository<OrganizationMember>,
  ) {}

  async create(dto: CreateOrganizationDto, user: User): Promise<Organization> {
    const slug = this.generateSlug(dto.name);

    const existing = await this.orgRepository.findOne({ where: { slug } });
    if (existing) {
      throw new ConflictException('Ya existe una organizacion con ese nombre');
    }

    const org = this.orgRepository.create({
      ...dto,
      slug,
      ownerId: user.id,
    });
    await this.orgRepository.save(org);

    const member = this.memberRepository.create({
      organizationId: org.id,
      userId: user.id,
      role: OrganizationRole.OWNER,
    });
    await this.memberRepository.save(member);

    this.logger.log(`Organizacion creada: ${org.name} por ${user.email}`);
    return org;
  }

  async findAll(userId: string): Promise<Organization[]> {
    const memberships = await this.memberRepository.find({ where: { userId } });
    if (memberships.length === 0) return [];

    const orgIds = memberships.map((m) => m.organizationId);
    return this.orgRepository
      .createQueryBuilder('org')
      .where('org.id IN (:...orgIds)', { orgIds })
      .andWhere('org.isActive = :isActive', { isActive: true })
      .orderBy('org.createdAt', 'DESC')
      .getMany();
  }

  async findAllAdmin(): Promise<Organization[]> {
    return this.orgRepository.find({ order: { createdAt: 'DESC' } });
  }

  async findById(id: string): Promise<Organization> {
    const org = await this.orgRepository.findOne({ where: { id } });
    if (!org) throw new NotFoundException('Organizacion no encontrada');
    return org;
  }

  async update(id: string, dto: UpdateOrganizationDto, userId: string): Promise<Organization> {
    const org = await this.findById(id);
    await this.verifyAdminAccess(id, userId);

    if (dto.name && dto.name !== org.name) {
      const slug = this.generateSlug(dto.name);
      const existing = await this.orgRepository.findOne({ where: { slug } });
      if (existing && existing.id !== id) {
        throw new ConflictException('Ya existe una organizacion con ese nombre');
      }
      (org as any).slug = slug;
    }

    Object.assign(org, dto);
    return this.orgRepository.save(org);
  }

  async remove(id: string, userId: string): Promise<void> {
    const org = await this.findById(id);
    if (org.ownerId !== userId) {
      throw new ForbiddenException('Solo el dueno puede eliminar la organizacion');
    }
    await this.orgRepository.softDelete(id);
  }

  async getMembers(organizationId: string): Promise<OrganizationMember[]> {
    await this.findById(organizationId);
    return this.memberRepository.find({
      where: { organizationId },
      relations: ['user'],
      order: { createdAt: 'ASC' },
    });
  }

  async getMemberRole(organizationId: string, userId: string): Promise<string | null> {
    const member = await this.memberRepository.findOne({
      where: { organizationId, userId },
    });
    return member?.role || null;
  }

  async addMember(organizationId: string, dto: AddMemberDto, requestUserId: string): Promise<OrganizationMember> {
    await this.findById(organizationId);
    await this.verifyAdminAccess(organizationId, requestUserId);

    const existing = await this.memberRepository.findOne({
      where: { organizationId, userId: dto.userId },
    });
    if (existing) throw new ConflictException('El usuario ya es miembro');

    const member = this.memberRepository.create({
      organizationId,
      userId: dto.userId,
      role: dto.role,
    });
    return this.memberRepository.save(member);
  }

  async removeMember(organizationId: string, userId: string, requestUserId: string): Promise<void> {
    await this.verifyAdminAccess(organizationId, requestUserId);
    const member = await this.memberRepository.findOne({
      where: { organizationId, userId },
    });
    if (!member) throw new NotFoundException('Miembro no encontrado');
    if (member.role === OrganizationRole.OWNER) {
      throw new ForbiddenException('No se puede eliminar al dueno');
    }
    await this.memberRepository.remove(member);
  }

  async isMember(organizationId: string, userId: string): Promise<boolean> {
    const member = await this.memberRepository.findOne({
      where: { organizationId, userId },
    });
    return !!member;
  }

  private async verifyAdminAccess(organizationId: string, userId: string): Promise<void> {
    const member = await this.memberRepository.findOne({
      where: { organizationId, userId },
    });
    if (!member || (member.role !== OrganizationRole.OWNER && member.role !== OrganizationRole.ADMIN)) {
      throw new ForbiddenException('No tienes permisos de administrador en esta organizacion');
    }
  }

  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }
}
