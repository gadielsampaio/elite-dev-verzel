import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { io, type Socket } from 'socket.io-client';
import { RealtimeModule } from '../src/realtime/realtime.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { AuctionEvents } from '../src/events/auction-events.js';

const first = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
const second = 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb';
describe('Auction WebSocket rooms', () => {
  let app: INestApplication;
  let events: AuctionEvents;
  let url: string;
  const clients: Socket[] = [];
  beforeEach(async () => {
    const module = await Test.createTestingModule({ imports: [RealtimeModule] })
      .overrideProvider(PrismaService)
      .useValue({
        lot: {
          findUnique: ({ where }: { where: { id: string } }) =>
            Promise.resolve(
              [first, second].includes(where.id) ? { status: 'open' } : null,
            ),
        },
      })
      .compile();
    app = module.createNestApplication();
    await app.listen(0, '127.0.0.1');
    url = await app.getUrl();
    events = app.get(AuctionEvents);
  });
  afterEach(async () => {
    clients.splice(0).forEach((client) => client.disconnect());
    await app.close();
  });
  async function connect() {
    const client = io(`${url}/auctions`, {
      transports: ['websocket'],
      forceNew: true,
      reconnection: false,
    });
    clients.push(client);
    await new Promise<void>((resolve, reject) => {
      client.once('connect', () => resolve());
      client.once('connect_error', reject);
    });
    return client;
  }
  const subscribe = (client: Socket, lotId: string) =>
    client.timeout(2000).emitWithAck('lot.subscribe', { lotId }) as Promise<{
      ok: boolean;
      lotId?: string;
    }>;
  it('rejects malformed and unavailable lots', async () => {
    const client = await connect();
    expect((await subscribe(client, 'invalid')).ok).toBe(false);
    expect(
      (await subscribe(client, 'cccccccc-cccc-4ccc-cccc-cccccccccccc')).ok,
    ).toBe(false);
  });
  it('delivers committed signals only to the selected room and supports switching', async () => {
    const a = await connect(),
      b = await connect();
    expect(await subscribe(a, first)).toEqual({ ok: true, lotId: first });
    await subscribe(b, second);
    const receivedA: unknown[] = [],
      receivedB: unknown[] = [];
    a.on('lot.changed', (event: unknown) => receivedA.push(event));
    b.on('lot.changed', (event: unknown) => receivedB.push(event));
    const change = {
      type: 'bid.accepted' as const,
      lotId: first,
      bidId: second,
      endTime: '2026-11-01T00:00:00.000Z',
    };
    events.publish(change);
    // Acknowledgements on each socket are ordering barriers after the event.
    await subscribe(a, first);
    await subscribe(b, second);
    expect(receivedA).toEqual([change]);
    expect(receivedB).toEqual([]);
    await subscribe(a, second);
    events.publish(change);
    const extension = {
      ...change,
      type: 'lot.extended' as const,
      lotId: second,
    };
    events.publish(extension);
    await subscribe(a, second);
    await subscribe(b, second);
    expect(receivedA).toEqual([change, extension]);
    expect(receivedB).toEqual([extension]);
  });
  it('allows a disconnected client to reconnect and subscribe again', async () => {
    const client = await connect();
    await subscribe(client, first);
    client.disconnect();
    client.connect();
    await new Promise<void>((resolve) =>
      client.once('connect', () => resolve()),
    );
    expect(await subscribe(client, first)).toEqual({ ok: true, lotId: first });
  });
});
