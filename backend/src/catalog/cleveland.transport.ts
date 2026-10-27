import { NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { artworkResponses } from './fixtures/artworks.js';
function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
export abstract class ClevelandTransport {
  abstract readonly mode: 'cleveland' | 'mock';
  abstract request(
    path: string,
    params: Record<string, string>,
  ): Promise<unknown>;
}
export class HttpClevelandTransport extends ClevelandTransport {
  readonly mode = 'cleveland' as const;
  async request(path: string, params: Record<string, string>) {
    const url = new URL(`https://openaccess-api.clevelandart.org/api/${path}`);
    url.search = new URLSearchParams(params).toString();
    try {
      const response = await fetch(url, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(5000),
      });
      if (response.status === 404 && /^artworks\/\d+$/.test(path))
        throw new NotFoundException('Artwork not found');
      if (!response.ok) throw new Error('Upstream HTTP error');
      const body: unknown = await response.json();
      if (!record(body)) throw new Error('Invalid response');
      return body;
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new ServiceUnavailableException('Cleveland Museum API unavailable');
    }
  }
}
export class MockClevelandTransport extends ClevelandTransport {
  readonly mode = 'mock' as const;
  async request(path: string, params: Record<string, string>) {
    if (path === 'artworks/') {
      const q = (params.q ?? '').toLowerCase();
      const matches = artworkResponses.filter(({ data }) =>
        `${data.title} ${data.creators?.map((c) => c.description).join(' ')} ${data.type}`
          .toLowerCase()
          .includes(q),
      );
      const skip = Number(params.skip ?? 0),
        limit = Number(params.limit ?? 10);
      return {
        info: { total: matches.length },
        data: matches.slice(skip, skip + limit).map((x) => x.data),
      };
    }
    const result = artworkResponses.find(
      (x) => path === `artworks/${x.data.id}`,
    );
    if (!result) throw new NotFoundException('Artwork not found');
    return result;
  }
}
export function catalogTransport(): ClevelandTransport {
  const mode = process.env.CATALOG_PROVIDER ?? 'cleveland';
  if (mode === 'cleveland') return new HttpClevelandTransport();
  if (mode === 'mock') return new MockClevelandTransport();
  throw new Error('CATALOG_PROVIDER must be cleveland or mock');
}
