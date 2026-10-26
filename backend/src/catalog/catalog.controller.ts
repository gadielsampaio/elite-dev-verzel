import {
  BadRequestException,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Query,
} from '@nestjs/common';
import { CatalogService } from './catalog.service.js';
import { SearchCatalogDto } from './search-catalog.dto.js';

@Controller('catalog')
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get('artworks/:id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    if (!Number.isSafeInteger(id) || id < 1)
      throw new BadRequestException('Artwork ID must be a positive integer');
    return this.catalog.findOne(id);
  }

  @Get('search')
  search(@Query() query: SearchCatalogDto) {
    return this.catalog.search(query);
  }
}
