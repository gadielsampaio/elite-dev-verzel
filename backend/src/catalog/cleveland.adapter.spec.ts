import { HttpClevelandTransport } from './cleveland.transport.js';
import { vi } from 'vitest';
import { ClevelandAdapter } from './cleveland.adapter.js';

describe('Cleveland adapter', () => {
  const adapter = new ClevelandAdapter(new HttpClevelandTransport());
  const fetchMock = vi.fn();
  const artwork = {
    id: 141639,
    title: 'Twilight in the Wilderness',
    creators: [{ description: 'Frederic Edwin Church (American, 1826–1900)' }],
    images: {
      web: {
        url: 'https://openaccess-cdn.clevelandart.org/1965.233/1965.233_web.jpg',
      },
    },
    creditline: 'Mr. and Mrs. William H. Marlatt Fund',
    share_license_status: 'CC0',
    creation_date: '1860',
    technique: 'oil on canvas',
    measurements: '101.6 x 162.6 cm',
    type: 'Painting',
  };
  const reply = (body: unknown, status = 200) =>
    fetchMock.mockResolvedValue(new Response(JSON.stringify(body), { status }));
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());
  it('maps pagination and official fields', async () => {
    reply({ info: { total: 10 }, data: [artwork] });
    expect(await adapter.search('painting & landscape', 2, 5)).toMatchObject({
      total: 10,
      page: 2,
      limit: 5,
      items: [
        {
          articArtworkId: 141639,
          articImageId: null,
          name: artwork.title,
          imageUrl: artwork.images.web.url,
          isPublicDomain: true,
        },
      ],
    });
    const [url, options] = fetchMock.mock.calls[0];
    expect(url.origin).toBe('https://openaccess-api.clevelandart.org');
    expect(url.searchParams.get('skip')).toBe('5');
    expect(url.searchParams.get('q')).toBe('painting & landscape');
    expect(options.signal).toBeInstanceOf(AbortSignal);
  });
  it('maps detail and nullable metadata', async () => {
    reply({ data: artwork });
    expect(await adapter.findOne(141639)).toMatchObject({
      dateDisplay: '1860',
      mediumDisplay: 'oil on canvas',
      artworkType: 'Painting',
    });
    reply({ data: { id: 141639, title: 'Unknown' } });
    expect(await adapter.findOne(141639)).toMatchObject({
      imageUrl: null,
      artistDisplay: null,
      isPublicDomain: null,
    });
  });
  it('handles empty results and health', async () => {
    reply({ info: { total: 0 }, data: [] });
    expect((await adapter.search('absent', 1, 10)).items).toEqual([]);
    await expect(adapter.check()).rejects.toMatchObject({ status: 503 });
    reply({ data: [{ id: 141639 }] });
    await expect(adapter.check()).resolves.toBe('up');
  });
  it.each([403, 429, 500])(
    'maps upstream %s to unavailable without fallback',
    async (status) => {
      reply({}, status);
      await expect(adapter.search('painting', 1, 10)).rejects.toMatchObject({
        status: 503,
      });
    },
  );
  it('maps missing artwork to 404', async () => {
    reply({}, 404);
    await expect(adapter.findOne(1)).rejects.toMatchObject({ status: 404 });
    reply({ data: null });
    await expect(adapter.findOne(1)).rejects.toMatchObject({ status: 404 });
  });
  it('rejects mismatched detail and malformed response', async () => {
    reply({ data: artwork });
    await expect(adapter.findOne(1)).rejects.toMatchObject({ status: 503 });
    reply({ info: { total: -1 }, data: [] });
    await expect(adapter.search('painting', 1, 10)).rejects.toMatchObject({
      status: 503,
    });
  });
  it('maps network failures to 503', async () => {
    fetchMock.mockRejectedValue(new TypeError('network'));
    await expect(adapter.check()).rejects.toMatchObject({ status: 503 });
  });
});
