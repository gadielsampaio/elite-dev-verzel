import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { ResultsService } from './results.service.js';

@Controller('lots/:lotId/result')
export class ResultsController {
  constructor(private readonly results: ResultsService) {}
  @Get()
  result(@Param('lotId', ParseUUIDPipe) lotId: string) {
    return this.results.forLot(lotId);
  }
}
