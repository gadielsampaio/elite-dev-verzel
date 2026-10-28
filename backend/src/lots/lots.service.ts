import { ListLotsDto } from './list-lots.dto.js';
import { CancelLotDto } from './cancel-lot.dto.js';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CatalogService } from '../catalog/catalog.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { Prisma } from '../generated/prisma/client.js';
import { CreateLotDto } from './create-lot.dto.js';

@Injectable()
export class LotsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly catalog: CatalogService,
  ) {}

  async create(ownerId: string, data: CreateLotDto) {
    let startTime =
        data.startMode === 'now' ? new Date() : new Date(data.startTime!),
      endTime = new Date(data.endTime);
    if (
      (data.startMode !== 'now' && startTime.getTime() <= Date.now()) ||
      endTime <= startTime
    ) {
      throw new BadRequestException(
        'Start must be in the future and end must be after start',
      );
    }
    const startingBid = new Prisma.Decimal(data.startingBid);
    const bidIncrement = new Prisma.Decimal(data.bidIncrement);
    const estimatedValue = new Prisma.Decimal(data.estimatedValue);
    if (
      [startingBid, bidIncrement, estimatedValue].some(
        (value) => !value.isPositive() || value.isZero(),
      )
    ) {
      throw new BadRequestException('Prices must be greater than zero');
    }
    const artwork = await this.catalog.findOne(data.artworkId);
    if (artwork.isPublicDomain !== true)
      throw new BadRequestException('Artwork must be public domain (CC0)');
    if (!artwork.imageUrl?.trim())
      throw new BadRequestException('Artwork must have an image');
    // Reject a schedule that expired while waiting for the provider.
    if (data.startMode === 'now') startTime = new Date();
    if (endTime <= startTime)
      throw new BadRequestException('End must be after start');
    if (data.startMode !== 'now' && startTime.getTime() <= Date.now())
      throw new BadRequestException('Start must be in the future');
    return this.prisma.lot.create({
      data: {
        ownerId,
        title: data.title,
        startTime,
        endTime,
        startingBid,
        bidIncrement,
        currency: 'USD',
        status: data.startMode === 'now' ? 'open' : 'scheduled',
        items: {
          create: {
            name: artwork.name,
            estimatedValue,
            imageUrl: artwork.imageUrl,
            articArtworkId: artwork.articArtworkId,
            articImageId: artwork.articImageId,
            artistDisplay: artwork.artistDisplay,
            creditLine: artwork.creditLine,
            isPublicDomain: artwork.isPublicDomain,
            sourceSnapshot: { ...artwork },
            sourceFetchedAt: new Date(),
          },
        },
      },
      include: { items: { orderBy: { position: 'asc' } } },
    });
  }

  // Reconcile on reads: timestamps are authoritative, not a background timer.
  // Closing marks the bidding window ended; settlement is a separate future workflow.
  private async refreshLifecycle(
    tx: Prisma.TransactionClient,
    now: Date,
    id?: string,
    ownerId?: string,
  ) {
    await tx.lot.updateMany({
      where: {
        id,
        ownerId,
        status: { in: ['scheduled', 'open'] },
        endTime: { lte: now },
      },
      data: { status: 'closed' },
    });
    await tx.lot.updateMany({
      where: {
        id,
        ownerId,
        status: 'scheduled',
        startTime: { lte: now },
        endTime: { gt: now },
      },
      data: { status: 'open' },
    });
  }

  async findAll({ status, page, limit }: ListLotsDto) {
    return this.prisma.$transaction(async (tx) => {
      await this.refreshLifecycle(tx, new Date());
      const where: Prisma.LotWhereInput = {
        status: status ?? { in: ['scheduled', 'open', 'closed'] },
      };
      const items = await tx.lot.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        include: { items: { orderBy: { position: 'asc' } } },
      });
      const total = await tx.lot.count({ where });
      return { items, total, page, limit };
    });
  }

  async findMine(ownerId: string, { status, page, limit }: ListLotsDto) {
    return this.prisma.$transaction(
      async (tx) => {
        const now = new Date();
        await this.refreshLifecycle(tx, now, undefined, ownerId);
        const where: Prisma.LotWhereInput = {
          ownerId,
          ...(status ? { status } : {}),
        };
        const lots = await tx.lot.findMany({
          where,
          skip: (page - 1) * limit,
          take: limit,
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          include: {
            items: { orderBy: { position: 'asc' } },
            _count: { select: { bids: true } },
          },
        });
        const total = await tx.lot.count({ where });
        const items = lots.map(({ _count, ...lot }) => ({
          ...lot,
          bidCount: _count.bids,
          canCancel:
            ['scheduled', 'open'].includes(lot.status) &&
            lot.endTime > now &&
            _count.bids === 0,
        }));
        return { items, total, page, limit };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }

  async findOne(id: string) {
    return this.prisma.$transaction(async (tx) => {
      await this.refreshLifecycle(tx, new Date(), id);
      const lot = await tx.lot.findFirst({
        where: { id, status: { in: ['scheduled', 'open', 'closed'] } },
        include: { items: { orderBy: { position: 'asc' } } },
      });
      if (!lot) throw new NotFoundException('Lot not found');
      return lot;
    });
  }

  async cancel(id: string, ownerId: string, { reason }: CancelLotDto) {
    return this.prisma.$transaction(async (tx) => {
      // All future bid writes must take this same lot lock before checking state.
      const locked = await tx.$queryRaw<
        { id: string }[]
      >`SELECT id FROM lots WHERE id = ${id}::uuid FOR UPDATE`;
      if (!locked.length) throw new NotFoundException('Lot not found');
      const lot = await tx.lot.findUniqueOrThrow({
        where: { id },
        include: { items: { orderBy: { position: 'asc' } } },
      });
      if (lot.ownerId !== ownerId)
        throw new ForbiddenException('Only the owner can cancel this lot');
      if (lot.status === 'cancelled') return lot;
      const now = new Date();
      if (!['scheduled', 'open'].includes(lot.status) || lot.endTime <= now) {
        throw new ConflictException(
          'Only scheduled or live lots can be cancelled',
        );
      }
      if (await tx.bid.count({ where: { lotId: id } })) {
        throw new ConflictException(
          'A lot that has received bids cannot be cancelled',
        );
      }
      return tx.lot.update({
        where: { id },
        data: {
          status: 'cancelled',
          cancelledAt: now,
          cancellationReason: reason ?? null,
        },
        include: { items: { orderBy: { position: 'asc' } } },
      });
    });
  }
}
