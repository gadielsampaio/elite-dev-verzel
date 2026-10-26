import { Module } from '@nestjs/common';
import { ArticAdapter } from './artic.adapter.js';
import { ExternalItemProvider } from './external-item.provider.js';
import { CatalogController } from './catalog.controller.js';
import { CatalogService } from './catalog.service.js';
import { ExternalHealthController } from './external-health.controller.js';

@Module({
  controllers: [CatalogController, ExternalHealthController],
  providers: [
    CatalogService,
    { provide: ExternalItemProvider, useClass: ArticAdapter },
  ],
})
export class CatalogModule {}
