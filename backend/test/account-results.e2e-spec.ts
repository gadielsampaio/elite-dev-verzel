import { Test } from '@nestjs/testing';
import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { vi } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { AccountResultsService } from '../src/settlement/account-results.service.js';

describe('Private results HTTP authorization', () => {
  const id = '11111111-1111-4111-8111-111111111111';
  const summary = vi.fn(),
    seller = vi.fn(),
    participations = vi.fn(),
    findUnique = vi.fn();
  let app: INestApplication, token: string;
  beforeAll(async () => {
    vi.stubEnv('JWT_SECRET', 'test-only-secret-with-at-least-32-characters');
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue({ user: { findUnique } })
      .overrideProvider(AccountResultsService)
      .useValue({ summary, seller, participations })
      .compile();
    token = await module.get(JwtService).signAsync({ sub: id });
    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();
  });
  beforeEach(() => {
    vi.resetAllMocks();
    findUnique.mockResolvedValue({ id, role: 'auctioneer', isActive: true });
    summary.mockResolvedValue({ sold: 0, totalReceived: '0.00' });
    seller.mockResolvedValue({ items: [] });
    participations.mockResolvedValue({ items: [] });
  });
  afterAll(async () => {
    await app.close();
    vi.unstubAllEnvs();
  });
  const get = (url: string) =>
    request(app.getHttpServer())
      .get('/me/' + url)
      .auth(token, { type: 'bearer' });
  it.each(['auction-summary', 'auction-results', 'participations'])(
    'requires JWT for %s',
    async (path) => {
      await request(app.getHttpServer())
        .get('/me/' + path)
        .expect(401);
    },
  );
  it('uses authenticated seller identity and validates pagination', async () => {
    await get('auction-summary').expect(200);
    expect(summary).toHaveBeenCalledWith(id);
    await get('auction-results?page=2&limit=9').expect(200);
    expect(seller).toHaveBeenCalledWith(id, { page: 2, limit: 9 });
  });
  it.each(['page=0', 'limit=51', 'ownerId=other', 'filter=wins'])(
    'rejects invalid seller query %s',
    async (query) => {
      await get('auction-results?' + query).expect(400);
      expect(seller).not.toHaveBeenCalled();
    },
  );
  it.each(['bidder', 'admin'])('rejects %s for seller reads', async (role) => {
    findUnique.mockResolvedValue({ id, role, isActive: true });
    await get('auction-summary').expect(403);
    await get('auction-results').expect(403);
  });
  it.each(['auctioneer', 'admin'])(
    'rejects %s for bidder reads',
    async (role) => {
      findUnique.mockResolvedValue({ id, role, isActive: true });
      await get('participations').expect(403);
    },
  );
  it('uses authenticated bidder identity and confirmed wins filter', async () => {
    findUnique.mockResolvedValue({ id, role: 'bidder', isActive: true });
    await get('participations?filter=wins&page=2&limit=5').expect(200);
    expect(participations).toHaveBeenCalledWith(id, {
      page: 2,
      limit: 5,
      filter: 'wins',
    });
    await get('participations?bidderId=other').expect(400);
    await get('participations?filter=leading').expect(400);
  });
});
