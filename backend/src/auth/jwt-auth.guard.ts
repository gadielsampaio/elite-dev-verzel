import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { isUUID } from 'class-validator';
import type { Request } from 'express';
import type { UserRole } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

export interface AuthenticatedRequest extends Request {
  user: { id: string; role: UserRole };
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const match = /^Bearer ([^\s]+)$/i.exec(
      request.headers.authorization ?? '',
    );
    if (!match) throw new UnauthorizedException();

    let subject: string;
    try {
      const payload = await this.jwt.verifyAsync<{
        sub?: unknown;
        exp?: unknown;
      }>(match[1], {
        algorithms: ['HS256'],
      });
      if (
        typeof payload.sub !== 'string' ||
        !isUUID(payload.sub) ||
        typeof payload.exp !== 'number'
      ) {
        throw new Error('Invalid token claims');
      }
      subject = payload.sub;
    } catch {
      throw new UnauthorizedException();
    }

    // Use current account state, so deactivation and role changes apply immediately.
    const user = await this.prisma.user.findUnique({
      where: { id: subject },
      select: { id: true, role: true, isActive: true },
    });
    if (!user?.isActive) throw new UnauthorizedException();
    request.user = { id: user.id, role: user.role };
    return true;
  }
}
