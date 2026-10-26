import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { CatalogModule } from '../catalog/catalog.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { AuctioneerGuard } from './auctioneer.guard.js';
import { LotsController } from './lots.controller.js';
import { LotsService } from './lots.service.js';

@Module({
  imports: [AuthModule, CatalogModule, PrismaModule],
  controllers: [LotsController],
  providers: [LotsService, AuctioneerGuard],
})
export class LotsModule {}
