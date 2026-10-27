import {
  ClevelandTransport,
  HttpClevelandTransport,
} from '../src/catalog/cleveland.transport.js';
import { artworkResponses } from '../src/catalog/fixtures/artworks.js';
import { Test } from '@nestjs/testing';
import { ValidationPipe, type INestApplication } from '@nestjs/common';
import request from 'supertest';
import { vi } from 'vitest';
import { CatalogModule } from '../src/catalog/catalog.module.js';

// HTTP routing, validation and real adapter; external HTTP is mocked.
describe('Catalog and external health (HTTP)', () => {
  let app: INestApplication;
  const fetchMock = vi.fn();
  const artwork = artworkResponses[0].data;
  beforeAll(async () => {
    vi.stubEnv('CATALOG_PROVIDER', 'cleveland');
    const module = await Test.createTestingModule({
      imports: [CatalogModule],
    })
      .overrideProvider(ClevelandTransport)
      .useValue(new HttpClevelandTransport())
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
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());
  afterAll(async () => {
    await app.close();
    vi.unstubAllEnvs();
  });
  const reply = (body: unknown, status = 200) =>
    fetchMock.mockResolvedValue(new Response(JSON.stringify(body), { status }));

  it('reports external availability independently of PostgreSQL', async () => {
    reply({ data: [{ id: 141639 }] });
    await request(app.getHttpServer())
      .get('/health/external')
      .expect(200)
      .expect({ status: 'ok', services: { cleveland: 'up' } });
    const [url, options] = fetchMock.mock.calls[0];
    expect(url.searchParams.get('fields')).toBe('id');
    expect(url.searchParams.get('limit')).toBe('1');
    expect(options.signal).toBeInstanceOf(AbortSignal);
  });
  it('normalizes search results and encodes user input as a query value', async () => {
    reply({ data: [artwork], info: { total: 1 } });
    const res = await request(app.getHttpServer())
      .get('/catalog/search')
      .query({ q: ' cats & dogs ', page: 2, limit: 5 })
      .expect(200);
    expect(res.body).toEqual({
      provider: 'cleveland',
      items: [
        {
          articArtworkId: 141639,
          name: artwork.title,
          articImageId: null,
          imageUrl: artwork.images!.web.url,
          artistDisplay: artwork.creators[0].description,
          creditLine: artwork.creditline,
          isPublicDomain: true,
        },
      ],
      page: 2,
      limit: 5,
      total: 1,
    });
    const url = fetchMock.mock.calls[0][0] as URL;
    expect(url.origin).toBe('https://openaccess-api.clevelandart.org');
    expect(url.pathname).toBe('/api/artworks/');
    expect(url.searchParams.get('q')).toBe('cats & dogs');
  });
  it.each([
    { type: 'Painting' },
    { q: 'Monet' },
    { q: 'Monet', type: 'Painting' },
  ])(
    'forwards optional filters with mandatory image/CC0 restrictions %j',
    async (filters) => {
      reply({ data: [artwork], info: { total: 1 } });
      await request(app.getHttpServer())
        .get('/catalog/search')
        .query({ ...filters, page: 2, limit: 5 })
        .expect(200);
      const url = fetchMock.mock.calls[0][0] as URL;
      expect(url.searchParams.get('q')).toBe(filters.q ?? null);
      expect(url.searchParams.get('type')).toBe(filters.type ?? null);
      expect(url.searchParams.has('cc0')).toBe(true);
      expect(url.searchParams.get('has_image')).toBe('1');
      expect(url.searchParams.get('skip')).toBe('5');
    },
  );
  it.each(['?type=Unknown', '?q=Monet&type=', '?q=Monet&cc0=false'])(
    'rejects invalid filters %s',
    async (query) => {
      await request(app.getHttpServer())
        .get('/catalog/search' + query)
        .expect(400);
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );
  it('preserves missing images and optional metadata as null', async () => {
    reply({
      data: [
        {
          ...artwork,
          images: null,
          creators: null,
          creditline: null,
          share_license_status: null,
        },
      ],
      info: { total: 1 },
    });
    const res = await request(app.getHttpServer())
      .get('/catalog/search?q=cats')
      .expect(200);
    expect(res.body.items[0]).toMatchObject({
      imageUrl: null,
      articImageId: null,
      artistDisplay: null,
      creditLine: null,
      isPublicDomain: null,
    });
    expect(res.body).toMatchObject({ page: 1, limit: 10 });
  });
  it('returns an empty result without treating it as provider failure', async () => {
    reply({ data: [], info: { total: 0 } });
    await request(app.getHttpServer())
      .get('/catalog/search?q=absent')
      .expect(200)
      .expect({
        items: [],
        page: 1,
        limit: 10,
        total: 0,
        provider: 'cleveland',
      });
  });
  it.each([
    '',
    '?q=',
    '?q=%20',
    '?q=cats&limit=21',
    '?q=cats&page=0',
    '?q=cats&page=101',
    '?q=cats&limit=abc',
    '?q=cats&unexpected=1',
    '?q=' + 'x'.repeat(101),
  ])('rejects invalid query %s before calling upstream', async (query) => {
    await request(app.getHttpServer())
      .get('/catalog/search' + query)
      .expect(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it.each([403, 429, 500])('maps upstream HTTP %s to 503', async (status) => {
    reply({ error: 'upstream' }, status);
    await request(app.getHttpServer())
      .get('/catalog/search?q=cats')
      .expect(503);
    await request(app.getHttpServer())
      .get('/health/external')
      .expect(503)
      .expect({ status: 'error', services: { cleveland: 'down' } });
  });
  it.each(['network', 'timeout', 'json', 'shape'])(
    'maps %s failures to 503',
    async (kind) => {
      if (kind === 'network')
        fetchMock.mockRejectedValue(new TypeError('network failed'));
      if (kind === 'timeout')
        fetchMock.mockRejectedValue(
          new DOMException('timed out', 'TimeoutError'),
        );
      if (kind === 'json')
        fetchMock.mockImplementation(() =>
          Promise.resolve(new Response('not json')),
        );
      if (kind === 'shape') reply({ data: {} });
      await request(app.getHttpServer())
        .get('/catalog/search?q=cats')
        .expect(503);
      await request(app.getHttpServer()).get('/health/external').expect(503);
    },
  );
  it('enforces the five-second deadline', async () => {
    const timeout = vi
      .spyOn(AbortSignal, 'timeout')
      .mockImplementation(() =>
        AbortSignal.abort(new DOMException('timed out', 'TimeoutError')),
      );
    fetchMock.mockImplementation((_url: URL, options: RequestInit) => {
      options.signal?.throwIfAborted();
    });
    try {
      await request(app.getHttpServer())
        .get('/catalog/search?q=cats')
        .expect(503);
      expect(timeout).toHaveBeenCalledWith(5000);
    } finally {
      timeout.mockRestore();
    }
  });
  it.each([
    { data: [artwork] },
    { data: [{ id: 'bad' }], info: { total: 1 } },
    { data: [], info: { total: -1 } },
  ])('rejects malformed search data %j', async (body) => {
    reply(body);
    await request(app.getHttpServer())
      .get('/catalog/search?q=cats')
      .expect(503);
  });
  it('rejects an empty health response', async () => {
    reply({ data: [] });
    await request(app.getHttpServer()).get('/health/external').expect(503);
  });
  it('normalizes the official detail shape using the HTTP transport', async () => {
    reply(artworkResponses[0]);
    const res = await request(app.getHttpServer())
      .get('/catalog/artworks/141639')
      .expect(200);
    expect(res.body).toMatchObject({
      provider: 'cleveland',
      articArtworkId: 141639,
      mediumDisplay: 'oil on canvas',
      artworkType: 'Painting',
    });
    expect(fetchMock.mock.calls[0][0].pathname).toBe('/api/artworks/141639');
  });
  it('maps provider detail 404 to a local 404', async () => {
    reply(
      { status: 404, error: 'Not Found', detail: 'Artwork not found' },
      404,
    );
    await request(app.getHttpServer())
      .get('/catalog/artworks/999999')
      .expect(404);
  });
  it('does not substitute fixtures when real detail requests fail', async () => {
    reply({ error: 'unavailable' }, 503);
    await request(app.getHttpServer())
      .get('/catalog/artworks/141639')
      .expect(503);
  });
  it.each([
    { data: [] },
    { data: { ...artworkResponses[0].data, id: 28560 } },
    { data: { ...artworkResponses[0].data, measurements: 42 } },
  ])('rejects malformed detail %j', async (body) => {
    reply(body);
    await request(app.getHttpServer())
      .get('/catalog/artworks/141639')
      .expect(503);
  });
});
