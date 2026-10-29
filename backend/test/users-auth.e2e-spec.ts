import { configureTestValidation } from './support/http-app.js';
import { Test } from '@nestjs/testing';
import { type INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { vi } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

// Real HTTP routing and JWT signatures; database calls are isolated mocks.
describe('User route authorization (HTTP)', () => {
  const id = '11111111-1111-4111-8111-111111111111';
  const otherId = '22222222-2222-4222-8222-222222222222';
  const prisma = {
    user: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
    },
    $queryRaw: vi.fn(),
  };
  let app: INestApplication;
  let jwt: JwtService;
  let token: string;
  const oldSecret = process.env.JWT_SECRET;

  beforeAll(async () => {
    process.env.JWT_SECRET = 'test-only-secret-with-at-least-32-characters';
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .compile();
    jwt = module.get(JwtService);
    app = module.createNestApplication();
    configureTestValidation(app);
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
    if (oldSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = oldSecret;
  });

  beforeEach(async () => {
    vi.resetAllMocks();
    prisma.user.findUnique.mockResolvedValue({
      id,
      role: 'bidder',
      isActive: true,
    });
    prisma.user.findMany.mockResolvedValue([]);
    prisma.user.update.mockResolvedValue({ id, name: 'Updated' });
    prisma.user.create.mockResolvedValue({ id });
    token = await jwt.signAsync({ sub: id, role: 'bidder' });
  });

  it.each(['get', 'post', 'patch'] as const)(
    'rejects unauthenticated %s',
    async (method) => {
      await request(app.getHttpServer())
        [method](method === 'patch' ? `/users/${id}` : '/users')
        .expect(401);
      expect(prisma.user.findUnique).not.toHaveBeenCalled();
    },
  );
  it.each([
    'malformed',
    'expired',
    'wrong-signature',
    'wrong-algorithm',
    'missing-exp',
    'invalid-sub',
  ])('rejects %s tokens', async (kind) => {
    const tokens: Record<string, () => Promise<string>> = {
      malformed: () => Promise.resolve('garbage'),
      expired: () => jwt.signAsync({ sub: id }, { expiresIn: -1 }),
      'wrong-signature': () =>
        jwt.signAsync({ sub: id }, { secret: 'different-secret' }),
      'wrong-algorithm': () =>
        jwt.signAsync({ sub: id }, { algorithm: 'HS384' }),
      'missing-exp': () =>
        new JwtService({ secret: process.env.JWT_SECRET }).signAsync({
          sub: id,
        }),
      'invalid-sub': () => jwt.signAsync({ sub: 'invalid' }),
    };
    await request(app.getHttpServer())
      .get(`/users/${id}`)
      .auth(await tokens[kind](), { type: 'bearer' })
      .expect(401);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it.each([null, { id, role: 'bidder', isActive: false }])(
    'rejects missing/inactive accounts %j',
    async (user) => {
      prisma.user.findUnique.mockResolvedValue(user);
      await request(app.getHttpServer())
        .get(`/users/${id}`)
        .auth(token, { type: 'bearer' })
        .expect(401);
    },
  );
  it.each(['bidder', 'auctioneer'])(
    'allows %s to read/update self but not others or collections',
    async (role) => {
      prisma.user.findUnique.mockResolvedValue({ id, role, isActive: true });
      await request(app.getHttpServer())
        .get(`/users/${id}`)
        .auth(token, { type: 'bearer' })
        .expect(200);
      await request(app.getHttpServer())
        .patch(`/users/${id}`)
        .auth(token, { type: 'bearer' })
        .send({ name: 'Updated' })
        .expect(200);
      for (const method of ['get', 'patch'] as const) {
        await request(app.getHttpServer())
          [method](`/users/${otherId}`)
          .auth(token, { type: 'bearer' })
          .send({ name: 'Unauthorized' })
          .expect(403);
      }
      await request(app.getHttpServer())
        .get('/users')
        .auth(token, { type: 'bearer' })
        .expect(403);
      await request(app.getHttpServer())
        .post('/users')
        .auth(token, { type: 'bearer' })
        .send({ role: 'admin' })
        .expect(403);
      expect(prisma.user.update).toHaveBeenCalledTimes(1);
      expect(prisma.user.create).not.toHaveBeenCalled();
      expect(prisma.user.findMany).not.toHaveBeenCalled();
    },
  );
  it('uses current database role, ignoring a stale admin token claim', async () => {
    const stale = await jwt.signAsync({ sub: id, role: 'admin' });
    await request(app.getHttpServer())
      .get('/users')
      .auth(stale, { type: 'bearer' })
      .expect(403);
  });

  it('allows admins to list/create users and read/update other profiles', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id,
      role: 'admin',
      isActive: true,
    });
    await request(app.getHttpServer())
      .get('/users')
      .auth(token, { type: 'bearer' })
      .expect(200);
    await request(app.getHttpServer())
      .post('/users')
      .auth(token, { type: 'bearer' })
      .send({ name: 'Test', email: 'test@example.com', role: 'bidder' })
      .expect(201);
    await request(app.getHttpServer())
      .get(`/users/${otherId}`)
      .auth(token, { type: 'bearer' })
      .expect(200);
    await request(app.getHttpServer())
      .patch(`/users/${otherId}`)
      .auth(token, { type: 'bearer' })
      .send({ name: 'Updated' })
      .expect(200);
  });

  it('rejects self-service role changes', async () => {
    await request(app.getHttpServer())
      .patch(`/users/${id}`)
      .auth(token, { type: 'bearer' })
      .send({ role: 'admin' })
      .expect(400);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('keeps health, registration and login public', async () => {
    prisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
    await request(app.getHttpServer()).get('/health').expect(200);
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({})
      .expect(400);
    await request(app.getHttpServer()).post('/auth/login').send({}).expect(400);
  });
});
