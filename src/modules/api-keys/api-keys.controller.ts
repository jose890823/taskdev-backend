import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { User } from '../auth/entities/user.entity';
import { CreateApiKeyDto, ReplaceApiKeyDto, RevokeApiKeyDto } from './dto';
import { ApiKeyService } from './api-key.service';

@ApiTags('API Keys')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api-keys')
export class ApiKeysController {
  constructor(private readonly apiKeyService: ApiKeyService) {}

  @Get()
  @ApiOperation({ summary: 'List API keys owned by the authenticated user' })
  @ApiResponse({ status: 200, description: 'Safe API key metadata' })
  async list(
    @CurrentUser() user: User,
    @Query('ownerId') ownerId: string | undefined,
    @Req() request: Request,
  ) {
    return this.apiKeyService.list(user, ownerId, request);
  }

  @Post()
  @ApiOperation({ summary: 'Create an API key and reveal its secret once' })
  @ApiResponse({ status: 201, description: 'Created key with one-time secret' })
  async create(
    @Body() dto: CreateApiKeyDto,
    @CurrentUser() user: User,
    @Req() request: Request,
  ) {
    return this.apiKeyService.create(dto, user, request);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Inspect safe API key metadata' })
  @ApiResponse({ status: 200, description: 'Safe API key metadata' })
  async findOne(
    @Param('id') id: string,
    @CurrentUser() user: User,
    @Req() request: Request,
  ) {
    return this.apiKeyService.findOne(id, user, request);
  }

  @Post(':id/revoke')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoke an API key immediately' })
  @ApiResponse({ status: 200, description: 'Revoked API key metadata' })
  async revoke(
    @Param('id') id: string,
    @Body() dto: RevokeApiKeyDto,
    @CurrentUser() user: User,
    @Req() request: Request,
  ) {
    return this.apiKeyService.revoke(id, user, dto.reason, request);
  }

  @Post(':id/replace')
  @ApiOperation({ summary: 'Replace a key and reveal the new secret once' })
  @ApiResponse({
    status: 201,
    description: 'Replacement key with one-time secret',
  })
  async replace(
    @Param('id') id: string,
    @Body() dto: ReplaceApiKeyDto,
    @CurrentUser() user: User,
    @Req() request: Request,
  ) {
    return this.apiKeyService.replace(id, dto, user, request);
  }

  @Post(':id/recover')
  @HttpCode(HttpStatus.GONE)
  @ApiOperation({
    summary: 'Reject lost API key secret recovery',
    description:
      'The secret is never recoverable. Revoke the key and create a replacement.',
  })
  @ApiResponse({
    status: 410,
    description:
      'The secret cannot be recovered; revoke the key and create a replacement.',
  })
  @ApiResponse({ status: 401, description: 'JWT authentication required' })
  @ApiResponse({ status: 403, description: 'Management disabled or forbidden' })
  async recover(
    @Param('id') id: string,
    @CurrentUser() user: User,
    @Req() request: Request,
  ): Promise<never> {
    return this.apiKeyService.recover(id, user, request);
  }
}
