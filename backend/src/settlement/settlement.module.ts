import { ResultsController } from './results.controller.js';
import { ResultsService } from './results.service.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { Module } from '@nestjs/common';
import { SettlementService } from './settlement.service.js';
import { SettlementWorker } from './settlement.worker.js';
@Module({
  imports: [PrismaModule],
  controllers: [ResultsController],
  providers: [SettlementService, SettlementWorker, ResultsService],
})
export class SettlementModule {}
