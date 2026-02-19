import {
  Injectable, Logger, NotFoundException, ConflictException, BadRequestException, ForbiddenException,
  Optional, Inject,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { randomBytes } from 'crypto';
import { Invitation, InvitationStatus } from './entities/invitation.entity';
import { CreateInvitationDto, CreateProjectInvitationDto } from './dto';
import { OrganizationsService } from '../organizations/organizations.service';
import { OrganizationRole } from '../organizations/entities/organization-member.entity';
import { ProjectsService } from '../projects/projects.service';
import { ProjectRole } from '../projects/entities/project-member.entity';
import { User, UserRole } from '../auth/entities/user.entity';

@Injectable()
export class InvitationsService {
  private readonly logger = new Logger(InvitationsService.name);

  constructor(
    @InjectRepository(Invitation)
    private readonly invitationRepository: Repository<Invitation>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly organizationsService: OrganizationsService,
    private readonly projectsService: ProjectsService,
    private readonly configService: ConfigService,
    @Optional() @Inject('EmailService') private emailService?: any,
  ) {
    if (this.emailService) {
      this.logger.log('✅ EmailService disponible en InvitationsService');
    } else {
      this.logger.warn('⚠️ EmailService NO disponible en InvitationsService');
    }
  }

  async create(organizationId: string, dto: CreateInvitationDto, user: User): Promise<Invitation> {
    const organization = await this.organizationsService.findById(organizationId);

    // Solo owner o admin de la organizacion pueden invitar (super_admin siempre puede)
    const isSuperAdmin = user.roles?.includes(UserRole.SUPER_ADMIN);
    if (!isSuperAdmin) {
      const memberRole = await this.organizationsService.getMemberRole(organizationId, user.id);
      if (!memberRole || (memberRole !== 'owner' && memberRole !== 'admin')) {
        throw new ForbiddenException('Solo el propietario o administrador de la organizacion puede invitar');
      }
    }

    const existing = await this.invitationRepository.findOne({
      where: { organizationId, email: dto.email, status: InvitationStatus.PENDING, projectId: null as any },
    });
    if (existing) throw new ConflictException('Ya existe una invitacion pendiente para este email');

    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const invitation = this.invitationRepository.create({
      organizationId,
      email: dto.email,
      role: dto.role || OrganizationRole.MEMBER,
      token,
      invitedById: user.id,
      expiresAt,
    });

    await this.invitationRepository.save(invitation);
    this.logger.log(`Invitacion creada para ${dto.email} en org ${organizationId}`);

    // Enviar email de invitacion
    const frontendUrl = this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3000';
    const inviteUrl = `${frontendUrl}/invite/${token}`;
    const inviterName = `${user.firstName} ${user.lastName}`.trim();

    if (this.emailService?.sendInvitationEmail) {
      const emailResult = await this.emailService.sendInvitationEmail({
        to: dto.email,
        organizationName: organization.name,
        inviteUrl,
        invitedByName: inviterName,
        role: dto.role || OrganizationRole.MEMBER,
      });
      if (emailResult.success) {
        this.logger.log(`✅ Email de invitacion enviado a ${dto.email}`);
      } else {
        this.logger.warn(`⚠️ Email de invitacion no enviado a ${dto.email}: ${emailResult.error}`);
      }
    } else {
      this.logger.warn(`⚠️ EmailService no disponible. Link de invitacion: ${inviteUrl}`);
    }

    return invitation;
  }

  async createProjectInvitation(
    projectId: string,
    dto: CreateProjectInvitationDto,
    user: User,
  ): Promise<{ action: 'added' | 'invited'; message: string }> {
    const project = await this.projectsService.findById(projectId);

    if (!project.organizationId) {
      throw new BadRequestException('No se puede invitar a un proyecto personal');
    }

    const organization = await this.organizationsService.findById(project.organizationId);

    // Verificar permisos: admin/owner del proyecto o super_admin
    const isSuperAdmin = user.roles?.includes(UserRole.SUPER_ADMIN);
    if (!isSuperAdmin) {
      const hasAccess = await this.projectsService.hasAdminAccess(projectId, user.id);
      if (!hasAccess) {
        throw new ForbiddenException('No tienes permisos de administrador en este proyecto');
      }
    }

    const projectRole = dto.role || ProjectRole.MEMBER;
    const inviterName = `${user.firstName} ${user.lastName}`.trim();

    // Buscar si el usuario ya existe en el sistema
    const existingUser = await this.userRepository.findOne({ where: { email: dto.email } });

    if (existingUser) {
      // Usuario existe → agregar directamente a org (si no es miembro) y al proyecto
      try {
        await this.organizationsService.addMember(
          project.organizationId,
          { userId: existingUser.id, role: OrganizationRole.MEMBER },
          user.id,
        );
        this.logger.log(`Usuario ${dto.email} agregado a org ${project.organizationId}`);
      } catch (e) {
        if (!(e instanceof ConflictException)) throw e;
        // Ya es miembro de la org, continuar
      }

      await this.projectsService.addMemberByUserId(projectId, existingUser.id, projectRole);
      this.logger.log(`Usuario ${dto.email} agregado al proyecto ${projectId} como ${projectRole}`);

      return { action: 'added', message: `${dto.email} ha sido agregado al proyecto` };
    }

    // Usuario NO existe → crear invitacion por email
    const existing = await this.invitationRepository.findOne({
      where: { organizationId: project.organizationId, email: dto.email, projectId, status: InvitationStatus.PENDING },
    });
    if (existing) throw new ConflictException('Ya existe una invitacion pendiente para este email en este proyecto');

    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const invitation = this.invitationRepository.create({
      organizationId: project.organizationId,
      email: dto.email,
      role: OrganizationRole.MEMBER,
      token,
      invitedById: user.id,
      expiresAt,
      projectId,
      projectRole,
    });

    await this.invitationRepository.save(invitation);
    this.logger.log(`Invitacion de proyecto creada para ${dto.email} en proyecto ${projectId}`);

    // Enviar email
    const frontendUrl = this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3000';
    const inviteUrl = `${frontendUrl}/invite/${token}`;

    if (this.emailService?.sendInvitationEmail) {
      const emailResult = await this.emailService.sendInvitationEmail({
        to: dto.email,
        organizationName: organization.name,
        inviteUrl,
        invitedByName: inviterName,
        role: projectRole,
        projectName: project.name,
      });
      if (emailResult.success) {
        this.logger.log(`✅ Email de invitacion de proyecto enviado a ${dto.email}`);
      } else {
        this.logger.warn(`⚠️ Email no enviado a ${dto.email}: ${emailResult.error}`);
      }
    } else {
      this.logger.warn(`⚠️ EmailService no disponible. Link de invitacion: ${inviteUrl}`);
    }

    return { action: 'invited', message: `Invitacion enviada a ${dto.email}` };
  }

  async findByOrganization(organizationId: string): Promise<Invitation[]> {
    return this.invitationRepository.find({
      where: { organizationId },
      order: { createdAt: 'DESC' },
    });
  }

  async findByProject(projectId: string): Promise<Invitation[]> {
    return this.invitationRepository.find({
      where: { projectId, status: InvitationStatus.PENDING },
      order: { createdAt: 'DESC' },
    });
  }

  async getInfoByToken(token: string): Promise<{
    email: string;
    organizationName: string;
    role: string;
    status: string;
    expired: boolean;
    projectName?: string;
    projectRole?: string;
  }> {
    const invitation = await this.invitationRepository.findOne({
      where: { token },
    });
    if (!invitation) throw new NotFoundException('Invitacion no encontrada');

    const organization = await this.organizationsService.findById(invitation.organizationId);
    const expired = new Date() > invitation.expiresAt;

    const result: any = {
      email: invitation.email,
      organizationName: organization.name,
      role: invitation.role,
      status: expired && invitation.status === InvitationStatus.PENDING ? 'expired' : invitation.status,
      expired,
    };

    if (invitation.projectId) {
      try {
        const project = await this.projectsService.findById(invitation.projectId);
        result.projectName = project.name;
        result.projectRole = invitation.projectRole;
      } catch {
        // Proyecto eliminado, mantener info basica
      }
    }

    return result;
  }

  async accept(token: string, user: User): Promise<{ message: string }> {
    const invitation = await this.invitationRepository.findOne({
      where: { token, status: InvitationStatus.PENDING },
    });

    if (!invitation) throw new NotFoundException('Invitacion no encontrada o ya fue utilizada');

    if (new Date() > invitation.expiresAt) {
      invitation.status = InvitationStatus.EXPIRED;
      await this.invitationRepository.save(invitation);
      throw new BadRequestException('La invitacion ha expirado');
    }

    if (invitation.email !== user.email) {
      throw new BadRequestException('Esta invitacion no corresponde a tu email');
    }

    // Agregar a organizacion
    try {
      await this.organizationsService.addMember(
        invitation.organizationId,
        { userId: user.id, role: invitation.role as OrganizationRole },
        invitation.invitedById,
      );
    } catch (e) {
      if (!(e instanceof ConflictException)) throw e;
      // Ya es miembro de la org
    }

    // Si es invitacion de proyecto, agregar al proyecto tambien
    if (invitation.projectId && invitation.projectRole) {
      try {
        await this.projectsService.addMemberByUserId(
          invitation.projectId,
          user.id,
          invitation.projectRole as ProjectRole,
        );
        this.logger.log(`Usuario ${user.email} agregado al proyecto ${invitation.projectId}`);
      } catch (e) {
        if (!(e instanceof ConflictException)) throw e;
        // Ya es miembro del proyecto
      }
    }

    invitation.status = InvitationStatus.ACCEPTED;
    await this.invitationRepository.save(invitation);

    this.logger.log(`Invitacion aceptada por ${user.email}`);
    return { message: 'Invitacion aceptada exitosamente' };
  }

  async resend(id: string): Promise<{ message: string }> {
    const invitation = await this.invitationRepository.findOne({ where: { id } });
    if (!invitation) throw new NotFoundException('Invitacion no encontrada');
    if (invitation.status !== InvitationStatus.PENDING) {
      throw new BadRequestException('Solo se pueden reenviar invitaciones pendientes');
    }

    // Renovar expiracion
    invitation.expiresAt = new Date();
    invitation.expiresAt.setDate(invitation.expiresAt.getDate() + 7);
    await this.invitationRepository.save(invitation);

    // Reenviar email
    const organization = await this.organizationsService.findById(invitation.organizationId);
    const frontendUrl = this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3000';
    const inviteUrl = `${frontendUrl}/invite/${invitation.token}`;

    let projectName: string | undefined;
    if (invitation.projectId) {
      try {
        const project = await this.projectsService.findById(invitation.projectId);
        projectName = project.name;
      } catch {
        // Proyecto eliminado
      }
    }

    if (this.emailService?.sendInvitationEmail) {
      const emailResult = await this.emailService.sendInvitationEmail({
        to: invitation.email,
        organizationName: organization.name,
        inviteUrl,
        role: invitation.projectRole || invitation.role,
        projectName,
      });
      if (emailResult.success) {
        this.logger.log(`✅ Email de invitacion reenviado a ${invitation.email}`);
        return { message: `Invitacion reenviada a ${invitation.email}` };
      }
      this.logger.warn(`⚠️ No se pudo reenviar email a ${invitation.email}`);
      return { message: 'Invitacion renovada pero no se pudo enviar el email' };
    }

    this.logger.warn(`⚠️ EmailService no disponible para reenvio. Link: ${inviteUrl}`);
    return { message: 'Invitacion renovada (email no disponible)' };
  }

  async cancel(id: string): Promise<void> {
    const invitation = await this.invitationRepository.findOne({ where: { id } });
    if (!invitation) throw new NotFoundException('Invitacion no encontrada');
    invitation.status = InvitationStatus.CANCELLED;
    await this.invitationRepository.save(invitation);
  }
}
