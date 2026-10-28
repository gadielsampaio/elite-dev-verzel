import {
  Controller,
  Get,
  InternalServerErrorException,
  type INestApplication,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { configureCors } from '../src/cors.config.js';
const origin = 'https://elite-dev-verzel-delta.vercel.app';
@Controller()
class CorsFixture {
  @Get('lots') lots() {
    return { items: [] };
  }
  @Get('failure') failure() {
    throw new InternalServerErrorException();
  }
}
describe('Configured browser CORS', () => {
  let app: INestApplication;
  beforeEach(async () => {
    vi.stubEnv('CORS_ORIGINS', `${origin}, http://localhost:5175/`);
    const module = await Test.createTestingModule({
      controllers: [CorsFixture],
    }).compile();
    app = module.createNestApplication({ logger: false });
    configureCors(app);
    await app.init();
  });
  afterEach(async () => {
    await app.close();
    vi.unstubAllEnvs();
  });
  it('allows the configured Vercel origin on successful and failed responses', async () => {
    await request(app.getHttpServer())
      .get('/lots')
      .set('Origin', origin)
      .expect(200)
      .expect('Access-Control-Allow-Origin', origin);
    await request(app.getHttpServer())
      .get('/failure')
      .set('Origin', origin)
      .expect(500)
      .expect('Access-Control-Allow-Origin', origin);
  });
  it('handles JSON and bearer-token preflight requests', async () => {
    const result = await request(app.getHttpServer())
      .options('/lots')
      .set('Origin', origin)
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'authorization,content-type')
      .expect(204);
    expect(result.headers['access-control-allow-origin']).toBe(origin);
    expect(result.headers['access-control-allow-methods']).toContain('POST');
    expect(result.headers['access-control-allow-headers']).toBe(
      'authorization,content-type',
    );
    expect(result.headers['access-control-allow-credentials']).toBe('true');
  });
  it('does not allow another Vercel project or a suffix attack', async () => {
    for (const other of [
      'https://another.vercel.app',
      `${origin}.example.com`,
    ]) {
      const result = await request(app.getHttpServer())
        .get('/lots')
        .set('Origin', other)
        .expect(200);
      expect(result.headers['access-control-allow-origin']).toBeUndefined();
    }
  });
  it('allows normalized development origins and non-browser requests', async () => {
    await request(app.getHttpServer())
      .get('/lots')
      .set('Origin', 'http://localhost:5175')
      .expect('Access-Control-Allow-Origin', 'http://localhost:5175');
    await request(app.getHttpServer()).get('/lots').expect(200);
  });
  it('fails closed when no origins are configured', () => {
    vi.stubEnv('CORS_ORIGINS', '');
    const enableCors = vi.fn();
    configureCors({ enableCors } as unknown as INestApplication);
    expect(enableCors).toHaveBeenCalledWith({ origin: [], credentials: true });
  });
  it('rejects wildcards and URLs containing paths or credentials', () => {
    for (const value of [
      '*',
      `${origin}/page`,
      'https://user:password@example.com',
    ]) {
      vi.stubEnv('CORS_ORIGINS', value);
      expect(() => configureCors(app)).toThrow();
    }
  });
});
