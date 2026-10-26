import {
  Body,
  Controller,
  Get,
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

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.lots.findOne(id);
  }
}
