import { Test } from '@nestjs/testing';
import {
  ValidationPipe,
  ServiceUnavailableException,
  NotFoundException,
  type INestApplication,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { vi } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { CatalogService } from '../src/catalog/catalog.service.js';

// Real routing, JWT and DTO validation; persistence/provider isolated here.
describe('Lot publication (HTTP)', () => {
  const ownerId = '11111111-1111-4111-8111-111111111111';
  const lotId = '22222222-2222-4222-8222-222222222222';
  const prisma = {
    user: { findUnique: vi.fn() },
    lot: { create: vi.fn(), findFirst: vi.fn(), updateManyAndReturn: vi.fn() },
    $transaction: vi.fn(),
  };
  const catalog = { findOne: vi.fn() };
  const artwork = {
    articArtworkId: 27992,
    name: 'Example painting',
    articImageId: 'image-id',
    imageUrl: 'https://www.artic.edu/iiif/2/image-id/full/843,/0/default.jpg',
    artistDisplay: 'Artist',
    creditLine: 'Collection',
    isPublicDomain: true,
    dateDisplay: '1884',
    mediumDisplay: 'Oil on canvas',
    dimensions: null,
    artworkType: 'Painting',
    provider: 'mock',
  };
  let app: INestApplication;
  let token: string;
  let data: Record<string, unknown>;
  beforeAll(async () => {
    vi.stubEnv('JWT_SECRET', 'test-only-secret-with-at-least-32-characters');
    vi.stubEnv('CATALOG_PROVIDER', 'mock');
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .overrideProvider(CatalogService)
      .useValue(catalog)
      .compile();
    token = await module
      .get(JwtService)
      .signAsync({ sub: ownerId, role: 'auctioneer' });
    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });
  beforeEach(() => {
    vi.resetAllMocks();
    prisma.lot.updateManyAndReturn.mockResolvedValue([]);
    prisma.$transaction.mockImplementation(
      (callback: (tx: typeof prisma) => unknown) => callback(prisma),
    );
    data = {
      title: ' Weekend auction ',
      artworkId: 27992,
      startingBid: '100.00',
      bidIncrement: '5.00',
      estimatedValue: '300.00',
      startTime: new Date(Date.now() + 3600000).toISOString(),
      endTime: new Date(Date.now() + 7200000).toISOString(),
    };
    prisma.user.findUnique.mockResolvedValue({
      id: ownerId,
      role: 'auctioneer',
      isActive: true,
    });
    catalog.findOne.mockResolvedValue(artwork);
    prisma.lot.create.mockResolvedValue({
      id: lotId,
      endTime: new Date(data.endTime),
      status: 'scheduled',
      ownerId,
    });
  });
  afterAll(async () => {
    await app.close();
    vi.unstubAllEnvs();
  });
  const publish = (body: object = data) =>
    request(app.getHttpServer())
      .post('/lots')
      .auth(token, { type: 'bearer' })
      .send(body);

  it('publishes using JWT ownership and atomically nests the provider snapshot', async () => {
    await publish().expect(201);
    const write = prisma.lot.create.mock.calls[0][0].data;
    expect(write).toMatchObject({
      ownerId,
      title: 'Weekend auction',
      status: 'scheduled',
      currency: 'USD',
    });
    expect(write.startingBid.toFixed(2)).toBe('100.00');
    expect(write.bidIncrement.toFixed(2)).toBe('5.00');
    expect(write.items.create).toMatchObject({
      name: artwork.name,
      sourceSnapshot: artwork,
      articArtworkId: 27992,
    });
    expect(write.items.create.estimatedValue.toFixed(2)).toBe('300.00');
    expect(write.items.create.sourceFetchedAt).toBeInstanceOf(Date);
    expect(catalog.findOne).toHaveBeenCalledWith(27992);
  });
  it('rejects artwork without an image before creating a lot', async () => {
    catalog.findOne.mockResolvedValue({ ...artwork, imageUrl: null });
    await request(app.getHttpServer())
      .post('/lots')
      .auth(token, { type: 'bearer' })
      .send(data)
      .expect(400);
    expect(prisma.lot.create).not.toHaveBeenCalled();
  });
  it.each([false, null])(
    'rejects non-CC0 artwork (%s)',
    async (isPublicDomain) => {
      catalog.findOne.mockResolvedValue({ ...artwork, isPublicDomain });
      await request(app.getHttpServer())
        .post('/lots')
        .auth(token, { type: 'bearer' })
        .send(data)
        .expect(400);
      expect(prisma.lot.create).not.toHaveBeenCalled();
    },
  );
  it('requires a JWT', async () => {
    await request(app.getHttpServer()).post('/lots').send(data).expect(401);
    expect(prisma.lot.create).not.toHaveBeenCalled();
  });
  it.each(['bidder', 'admin'])(
    'rejects %s publication before fetching artwork',
    async (role) => {
      prisma.user.findUnique.mockResolvedValue({
        id: ownerId,
        role,
        isActive: true,
      });
      await publish().expect(403);
      expect(catalog.findOne).not.toHaveBeenCalled();
      expect(prisma.lot.create).not.toHaveBeenCalled();
    },
  );
  it.each([
    { ownerId: 'spoofed' },
    { status: 'open' },
    { currency: 'EUR' },
    { sourceSnapshot: {} },
    { title: '   ' },
    { artworkId: '27992' },
    { artworkId: 0 },
    { startingBid: 100 },
    { startingBid: '1e2' },
    { startingBid: '-1' },
    { startingBid: '1.001' },
    { startingBid: '100000000000000000' },
    { startingBid: '0' },
    { bidIncrement: '0.00' },
    { estimatedValue: '0' },
    { startTime: '2027-02-30T10:00:00Z' },
    { startTime: '2027-01-01T10:00:00' },
    { endTime: null },
  ])('rejects invalid publication %j without writes', async (patch) => {
    await publish({ ...data, ...patch }).expect(400);
    expect(prisma.lot.create).not.toHaveBeenCalled();
    expect(catalog.findOne).not.toHaveBeenCalled();
  });
  it('publishes immediately using server time after catalog lookup', async () => {
    const { startTime: _, ...immediate } = data;
    const before = Date.now();
    await publish({ ...immediate, startMode: 'now' }).expect(201);
    const saved = prisma.lot.create.mock.calls[0][0].data;
    expect(saved.status).toBe('open');
    expect(saved.startTime.getTime()).toBeGreaterThanOrEqual(before);
    expect(saved.startTime.getTime()).toBeLessThanOrEqual(Date.now());
  });
  it('rejects invalid immediate publication end times', async () => {
    const { startTime: _, ...immediate } = data;
    await publish({
      ...immediate,
      startMode: 'now',
      endTime: new Date(Date.now() - 1000).toISOString(),
    }).expect(400);
    expect(prisma.lot.create).not.toHaveBeenCalled();
  });
  it('rejects past starts and reversed intervals', async () => {
    await publish({
      ...data,
      startTime: new Date(Date.now() - 1000).toISOString(),
    }).expect(400);
    await publish({ ...data, endTime: data.startTime }).expect(400);
    expect(prisma.lot.create).not.toHaveBeenCalled();
  });
  it('rejects a schedule that expires during provider lookup', async () => {
    catalog.findOne.mockImplementation(() => {
      vi.spyOn(Date, 'now').mockReturnValue(
        new Date(data.startTime as string).getTime() + 1,
      );
      return Promise.resolve(artwork);
    });
    try {
      await publish().expect(400);
      expect(prisma.lot.create).not.toHaveBeenCalled();
    } finally {
      vi.restoreAllMocks();
    }
  });
  it.each([
    new NotFoundException('Artwork not found'),
    new ServiceUnavailableException('Provider unavailable'),
  ])('does not write when the provider fails: %s', async (error) => {
    catalog.findOne.mockRejectedValue(error);
    await publish().expect(error.getStatus());
    expect(prisma.lot.create).not.toHaveBeenCalled();
  });
  it('reads persisted details without authentication or provider access', async () => {
    prisma.lot.findFirst.mockResolvedValue({
      id: lotId,
      items: [{ sourceSnapshot: artwork }],
    });
    catalog.findOne.mockRejectedValue(new ServiceUnavailableException());
    const res = await request(app.getHttpServer())
      .get(`/lots/${lotId}`)
      .expect(200);
    expect(res.body.items[0].sourceSnapshot).toEqual(artwork);
    expect(catalog.findOne).not.toHaveBeenCalled();
    expect(prisma.lot.findFirst).toHaveBeenCalledWith({
      where: { id: lotId, status: { in: ['scheduled', 'open', 'closed'] } },
      include: { items: { orderBy: { position: 'asc' } } },
    });
  });
  it('returns 404 for missing/draft/cancelled lots and 400 for invalid UUIDs', async () => {
    prisma.lot.findFirst.mockResolvedValue(null);
    await request(app.getHttpServer()).get(`/lots/${lotId}`).expect(404);
    await request(app.getHttpServer()).get('/lots/not-a-uuid').expect(400);
  });
});
