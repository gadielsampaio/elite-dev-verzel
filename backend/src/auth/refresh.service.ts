import {
  ACCESS_TOKEN_TTL_SECONDS,
  REFRESH_TOKEN_BYTES,
  REFRESH_TOKEN_TTL_MS,
  REFRESH_TOKEN_PATTERN,
} from './token.constants.js';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { JwtService } from '@nestjs/jwt';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

const digest = (token: string) =>
  createHash('sha256').update(token).digest('hex');
const validToken = (token: string | undefined): token is string =>
  !!token && REFRESH_TOKEN_PATTERN.test(token);

// Serialize all rotation/revocation operations for a token family in this transaction.
async function lockRefreshFamily(
  tx: Prisma.TransactionClient,
  familyId: string,
) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${familyId}, 0))`;
}

@Injectable()
export class RefreshService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async issue(user: { id: string; role: string }) {
    const familyId = randomUUID();
    const refreshToken = randomBytes(REFRESH_TOKEN_BYTES).toString('base64url');
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);
    const accessToken = await this.jwt.signAsync({
      sub: user.id,
      role: user.role,
      sid: familyId,
    });
    await this.prisma.refreshSession.create({
      data: {
        familyId,
        userId: user.id,
        tokenHash: digest(refreshToken),
        expiresAt,
      },
    });

    return {
      accessToken,
      tokenType: 'Bearer',
      expiresIn: ACCESS_TOKEN_TTL_SECONDS,
      refreshToken,
      expiresAt,
    };
  }

  async rotate(token?: string) {
    if (!validToken(token))
      throw new UnauthorizedException('Refresh session expired');

    const result = await this.prisma.$transaction(async (tx) => {
      const previous = await tx.refreshSession.findUnique({
        where: { tokenHash: digest(token) },
      });
      if (!previous) return null;

      await lockRefreshFamily(tx, previous.familyId);
      const current = await tx.refreshSession.findUniqueOrThrow({
        where: { id: previous.id },
      });
      const user = await tx.user.findUnique({ where: { id: current.userId } });
      const now = new Date();
      if (
        current.consumedAt ||
        current.revokedAt ||
        current.expiresAt <= now ||
        !user?.isActive
      ) {
        // Return instead of throwing: revocation must commit even on replay.
        await tx.refreshSession.updateMany({
          where: { familyId: current.familyId, revokedAt: null },
          data: { revokedAt: now },
        });
        return null;
      }

      const refreshToken =
        randomBytes(REFRESH_TOKEN_BYTES).toString('base64url');
      await tx.refreshSession.update({
        where: { id: current.id },
        data: { consumedAt: now },
      });
      await tx.refreshSession.create({
        data: {
          familyId: current.familyId,
          userId: current.userId,
          tokenHash: digest(refreshToken),
          expiresAt: current.expiresAt,
        },
      });
      const accessToken = await this.jwt.signAsync({
        sub: user.id,
        role: user.role,
        sid: current.familyId,
      });
      return {
        accessToken,
        tokenType: 'Bearer',
        expiresIn: ACCESS_TOKEN_TTL_SECONDS,
        refreshToken,
        expiresAt: current.expiresAt,
      };
    });

    if (!result) throw new UnauthorizedException('Refresh session expired');

    return result;
  }

  async revoke(token?: string) {
    if (!validToken(token)) return;

    await this.prisma.$transaction(async (tx) => {
      const current = await tx.refreshSession.findUnique({
        where: { tokenHash: digest(token) },
      });
      if (!current) return;

      await lockRefreshFamily(tx, current.familyId);
      await tx.refreshSession.updateMany({
        where: { familyId: current.familyId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    });
  }
}
