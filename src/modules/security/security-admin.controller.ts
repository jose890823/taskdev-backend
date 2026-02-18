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
  HttpCode,
  HttpStatus,
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
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User, UserRole } from '../auth/entities/user.entity';

import { SecurityEventService } from './services/security-event.service';
import { BlockedIpService } from './services/blocked-ip.service';
import { LoginAttemptService } from './services/login-attempt.service';
import { SecurityConfigService } from './services/security-config.service';
import { ActiveSessionService } from './services/active-session.service';
import { SecurityAlertService } from './services/security-alert.service';

import { SecurityEventFilterDto } from './dto/security-event-filter.dto';
import { BlockIpDto, UnblockIpDto } from './dto/block-ip.dto';
import {
  UpdateSecurityConfigDto,
  CreateSecurityConfigDto,
} from './dto/update-security-config.dto';
import {
  UpdateAlertStatusDto,
  AssignAlertDto,
  ReviewEventDto,
} from './dto/update-alert.dto';

@ApiTags('Security - Admin')
@Controller('admin/security')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN)
@ApiBearerAuth()
export class SecurityAdminController {
  constructor(
    private readonly securityEventService: SecurityEventService,
    private readonly blockedIpService: BlockedIpService,
    private readonly loginAttemptService: LoginAttemptService,
    private readonly securityConfigService: SecurityConfigService,
    private readonly activeSessionService: ActiveSessionService,
    private readonly securityAlertService: SecurityAlertService,
  ) {}

  // ============================================
  // DASHBOARD / OVERVIEW
  // ============================================

  @Get('dashboard')
  @ApiOperation({
    summary: 'Dashboard de seguridad',
    description: 'Obtiene resumen completo del estado de seguridad del sistema',
  })
  @ApiResponse({ status: 200, description: 'Dashboard de seguridad' })
  async getDashboard() {
    const [eventStats, blockedIpStats, loginStats, alertCounts, sessionStats] =
      await Promise.all([
        this.securityEventService.getStats(7),
        this.blockedIpService.getStats(),
        this.loginAttemptService.getStats(24),
        this.securityAlertService.countActiveBySeverity(),
        this.activeSessionService.getStats(),
      ]);

    const activeAlerts = await this.securityAlertService.findActive();

    return {
      events: eventStats,
      blockedIps: blockedIpStats,
      loginAttempts: loginStats,
      alerts: {
        active: alertCounts,
        recent: activeAlerts.slice(0, 5),
      },
      sessions: sessionStats,
    };
  }

  // ============================================
  // SECURITY EVENTS
  // ============================================

  @Get('events')
  @ApiOperation({
    summary: 'Listar eventos de seguridad',
    description: 'Lista eventos con filtros y paginacion',
  })
  @ApiResponse({ status: 200, description: 'Lista de eventos' })
  async getEvents(@Query() filter: SecurityEventFilterDto) {
    return this.securityEventService.findAll(filter);
  }

  @Get('events/:id')
  @ApiOperation({ summary: 'Obtener evento por ID' })
  @ApiParam({ name: 'id', description: 'ID del evento' })
  @ApiResponse({ status: 200, description: 'Evento encontrado' })
  async getEvent(@Param('id') id: string) {
    return this.securityEventService.findById(id);
  }

  @Patch('events/:id/review')
  @ApiOperation({
    summary: 'Marcar evento como revisado',
    description: 'Marca un evento de seguridad como revisado por un admin',
  })
  @ApiParam({ name: 'id', description: 'ID del evento' })
  @ApiResponse({ status: 200, description: 'Evento marcado como revisado' })
  async reviewEvent(
    @Param('id') id: string,
    @Body() dto: ReviewEventDto,
    @CurrentUser() user: User,
  ) {
    return this.securityEventService.markAsReviewed(id, user.id, dto.notes);
  }

  @Get('events/stats')
  @ApiOperation({ summary: 'Estadisticas de eventos' })
  @ApiQuery({ name: 'days', required: false, description: 'Dias a analizar' })
  @ApiResponse({ status: 200, description: 'Estadisticas' })
  async getEventStats(@Query('days') days?: number) {
    return this.securityEventService.getStats(days || 7);
  }

  // ============================================
  // BLOCKED IPS
  // ============================================

  @Get('blocked-ips')
  @ApiOperation({
    summary: 'Listar IPs bloqueadas',
    description: 'Lista todas las IPs bloqueadas activas',
  })
  @ApiResponse({ status: 200, description: 'Lista de IPs bloqueadas' })
  async getBlockedIps() {
    return this.blockedIpService.findAllActive();
  }

  @Post('blocked-ips')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Bloquear IP',
    description: 'Bloquea manualmente una IP',
  })
  @ApiResponse({ status: 201, description: 'IP bloqueada' })
  async blockIp(@Body() dto: BlockIpDto, @CurrentUser() user: User) {
    return this.blockedIpService.blockIp(dto.ipAddress, dto.reason, user.id, {
      permanent: dto.permanent,
      durationMinutes: dto.durationMinutes,
    });
  }

  @Delete('blocked-ips/:ip')
  @ApiOperation({
    summary: 'Desbloquear IP',
    description: 'Desbloquea una IP',
  })
  @ApiParam({ name: 'ip', description: 'Direccion IP' })
  @ApiResponse({ status: 200, description: 'IP desbloqueada' })
  async unblockIp(@Param('ip') ip: string, @CurrentUser() user: User) {
    const success = await this.blockedIpService.unblockIp(ip, user.id);
    return {
      success,
      message: success ? 'IP desbloqueada' : 'IP no encontrada',
    };
  }

  @Get('blocked-ips/stats')
  @ApiOperation({ summary: 'Estadisticas de IPs bloqueadas' })
  @ApiResponse({ status: 200, description: 'Estadisticas' })
  async getBlockedIpStats() {
    return this.blockedIpService.getStats();
  }

  // ============================================
  // LOGIN ATTEMPTS
  // ============================================

  @Get('login-attempts')
  @ApiOperation({
    summary: 'Estadisticas de intentos de login',
    description: 'Obtiene estadisticas de intentos de login',
  })
  @ApiQuery({ name: 'hours', required: false, description: 'Horas a analizar' })
  @ApiResponse({ status: 200, description: 'Estadisticas' })
  async getLoginAttemptStats(@Query('hours') hours?: number) {
    return this.loginAttemptService.getStats(hours || 24);
  }

  @Get('login-attempts/ip/:ip')
  @ApiOperation({ summary: 'Intentos de login por IP' })
  @ApiParam({ name: 'ip', description: 'Direccion IP' })
  @ApiResponse({ status: 200, description: 'Intentos de login' })
  async getLoginAttemptsByIp(@Param('ip') ip: string) {
    return this.loginAttemptService.getRecentByIp(ip, 50);
  }

  @Get('login-attempts/email/:email')
  @ApiOperation({ summary: 'Intentos de login por email' })
  @ApiParam({ name: 'email', description: 'Email' })
  @ApiResponse({ status: 200, description: 'Intentos de login' })
  async getLoginAttemptsByEmail(@Param('email') email: string) {
    return this.loginAttemptService.getRecentByEmail(email, 50);
  }

  // ============================================
  // SECURITY CONFIG
  // ============================================

  @Get('config')
  @ApiOperation({
    summary: 'Obtener configuraciones de seguridad',
    description: 'Lista todas las configuraciones de seguridad',
  })
  @ApiResponse({ status: 200, description: 'Configuraciones' })
  async getConfigs() {
    return this.securityConfigService.findAll();
  }

  @Get('config/:category')
  @ApiOperation({ summary: 'Obtener configuraciones por categoria' })
  @ApiParam({ name: 'category', description: 'Categoria' })
  @ApiResponse({ status: 200, description: 'Configuraciones' })
  async getConfigsByCategory(@Param('category') category: string) {
    return this.securityConfigService.findByCategory(category);
  }

  @Patch('config')
  @ApiOperation({
    summary: 'Actualizar configuracion',
    description: 'Actualiza el valor de una configuracion de seguridad',
  })
  @ApiResponse({ status: 200, description: 'Configuracion actualizada' })
  async updateConfig(
    @Body() dto: UpdateSecurityConfigDto,
    @CurrentUser() user: User,
  ) {
    return this.securityConfigService.updateValue(dto.key, dto.value, user.id);
  }

  @Post('config')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Crear configuracion',
    description: 'Crea una nueva configuracion de seguridad',
  })
  @ApiResponse({ status: 201, description: 'Configuracion creada' })
  async createConfig(
    @Body() dto: CreateSecurityConfigDto,
    @CurrentUser() user: User,
  ) {
    return this.securityConfigService.create(
      dto.key,
      dto.value,
      dto.valueType || 'string',
      dto.description,
      dto.category || 'general',
      user.id,
    );
  }

  // ============================================
  // ACTIVE SESSIONS
  // ============================================

  @Get('sessions')
  @ApiOperation({
    summary: 'Estadisticas de sesiones activas',
    description: 'Obtiene estadisticas de todas las sesiones activas',
  })
  @ApiResponse({ status: 200, description: 'Estadisticas de sesiones' })
  async getSessionStats() {
    return this.activeSessionService.getStats();
  }

  @Get('sessions/user/:userId')
  @ApiOperation({ summary: 'Sesiones activas de un usuario' })
  @ApiParam({ name: 'userId', description: 'ID del usuario' })
  @ApiResponse({ status: 200, description: 'Sesiones del usuario' })
  async getUserSessions(@Param('userId') userId: string) {
    return this.activeSessionService.getUserSessions(userId);
  }

  @Delete('sessions/user/:userId')
  @ApiOperation({
    summary: 'Revocar todas las sesiones de un usuario',
    description: 'Cierra todas las sesiones activas de un usuario',
  })
  @ApiParam({ name: 'userId', description: 'ID del usuario' })
  @ApiResponse({ status: 200, description: 'Sesiones revocadas' })
  async revokeUserSessions(@Param('userId') userId: string) {
    const count = await this.activeSessionService.revokeAllUserSessions(userId);
    return { success: true, revokedSessions: count };
  }

  // ============================================
  // SECURITY ALERTS
  // ============================================

  @Get('alerts')
  @ApiOperation({
    summary: 'Listar alertas de seguridad',
    description: 'Lista todas las alertas de seguridad',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    description: 'Filtrar por estado',
  })
  @ApiQuery({
    name: 'severity',
    required: false,
    description: 'Filtrar por severidad',
  })
  @ApiResponse({ status: 200, description: 'Lista de alertas' })
  async getAlerts(
    @Query('status') status?: string,
    @Query('severity') severity?: string,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ) {
    return this.securityAlertService.findAll({
      status: status as any,
      severity: severity as any,
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    });
  }

  @Get('alerts/active')
  @ApiOperation({
    summary: 'Alertas activas',
    description: 'Lista solo alertas activas e investigando',
  })
  @ApiResponse({ status: 200, description: 'Alertas activas' })
  async getActiveAlerts() {
    return this.securityAlertService.findActive();
  }

  @Get('alerts/:id')
  @ApiOperation({ summary: 'Obtener alerta por ID' })
  @ApiParam({ name: 'id', description: 'ID de la alerta' })
  @ApiResponse({ status: 200, description: 'Alerta encontrada' })
  async getAlert(@Param('id') id: string) {
    return this.securityAlertService.findById(id);
  }

  @Patch('alerts/:id/status')
  @ApiOperation({
    summary: 'Actualizar estado de alerta',
    description:
      'Actualiza el estado de una alerta (resolver, descartar, etc.)',
  })
  @ApiParam({ name: 'id', description: 'ID de la alerta' })
  @ApiResponse({ status: 200, description: 'Alerta actualizada' })
  async updateAlertStatus(
    @Param('id') id: string,
    @Body() dto: UpdateAlertStatusDto,
    @CurrentUser() user: User,
  ) {
    return this.securityAlertService.updateStatus(
      id,
      dto.status,
      user.id,
      dto.resolution,
    );
  }

  @Patch('alerts/:id/assign')
  @ApiOperation({
    summary: 'Asignar alerta',
    description: 'Asigna una alerta a un admin para investigacion',
  })
  @ApiParam({ name: 'id', description: 'ID de la alerta' })
  @ApiResponse({ status: 200, description: 'Alerta asignada' })
  async assignAlert(@Param('id') id: string, @Body() dto: AssignAlertDto) {
    return this.securityAlertService.assign(id, dto.assignedToId);
  }

  @Get('alerts/stats')
  @ApiOperation({ summary: 'Estadisticas de alertas' })
  @ApiQuery({ name: 'days', required: false, description: 'Dias a analizar' })
  @ApiResponse({ status: 200, description: 'Estadisticas' })
  async getAlertStats(@Query('days') days?: number) {
    return this.securityAlertService.getStats(days || 30);
  }

  // ============================================
  // MAINTENANCE
  // ============================================

  @Post('maintenance/cleanup')
  @ApiOperation({
    summary: 'Ejecutar limpieza',
    description: 'Limpia bloqueos expirados y sesiones caducadas',
  })
  @ApiResponse({ status: 200, description: 'Limpieza completada' })
  async runCleanup() {
    const [expiredBlocks, expiredSessions] = await Promise.all([
      this.blockedIpService.cleanExpiredBlocks(),
      this.activeSessionService.cleanExpiredSessions(),
    ]);

    return {
      success: true,
      cleaned: {
        expiredBlocks,
        expiredSessions,
      },
    };
  }
}
