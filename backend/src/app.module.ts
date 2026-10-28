import { RealtimeModule } from './realtime/realtime.module.js';
import { AuditModule } from './audit/audit.module.js';
import { SettlementModule } from './settlement/settlement.module.js';
import { BidsModule } from './bids/bids.module.js';
import { WalletsModule } from './wallets/wallets.module.js';
import { LotsModule } from './lots/lots.module.js';
import { CatalogModule } from './catalog/catalog.module.js';
import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { HealthModule } from './health/health.module.js';
import { UsersModule } from './users/users.module.js';

import { AuthModule } from './auth/auth.module.js';

@Module({
  imports: [
    PrismaModule,
    HealthModule,
    UsersModule,
    AuthModule,
    CatalogModule,
    LotsModule,
    WalletsModule,
    BidsModule,
    SettlementModule,
    AuditModule,
    RealtimeModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
