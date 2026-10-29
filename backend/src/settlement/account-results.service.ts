import { Injectable } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ParticipationPageDto, ResultsPageDto } from './account-results.dto.js';

@Injectable()
export class AccountResultsService {
  constructor(private readonly prisma: PrismaService) {}

  summary(ownerId: string) {
    return this.prisma.$transaction(
      async (tx) => {
        const now = new Date();
        const lots = await tx.lot.count({ where: { ownerId } });
        const live = await tx.lot.count({
          where: {
            ownerId,
            status: { in: ['scheduled', 'open'] },
            startTime: { lte: now },
            endTime: { gt: now },
          },
        });
        const sold = await tx.auctionResult.count({
          where: { ownerId, settledAt: { not: null } },
        });
        // Actual credited sale transactions, never starting bids or unconfirmed results.
        const credits = await tx.walletTransaction.aggregate({
          where: {
            type: 'auction_sale',
            wallet: { userId: ownerId, currency: 'USD' },
            auctionResult: { ownerId, settledAt: { not: null } },
          },
          _sum: { amount: true },
        });
        return {
          lots,
          live,
          sold,
          currency: 'USD',
          totalReceived: (credits._sum.amount ?? new Prisma.Decimal(0)).toFixed(
            2,
          ),
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }

  seller(ownerId: string, query: ResultsPageDto) {
    const now = new Date();
    return this.list(
      {
        ownerId,
        status: { in: ['scheduled', 'open', 'closed'] },
        OR: [{ status: 'closed' }, { endTime: { lte: now } }],
      },
      query,
    );
  }

  participations(bidderId: string, query: ParticipationPageDto) {
    return this.list(
      {
        status: { not: 'draft' },
        bids: { some: { bidderId } },
        ...(query.filter === 'wins'
          ? { result: { winnerId: bidderId, settledAt: { not: null } } }
          : {}),
      },
      query,
      bidderId,
    );
  }

  private list(
    where: Prisma.LotWhereInput,
    { page, limit }: ResultsPageDto,
    bidderId?: string,
  ) {
    return this.prisma.$transaction(
      async (tx) => {
        const now = new Date();
        const lots = await tx.lot.findMany({
          where,
          orderBy: [{ endTime: 'desc' }, { id: 'desc' }],
          skip: (page - 1) * limit,
          take: limit,
          select: {
            id: true,
            title: true,
            currency: true,
            status: true,
            startTime: true,
            endTime: true,
            items: {
              orderBy: { position: 'asc' },
              take: 1,
              select: { name: true, imageUrl: true },
            },
            result: {
              select: {
                settledAt: true,
                winnerId: true,
                winningBid: { select: { amount: true } },
              },
            },
            _count: { select: { bids: { where: { isActive: true } } } },
            bids: {
              where: { bidderId: bidderId ?? { in: [] } },
              orderBy: [{ amount: 'desc' }, { id: 'asc' }],
              take: 1,
              select: { amount: true },
            },
          },
        });
        const total = await tx.lot.count({ where });
        const items = lots.map((lot) => {
          const settled = !!lot.result?.settledAt;
          const status =
            lot.status === 'cancelled'
              ? 'cancelled'
              : lot.status === 'closed' || lot.endTime <= now
                ? 'closed'
                : lot.startTime > now
                  ? 'scheduled'
                  : 'open';
          const outcome = settled
            ? 'settled'
            : status === 'cancelled'
              ? 'cancelled'
              : status !== 'closed'
                ? 'awaiting_close'
                : lot.status === 'closed' &&
                    !lot.result &&
                    lot._count.bids === 0
                  ? 'no_winner'
                  : 'pending_settlement';
          return {
            lotId: lot.id,
            title: lot.title,
            currency: lot.currency,
            status,
            outcome,
            endTime: lot.endTime,
            items: lot.items,
            amount: settled ? lot.result!.winningBid.amount.toFixed(2) : null,
            settledAt: settled ? lot.result!.settledAt : null,
            receiptPath:
              settled && (!bidderId || lot.result!.winnerId === bidderId)
                ? `/#/receipt/${lot.id}`
                : null,
            ...(bidderId
              ? {
                  won: settled && lot.result!.winnerId === bidderId,
                  myBestBid: lot.bids[0]?.amount.toFixed(2) ?? null,
                }
              : {}),
          };
        });
        return { items, total, page, limit };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }
}
