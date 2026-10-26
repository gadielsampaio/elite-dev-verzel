import { CatalogModule } from './catalog/catalog.module.js';
import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { HealthModule } from './health/health.module.js';
import { UsersModule } from './users/users.module.js';

import { AuthModule } from './auth/auth.module.js';

@Module({
  imports: [PrismaModule, HealthModule, UsersModule, AuthModule, CatalogModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
