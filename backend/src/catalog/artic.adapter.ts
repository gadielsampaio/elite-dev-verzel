import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import {
  ExternalItemProvider,
  type CatalogItem,
} from './external-item.provider.js';

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function nullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

@Injectable()
export class ArticAdapter extends ExternalItemProvider {
  private async request(path: string, params: Record<string, string>) {
    const url = new URL(`https://api.artic.edu/api/v1/${path}`);
    url.search = new URLSearchParams(params).toString();
    try {
      const response = await fetch(url, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) throw new Error('Upstream HTTP error');
      const body: unknown = await response.json();
      if (!record(body) || !Array.isArray(body.data))
        throw new Error('Invalid response');
      return { data: body.data as unknown[], pagination: body.pagination };
    } catch {
      throw new ServiceUnavailableException('Art Institute API unavailable');
    }
  }

  async check(): Promise<void> {
    const body = await this.request('artworks', { limit: '1', fields: 'id' });
    if (
      !body.data.length ||
      !record(body.data[0]) ||
      !Number.isInteger(body.data[0].id)
    ) {
      throw new ServiceUnavailableException('Art Institute API unavailable');
    }
  }

  async search(query: string, page: number, limit: number) {
    const body = await this.request('artworks/search', {
      q: query,
      page: String(page),
      limit: String(limit),
      fields: 'id,title,image_id,artist_display,credit_line,is_public_domain',
    });
    if (
      !record(body.pagination) ||
      !Number.isInteger(body.pagination.total) ||
      Number(body.pagination.total) < 0
    ) {
      throw new ServiceUnavailableException('Art Institute API unavailable');
    }
    const items: CatalogItem[] = body.data.map((item: unknown) => {
      if (
        !record(item) ||
        !Number.isInteger(item.id) ||
        typeof item.title !== 'string' ||
        !nullableString(item.image_id) ||
        !nullableString(item.artist_display) ||
        !nullableString(item.credit_line) ||
        (item.is_public_domain !== null &&
          typeof item.is_public_domain !== 'boolean')
      ) {
        throw new ServiceUnavailableException('Art Institute API unavailable');
      }
      return {
        articArtworkId: item.id as number,
        name: item.title,
        articImageId: item.image_id,
        imageUrl: item.image_id
          ? `https://www.artic.edu/iiif/2/${encodeURIComponent(item.image_id)}/full/843,/0/default.jpg`
          : null,
        artistDisplay: item.artist_display,
        creditLine: item.credit_line,
        isPublicDomain: item.is_public_domain,
      };
    });
    return { items, page, limit, total: body.pagination.total as number };
  }
}
