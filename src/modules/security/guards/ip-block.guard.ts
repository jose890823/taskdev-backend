import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { BlockedIpService } from '../services/blocked-ip.service';
import { Request } from 'express';

export const SKIP_IP_CHECK = 'skipIpCheck';

@Injectable()
export class IpBlockGuard implements CanActivate {
  private readonly logger = new Logger(IpBlockGuard.name);

  constructor(
    private readonly blockedIpService: BlockedIpService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Verificar si el endpoint tiene el decorator para saltar la verificacion
    const skipCheck = this.reflector.getAllAndOverride<boolean>(SKIP_IP_CHECK, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (skipCheck) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const ipAddress = this.getClientIp(request);

    const isBlocked = await this.blockedIpService.isBlocked(ipAddress);

    if (isBlocked) {
      this.logger.warn(`Acceso denegado a IP bloqueada: ${ipAddress}`);
      throw new ForbiddenException({
        message:
          'Tu IP ha sido bloqueada temporalmente debido a actividad sospechosa.',
        code: 'IP_BLOCKED',
      });
    }

    return true;
  }

  private getClientIp(request: Request): string {
    const forwardedFor = request.headers['x-forwarded-for'];
    if (forwardedFor) {
      const ips = Array.isArray(forwardedFor)
        ? forwardedFor[0]
        : forwardedFor.split(',')[0];
      return ips.trim();
    }

    const realIp = request.headers['x-real-ip'];
    if (realIp) {
      return Array.isArray(realIp) ? realIp[0] : realIp;
    }

    return request.ip || request.socket.remoteAddress || 'unknown';
  }
}
