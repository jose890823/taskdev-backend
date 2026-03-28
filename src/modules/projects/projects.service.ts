import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Project } from './entities/project.entity';
import { ProjectMember, ProjectRole } from './entities/project-member.entity';
import { CreateProjectDto, UpdateProjectDto, AddProjectMemberDto } from './dto';
import { User } from '../auth/entities/user.entity';
import { isUuid } from '../../common/utils/identifier.util';

export interface ProjectParentRef {
  id: string;
  name: string;
  systemCode: string;
}

export interface ProjectWithMeta {
  id: string;
  parent: ProjectParentRef | null;
  childCount: number;
  [key: string]: unknown;
}

@Injectable()
export class ProjectsService {
  private readonly logger = new Logger(ProjectsService.name);

  constructor(
    @InjectRepository(Project)
    private readonly projectRepository: Repository<Project>,
    @InjectRepository(ProjectMember)
    private readonly memberRepository: Repository<ProjectMember>,
    private readonly eventEmitter: EventEmitter2,
    private readonly dataSource: DataSource,
  ) {}

  async create(dto: CreateProjectDto, user: User): Promise<Project> {
    // Validar proyecto padre si se proporcionó
    let parent: Project | null = null;
    if (dto.parentId) {
      parent = await this.projectRepository.findOne({
        where: { id: dto.parentId },
      });
      if (!parent) {
        throw new NotFoundException('Proyecto padre no encontrado');
      }
      // Max depth: 2 niveles — el padre no puede tener padre
      if (parent.parentId) {
        throw new BadRequestException(
          'No se permite crear sub-proyectos de mas de 2 niveles de profundidad',
        );
      }
      // Verificar que el usuario tiene acceso al proyecto padre
      await this.verifyMemberAccess(dto.parentId, user.id, user.isSuperAdmin());
    }

    // Resolve effective organizationId without mutating the DTO
    const effectiveOrgId =
      dto.organizationId || (parent ? parent.organizationId : null);

    const project = await this.dataSource.transaction(async (manager) => {
      const slug = this.generateSlug(dto.name);

      const newProject = manager.create(Project, {
        ...dto,
        slug,
        ownerId: user.id,
        organizationId: effectiveOrgId || null,
        parentId: dto.parentId || null,
      });
      await manager.save(newProject);

      const member = manager.create(ProjectMember, {
        projectId: newProject.id,
        userId: user.id,
        role: ProjectRole.OWNER,
      });
      await manager.save(member);

      return newProject;
    });

    // Emit AFTER transaction committed successfully
    this.eventEmitter.emit('project.created', { projectId: project.id });

    this.logger.log(`Proyecto creado: ${project.name} por ${user.email}`);
    return project;
  }

  async findAll(
    userId: string,
    organizationId?: string,
    personal?: boolean,
    includeChildren = false,
  ): Promise<Project[]> {
    const qb = this.projectRepository
      .createQueryBuilder('p')
      .where('p.isActive = :isActive', { isActive: true })
      .andWhere(
        '(p.ownerId = :userId OR EXISTS (SELECT 1 FROM project_members pm WHERE pm."projectId" = p.id AND pm."userId" = :userId))',
        { userId },
      );

    if (organizationId) {
      qb.andWhere('p.organizationId = :organizationId', { organizationId });
    } else if (personal) {
      qb.andWhere('p.organizationId IS NULL');
    }

    // Por defecto excluir sub-proyectos (solo mostrar proyectos raiz)
    if (!includeChildren) {
      qb.andWhere('p.parentId IS NULL');
    }

    return qb.orderBy('p.createdAt', 'DESC').getMany();
  }

  async findById(identifier: string): Promise<ProjectWithMeta> {
    const where = isUuid(identifier)
      ? { id: identifier }
      : { systemCode: identifier };
    const project = await this.projectRepository.findOne({
      where,
      relations: ['parent'],
    });
    if (!project) throw new NotFoundException('Proyecto no encontrado');

    // Contar hijos directos
    const childCount = await this.projectRepository.count({
      where: { parentId: project.id },
    });

    return {
      ...project,
      parent: project.parent
        ? {
            id: project.parent.id,
            name: project.parent.name,
            systemCode: project.parent.systemCode,
          }
        : null,
      childCount,
    };
  }

  async findChildren(parentId: string): Promise<Project[]> {
    const parent = await this.projectRepository.findOne({
      where: { id: parentId },
    });
    if (!parent) throw new NotFoundException('Proyecto padre no encontrado');

    return this.projectRepository.find({
      where: { parentId, isActive: true },
      order: { createdAt: 'ASC' },
    });
  }

  async findBySlug(slug: string): Promise<Project> {
    const project = await this.projectRepository.findOne({ where: { slug } });
    if (!project) throw new NotFoundException('Proyecto no encontrado');
    return project;
  }

  async update(
    identifier: string,
    dto: UpdateProjectDto,
    userId: string,
  ): Promise<Project> {
    const where = isUuid(identifier)
      ? { id: identifier }
      : { systemCode: identifier };
    const project = await this.projectRepository.findOne({ where });
    if (!project) throw new NotFoundException('Proyecto no encontrado');
    await this.verifyAdminAccess(project.id, userId);

    // Validate parentId change if provided
    if (dto.parentId !== undefined) {
      if (dto.parentId === project.id) {
        throw new BadRequestException(
          'Un proyecto no puede ser su propio padre',
        );
      }
      if (dto.parentId) {
        const newParent = await this.projectRepository.findOne({
          where: { id: dto.parentId },
        });
        if (!newParent) {
          throw new NotFoundException('Proyecto padre no encontrado');
        }
        if (newParent.parentId) {
          throw new BadRequestException(
            'No se permite crear sub-proyectos de mas de 2 niveles de profundidad',
          );
        }
        // Check if this project has children — can't become a child itself
        const childCount = await this.projectRepository.count({
          where: { parentId: project.id },
        });
        if (childCount > 0) {
          throw new BadRequestException(
            'Un proyecto con sub-proyectos no puede convertirse en sub-proyecto',
          );
        }
      }
    }

    if (dto.name && dto.name !== project.name) {
      project.slug = this.generateSlug(dto.name);
    }

    Object.assign(project, dto);
    return this.projectRepository.save(project);
  }

  async remove(identifier: string, userId: string): Promise<void> {
    const where = isUuid(identifier)
      ? { id: identifier }
      : { systemCode: identifier };
    const project = await this.projectRepository.findOne({ where });
    if (!project) throw new NotFoundException('Proyecto no encontrado');
    if (project.ownerId !== userId) {
      throw new ForbiddenException('Solo el dueno puede eliminar el proyecto');
    }
    // Orphan children and soft-delete in a single atomic transaction to avoid
    // dangling parentId references if one operation fails.
    await this.dataSource.transaction(async (manager) => {
      await manager.update(
        Project,
        { parentId: project.id },
        { parentId: null },
      );
      await manager.softDelete(Project, project.id);
    });
  }

  async getMembers(identifier: string): Promise<ProjectMember[]> {
    const project = await this.findById(identifier);
    return this.memberRepository.find({
      where: { projectId: project.id },
      relations: ['user'],
      order: { createdAt: 'ASC' },
    });
  }

  async addMember(
    identifier: string,
    dto: AddProjectMemberDto,
    requestUserId: string,
  ): Promise<ProjectMember> {
    const project = await this.findById(identifier);
    await this.verifyAdminAccess(project.id, requestUserId);

    const existing = await this.memberRepository.findOne({
      where: { projectId: project.id, userId: dto.userId },
    });
    if (existing)
      throw new ConflictException('El usuario ya es miembro del proyecto');

    const member = this.memberRepository.create({
      projectId: project.id,
      ...dto,
    });
    const saved = await this.memberRepository.save(member);

    // Emit project.member_added
    if (dto.userId !== requestUserId) {
      const requestUser = await this.getMinimalUser(requestUserId);
      this.eventEmitter.emit('project.member_added', {
        projectId: project.id,
        projectSlug: project.slug,
        projectName: project.name,
        addedUserId: dto.userId,
        addedByName: requestUser
          ? `${requestUser.firstName} ${requestUser.lastName}`
          : 'Un administrador',
      });
    }

    return saved;
  }

  async removeMember(
    identifier: string,
    userId: string,
    requestUserId: string,
  ): Promise<void> {
    const project = await this.findById(identifier);
    await this.verifyAdminAccess(project.id, requestUserId);
    const member = await this.memberRepository.findOne({
      where: { projectId: project.id, userId },
    });
    if (!member) throw new NotFoundException('Miembro no encontrado');
    if (member.role === ProjectRole.OWNER) {
      throw new ForbiddenException(
        'No se puede eliminar al dueno del proyecto',
      );
    }
    await this.memberRepository.remove(member);

    // Emit project.member_removed
    if (userId !== requestUserId) {
      const requestUser = await this.getMinimalUser(requestUserId);
      this.eventEmitter.emit('project.member_removed', {
        projectId: project.id,
        projectName: project.name,
        removedUserId: userId,
        removedByName: requestUser
          ? `${requestUser.firstName} ${requestUser.lastName}`
          : 'Un administrador',
      });
    }
  }

  async hasAdminAccess(projectId: string, userId: string): Promise<boolean> {
    const member = await this.memberRepository.findOne({
      where: { projectId, userId },
    });
    return (
      !!member &&
      (member.role === ProjectRole.OWNER || member.role === ProjectRole.ADMIN)
    );
  }

  async isMember(projectId: string, userId: string): Promise<boolean> {
    const member = await this.memberRepository.findOne({
      where: { projectId, userId },
    });
    return !!member;
  }

  async getMemberRole(
    projectId: string,
    userId: string,
  ): Promise<ProjectRole | null> {
    const member = await this.memberRepository.findOne({
      where: { projectId, userId },
    });
    return member?.role || null;
  }

  async verifyMemberAccess(
    projectId: string,
    userId: string,
    isSuperAdmin = false,
  ): Promise<void> {
    if (isSuperAdmin) return;
    const member = await this.memberRepository.findOne({
      where: { projectId, userId },
    });
    if (!member) {
      throw new ForbiddenException('No tienes acceso a este proyecto');
    }
  }

  async addMemberByUserId(
    projectId: string,
    userId: string,
    role: ProjectRole,
  ): Promise<ProjectMember> {
    const existing = await this.memberRepository.findOne({
      where: { projectId, userId },
    });
    if (existing)
      throw new ConflictException('El usuario ya es miembro del proyecto');

    const member = this.memberRepository.create({ projectId, userId, role });
    const saved = await this.memberRepository.save(member);

    // Emit project.member_added
    const project = await this.findById(projectId);
    this.eventEmitter.emit('project.member_added', {
      projectId,
      projectSlug: project.slug,
      projectName: project.name,
      addedUserId: userId,
      addedByName: 'El sistema',
    });

    return saved;
  }

  private async getMinimalUser(
    userId: string,
  ): Promise<{ firstName: string; lastName: string } | null> {
    return this.dataSource.getRepository(User).findOne({
      where: { id: userId },
      select: ['id', 'firstName', 'lastName'],
    });
  }

  private async verifyAdminAccess(
    projectId: string,
    userId: string,
  ): Promise<void> {
    const hasAccess = await this.hasAdminAccess(projectId, userId);
    if (!hasAccess) {
      throw new ForbiddenException(
        'No tienes permisos de administrador en este proyecto',
      );
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
