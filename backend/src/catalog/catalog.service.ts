import { BadRequestException, Injectable } from '@nestjs/common';
import { ExternalItemProvider } from './external-item.provider.js';
import { SearchCatalogDto } from './search-catalog.dto.js';

@Injectable()
export class CatalogService {
  constructor(private readonly provider: ExternalItemProvider) {}

  async findOne(id: number) {
    return {
      ...(await this.provider.findOne(id)),
      provider: this.provider.name,
    };
  }

  async search({ q, type, page, limit }: SearchCatalogDto) {
    if (!q && !type)
      throw new BadRequestException(
        'Provide artwork/artist text or an artwork type',
      );
    return {
      ...(await this.provider.search(q, page, limit, type)),
      provider: this.provider.name,
    };
  }
}
