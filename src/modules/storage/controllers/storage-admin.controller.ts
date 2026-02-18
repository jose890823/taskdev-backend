import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '../../auth/entities/user.entity';
import { StorageService } from '../storage.service';
import { StorageConfigService } from '../services/storage-config.service';
import { StorageProviderType } from '../interfaces/storage-provider.interface';
import {
  UpdateStorageConfigDto,
  StorageConfigResponseDto,
  StorageProvidersListDto,
  StorageTestResultDto,
} from '../dto';
import { StorageConfig } from '../entities/storage-config.entity';

@ApiTags('Admin - Storage')
@Controller('v1/admin/storage')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN)
@ApiBearerAuth()
export class StorageAdminController {
  constructor(
    private readonly storageService: StorageService,
    private readonly configService: StorageConfigService,
  ) {}

  @Get('providers')
  @ApiOperation({
    summary: 'Listar todos los proveedores de storage',
    description:
      'Retorna la lista de proveedores con su estado de configuración',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de proveedores',
    type: StorageProvidersListDto,
  })
  async listProviders(): Promise<StorageProvidersListDto> {
    const configs = await this.configService.getAllConfigs();
    const activeConfig = await this.configService.getActiveConfig();

    return {
      providers: configs.map((config) => this.toResponseDto(config)),
      activeProvider: activeConfig?.provider || null,
    };
  }

  @Get('providers/:provider')
  @ApiOperation({
    summary: 'Obtener configuración de un proveedor',
    description:
      'Retorna la configuración del proveedor especificado (sin datos sensibles)',
  })
  @ApiParam({
    name: 'provider',
    enum: StorageProviderType,
    description: 'Tipo de proveedor',
  })
  @ApiResponse({
    status: 200,
    description: 'Configuración del proveedor',
    type: StorageConfigResponseDto,
  })
  async getProvider(
    @Param('provider') provider: StorageProviderType,
  ): Promise<StorageConfigResponseDto> {
    const config = await this.configService.getConfig(provider);
    return this.toResponseDto(config);
  }

  @Patch('providers/:provider/config')
  @ApiOperation({
    summary: 'Actualizar configuración de un proveedor',
    description: 'Actualiza la configuración del proveedor especificado',
  })
  @ApiParam({
    name: 'provider',
    enum: StorageProviderType,
    description: 'Tipo de proveedor',
  })
  @ApiResponse({
    status: 200,
    description: 'Configuración actualizada',
    type: StorageConfigResponseDto,
  })
  async updateProviderConfig(
    @Param('provider') provider: StorageProviderType,
    @Body() dto: UpdateStorageConfigDto,
  ): Promise<StorageConfigResponseDto> {
    const config = await this.configService.updateConfig(provider, {
      name: dto.name,
      config: dto.config,
      settings: dto.settings,
    });

    return this.toResponseDto(config);
  }

  @Post('providers/:provider/test')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Probar conexión con un proveedor',
    description:
      'Valida que la configuración del proveedor es correcta y puede conectarse',
  })
  @ApiParam({
    name: 'provider',
    enum: StorageProviderType,
    description: 'Tipo de proveedor',
  })
  @ApiResponse({
    status: 200,
    description: 'Resultado de la prueba',
    type: StorageTestResultDto,
  })
  async testProvider(
    @Param('provider') provider: StorageProviderType,
  ): Promise<StorageTestResultDto> {
    const result = await this.storageService.validateProvider(provider);

    return {
      success: result.success,
      message: result.message,
      responseTime: result.responseTime,
      details: {
        provider,
        testedAt: new Date().toISOString(),
      },
    };
  }

  @Post('providers/:provider/activate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Activar un proveedor',
    description:
      'Activa el proveedor especificado como el proveedor de storage principal. El proveedor debe estar configurado correctamente.',
  })
  @ApiParam({
    name: 'provider',
    enum: StorageProviderType,
    description: 'Tipo de proveedor',
  })
  @ApiResponse({
    status: 200,
    description: 'Proveedor activado',
    type: StorageConfigResponseDto,
  })
  async activateProvider(
    @Param('provider') provider: StorageProviderType,
  ): Promise<StorageConfigResponseDto> {
    // Primero validar el proveedor
    const testResult = await this.storageService.validateProvider(provider);
    if (!testResult.success) {
      throw new Error(
        `No se puede activar el proveedor: ${testResult.message}`,
      );
    }

    // Activar el proveedor
    const config = await this.configService.activateProvider(provider);

    // Reinicializar el servicio de storage con el nuevo proveedor
    await this.storageService.reinitializeActiveProvider();

    return this.toResponseDto(config);
  }

  @Get('stats')
  @ApiOperation({
    summary: 'Obtener estadísticas de storage',
    description: 'Retorna estadísticas de uso del proveedor de storage activo',
  })
  @ApiResponse({
    status: 200,
    description: 'Estadísticas de storage',
  })
  async getStats(): Promise<{
    activeProvider: StorageProviderType;
    usage: { used: number; total?: number; available?: number };
    isHealthy: boolean;
  }> {
    const activeProvider = await this.storageService.getActiveProviderType();
    const usage = await this.storageService.getUsageInfo();
    const isHealthy = await this.storageService.validateActiveProvider();

    return {
      activeProvider,
      usage,
      isHealthy,
    };
  }

  /**
   * Convertir entidad a DTO de respuesta
   */
  private toResponseDto(config: StorageConfig): StorageConfigResponseDto {
    return {
      id: config.id,
      provider: config.provider,
      name: config.name,
      isActive: config.isActive,
      isConfigured: config.isConfigured,
      lastValidatedAt: config.lastValidatedAt,
      lastValidationError: config.lastValidationError,
      config: config.getSafeConfig(),
      settings: config.settings,
      createdAt: config.createdAt,
      updatedAt: config.updatedAt,
    };
  }
}
