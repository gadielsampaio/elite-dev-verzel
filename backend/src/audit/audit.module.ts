import { AuctionEventsModule } from '../events/auction-events.module.js';
import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { AuditController } from './audit.controller.js';
import { AuditService } from './audit.service.js';
import { AuditWorker } from './audit.worker.js';
@Module({
  imports: [PrismaModule, AuctionEventsModule],
  controllers: [AuditController],
  providers: [AuditService, AuditWorker],
})
export class AuditModule {}
