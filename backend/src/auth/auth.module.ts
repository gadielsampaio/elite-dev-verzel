import { JwtModule } from '@nestjs/jwt';
import { jwtOptions } from './jwt.config.js';
import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';

@Module({
  imports: [PrismaModule, JwtModule.registerAsync({ useFactory: jwtOptions })],
  controllers: [AuthController],
  providers: [AuthService],
})
export class AuthModule {}
