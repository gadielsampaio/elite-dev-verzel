import { configureTestValidation } from '../../test/support/http-app.js';
import { Test } from '@nestjs/testing';
import { type INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { vi } from 'vitest';
import { AppModule } from '../app.module.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { BidReadsService } from './bid-reads.service.js';
import { BidsService } from './bids.service.js';
describe('Bid HTTP access and validation', () => {
  const id = '11111111-1111-4111-8111-111111111111',
    key = '22222222-2222-4222-8222-222222222222';
  const history = vi.fn(),
    mine = vi.fn();
  const place = vi.fn(),
    findUnique = vi.fn();
  let app: INestApplication, token: string;
  beforeAll(async () => {
    vi.stubEnv('JWT_SECRET', 'test-only-secret-with-at-least-32-characters');
    vi.stubEnv('CATALOG_PROVIDER', 'mock');
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue({ user: { findUnique } })
      .overrideProvider(BidReadsService)
      .useValue({ history, mine })
      .overrideProvider(BidsService)
      .useValue({ place })
      .compile();
    token = await module.get(JwtService).signAsync({ sub: id });
    app = module.createNestApplication();
    configureTestValidation(app);
    await app.init();
  });

  beforeEach(() => {
    vi.resetAllMocks();
    findUnique.mockResolvedValue({ id, role: 'bidder', isActive: true });
    place.mockResolvedValue({ id: key, amount: '100.00' });
  });

  afterAll(async () => {
    await app.close();
    vi.unstubAllEnvs();
  });
  const send = (patch = {}) =>
    request(app.getHttpServer())
      .post(`/lots/${id}/bids`)
      .auth(token, { type: 'bearer' })
      .send({ amount: '100.00', idempotencyKey: key, ...patch });
  it('uses the authenticated bidder and responds 201', async () => {
    await send().expect(201);
    expect(place).toHaveBeenCalledWith(id, id, {
      amount: '100.00',
      idempotencyKey: key,
    });
  });

  it('allows public paginated history', async () => {
    history.mockResolvedValue({ items: [] });
    await request(app.getHttpServer())
      .get(`/lots/${id}/bids?page=2&limit=5`)
      .expect(200);
    expect(history).toHaveBeenCalledWith(id, { page: 2, limit: 5 });
  });

  it.each(['page=0', 'limit=51', 'page=1.5', 'bidderId=other'])(
    'rejects history query %s',
    async (query) => {
      await request(app.getHttpServer())
        .get(`/lots/${id}/bids?${query}`)
        .expect(400);
      expect(history).not.toHaveBeenCalled();
    },
  );
  it('requires authentication for own position', async () => {
    await request(app.getHttpServer()).get(`/lots/${id}/bids/me`).expect(401);
    expect(mine).not.toHaveBeenCalled();
  });

  it('reads only the authenticated user position', async () => {
    mine.mockResolvedValue({ position: null });
    await request(app.getHttpServer())
      .get(`/lots/${id}/bids/me`)
      .auth(token, { type: 'bearer' })
      .expect(200);
    expect(mine).toHaveBeenCalledWith(id, id);
  });

  it('requires login', async () => {
    await request(app.getHttpServer())
      .post(`/lots/${id}/bids`)
      .send({})
      .expect(401);
  });

  it.each(['auctioneer', 'admin'])('rejects %s', async (role) => {
    findUnique.mockResolvedValue({ id, role, isActive: true });
    await send().expect(403);
    expect(place).not.toHaveBeenCalled();
  });

  it.each([
    { amount: 100 },
    { amount: '-1' },
    { amount: '1.001' },
    { amount: '1e3' },
    { amount: '100000000000000000' },
    { amount: null },
    { idempotencyKey: 'invalid' },
    { bidderId: id },
    { isWinner: true },
    { lotId: id },
  ])('rejects invalid body %j', async (patch) => {
    await send(patch).expect(400);
    expect(place).not.toHaveBeenCalled();
  });

  it('rejects invalid UUID', async () => {
    await request(app.getHttpServer())
      .post('/lots/invalid/bids')
      .auth(token, { type: 'bearer' })
      .send({ amount: '100.00', idempotencyKey: key })
      .expect(400);
  });
});
