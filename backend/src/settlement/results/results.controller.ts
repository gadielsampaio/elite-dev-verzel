import {
  Controller,
  Get,
  Header,
  Headers,
  Param,
  ParseUUIDPipe,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  JwtAuthGuard,
  OptionalJwtAuthGuard,
  type AuthenticatedRequest,
} from '../../auth/jwt-auth.guard.js';
import { ResultsService } from './results.service.js';

@Controller('lots/:lotId')
export class ResultsController {
  constructor(private readonly results: ResultsService) {}
  @Get('result')
  @UseGuards(OptionalJwtAuthGuard)
  result(
    @Param('lotId', ParseUUIDPipe) lotId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.results.forLot(lotId, request.user);
  }
  @Get('receipt/shared')
  @Header('Cache-Control', 'private, no-store')
  sharedReceipt(
    @Param('lotId', ParseUUIDPipe) lotId: string,
    @Headers('x-receipt-token') token?: string,
  ) {
    return this.results.forLot(lotId, undefined, true, token ?? '');
  }

  @Get('receipt')
  @Header('Cache-Control', 'private, no-store')
  @UseGuards(JwtAuthGuard)
  receipt(
    @Param('lotId', ParseUUIDPipe) lotId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.results.forLot(lotId, request.user, true);
  }
}
