import {
  Controller,
  Get,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
  ParseEnumPipe,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { UsersService } from './services/users.service';
import { UserActivityService } from './services/user-activity.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { User, UserRole } from '../auth/entities/user.entity';
import { UserActivity } from './entities/user-activity.entity';
import { UserFilterDto } from './dto/user-filter.dto';
import { UpdateUserAdminDto } from './dto/update-user-admin.dto';

@ApiTags('Users - Admin')
@Controller('users/admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN)
@ApiBearerAuth()
export class UsersAdminController {
  constructor(
    private readonly usersService: UsersService,
    private readonly activityService: UserActivityService,
  ) {}

  // ============================================
  // USER MANAGEMENT
  // ============================================

  @Get('all')
  @ApiOperation({
    summary: 'Get all users (Admin)',
    description: 'Get all users with filters and pagination',
  })
  @ApiResponse({
    status: 200,
    description: 'List of users',
  })
  async getAllUsers(@Query() filter: UserFilterDto) {
    return this.usersService.findAll(filter);
  }

  @Get('search')
  @ApiOperation({
    summary: 'Search users (Admin)',
    description: 'Search users by email or name',
  })
  @ApiQuery({
    name: 'q',
    description: 'Search query',
    example: 'juan',
  })
  @ApiQuery({
    name: 'limit',
    description: 'Maximum results',
    required: false,
    example: 10,
  })
  @ApiResponse({
    status: 200,
    description: 'Search results',
    type: [User],
  })
  async searchUsers(@Query('q') query: string, @Query('limit') limit?: number) {
    return this.usersService.searchUsers(query, limit);
  }

  @Get('search/fullname')
  @ApiOperation({
    summary: 'Search users by full name (Admin)',
    description:
      'Search users by full name (firstName + lastName). Supports accents and partial matches.',
  })
  @ApiQuery({
    name: 'name',
    description: 'Full name to search (e.g., "Juan Pérez" or "laura ubeda")',
    example: 'Juan Pérez',
  })
  @ApiQuery({
    name: 'limit',
    description: 'Maximum results',
    required: false,
    example: 10,
  })
  @ApiResponse({
    status: 200,
    description: 'Search results',
    type: [User],
  })
  async searchByFullName(
    @Query('name') fullName: string,
    @Query('limit') limit?: number,
  ) {
    return this.usersService.searchByFullName(fullName, limit);
  }

  @Get('by-slug/:slug')
  @ApiOperation({
    summary: 'Get user by slug (Admin)',
    description: 'Find a user by their URL-friendly slug (e.g., "juan-perez")',
  })
  @ApiParam({
    name: 'slug',
    description: 'User slug',
    example: 'juan-perez',
  })
  @ApiResponse({
    status: 200,
    description: 'User found',
    type: User,
  })
  @ApiResponse({
    status: 404,
    description: 'User not found',
  })
  async getUserBySlug(@Param('slug') slug: string) {
    return this.usersService.findBySlug(slug);
  }

  @Get('stats')
  @ApiOperation({
    summary: 'Get user statistics (Admin)',
    description: 'Get comprehensive user statistics',
  })
  @ApiResponse({
    status: 200,
    description: 'User statistics',
  })
  async getStats() {
    return this.usersService.getStats();
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get user by ID (Admin)',
    description: 'Get detailed user information',
  })
  @ApiParam({
    name: 'id',
    description: 'User ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiResponse({
    status: 200,
    description: 'User found',
    type: User,
  })
  @ApiResponse({
    status: 404,
    description: 'User not found',
  })
  async getUser(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.findById(id);
  }

  @Put(':id')
  @ApiOperation({
    summary: 'Update user (Admin)',
    description:
      'Update any field of a user. Admins can modify profile, role, verification status, etc. Only super admins can change email/phone verification status.',
  })
  @ApiParam({
    name: 'id',
    description: 'User ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiResponse({
    status: 200,
    description: 'User updated successfully',
    type: User,
  })
  @ApiResponse({
    status: 404,
    description: 'User not found',
  })
  @ApiResponse({
    status: 400,
    description: 'Cannot perform this action (e.g., demoting last super admin)',
  })
  @ApiResponse({
    status: 403,
    description: 'Only super admins can change verification status',
  })
  @ApiResponse({
    status: 409,
    description: 'Email already in use',
  })
  async updateUser(
    @CurrentUser() currentUser: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateDto: UpdateUserAdminDto,
  ) {
    return this.usersService.updateUserAdmin(id, updateDto, currentUser);
  }

  // ============================================
  // USER ROLE MANAGEMENT
  // ============================================

  @Patch(':id/role')
  @Roles(UserRole.SUPER_ADMIN) // Only super admin can change roles
  @ApiOperation({
    summary: 'Update user role (Super Admin)',
    description: 'Change user role (only super admins)',
  })
  @ApiParam({
    name: 'id',
    description: 'User ID',
  })
  @ApiResponse({
    status: 200,
    description: 'Role updated',
    type: User,
  })
  async updateRole(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('role', new ParseEnumPipe(UserRole)) role: UserRole,
  ) {
    return this.usersService.updateRole(id, role);
  }

  // ============================================
  // USER STATUS MANAGEMENT
  // ============================================

  @Patch(':id/activate')
  @ApiOperation({
    summary: 'Activate user (Admin)',
    description: 'Activate a deactivated user',
  })
  @ApiParam({
    name: 'id',
    description: 'User ID',
  })
  @ApiResponse({
    status: 200,
    description: 'User activated',
    type: User,
  })
  async activateUser(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.toggleActive(id, true);
  }

  @Patch(':id/deactivate')
  @ApiOperation({
    summary: 'Deactivate user (Admin)',
    description: 'Deactivate a user (prevents login)',
  })
  @ApiParam({
    name: 'id',
    description: 'User ID',
  })
  @ApiResponse({
    status: 200,
    description: 'User deactivated',
    type: User,
  })
  async deactivateUser(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.toggleActive(id, false);
  }

  @Delete(':id')
  @Roles(UserRole.SUPER_ADMIN) // Only super admin can delete users
  @ApiOperation({
    summary: 'Delete user (Super Admin)',
    description: 'Soft delete a user (only super admins)',
  })
  @ApiParam({
    name: 'id',
    description: 'User ID',
  })
  @ApiResponse({
    status: 200,
    description: 'User deleted',
  })
  async deleteUser(@Param('id', ParseUUIDPipe) id: string) {
    await this.usersService.deleteUser(id);

    return {
      success: true,
      message: 'User deleted successfully',
    };
  }

  // ============================================
  // USER ACTIVITY / AUDIT TRAIL
  // ============================================

  @Get(':id/activity')
  @ApiOperation({
    summary: 'Get user activity history (Admin)',
    description: 'Get complete audit trail of user activities',
  })
  @ApiParam({
    name: 'id',
    description: 'User ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiQuery({
    name: 'limit',
    description: 'Number of activities to return',
    required: false,
    example: 50,
  })
  @ApiQuery({
    name: 'offset',
    description: 'Offset for pagination',
    required: false,
    example: 0,
  })
  @ApiResponse({
    status: 200,
    description: 'User activity history',
    type: [UserActivity],
  })
  @ApiResponse({
    status: 404,
    description: 'User not found',
  })
  async getUserActivity(
    @Param('id', ParseUUIDPipe) userId: string,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ) {
    // Verify user exists
    await this.usersService.findById(userId);

    const result = await this.activityService.getUserActivities(userId, {
      limit: limit ? parseInt(limit.toString()) : 50,
      offset: offset ? parseInt(offset.toString()) : 0,
    });

    // Return activities array directly with total in meta
    return {
      activities: result.data,
      total: result.pagination.total,
    };
  }

  @Get(':id/activity/stats')
  @ApiOperation({
    summary: 'Get user activity statistics (Admin)',
    description: 'Get aggregated statistics about user activities',
  })
  @ApiParam({
    name: 'id',
    description: 'User ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiResponse({
    status: 200,
    description: 'User activity statistics',
  })
  @ApiResponse({
    status: 404,
    description: 'User not found',
  })
  async getUserActivityStats(@Param('id', ParseUUIDPipe) userId: string) {
    // Verify user exists
    await this.usersService.findById(userId);

    return this.activityService.getUserActivityStats(userId);
  }
}
