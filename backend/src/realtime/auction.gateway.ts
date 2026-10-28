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
  private readonly pending = new WeakSet<Socket>();
  constructor(
    private readonly events: AuctionEvents,
    private readonly prisma: PrismaService,
  ) {}

  afterInit(server: Namespace) {
    this.unsubscribe = this.events.subscribe((event) => {
      server.to(`lot:${event.lotId}`).emit('lot.changed', event);
    });
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
  }
}
