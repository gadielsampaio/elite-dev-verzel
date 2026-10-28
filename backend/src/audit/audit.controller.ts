import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { AuditService } from './audit.service.js';

@Controller('lots')
export class AuditController {
  constructor(private readonly audit: AuditService) {}
  @Get(':id/audit')
  verify(@Param('id', ParseUUIDPipe) id: string) {
    return this.audit.verify(id.toLowerCase());
  }
}
