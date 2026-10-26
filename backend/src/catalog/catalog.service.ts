import { Injectable } from '@nestjs/common';
import { ExternalItemProvider } from './external-item.provider.js';
import { SearchCatalogDto } from './search-catalog.dto.js';

@Injectable()
export class CatalogService {
  constructor(private readonly provider: ExternalItemProvider) {}

  search({ q, page, limit }: SearchCatalogDto) {
    return this.provider.search(q, page, limit);
  }
}
