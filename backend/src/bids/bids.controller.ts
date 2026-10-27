import { BidReadsService } from './bid-reads.service.js';
import { ListBidsDto } from './list-bids.dto.js';
import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Query,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  JwtAuthGuard,
  type AuthenticatedRequest,
} from '../auth/jwt-auth.guard.js';
import { BidsService } from './bids.service.js';
import { PlaceBidDto } from './place-bid.dto.js';

@Controller('lots/:lotId/bids')
export class BidsController {
  constructor(
    private readonly bids: BidsService,
    private readonly reads: BidReadsService,
  ) {}

  @Get()
  history(
    @Param('lotId', ParseUUIDPipe) lotId: string,
    @Query() query: ListBidsDto,
  ) {
    return this.reads.history(lotId, query);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  mine(
    @Param('lotId', ParseUUIDPipe) lotId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.reads.mine(lotId, request.user.id);
  }
  @Post()
  @UseGuards(JwtAuthGuard)
  place(
    @Param('lotId', ParseUUIDPipe) lotId: string,
    @Req() request: AuthenticatedRequest,
    @Body() data: PlaceBidDto,
  ) {
    if (request.user.role !== 'bidder')
      throw new ForbiddenException('Only bidders can place bids');
    return this.bids.place(lotId, request.user.id, data);
  }
}
