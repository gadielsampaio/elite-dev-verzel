import {
  Controller,
  ForbiddenException,
  Get,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  JwtAuthGuard,
  type AuthenticatedRequest,
} from '../auth/jwt-auth.guard.js';
import { AccountResultsService } from './account-results.service.js';
import { ParticipationPageDto, ResultsPageDto } from './account-results.dto.js';

@Controller('me')
@UseGuards(JwtAuthGuard)
export class AccountResultsController {
  constructor(private readonly results: AccountResultsService) {}

  @Get('auction-summary')
  summary(@Req() request: AuthenticatedRequest) {
    if (request.user.role !== 'auctioneer')
      throw new ForbiddenException('Auctioneer account required');
    return this.results.summary(request.user.id);
  }

  @Get('auction-results')
  sold(@Req() request: AuthenticatedRequest, @Query() query: ResultsPageDto) {
    if (request.user.role !== 'auctioneer')
      throw new ForbiddenException('Auctioneer account required');
    return this.results.seller(request.user.id, query);
  }

  @Get('participations')
  participated(
    @Req() request: AuthenticatedRequest,
    @Query() query: ParticipationPageDto,
  ) {
    if (request.user.role !== 'bidder')
      throw new ForbiddenException('Bidder account required');
    return this.results.participations(request.user.id, query);
  }
}
