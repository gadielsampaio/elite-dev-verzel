import { JwtService } from '@nestjs/jwt';
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
    vi.stubEnv('JWT_SECRET', 'realtime-test-secret-32-characters-minimum');
    const module = await Test.createTestingModule({ imports: [RealtimeModule] })
      .overrideProvider(PrismaService)
      .useValue({
        user: {
          findUnique: ({ where }: { where: { id: string } }) =>
            Promise.resolve(
              [first, second].includes(where.id) ? { isActive: true } : null,
            ),
        },
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
    vi.unstubAllEnvs();
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
  it('broadcasts collection changes without private fields', async () => {
    const client = await connect();
    expect(
      await client.timeout(2000).emitWithAck('collection.subscribe'),
    ).toEqual({ ok: true });
    const received = new Promise((resolve) =>
      client.once('collection.changed', resolve),
    );
    events.publish({
      type: 'lot.created',
      lotId: first,
      endTime: new Date().toISOString(),
    });
    expect(await received).toEqual({ type: 'lot.created', lotId: first });
  });
  it('keeps wallet notifications private and rejects expired/invalid tokens', async () => {
    const a = await connect(),
      b = await connect(),
      guest = await connect();
    const jwt = app.get(JwtService);
    const account = (client: Socket, token: string) =>
      client.timeout(2000).emitWithAck('account.subscribe', { token });
    expect(await account(guest, 'bad-token')).toEqual({ ok: false });
    expect(
      await account(
        guest,
        await jwt.signAsync({ sub: first }, { expiresIn: -1 }),
      ),
    ).toEqual({ ok: false });
    expect(await account(a, await jwt.signAsync({ sub: first }))).toEqual({
      ok: true,
    });
    expect(await account(b, await jwt.signAsync({ sub: second }))).toEqual({
      ok: true,
    });
    const other = vi.fn(),
      anonymous = vi.fn();
    b.on('account.changed', other);
    guest.on('account.changed', anonymous);
    const received = new Promise((resolve) =>
      a.once('account.changed', () => resolve(true)),
    );
    events.publishAccount(first);
    expect(await received).toBe(true);
    await b.timeout(2000).emitWithAck('collection.subscribe');
    await guest.timeout(2000).emitWithAck('collection.subscribe');
    expect(other).not.toHaveBeenCalled();
    expect(anonymous).not.toHaveBeenCalled();
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
