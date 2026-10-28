import { JwtService } from '@nestjs/jwt';
import { isUUID } from 'class-validator';
import { type OnModuleDestroy } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  type OnGatewayInit,
} from '@nestjs/websockets';
import type { Namespace, Socket } from 'socket.io';
import { AuctionEvents } from '../events/auction-events.js';
import { PrismaService } from '../prisma/prisma.service.js';

@WebSocketGateway({
  namespace: '/auctions',
  transports: ['websocket'],
  maxHttpBufferSize: 4096,
})
export class AuctionGateway
  implements OnGatewayInit<Namespace>, OnModuleDestroy
{
  private unsubscribe?: () => void;
  private unsubscribeAccount?: () => void;
  private readonly pending = new WeakSet<Socket>();
  constructor(
    private readonly events: AuctionEvents,
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  afterInit(server: Namespace) {
    this.unsubscribe = this.events.subscribe((event) => {
      server.to(`lot:${event.lotId}`).emit('lot.changed', event);
      server
        .to('collection')
        .emit('collection.changed', { lotId: event.lotId, type: event.type });
    });
    this.unsubscribeAccount = this.events.subscribeAccount(async (userId) => {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { isActive: true },
      });
      for (const client of await server
        .in(`account:${userId}`)
        .fetchSockets()) {
        if (
          !user?.isActive ||
          client.data.accountExpiresAt <= Date.now() ||
          (client.data.accountSessionId &&
            !(await this.prisma.refreshSession.findFirst({
              where: {
                familyId: client.data.accountSessionId,
                userId,
                revokedAt: null,
                consumedAt: null,
                expiresAt: { gt: new Date() },
              },
              select: { id: true },
            })))
        ) {
          client.leave(`account:${userId}`);
          client.emit('account.expired');
        } else client.emit('account.changed');
      }
    });
  }

  @SubscribeMessage('collection.subscribe')
  async collection(@ConnectedSocket() client: Socket) {
    await client.join('collection');
    return { ok: true };
  }

  @SubscribeMessage('account.subscribe')
  async account(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: unknown,
  ) {
    // Identity comes only from a verified JWT, never a client-supplied user ID.
    if (this.pending.has(client)) return { ok: false };
    this.pending.add(client);
    try {
      for (const room of client.rooms)
        if (room.startsWith('account:')) await client.leave(room);
      if (
        !body ||
        typeof body !== 'object' ||
        !('token' in body) ||
        typeof body.token !== 'string'
      )
        return { ok: false };
      const payload = await this.jwt.verifyAsync<{
        sub: string;
        exp: number;
        sid?: string;
      }>(body.token, { algorithms: ['HS256'] });
      if (
        !isUUID(payload.sub) ||
        typeof payload.exp !== 'number' ||
        payload.exp * 1000 <= Date.now()
      )
        return { ok: false };
      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        select: { isActive: true },
      });
      if (!user?.isActive || !client.connected) return { ok: false };
      if (
        payload.sid &&
        (!isUUID(payload.sid) ||
          !(await this.prisma.refreshSession.findFirst({
            where: {
              familyId: payload.sid,
              userId: payload.sub,
              revokedAt: null,
              consumedAt: null,
              expiresAt: { gt: new Date() },
            },
            select: { id: true },
          })))
      )
        return { ok: false };
      client.data.accountSessionId = payload.sid;
      client.data.accountExpiresAt = payload.exp * 1000;
      await client.join(`account:${payload.sub}`);
      return { ok: true };
    } catch {
      return { ok: false };
    } finally {
      this.pending.delete(client);
    }
  }

  @SubscribeMessage('lot.subscribe')
  async subscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: unknown,
  ) {
    const lotId =
      body &&
      typeof body === 'object' &&
      'lotId' in body &&
      typeof body.lotId === 'string'
        ? body.lotId.toLowerCase()
        : '';
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(
        lotId,
      )
    )
      return { ok: false, error: 'Invalid lot ID' };
    if (this.pending.has(client))
      return { ok: false, error: 'Subscription pending' };
    this.pending.add(client);
    try {
      const lot = await this.prisma.lot.findUnique({
        where: { id: lotId },
        select: { status: true },
      });
      if (!lot || !['scheduled', 'open', 'closed'].includes(lot.status))
        return { ok: false, error: 'Lot unavailable' };
      if (!client.connected) return { ok: false, error: 'Disconnected' };
      // One public lot per connection; no arbitrary room names or private feeds.
      for (const room of client.rooms)
        if (room.startsWith('lot:')) await client.leave(room);
      await client.join(`lot:${lotId}`);
      return { ok: true, lotId };
    } catch {
      return { ok: false, error: 'Subscription unavailable' };
    } finally {
      this.pending.delete(client);
    }
  }

  onModuleDestroy() {
    this.unsubscribe?.();
    this.unsubscribeAccount?.();
  }
}
