import { ListLotsDto } from './list-lots.dto.js';
import { CancelLotDto } from './cancel-lot.dto.js';
import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  JwtAuthGuard,
  type AuthenticatedRequest,
} from '../auth/jwt-auth.guard.js';
import { AuctioneerGuard } from './auctioneer.guard.js';
import { CreateLotDto } from './create-lot.dto.js';
import { LotsService } from './lots.service.js';

@Controller('lots')
export class LotsController {
  constructor(private readonly lots: LotsService) {}

  @Post()
  @UseGuards(JwtAuthGuard, AuctioneerGuard)
  create(@Req() request: AuthenticatedRequest, @Body() data: CreateLotDto) {
    return this.lots.create(request.user.id, data);
  }

  @Get()
  findAll(@Query() query: ListLotsDto) {
    return this.lots.findAll(query);
  }

  @Patch(':id/cancel')
  @UseGuards(JwtAuthGuard, AuctioneerGuard)
  cancel(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() data: CancelLotDto,
  ) {
    return this.lots.cancel(id, request.user.id, data);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.lots.findOne(id);
  }
}
