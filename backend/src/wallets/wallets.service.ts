import { walletBalance } from './wallet-balance.js';
import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { Prisma, type WalletTransaction } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { DepositDto } from './deposit.dto.js';

@Injectable()
export class WalletsService {
  constructor(private readonly prisma: PrismaService) {}

  async balance(userId: string) {
    return this.prisma.$transaction(
      async (tx) => {
        const wallet = await tx.wallet.findUnique({ where: { userId } });
        if (!wallet)
          return {
            walletId: null,
            currency: 'USD',
            total: '0.00',
            committed: '0.00',
            available: '0.00',
          };
        const { total, committed, available } = await walletBalance(
          tx,
          wallet.id,
        );
        return {
          walletId: wallet.id,
          currency: wallet.currency,
          total: total.toFixed(2),
          committed: committed.toFixed(2),
          available: available.toFixed(2),
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }

  private receipt(entry: WalletTransaction) {
    return {
      id: entry.id,
      walletId: entry.walletId,
      type: entry.type,
      amount: entry.amount.toFixed(2),
      idempotencyKey: entry.idempotencyKey,
      createdAt: entry.createdAt,
    };
  }

  private async replay(
    client: Prisma.TransactionClient,
    userId: string,
    data: DepositDto,
    amount: Prisma.Decimal,
  ) {
    const entry = await client.walletTransaction.findUnique({
      where: { idempotencyKey: data.idempotencyKey },
      include: { wallet: { select: { userId: true } } },
    });
    if (!entry) return null;
    if (
      entry.wallet.userId !== userId ||
      entry.type !== 'deposit' ||
      !entry.amount.equals(amount)
    ) {
      throw new ConflictException(
        'Idempotency key already used for another operation',
      );
    }
    return this.receipt(entry);
  }

  async deposit(userId: string, data: DepositDto) {
    const amount = new Prisma.Decimal(data.amount);
    if (amount.lte(0))
      throw new BadRequestException('Deposit must be greater than zero');
    try {
      return await this.prisma.$transaction(async (tx) => {
        // Serialize first-wallet creation; NO KEY UPDATE permits bid foreign-key checks.
        await tx.$queryRaw`SELECT id FROM users WHERE id = ${userId}::uuid FOR NO KEY UPDATE`;
        const existing = await this.replay(tx, userId, data, amount);
        if (existing) return existing;
        const wallet = await tx.wallet.upsert({
          where: { userId },
          create: { userId, currency: 'USD' },
          update: {},
        });
        await tx.$queryRaw`SELECT id FROM wallets WHERE id = ${wallet.id}::uuid FOR UPDATE`;
        if (wallet.currency !== 'USD')
          throw new ConflictException('Only USD deposits are supported');
        const entry = await tx.walletTransaction.create({
          data: {
            walletId: wallet.id,
            type: 'deposit',
            amount,
            idempotencyKey: data.idempotencyKey,
            description: 'Simulated deposit',
          },
        });
        return this.receipt(entry);
      });
    } catch (error) {
      // Different users can race on the globally unique key. Never expose another receipt.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const existing = await this.replay(this.prisma, userId, data, amount);
        if (existing) return existing;
      }
      throw error;
    }
  }
}
