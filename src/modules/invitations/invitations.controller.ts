import {
  Controller, Get, Post, Delete, Body, Param, ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { InvitationsService } from './invitations.service';
import { CreateInvitationDto, CreateProjectInvitationDto } from './dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../auth/entities/user.entity';
import { Public } from '../auth/decorators/public.decorator';

@ApiTags('Invitations')
@ApiBearerAuth()
@Controller()
export class InvitationsController {
  constructor(private readonly invitationsService: InvitationsService) {}

  @Post('organizations/:id/invitations')
  @ApiOperation({ summary: 'Invitar usuario a organizacion' })
  async create(
    @Param('id', ParseUUIDPipe) organizationId: string,
    @Body() dto: CreateInvitationDto,
    @CurrentUser() user: User,
  ) {
    return this.invitationsService.create(organizationId, dto, user);
  }

  @Get('organizations/:id/invitations')
  @ApiOperation({ summary: 'Listar invitaciones de organizacion' })
  async findByOrganization(@Param('id', ParseUUIDPipe) organizationId: string) {
    return this.invitationsService.findByOrganization(organizationId);
  }

  @Post('projects/:id/invitations')
  @ApiOperation({ summary: 'Invitar usuario a proyecto por email' })
  @ApiResponse({ status: 201, description: 'Usuario agregado o invitacion enviada' })
  async createProjectInvitation(
    @Param('id', ParseUUIDPipe) projectId: string,
    @Body() dto: CreateProjectInvitationDto,
    @CurrentUser() user: User,
  ) {
    return this.invitationsService.createProjectInvitation(projectId, dto, user);
  }

  @Get('projects/:id/invitations')
  @ApiOperation({ summary: 'Listar invitaciones pendientes de un proyecto' })
  async findByProject(@Param('id', ParseUUIDPipe) projectId: string) {
    return this.invitationsService.findByProject(projectId);
  }

  @Get('invitations/info/:token')
  @Public()
  @ApiOperation({ summary: 'Obtener info de invitacion por token (publico)' })
  async getInfo(@Param('token') token: string) {
    return this.invitationsService.getInfoByToken(token);
  }

  @Post('invitations/accept/:token')
  @ApiOperation({ summary: 'Aceptar invitacion' })
  async accept(@Param('token') token: string, @CurrentUser() user: User) {
    return this.invitationsService.accept(token, user);
  }

  @Post('invitations/:id/resend')
  @ApiOperation({ summary: 'Reenviar invitacion pendiente' })
  async resend(@Param('id', ParseUUIDPipe) id: string) {
    return this.invitationsService.resend(id);
  }

  @Delete('invitations/:id')
  @ApiOperation({ summary: 'Cancelar invitacion' })
  async cancel(@Param('id', ParseUUIDPipe) id: string) {
    await this.invitationsService.cancel(id);
    return { message: 'Invitacion cancelada' };
  }
}
