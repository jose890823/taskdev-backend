import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Guard para validar refresh tokens
 * Usa la estrategia 'jwt-refresh'
 */
@Injectable()
export class JwtRefreshGuard extends AuthGuard('jwt-refresh') {}
