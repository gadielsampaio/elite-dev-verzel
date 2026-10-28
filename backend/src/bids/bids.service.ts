import { AuctionEvents } from '../events/auction-events.js';
import { recordBidAudit } from '../audit/record-bid-audit.js';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type Bid, type Lot } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { walletBalance } from '../wallets/wallet-balance.js';
import { PlaceBidDto } from './place-bid.dto.js';

@Injectable()
export class BidsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: AuctionEvents,
  ) {}

  private receipt(bid: Bid) {
    return {
      id: bid.id,
      lotId: bid.lotId,
      amount: bid.amount.toFixed(2),
      idempotencyKey: bid.idempotencyKey,
      createdAt: bid.createdAt,
    };
  }

  private async replay(
    tx: Prisma.TransactionClient,
    lotId: string,
    bidderId: string,
    data: PlaceBidDto,
    amount: Prisma.Decimal,
  ) {
    const bid = await tx.bid.findUnique({
      where: { idempotencyKey: data.idempotencyKey },
    });
    if (!bid) return null;
    if (
      bid.lotId !== lotId ||
      bid.bidderId !== bidderId ||
      !bid.amount.equals(amount)
    )
      throw new ConflictException(
        'Idempotency key already used for another bid',
      );
    return this.receipt(bid);
  }

  private assertLive(lot: Lot, now: Date) {
    if (!['scheduled', 'open'].includes(lot.status))
      throw new ConflictException('Lot is not open for bidding');
    if (now < lot.startTime) throw new ConflictException('Lot has not started');
    if (now >= lot.endTime) throw new ConflictException('Lot has ended');
  }

  async place(lotId: string, bidderId: string, data: PlaceBidDto) {
    const amount = new Prisma.Decimal(data.amount);
    if (amount.lte(0))
      throw new BadRequestException('Bid must be greater than zero');
    try {
      const result = await this.prisma.$transaction(async (tx) => {
        // Shared with cancellation. All bids for a lot serialize here.
        const locked = await tx.$queryRaw<
          { id: string }[]
        >`SELECT id FROM lots WHERE id = ${lotId}::uuid FOR UPDATE`;
        if (!locked.length) throw new NotFoundException('Lot not found');
        const replay = await this.replay(tx, lotId, bidderId, data, amount);
        if (replay) return { receipt: replay, change: null };
        const lot = await tx.lot.findUniqueOrThrow({ where: { id: lotId } });
        if (lot.ownerId === bidderId)
          throw new ForbiddenException('You cannot bid on your own lot');
        this.assertLive(lot, new Date());
        const leader = await tx.bid.findFirst({
          where: { lotId, isActive: true },
          orderBy: [{ amount: 'desc' }, { createdAt: 'asc' }, { id: 'asc' }],
        });
        if (leader?.bidderId === bidderId)
          throw new ConflictException('You are already leading this lot');
        const minimum = leader
          ? leader.amount.plus(lot.bidIncrement)
          : lot.startingBid;
        if (amount.lt(minimum))
          throw new ConflictException(
            `Bid must be at least ${minimum.toFixed(2)}`,
          );
        const wallets = await tx.wallet.findMany({
          where: {
            userId: { in: leader ? [bidderId, leader.bidderId] : [bidderId] },
          },
        });
        const wallet = wallets.find((w) => w.userId === bidderId);
        if (!wallet)
          throw new ConflictException('Insufficient available balance');
        // Stable ordering prevents cycles when different lots share bidder wallets.
        const ids = wallets.map((w) => w.id).sort();
        await tx.$queryRaw`SELECT id FROM wallets WHERE id IN (${Prisma.join(ids)}) ORDER BY id FOR UPDATE`;
        if (wallet.currency !== lot.currency)
          throw new ConflictException('Wallet and lot currencies must match');
        const previousHold = leader
          ? await tx.walletHold.findUnique({ where: { bidId: leader.id } })
          : null;
        if (
          leader &&
          (!previousHold ||
            previousHold.status !== 'active' ||
            !previousHold.amount.equals(leader.amount) ||
            !wallets.some(
              (w) =>
                w.id === previousHold.walletId &&
                w.userId === leader.bidderId &&
                w.currency === lot.currency,
            ))
        ) {
          throw new ConflictException(
            'Leading bid has no valid active reservation',
          );
        }
        const balance = await walletBalance(tx, wallet.id);
        if (amount.gt(balance.available))
          throw new ConflictException('Insufficient available balance');
        const now = new Date();
        this.assertLive(lot, now); // Wallet lock waits must not permit late bids.
        const bid = await tx.bid.create({
          data: {
            lotId,
            bidderId,
            amount,
            idempotencyKey: data.idempotencyKey,
            createdAt: now,
          },
        });
        if (previousHold)
          await tx.walletHold.update({
            where: { id: previousHold.id },
            data: { status: 'released', releasedAt: now },
          });
        await tx.walletHold.create({
          data: { walletId: wallet.id, bidId: bid.id, amount },
        });
        const endTime =
          lot.endTime.getTime() - now.getTime() <= 120000
            ? new Date(lot.endTime.getTime() + 120000)
            : lot.endTime;
        await tx.lot.update({
          where: { id: lotId },
          data: { status: 'open', endTime },
        });
        await recordBidAudit(tx, bid, lot.currency, endTime);
        return {
          receipt: this.receipt(bid),
          change: {
            lotId,
            bidId: bid.id,
            endTime: endTime.toISOString(),
            extended: endTime.getTime() !== lot.endTime.getTime(),
          },
        };
      });
      // Prisma resolves only after COMMIT. Replays and failed transactions never
      // reach publication with a new change; transport stays outside this Facade.
      if (result.change) {
        this.events.publish({ type: 'bid.accepted', ...result.change });
        if (result.change.extended)
          this.events.publish({ type: 'lot.extended', ...result.change });
      }
      return result.receipt;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const replay = await this.replay(
          this.prisma,
          lotId,
          bidderId,
          data,
          amount,
        );
        if (replay) return replay;
      }
      throw error;
    }
  }
}
