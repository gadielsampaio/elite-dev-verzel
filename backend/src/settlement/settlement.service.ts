import { AuctionEvents, type AuctionEvent } from '../events/auction-events.js';
import { randomUUID } from 'node:crypto';
import { ConflictException, Injectable } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { walletBalance } from '../wallets/wallet-balance.js';

@Injectable()
export class SettlementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: AuctionEvents,
  ) {}

  async settle(lotId: string) {
    const changes: AuctionEvent[] = [];
    const settled = await this.prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<
        { id: string }[]
      >`SELECT id FROM lots WHERE id = ${lotId}::uuid FOR UPDATE`;
      if (!locked.length) return null;
      const lot = await tx.lot.findUniqueOrThrow({ where: { id: lotId } });
      if (
        !['scheduled', 'open', 'closed'].includes(lot.status) ||
        lot.endTime > new Date()
      )
        return null;
      const existing = await tx.auctionResult.findUnique({ where: { lotId } });
      if (existing) {
        if (!existing.settledAt)
          throw new ConflictException('Existing result is not settled');
        return existing;
      }
      const winner = await tx.bid.findFirst({
        where: { lotId, isActive: true },
        orderBy: [{ amount: 'desc' }, { createdAt: 'asc' }, { id: 'asc' }],
      });
      const holds = await tx.walletHold.findMany({
        where: { bid: { lotId }, status: 'active' },
      });
      const closed: AuctionEvent = {
        type: 'lot.closed',
        lotId,
        endTime: lot.endTime.toISOString(),
      };
      if (!winner) {
        if (holds.length)
          throw new ConflictException(
            'Lot without eligible bids has active reservations',
          );
        await tx.lot.update({
          where: { id: lotId },
          data: { status: 'closed' },
        });
        if (lot.status !== 'closed') changes.push(closed);
        return null;
      }
      if (
        winner.bidderId === lot.ownerId ||
        holds.length !== 1 ||
        holds[0].bidId !== winner.id ||
        !holds[0].amount.equals(winner.amount)
      )
        throw new ConflictException('Winning bid has inconsistent reservation');

      // Match deposit creation locking; acquire all wallet locks afterward in ID order.
      await tx.$queryRaw`SELECT id FROM users WHERE id = ${lot.ownerId}::uuid FOR NO KEY UPDATE`;
      let seller = await tx.wallet.findUnique({
        where: { userId: lot.ownerId },
      });
      if (!seller)
        seller = await tx.wallet.create({
          data: { userId: lot.ownerId, currency: lot.currency },
        });
      const buyer = await tx.wallet.findUnique({
        where: { userId: winner.bidderId },
      });
      if (
        !buyer ||
        buyer.id !== holds[0].walletId ||
        buyer.currency !== lot.currency ||
        seller.currency !== lot.currency
      )
        throw new ConflictException('Settlement wallet mismatch');
      const ids = [seller.id, buyer.id].sort();
      await tx.$queryRaw`SELECT id FROM wallets WHERE id IN (${Prisma.join(ids)}) ORDER BY id FOR UPDATE`;
      const balance = await walletBalance(tx, buyer.id);
      if (balance.available.lt(0) || balance.total.lt(winner.amount))
        throw new ConflictException('Insufficient reserved funds');
      const now = new Date();
      const result = await tx.auctionResult.create({
        data: {
          lotId,
          ownerId: lot.ownerId,
          winnerId: winner.bidderId,
          winningBidId: winner.id,
          endedAt: lot.endTime,
          settledAt: now,
        },
      });
      const transferId = randomUUID();
      await tx.walletTransaction.createMany({
        data: [
          {
            walletId: buyer.id,
            type: 'auction_purchase',
            amount: winner.amount,
            auctionResultId: result.id,
            transferId,
            idempotencyKey: randomUUID(),
          },
          {
            walletId: seller.id,
            type: 'auction_sale',
            amount: winner.amount,
            auctionResultId: result.id,
            transferId,
            idempotencyKey: randomUUID(),
          },
        ],
      });
      await tx.walletHold.update({
        where: { id: holds[0].id },
        data: { status: 'captured', capturedAt: now },
      });
      await tx.bid.update({
        where: { id: winner.id },
        data: { isWinner: true },
      });
      await tx.lot.update({ where: { id: lotId }, data: { status: 'closed' } });
      if (lot.status !== 'closed') changes.push(closed);
      changes.push({ ...closed, type: 'lot.settled' });
      return result;
    });
    changes.forEach((change) => this.events.publish(change));
    return settled;
  }
}
