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

const BEARER_HEADER = /^Bearer ([^\s]+)$/i;

type AccessClaims = { sub?: unknown; exp?: unknown; sid?: unknown };

function accessClaims(payload: AccessClaims) {
  if (
    typeof payload.sub !== 'string' ||
    !isUUID(payload.sub) ||
    typeof payload.exp !== 'number'
  ) {
    throw new Error('Invalid token claims');
  }

  if (payload.sid === undefined)
    return { subject: payload.sub, sessionId: undefined };
  if (typeof payload.sid !== 'string' || !isUUID(payload.sid))
    throw new Error('Invalid session');
  return { subject: payload.sub, sessionId: payload.sid };
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const match = BEARER_HEADER.exec(request.headers.authorization ?? '');
    if (!match) throw new UnauthorizedException();

    let subject: string;
    let sessionId: string | undefined;
    try {
      const payload = await this.jwt.verifyAsync<AccessClaims>(match[1], {
        algorithms: ['HS256'],
      });
      const claims = accessClaims(payload);
      subject = claims.subject;
      sessionId = claims.sessionId;
    } catch {
      throw new UnauthorizedException();
    }

    // Use current account state, so deactivation and role changes apply immediately.
    const user = await this.prisma.user.findUnique({
      where: { id: subject },
      select: { id: true, role: true, isActive: true },
    });
    if (!user?.isActive) throw new UnauthorizedException();

    if (
      sessionId &&
      !(await this.prisma.refreshSession.findFirst({
        where: {
          familyId: sessionId,
          userId: subject,
          consumedAt: null,
          revokedAt: null,
          expiresAt: { gt: new Date() },
        },
        select: { id: true },
      }))
    )
      throw new UnauthorizedException();

    request.user = { id: user.id, role: user.role };

    return true;
  }
}

// Public reads may personalize access flags, but supplied credentials must be valid.
@Injectable()
export class OptionalJwtAuthGuard extends JwtAuthGuard {
  override canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<Request>();
    if (!request.headers.authorization) return Promise.resolve(true);

    return super.canActivate(context);
  }
}
