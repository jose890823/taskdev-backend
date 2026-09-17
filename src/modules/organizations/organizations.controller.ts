import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Req,
  ForbiddenException,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { OrganizationsService } from './organizations.service';
import {
  CreateOrganizationDto,
  UpdateOrganizationDto,
  AddMemberDto,
} from './dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../auth/entities/user.entity';
import { ProjectsService } from '../projects/projects.service';
import { CombinedAuthGuard } from '../api-keys/guards';
import { ApiKeyProjectParam, ApiKeyScopes } from '../api-keys/decorators';
import type { ApiKeyRequest } from '../api-keys/api-key.types';

@ApiTags('Organizations')
@ApiBearerAuth()
@UseGuards(CombinedAuthGuard)
@Controller('organizations')
export class OrganizationsController {
  constructor(
    private readonly organizationsService: OrganizationsService,
    private readonly projectsService: ProjectsService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Crear organizacion' })
  @ApiResponse({ status: 201, description: 'Organizacion creada' })
  async create(@Body() dto: CreateOrganizationDto, @CurrentUser() user: User) {
    return this.organizationsService.create(dto, user);
  }

  @Get()
  @ApiOperation({ summary: 'Listar mis organizaciones' })
  async findAll(@CurrentUser() user: User) {
    if (user.isSuperAdmin()) {
      return this.organizationsService.findAllAdmin();
    }
    return this.organizationsService.findAll(user.id);
  }

  @Get(':id')
  @ApiKeyScopes('organizations:read')
  @ApiKeyProjectParam('projectId')
  @ApiQuery({
    name: 'projectId',
    required: false,
    description: 'Proyecto vinculado a la API key (obligatorio para API keys)',
  })
  @ApiOperation({ summary: 'Obtener organizacion por ID' })
  async findOne(
    @Param('id') id: string,
    @CurrentUser() user: User,
    @Req() request: ApiKeyRequest,
  ) {
    const org = await this.organizationsService.findById(id);
    await this.organizationsService.verifyMemberAccess(
      org.id,
      user.id,
      user.isSuperAdmin(),
    );
    await this.verifyApiKeyProjectOrganization(request, org.id);
    return org;
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar organizacion' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateOrganizationDto,
    @CurrentUser() user: User,
  ) {
    return this.organizationsService.update(id, dto, user.id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar organizacion' })
  async remove(@Param('id') id: string, @CurrentUser() user: User) {
    await this.organizationsService.remove(id, user.id);
    return { message: 'Organizacion eliminada' };
  }

  @Get(':id/members')
  @ApiKeyScopes('organizations:read')
  @ApiKeyProjectParam('projectId')
  @ApiQuery({
    name: 'projectId',
    required: false,
    description: 'Proyecto vinculado a la API key (obligatorio para API keys)',
  })
  @ApiOperation({ summary: 'Listar miembros de la organizacion' })
  async getMembers(
    @Param('id') id: string,
    @CurrentUser() user: User,
    @Req() request: ApiKeyRequest,
  ) {
    this.assertOrganizationMembersAccess(request);
    const org = await this.organizationsService.findById(id);
    await this.organizationsService.verifyMemberAccess(
      org.id,
      user.id,
      user.isSuperAdmin(),
    );
    await this.verifyApiKeyProjectOrganization(request, org.id);
    return this.organizationsService.getMembers(id);
  }

  @Post(':id/members')
  @ApiOperation({ summary: 'Agregar miembro a la organizacion' })
  async addMember(
    @Param('id') id: string,
    @Body() dto: AddMemberDto,
    @CurrentUser() user: User,
  ) {
    return this.organizationsService.addMember(id, dto, user.id);
  }

  @Delete(':id/members/:userId')
  @ApiOperation({ summary: 'Eliminar miembro de la organizacion' })
  async removeMember(
    @Param('id') id: string,
    @Param('userId') userId: string,
    @CurrentUser() user: User,
  ) {
    await this.organizationsService.removeMember(id, userId, user.id);
    return { message: 'Miembro eliminado' };
  }

  private async verifyApiKeyProjectOrganization(
    request: ApiKeyRequest,
    organizationId: string,
  ): Promise<void> {
    const identity = request.identity;
    if (identity?.authType !== 'api-key') return;

    const project = await this.projectsService.findById(identity.projectId);
    if (project.organizationId !== organizationId) {
      throw new ForbiddenException('Acceso al proyecto denegado');
    }
  }

  private assertOrganizationMembersAccess(request: ApiKeyRequest): void {
    if (request.identity?.authType !== 'api-key') return;

    throw new ForbiddenException({
      code: 'PROJECT_ACCESS_DENIED',
      message:
        'Los miembros de la organización no están disponibles para API keys vinculadas a proyectos',
    });
  }
}
