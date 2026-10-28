import { AuctionEventsModule } from '../events/auction-events.module.js';
import { BidReadsService } from './bid-reads.service.js';
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { BidsController } from './bids.controller.js';
import { BidsService } from './bids.service.js';
@Module({
  imports: [AuthModule, PrismaModule, AuctionEventsModule],
  controllers: [BidsController],
  providers: [BidsService, BidReadsService],
})
export class BidsModule {}
