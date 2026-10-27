import { PrismaModule } from '../prisma/prisma.module.js';
import { Module } from '@nestjs/common';
import { SettlementService } from './settlement.service.js';
import { SettlementWorker } from './settlement.worker.js';
@Module({
  imports: [PrismaModule],
  providers: [SettlementService, SettlementWorker],
})
export class SettlementModule {}
