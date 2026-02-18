import {
  Injectable, Logger, NotFoundException, ConflictException, ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Project } from './entities/project.entity';
import { ProjectMember, ProjectRole } from './entities/project-member.entity';
import { CreateProjectDto, UpdateProjectDto, AddProjectMemberDto } from './dto';
import { User } from '../auth/entities/user.entity';

@Injectable()
export class ProjectsService {
  private readonly logger = new Logger(ProjectsService.name);

  constructor(
    @InjectRepository(Project)
    private readonly projectRepository: Repository<Project>,
    @InjectRepository(ProjectMember)
    private readonly memberRepository: Repository<ProjectMember>,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async create(dto: CreateProjectDto, user: User): Promise<Project> {
    const slug = this.generateSlug(dto.name);

    const project = this.projectRepository.create({
      ...dto,
      slug,
      ownerId: user.id,
      organizationId: dto.organizationId || null,
    });
    await this.projectRepository.save(project);

    // Creador es OWNER
    const member = this.memberRepository.create({
      projectId: project.id,
      userId: user.id,
      role: ProjectRole.OWNER,
    });
    await this.memberRepository.save(member);

    // Emitir evento para crear task statuses default
    this.eventEmitter.emit('project.created', { projectId: project.id });

    this.logger.log(`Proyecto creado: ${project.name} por ${user.email}`);
    return project;
  }

  async findAll(userId: string, organizationId?: string, personal?: boolean): Promise<Project[]> {
    const qb = this.projectRepository.createQueryBuilder('p')
      .leftJoin('project_members', 'pm', 'pm.projectId = p.id')
      .where('p.isActive = :isActive', { isActive: true })
      .andWhere('(p.ownerId = :userId OR pm.userId = :userId)', { userId });

    if (organizationId) {
      qb.andWhere('p.organizationId = :organizationId', { organizationId });
    } else if (personal) {
      qb.andWhere('p.organizationId IS NULL');
    }

    return qb.orderBy('p.createdAt', 'DESC').getMany();
  }

  async findById(id: string): Promise<Project> {
    const project = await this.projectRepository.findOne({ where: { id } });
    if (!project) throw new NotFoundException('Proyecto no encontrado');
    return project;
  }

  async findBySlug(slug: string): Promise<Project> {
    const project = await this.projectRepository.findOne({ where: { slug } });
    if (!project) throw new NotFoundException('Proyecto no encontrado');
    return project;
  }

  async update(id: string, dto: UpdateProjectDto, userId: string): Promise<Project> {
    const project = await this.findById(id);
    await this.verifyAdminAccess(id, userId);

    if (dto.name && dto.name !== project.name) {
      project.slug = this.generateSlug(dto.name);
    }

    Object.assign(project, dto);
    return this.projectRepository.save(project);
  }

  async remove(id: string, userId: string): Promise<void> {
    const project = await this.findById(id);
    if (project.ownerId !== userId) {
      throw new ForbiddenException('Solo el dueno puede eliminar el proyecto');
    }
    await this.projectRepository.softDelete(id);
  }

  async getMembers(projectId: string): Promise<ProjectMember[]> {
    await this.findById(projectId);
    return this.memberRepository.find({
      where: { projectId },
      order: { createdAt: 'ASC' },
    });
  }

  async addMember(projectId: string, dto: AddProjectMemberDto, requestUserId: string): Promise<ProjectMember> {
    await this.findById(projectId);
    await this.verifyAdminAccess(projectId, requestUserId);

    const existing = await this.memberRepository.findOne({
      where: { projectId, userId: dto.userId },
    });
    if (existing) throw new ConflictException('El usuario ya es miembro del proyecto');

    const member = this.memberRepository.create({ projectId, ...dto });
    return this.memberRepository.save(member);
  }

  async removeMember(projectId: string, userId: string, requestUserId: string): Promise<void> {
    await this.verifyAdminAccess(projectId, requestUserId);
    const member = await this.memberRepository.findOne({
      where: { projectId, userId },
    });
    if (!member) throw new NotFoundException('Miembro no encontrado');
    if (member.role === ProjectRole.OWNER) {
      throw new ForbiddenException('No se puede eliminar al dueno del proyecto');
    }
    await this.memberRepository.remove(member);
  }

  private async verifyAdminAccess(projectId: string, userId: string): Promise<void> {
    const member = await this.memberRepository.findOne({
      where: { projectId, userId },
    });
    if (!member || (member.role !== ProjectRole.OWNER && member.role !== ProjectRole.ADMIN)) {
      throw new ForbiddenException('No tienes permisos de administrador en este proyecto');
    }
  }

  private generateSlug(name: string): string {
    const base = name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    const suffix = Math.random().toString(36).substring(2, 6);
    return `${base}-${suffix}`;
  }
}
