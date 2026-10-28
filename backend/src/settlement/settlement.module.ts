import { AuthModule } from '../auth/auth.module.js';
import { AccountResultsController } from './account-results.controller.js';
import { AccountResultsService } from './account-results.service.js';
import { ResultsController } from './results.controller.js';
import { ResultsService } from './results.service.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { Module } from '@nestjs/common';
import { SettlementService } from './settlement.service.js';
import { SettlementWorker } from './settlement.worker.js';
@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [ResultsController, AccountResultsController],
  providers: [
    SettlementService,
    SettlementWorker,
    ResultsService,
    AccountResultsService,
  ],
})
export class SettlementModule {}
