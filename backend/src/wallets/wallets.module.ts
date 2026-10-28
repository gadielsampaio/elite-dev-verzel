import { AuctionEventsModule } from '../events/auction-events.module.js';
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { WalletsController } from './wallets.controller.js';
import { WalletsService } from './wallets.service.js';

@Module({
  imports: [AuthModule, PrismaModule, AuctionEventsModule],
  controllers: [WalletsController],
  providers: [WalletsService],
})
export class WalletsModule {}
