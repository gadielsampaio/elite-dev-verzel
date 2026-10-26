import {
  BadRequestException,
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
    const startTime = new Date(data.startTime),
      endTime = new Date(data.endTime);
    if (startTime.getTime() <= Date.now() || endTime <= startTime) {
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
    // Reject a schedule that expired while waiting for the provider.
    if (startTime.getTime() <= Date.now())
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
        status: 'scheduled',
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

  async findOne(id: string) {
    const lot = await this.prisma.lot.findFirst({
      where: { id, status: { in: ['scheduled', 'open', 'closed'] } },
      include: { items: { orderBy: { position: 'asc' } } },
    });
    if (!lot) throw new NotFoundException('Lot not found');
    return lot;
  }
}
