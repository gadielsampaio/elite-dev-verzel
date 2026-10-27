import {
  Body,
  Controller,
  ForbiddenException,
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
@UseGuards(JwtAuthGuard)
export class BidsController {
  constructor(private readonly bids: BidsService) {}
  @Post()
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
