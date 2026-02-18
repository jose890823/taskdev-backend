import {
  Injectable, Logger, NotFoundException, ConflictException, BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomBytes } from 'crypto';
import { Invitation, InvitationStatus } from './entities/invitation.entity';
import { CreateInvitationDto } from './dto';
import { OrganizationsService } from '../organizations/organizations.service';
import { OrganizationRole } from '../organizations/entities/organization-member.entity';
import { User } from '../auth/entities/user.entity';

@Injectable()
export class InvitationsService {
  private readonly logger = new Logger(InvitationsService.name);

  constructor(
    @InjectRepository(Invitation)
    private readonly invitationRepository: Repository<Invitation>,
    private readonly organizationsService: OrganizationsService,
  ) {}

  async create(organizationId: string, dto: CreateInvitationDto, user: User): Promise<Invitation> {
    await this.organizationsService.findById(organizationId);

    const existing = await this.invitationRepository.findOne({
      where: { organizationId, email: dto.email, status: InvitationStatus.PENDING },
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
    return invitation;
  }

  async findByOrganization(organizationId: string): Promise<Invitation[]> {
    return this.invitationRepository.find({
      where: { organizationId },
      order: { createdAt: 'DESC' },
    });
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

    await this.organizationsService.addMember(
      invitation.organizationId,
      { userId: user.id, role: invitation.role as OrganizationRole },
      invitation.invitedById,
    );

    invitation.status = InvitationStatus.ACCEPTED;
    await this.invitationRepository.save(invitation);

    this.logger.log(`Invitacion aceptada por ${user.email}`);
    return { message: 'Invitacion aceptada exitosamente' };
  }

  async cancel(id: string): Promise<void> {
    const invitation = await this.invitationRepository.findOne({ where: { id } });
    if (!invitation) throw new NotFoundException('Invitacion no encontrada');
    invitation.status = InvitationStatus.CANCELLED;
    await this.invitationRepository.save(invitation);
  }
}
