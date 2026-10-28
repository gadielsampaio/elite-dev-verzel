import { randomUUID, createHash } from 'node:crypto';
import { hash } from 'bcryptjs';
import { Test } from '@nestjs/testing';
import { ValidationPipe, type INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AuthModule } from '../src/auth/auth.module.js';
import { UsersModule } from '../src/users/users.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { cookieOptions } from '../src/auth/session-cookie.js';

describe.runIf(process.env.RUN_DATABASE_TESTS === '1')(
  'Rotating refresh sessions (PostgreSQL)',
  () => {
    let app: INestApplication, db: PrismaService, userId: string, email: string;
    const password = 'refresh-test-password';
    beforeEach(async () => {
      vi.stubEnv('AUTH_COOKIE_SECURE', 'false');
      db = new PrismaService();
      email = `refresh-${randomUUID()}@example.invalid`;
      userId = (
        await db.user.create({
          data: {
            name: 'Refresh test',
            email,
            role: 'bidder',
            passwordHash: await hash(password, 4),
          },
        })
      ).id;
      const module = await Test.createTestingModule({
        imports: [AuthModule, UsersModule],
      })
        .overrideProvider(PrismaService)
        .useValue(db)
        .compile();
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
    afterEach(async () => {
      await app.close();
      await db.user.delete({ where: { id: userId } });
      await db.$disconnect();
      vi.unstubAllEnvs();
    });
    const post = (path: string, cookie?: string) => {
      const req = request(app.getHttpServer())
        .post(`/auth/${path}`)
        .set('X-Session-Request', '1');
      return cookie ? req.set('Cookie', cookie) : req;
    };
    const cookie = (res: request.Response) =>
      String(res.headers['set-cookie'][0]).split(';')[0];
    const login = () => post('login').send({ email, password }).expect(200);
    it('stores only hashes, rotates, renews access and revokes the whole family on replay', async () => {
      const first = await login();
      const old = cookie(first);
      expect(first.headers['set-cookie'][0]).toContain('HttpOnly');
      expect(first.headers['set-cookie'][0]).toContain('SameSite=Lax');
      expect(first.body).not.toHaveProperty('refreshToken');
      const rows = await db.refreshSession.findMany({ where: { userId } });
      expect(rows[0].tokenHash).toBe(
        createHash('sha256').update(old.split('=')[1]).digest('hex'),
      );
      const second = await post('refresh', old).send({}).expect(200);
      expect(cookie(second)).not.toBe(old);
      await request(app.getHttpServer())
        .get(`/users/${userId}`)
        .auth(second.body.accessToken, { type: 'bearer' })
        .expect(200);
      await post('refresh', old).send({}).expect(401);
      await post('refresh', cookie(second)).send({}).expect(401);
      await request(app.getHttpServer())
        .get(`/users/${userId}`)
        .auth(second.body.accessToken, { type: 'bearer' })
        .expect(401);
    });
    it('revokes refresh and access tokens on logout', async () => {
      const session = await login();
      const response = await post('logout', cookie(session))
        .send({})
        .expect(204);
      expect(response.headers['set-cookie'][0]).toContain(
        'Expires=Thu, 01 Jan 1970',
      );
      await post('refresh', cookie(session)).send({}).expect(401);
      await request(app.getHttpServer())
        .get(`/users/${userId}`)
        .auth(session.body.accessToken, { type: 'bearer' })
        .expect(401);
    });
    it('allows at most one concurrent rotation and detects the replay', async () => {
      const session = await login();
      const responses = await Promise.all([
        post('refresh', cookie(session)).send({}),
        post('refresh', cookie(session)).send({}),
      ]);
      expect(responses.map((r) => r.status).sort((a, b) => a - b)).toEqual([
        200, 401,
      ]);
      await post('refresh', cookie(responses.find((r) => r.status === 200)!))
        .send({})
        .expect(401);
    });
    it.each(['expired', 'inactive'])('rejects %s sessions', async (kind) => {
      const session = await login();
      if (kind === 'expired')
        await db.refreshSession.updateMany({
          where: { userId },
          data: { expiresAt: new Date(0) },
        });
      else
        await db.user.update({
          where: { id: userId },
          data: { isActive: false },
        });
      await post('refresh', cookie(session)).send({}).expect(401);
    });
    it('requires the preflight-forcing header and uses secure production cookies', async () => {
      const session = await login();
      await request(app.getHttpServer())
        .post('/auth/refresh')
        .set('Cookie', cookie(session))
        .send({})
        .expect(403);
      await request(app.getHttpServer())
        .post('/auth/logout')
        .set('Cookie', cookie(session))
        .send({})
        .expect(403);
      await post('refresh').send({}).expect(401);
      vi.stubEnv('AUTH_COOKIE_SECURE', 'true');
      expect(cookieOptions()).toMatchObject({
        httpOnly: true,
        secure: true,
        sameSite: 'none',
      });
    });
  },
);
