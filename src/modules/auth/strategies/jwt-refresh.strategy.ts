import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';

/**
 * Payload del JWT Refresh Token
 */
export interface JwtRefreshPayload {
  sub: string; // ID del usuario
  email: string;
}

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(
  Strategy,
  'jwt-refresh',
) {
  constructor(
    private configService: ConfigService,
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromBodyField('refreshToken'),
      secretOrKey:
        configService.get<string>('JWT_REFRESH_SECRET') ||
        'default-refresh-secret',
      ignoreExpiration: false,
    });
  }

  /**
   * Valida el payload del refresh token y retorna el usuario
   */
  async validate(payload: JwtRefreshPayload): Promise<User> {
    const { sub: userId } = payload;

    // Buscar usuario en la base de datos
    const user = await this.userRepository.findOne({
      where: { id: userId, isActive: true },
    });

    if (!user) {
      throw new UnauthorizedException(
        'Usuario no encontrado o inactivo para refresh token',
      );
    }

    return user;
  }
}
