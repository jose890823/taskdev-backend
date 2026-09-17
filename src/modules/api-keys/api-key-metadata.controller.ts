import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../auth/entities/user.entity';
import { ApiKeyMetadataOnly } from './decorators';
import { CombinedAuthGuard } from './guards';
import type { ApiKeyRequest } from './api-key.types';

/** Metadata-only identity endpoint used by MCP clients. */
@ApiTags('Authentication')
@ApiBearerAuth()
@Controller('auth')
export class ApiKeyMetadataController {
  @Get('whoami')
  @UseGuards(CombinedAuthGuard)
  @ApiKeyMetadataOnly()
  @ApiOperation({ summary: 'Return safe authenticated identity metadata' })
  getWhoAmI(@CurrentUser() user: User, @Req() request: ApiKeyRequest) {
    const identity = request.identity;

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        roles: user.roles,
        isActive: user.isActive,
      },
      authType: identity?.authType || 'jwt',
      key: identity
        ? {
            id: identity.keyId,
            projectId: identity.projectId,
            scopes: identity.scopes,
          }
        : null,
    };
  }
}
