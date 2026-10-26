import { NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { artworkResponses } from './fixtures/artworks.js';

export abstract class ArticTransport {
  abstract readonly mode: 'artic' | 'mock';
  abstract request(
    path: string,
    params: Record<string, string>,
  ): Promise<unknown>;
}

export class HttpArticTransport extends ArticTransport {
  readonly mode = 'artic' as const;
  async request(
    path: string,
    params: Record<string, string>,
  ): Promise<unknown> {
    const url = new URL(`https://api.artic.edu/api/v1/${path}`);
    url.search = new URLSearchParams(params).toString();
    try {
      const response = await fetch(url, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(5000),
      });
      if (response.status === 404 && /^artworks\/\d+$/.test(path))
        throw new NotFoundException('Artwork not found');
      if (!response.ok) throw new Error('Upstream HTTP error');
      return await response.json();
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new ServiceUnavailableException('Art Institute API unavailable');
    }
  }
}

export class MockArticTransport extends ArticTransport {
  readonly mode = 'mock' as const;
  request(path: string, params: Record<string, string>): Promise<unknown> {
    const fields = params.fields?.split(',');
    const select = (item: (typeof artworkResponses)[number]['data']) =>
      Object.fromEntries(
        Object.entries(item).filter(([key]) => !fields || fields.includes(key)),
      );
    if (path === 'artworks' || path === 'artworks/search') {
      const query = (params.q ?? '').toLowerCase();
      const matches = artworkResponses.filter(({ data }) =>
        `${data.title} ${data.artist_display} ${data.artwork_type_title}`
          .toLowerCase()
          .includes(query),
      );
      const page = Number(params.page ?? 1),
        limit = Number(params.limit ?? 10);
      const offset = (page - 1) * limit;
      return Promise.resolve({
        pagination: {
          total: matches.length,
          limit,
          offset,
          total_pages: Math.ceil(matches.length / limit),
          current_page: page,
        },
        data: matches
          .slice(offset, offset + limit)
          .map(({ data }) => select(data)),
        config: { iiif_url: 'https://www.artic.edu/iiif/2' },
      });
    }
    const response = artworkResponses.find(
      ({ data }) => path === `artworks/${data.id}`,
    );
    if (!response)
      return Promise.reject(new NotFoundException('Artwork not found'));
    return Promise.resolve({ ...response, data: select(response.data) });
  }
}

export function catalogTransport(): ArticTransport {
  const mode = process.env.CATALOG_PROVIDER ?? 'artic';
  if (mode === 'mock') return new MockArticTransport();
  if (mode === 'artic') return new HttpArticTransport();
  throw new Error('CATALOG_PROVIDER must be artic or mock');
}
