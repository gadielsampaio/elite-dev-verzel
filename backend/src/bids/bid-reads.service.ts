import { bidderAlias } from './bidder-alias.js';
import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, type Lot } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ListBidsDto } from './list-bids.dto.js';

const publicSelect = {
  id: true,
  bidderId: true,
  amount: true,
  createdAt: true,
  isActive: true,
} satisfies Prisma.BidSelect;
type PublicBid = Prisma.BidGetPayload<{ select: typeof publicSelect }>;
const leaderOrder = [
  { amount: 'desc' },
  { createdAt: 'asc' },
  { id: 'asc' },
] satisfies Prisma.BidOrderByWithRelationInput[];

@Injectable()
export class BidReadsService {
  constructor(private readonly prisma: PrismaService) {}

  private publicBid(lotId: string, bid: PublicBid) {
    return {
      id: bid.id,
      bidderAlias: bidderAlias(lotId, bid.bidderId),
      amount: bid.amount.toFixed(2),
      createdAt: bid.createdAt,
      isActive: bid.isActive,
    };
  }

  private async lot(tx: Prisma.TransactionClient, id: string) {
    const lot = await tx.lot.findFirst({
      where: { id, status: { in: ['scheduled', 'open', 'closed'] } },
    });
    if (!lot) throw new NotFoundException('Lot not found');
    return lot;
  }

  private summary(lot: Lot, leader: PublicBid | null, now: Date) {
    const status =
      lot.status === 'closed' || now >= lot.endTime
        ? 'closed'
        : now < lot.startTime
          ? 'scheduled'
          : 'open';
    return {
      lotId: lot.id,
      status,
      serverTime: now,
      startTime: lot.startTime,
      endTime: lot.endTime,
      currency: lot.currency,
      startingBid: lot.startingBid.toFixed(2),
      bidIncrement: lot.bidIncrement.toFixed(2),
      currentBid: leader?.amount.toFixed(2) ?? null,
      minimumNextBid:
        status === 'open'
          ? (leader
              ? leader.amount.plus(lot.bidIncrement)
              : lot.startingBid
            ).toFixed(2)
          : null,
      leader: leader ? this.publicBid(lot.id, leader) : null,
    };
  }

  async history(lotId: string, { page, limit }: ListBidsDto) {
    return this.prisma.$transaction(
      async (tx) => {
        const lot = await this.lot(tx, lotId);
        const leader = await tx.bid.findFirst({
          where: { lotId, isActive: true },
          orderBy: leaderOrder,
          select: publicSelect,
        });
        const bids = await tx.bid.findMany({
          where: { lotId },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          skip: (page - 1) * limit,
          take: limit,
          select: publicSelect,
        });
        const total = await tx.bid.count({ where: { lotId } });
        return {
          ...this.summary(lot, leader, new Date()),
          items: bids.map((bid) => this.publicBid(lotId, bid)),
          total,
          page,
          limit,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }

  async mine(lotId: string, bidderId: string) {
    return this.prisma.$transaction(
      async (tx) => {
        const lot = await this.lot(tx, lotId);
        const leader = await tx.bid.findFirst({
          where: { lotId, isActive: true },
          orderBy: leaderOrder,
          select: publicSelect,
        });
        const best = await tx.bid.findFirst({
          where: { lotId, bidderId, isActive: true },
          orderBy: leaderOrder,
          select: publicSelect,
        });
        const higherBidders = best
          ? await tx.bid.groupBy({
              by: ['bidderId'],
              where: { lotId, isActive: true, amount: { gt: best.amount } },
            })
          : [];
        return {
          ...this.summary(lot, leader, new Date()),
          bestBid: best ? this.publicBid(lotId, best) : null,
          position: best ? higherBidders.length + 1 : null,
          isLeading: leader !== null && leader.bidderId === bidderId,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }
}
