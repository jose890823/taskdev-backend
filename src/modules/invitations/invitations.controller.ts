import {
  Controller, Get, Post, Delete, Body, Param, ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { InvitationsService } from './invitations.service';
import { CreateInvitationDto } from './dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../auth/entities/user.entity';

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

  @Post('invitations/accept/:token')
  @ApiOperation({ summary: 'Aceptar invitacion' })
  async accept(@Param('token') token: string, @CurrentUser() user: User) {
    return this.invitationsService.accept(token, user);
  }

  @Delete('invitations/:id')
  @ApiOperation({ summary: 'Cancelar invitacion' })
  async cancel(@Param('id', ParseUUIDPipe) id: string) {
    await this.invitationsService.cancel(id);
    return { message: 'Invitacion cancelada' };
  }
}
