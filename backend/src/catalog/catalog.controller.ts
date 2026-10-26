import { Controller, Get, Query } from '@nestjs/common';
import { CatalogService } from './catalog.service.js';
import { SearchCatalogDto } from './search-catalog.dto.js';

@Controller('catalog')
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get('search')
  search(@Query() query: SearchCatalogDto) {
    return this.catalog.search(query);
  }
}
