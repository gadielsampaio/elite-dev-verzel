import { Module } from '@nestjs/common';
import { AuctionEvents } from './auction-events.js';
@Module({ providers: [AuctionEvents], exports: [AuctionEvents] })
export class AuctionEventsModule {}
