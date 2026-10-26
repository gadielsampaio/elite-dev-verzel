import { ArticTransport } from './artic.transport.js';
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
  constructor(private readonly transport: ArticTransport) {
    super();
  }
  get name() {
    return this.transport.mode;
  }

  private async request(path: string, params: Record<string, string>) {
    const body = await this.transport.request(path, params);
    if (!record(body))
      throw new ServiceUnavailableException('Art Institute API unavailable');
    return body;
  }

  async check(): Promise<'up' | 'mocked'> {
    if (this.name === 'mock') return 'mocked';
    const body = await this.request('artworks', { limit: '1', fields: 'id' });
    if (
      !Array.isArray(body.data) ||
      !body.data.length ||
      !record(body.data[0]) ||
      !Number.isInteger(body.data[0].id)
    ) {
      throw new ServiceUnavailableException('Art Institute API unavailable');
    }
    return 'up';
  }

  async search(query: string, page: number, limit: number) {
    const body = await this.request('artworks/search', {
      q: query,
      page: String(page),
      limit: String(limit),
      fields: 'id,title,image_id,artist_display,credit_line,is_public_domain',
    });
    if (
      !Array.isArray(body.data) ||
      !record(body.pagination) ||
      !Number.isInteger(body.pagination.total) ||
      Number(body.pagination.total) < 0
    ) {
      throw new ServiceUnavailableException('Art Institute API unavailable');
    }
    const items = body.data.map((item: unknown) => this.normalize(item));
    return { items, page, limit, total: body.pagination.total as number };
  }
  private normalize(item: unknown): CatalogItem {
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
  }

  async findOne(id: number) {
    const body = await this.request(`artworks/${id}`, {
      fields:
        'id,title,image_id,artist_display,credit_line,is_public_domain,date_display,medium_display,dimensions,artwork_type_title',
    });
    const item = body.data;
    const normalized = this.normalize(item);
    if (
      !record(item) ||
      item.id !== id ||
      !nullableString(item.date_display) ||
      !nullableString(item.medium_display) ||
      !nullableString(item.dimensions) ||
      !nullableString(item.artwork_type_title)
    ) {
      throw new ServiceUnavailableException('Art Institute API unavailable');
    }
    return {
      ...normalized,
      dateDisplay: item.date_display,
      mediumDisplay: item.medium_display,
      dimensions: item.dimensions,
      artworkType: item.artwork_type_title,
    };
  }
}
