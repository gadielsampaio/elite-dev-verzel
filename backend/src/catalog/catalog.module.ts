import { Module } from '@nestjs/common';
import { ClevelandAdapter } from './cleveland.adapter.js';
import { ClevelandTransport, catalogTransport } from './cleveland.transport.js';
import { ExternalItemProvider } from './external-item.provider.js';
import { CatalogController } from './catalog.controller.js';
import { CatalogService } from './catalog.service.js';
import { ExternalHealthController } from './external-health.controller.js';
@Module({
  exports: [CatalogService],
  controllers: [CatalogController, ExternalHealthController],
  providers: [
    CatalogService,
    { provide: ClevelandTransport, useFactory: catalogTransport },
    { provide: ExternalItemProvider, useClass: ClevelandAdapter },
  ],
})
export class CatalogModule {}
