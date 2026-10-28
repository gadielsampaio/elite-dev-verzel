import { ClevelandTransport } from './cleveland.transport.js';
import {
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ExternalItemProvider } from './external-item.provider.js';

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function text(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string')
    throw new ServiceUnavailableException('Cleveland Museum API unavailable');
  return value;
}

@Injectable()
export class ClevelandAdapter extends ExternalItemProvider {
  constructor(private readonly transport: ClevelandTransport) {
    super();
  }
  get name() {
    return this.transport.mode;
  }
  private async request(path: string, params: Record<string, string> = {}) {
    const body = await this.transport.request(path, params);
    if (!record(body))
      throw new ServiceUnavailableException('Cleveland Museum API unavailable');
    return body;
  }
  async check(): Promise<'up' | 'mocked'> {
    if (this.name === 'mock') return 'mocked';
    const body = await this.request('artworks/', { limit: '1', fields: 'id' });
    if (
      !Array.isArray(body.data) ||
      !record(body.data[0]) ||
      !Number.isSafeInteger(body.data[0].id)
    )
      throw new ServiceUnavailableException('Cleveland Museum API unavailable');
    return 'up';
  }
  private normalize(value: unknown) {
    if (
      !record(value) ||
      !Number.isSafeInteger(value.id) ||
      Number(value.id) <= 0 ||
      typeof value.title !== 'string'
    )
      throw new ServiceUnavailableException('Cleveland Museum API unavailable');
    const creators = value.creators;
    if (
      creators != null &&
      (!Array.isArray(creators) || creators.some((x) => !record(x)))
    )
      throw new ServiceUnavailableException('Cleveland Museum API unavailable');
    const images = value.images;
    if (images != null && !record(images))
      throw new ServiceUnavailableException('Cleveland Museum API unavailable');
    const image = (variant: string) => {
      const asset = record(images) ? images[variant] : null;
      if (asset != null && !record(asset))
        throw new ServiceUnavailableException(
          'Cleveland Museum API unavailable',
        );
      const url = record(asset) ? text(asset.url) : null;
      if (url && !url.startsWith('https://'))
        throw new ServiceUnavailableException(
          'Cleveland Museum API unavailable',
        );
      return url;
    };
    const imageUrl = image('web');
    const printImageUrl = image('print');
    const license = text(value.share_license_status);
    return {
      // Compatibility fields: sourceSnapshot.provider identifies the ID namespace.
      articArtworkId: value.id as number,
      articImageId: null,
      name: value.title,
      imageUrl,
      printImageUrl,
      artistDisplay: Array.isArray(creators)
        ? creators
            .map((c) => text(c.description))
            .filter(Boolean)
            .join('; ') || null
        : null,
      creditLine: text(value.creditline),
      isPublicDomain: license === null ? null : license === 'CC0',
    };
  }
  async search(query: string, page: number, limit: number, type?: string) {
    const body = await this.request('artworks/', {
      ...(query ? { q: query } : {}),
      ...(type ? { type } : {}),
      cc0: '',
      has_image: '1',
      skip: String((page - 1) * limit),
      limit: String(limit),
    });
    if (
      !Array.isArray(body.data) ||
      !record(body.info) ||
      !Number.isSafeInteger(body.info.total) ||
      Number(body.info.total) < 0
    )
      throw new ServiceUnavailableException('Cleveland Museum API unavailable');
    return {
      items: body.data.map((item) => this.normalize(item)),
      total: body.info.total as number,
      page,
      limit,
    };
  }
  async findOne(id: number) {
    const body = await this.request(`artworks/${id}`);
    if (body.data === null) throw new NotFoundException('Artwork not found');
    const item = body.data;
    const normalized = this.normalize(item);
    if (!record(item) || item.id !== id)
      throw new ServiceUnavailableException('Cleveland Museum API unavailable');
    return {
      ...normalized,
      dateDisplay: text(item.creation_date),
      mediumDisplay: text(item.technique),
      dimensions: text(item.measurements),
      artworkType: text(item.type),
    };
  }
}
