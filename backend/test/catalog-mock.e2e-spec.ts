import { Test } from '@nestjs/testing';
import { ValidationPipe, type INestApplication } from '@nestjs/common';
import request from 'supertest';
import { vi } from 'vitest';
import { CatalogModule } from '../src/catalog/catalog.module.js';
import {
  catalogTransport,
  HttpArticTransport,
  MockArticTransport,
} from '../src/catalog/artic.transport.js';

describe('Mock catalog (HTTP)', () => {
  let app: INestApplication;
  const fetchMock = vi.fn();
  beforeAll(async () => {
    vi.stubEnv('CATALOG_PROVIDER', 'mock');
    const module = await Test.createTestingModule({
      imports: [CatalogModule],
    }).compile();
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
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => {
    expect(fetchMock).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
  afterAll(async () => {
    await app.close();
    vi.unstubAllEnvs();
  });

  it('supports case-insensitive search and selecting the returned artwork', async () => {
    const search = await request(app.getHttpServer())
      .get('/catalog/search?q=SEURAT')
      .expect(200);
    expect(search.body).toMatchObject({ provider: 'mock', total: 1 });
    const id = search.body.items[0].articArtworkId;
    const detail = await request(app.getHttpServer())
      .get(`/catalog/artworks/${id}`)
      .expect(200);
    expect(detail.body).toMatchObject({
      ...search.body.items[0],
      provider: 'mock',
      mediumDisplay: 'Oil on canvas',
      dateDisplay: '1884–86',
      dimensions: '207.5 × 308.1 cm',
      artworkType: 'Painting',
    });
  });
  it('paginates deterministically and handles out-of-range pages', async () => {
    const first = await request(app.getHttpServer())
      .get('/catalog/search?q=painting&limit=1')
      .expect(200);
    const second = await request(app.getHttpServer())
      .get('/catalog/search?q=painting&limit=1&page=2')
      .expect(200);
    expect(first.body.total).toBe(3);
    expect(first.body.items[0].articArtworkId).not.toBe(
      second.body.items[0].articArtworkId,
    );
    const beyond = await request(app.getHttpServer())
      .get('/catalog/search?q=painting&page=10')
      .expect(200);
    expect(beyond.body.items).toEqual([]);
    expect(beyond.body.total).toBe(3);
  });
  it('returns an empty array for unmatched queries', async () => {
    const result = await request(app.getHttpServer())
      .get('/catalog/search?q=no-match')
      .expect(200);
    expect(result.body).toMatchObject({
      items: [],
      total: 0,
      provider: 'mock',
    });
  });
  it('preserves nullable fields and non-public-domain metadata', async () => {
    const result = await request(app.getHttpServer())
      .get('/catalog/artworks/129884')
      .expect(200);
    expect(result.body).toMatchObject({
      imageUrl: null,
      dimensions: null,
      isPublicDomain: false,
    });
  });
  it('returns 404 for unknown artwork IDs', async () => {
    await request(app.getHttpServer())
      .get('/catalog/artworks/999999')
      .expect(404);
  });
  it.each(['0', '-1', 'abc', '1.5', '9007199254740992'])(
    'rejects invalid ID %s',
    async (id) => {
      await request(app.getHttpServer())
        .get(`/catalog/artworks/${id}`)
        .expect(400);
    },
  );
  it('does not report the real provider as healthy in mock mode', async () => {
    await request(app.getHttpServer())
      .get('/health/external')
      .expect(200)
      .expect({ status: 'mocked', services: { artic: 'not_checked' } });
  });
  it('selects providers explicitly and rejects misconfiguration', () => {
    expect(catalogTransport()).toBeInstanceOf(MockArticTransport);
    try {
      vi.stubEnv('CATALOG_PROVIDER', 'artic');
      expect(catalogTransport()).toBeInstanceOf(HttpArticTransport);
      vi.stubEnv('CATALOG_PROVIDER', undefined);
      expect(catalogTransport()).toBeInstanceOf(HttpArticTransport);
      vi.stubEnv('CATALOG_PROVIDER', 'typo');
      expect(() => catalogTransport()).toThrow(
        'CATALOG_PROVIDER must be artic or mock',
      );
    } finally {
      vi.stubEnv('CATALOG_PROVIDER', 'mock');
    }
  });
});
