import { AuthModule } from '../auth/auth.module.js';
import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { AuctionEventsModule } from '../events/auction-events.module.js';
import { AuctionGateway } from './auction.gateway.js';
@Module({
  imports: [PrismaModule, AuctionEventsModule, AuthModule],
  providers: [AuctionGateway],
})
export class RealtimeModule {}
