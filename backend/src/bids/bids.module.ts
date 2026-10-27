import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { BidsController } from './bids.controller.js';
import { BidsService } from './bids.service.js';
@Module({
  imports: [AuthModule, PrismaModule],
  controllers: [BidsController],
  providers: [BidsService],
})
export class BidsModule {}
