import {
  Controller, Get, Post, Patch, Delete, Body, Param, ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { OrganizationsService } from './organizations.service';
import { CreateOrganizationDto, UpdateOrganizationDto, AddMemberDto } from './dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../auth/entities/user.entity';

@ApiTags('Organizations')
@ApiBearerAuth()
@Controller('organizations')
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

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
  @ApiOperation({ summary: 'Obtener organizacion por ID' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.organizationsService.findById(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar organizacion' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateOrganizationDto,
    @CurrentUser() user: User,
  ) {
    return this.organizationsService.update(id, dto, user.id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar organizacion' })
  async remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    await this.organizationsService.remove(id, user.id);
    return { message: 'Organizacion eliminada' };
  }

  @Get(':id/members')
  @ApiOperation({ summary: 'Listar miembros de la organizacion' })
  async getMembers(@Param('id', ParseUUIDPipe) id: string) {
    return this.organizationsService.getMembers(id);
  }

  @Post(':id/members')
  @ApiOperation({ summary: 'Agregar miembro a la organizacion' })
  async addMember(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddMemberDto,
    @CurrentUser() user: User,
  ) {
    return this.organizationsService.addMember(id, dto, user.id);
  }

  @Delete(':id/members/:userId')
  @ApiOperation({ summary: 'Eliminar miembro de la organizacion' })
  async removeMember(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @CurrentUser() user: User,
  ) {
    await this.organizationsService.removeMember(id, userId, user.id);
    return { message: 'Miembro eliminado' };
  }
}
