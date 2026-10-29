import { LotsModule } from '../lots/lots.module.js';
import { AuctionEventsModule } from '../events/auction-events.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { AccountResultsController } from './account/account-results.controller.js';
import { AccountResultsService } from './account/account-results.service.js';
import { ResultsController } from './results/results.controller.js';
import { ResultsService } from './results/results.service.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { Module } from '@nestjs/common';
import { SettlementService } from './settlement.service.js';
import { SettlementWorker } from './settlement.worker.js';
@Module({
  imports: [LotsModule, AuctionEventsModule, PrismaModule, AuthModule],
  controllers: [ResultsController, AccountResultsController],
  providers: [
    SettlementService,
    SettlementWorker,
    ResultsService,
    AccountResultsService,
  ],
})
export class SettlementModule {}
