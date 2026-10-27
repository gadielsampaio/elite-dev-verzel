import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  JwtAuthGuard,
  type AuthenticatedRequest,
} from '../auth/jwt-auth.guard.js';
import { DepositDto } from './deposit.dto.js';
import { WalletsService } from './wallets.service.js';

@Controller('wallet')
@UseGuards(JwtAuthGuard)
export class WalletsController {
  constructor(private readonly wallets: WalletsService) {}

  @Get()
  balance(@Req() request: AuthenticatedRequest) {
    return this.wallets.balance(request.user.id);
  }

  @Post('deposits')
  deposit(@Req() request: AuthenticatedRequest, @Body() data: DepositDto) {
    if (request.user.role !== 'bidder')
      throw new ForbiddenException('Only bidders can make simulated deposits');
    return this.wallets.deposit(request.user.id, data);
  }
}
