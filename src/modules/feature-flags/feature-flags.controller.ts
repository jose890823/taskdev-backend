import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../auth/entities/user.entity';
import { FeatureFlagsService } from './feature-flags.service';
import { CreateFeatureFlagDto, UpdateFeatureFlagDto } from './dto';

@ApiTags('Feature Flags (Admin)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN)
@Controller('admin/feature-flags')
export class FeatureFlagsController {
  constructor(private readonly featureFlagsService: FeatureFlagsService) {}

  @Get()
  @ApiOperation({ summary: 'Listar todos los feature flags' })
  @ApiResponse({
    status: 200,
    description: 'Lista de feature flags obtenida exitosamente',
  })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  @ApiResponse({
    status: 403,
    description: 'Acceso denegado - Rol insuficiente',
  })
  async findAll() {
    return this.featureFlagsService.findAll();
  }

  @Get(':key/check')
  @ApiOperation({
    summary: 'Verificar si un feature flag está habilitado',
  })
  @ApiParam({
    name: 'key',
    description: 'Clave del feature flag',
    example: 'michambita.content_generation',
  })
  @ApiQuery({
    name: 'roles',
    required: false,
    description: 'Roles del usuario (separados por coma)',
    example: 'admin,client',
  })
  @ApiQuery({
    name: 'storeId',
    required: false,
    description: 'ID de la tienda',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiResponse({
    status: 200,
    description: 'Estado del feature flag',
  })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  @ApiResponse({
    status: 403,
    description: 'Acceso denegado - Rol insuficiente',
  })
  async checkEnabled(
    @Param('key') key: string,
    @Query('roles') roles?: string,
    @Query('storeId') storeId?: string,
  ) {
    const context: { roles?: string[]; storeId?: string } = {};

    if (roles) {
      context.roles = roles.split(',').map((r) => r.trim());
    }

    if (storeId) {
      context.storeId = storeId;
    }

    const enabled = await this.featureFlagsService.isEnabled(key, context);
    return { key, enabled };
  }

  @Get(':key')
  @ApiOperation({ summary: 'Obtener un feature flag por su clave' })
  @ApiParam({
    name: 'key',
    description: 'Clave del feature flag',
    example: 'michambita.content_generation',
  })
  @ApiResponse({
    status: 200,
    description: 'Feature flag obtenido exitosamente',
  })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  @ApiResponse({
    status: 403,
    description: 'Acceso denegado - Rol insuficiente',
  })
  @ApiResponse({ status: 404, description: 'Feature flag no encontrado' })
  async findByKey(@Param('key') key: string) {
    return this.featureFlagsService.findByKey(key);
  }

  @Post()
  @ApiOperation({ summary: 'Crear un nuevo feature flag' })
  @ApiResponse({
    status: 201,
    description: 'Feature flag creado exitosamente',
  })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  @ApiResponse({
    status: 403,
    description: 'Acceso denegado - Rol insuficiente',
  })
  @ApiResponse({
    status: 409,
    description: 'Ya existe un feature flag con esa clave',
  })
  async create(@Body() dto: CreateFeatureFlagDto) {
    return this.featureFlagsService.create(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar un feature flag' })
  @ApiParam({
    name: 'id',
    description: 'ID del feature flag (UUID)',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiResponse({
    status: 200,
    description: 'Feature flag actualizado exitosamente',
  })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  @ApiResponse({
    status: 403,
    description: 'Acceso denegado - Rol insuficiente',
  })
  @ApiResponse({ status: 404, description: 'Feature flag no encontrado' })
  @ApiResponse({
    status: 409,
    description: 'Ya existe un feature flag con esa clave',
  })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateFeatureFlagDto,
  ) {
    return this.featureFlagsService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar un feature flag' })
  @ApiParam({
    name: 'id',
    description: 'ID del feature flag (UUID)',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiResponse({
    status: 200,
    description: 'Feature flag eliminado exitosamente',
  })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  @ApiResponse({
    status: 403,
    description: 'Acceso denegado - Rol insuficiente',
  })
  @ApiResponse({ status: 404, description: 'Feature flag no encontrado' })
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.featureFlagsService.remove(id);
    return { message: 'Feature flag eliminado exitosamente' };
  }
}
