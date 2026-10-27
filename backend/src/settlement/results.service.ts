import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { bidderAlias } from '../bids/bidder-alias.js';

@Injectable()
export class ResultsService {
  constructor(private readonly prisma: PrismaService) {}
  async forLot(lotId: string) {
    return this.prisma.$transaction(
      async (tx) => {
        const lot = await tx.lot.findFirst({
          where: { id: lotId, status: { in: ['scheduled', 'open', 'closed'] } },
          select: {
            id: true,
            title: true,
            currency: true,
            status: true,
            endTime: true,
            items: {
              orderBy: { position: 'asc' },
              select: { name: true, imageUrl: true },
            },
            result: {
              select: {
                id: true,
                endedAt: true,
                settledAt: true,
                winningBid: {
                  select: { id: true, bidderId: true, amount: true },
                },
              },
            },
          },
        });
        if (!lot) throw new NotFoundException('Lot not found');
        const summary = {
          lotId: lot.id,
          title: lot.title,
          currency: lot.currency,
          endTime: lot.endTime,
          items: lot.items,
        };
        if (lot.result?.settledAt) {
          const result = lot.result;
          return {
            ...summary,
            status: 'settled' as const,
            receipt: {
              id: result.id,
              endedAt: result.endedAt,
              settledAt: result.settledAt,
              winningBidId: result.winningBid.id,
              amount: result.winningBid.amount.toFixed(2),
              winnerAlias: bidderAlias(lotId, result.winningBid.bidderId),
            },
          };
        }
        const ended = lot.endTime <= new Date();
        if (!ended)
          return {
            ...summary,
            status: 'awaiting_close' as const,
            receipt: null,
          };
        // A lifecycle read can close a lot before settlement; never infer a sale from status.
        const eligible = await tx.bid.count({
          where: { lotId, isActive: true },
        });
        return {
          ...summary,
          status:
            !lot.result && lot.status === 'closed' && eligible === 0
              ? ('no_winner' as const)
              : ('pending_settlement' as const),
          receipt: null,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }
}
