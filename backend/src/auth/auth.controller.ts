import {
  Body,
  Controller,
  HttpCode,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { RefreshService } from './refresh.service.js';
import {
  refreshCookie,
  cookieOptions,
  cookieToken,
  sessionRequest,
} from './session-cookie.js';
import { AuthService } from './auth.service.js';
import { LoginDto } from './dto/login.dto.js';
import { RegisterDto } from './dto/register.dto.js';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly sessions: RefreshService,
  ) {}

  @Post('login')
  @HttpCode(200)
  async login(
    @Body() data: LoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    sessionRequest(request);
    const result = await this.auth.login(data);
    await this.sessions.revoke(cookieToken(request));
    return this.tokens(response, result);
  }

  private tokens(
    response: Response,
    result: Awaited<ReturnType<RefreshService['rotate']>>,
  ) {
    const { refreshToken, expiresAt, ...body } = result;
    response.setHeader('Cache-Control', 'no-store');
    response.cookie(refreshCookie, refreshToken, {
      ...cookieOptions(),
      maxAge: Math.max(0, expiresAt.getTime() - Date.now()),
    });
    return body;
  }

  @Post('refresh')
  @HttpCode(200)
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    sessionRequest(request);
    try {
      return this.tokens(
        response,
        await this.sessions.rotate(cookieToken(request)),
      );
    } catch (error) {
      if (error instanceof UnauthorizedException)
        response.clearCookie(refreshCookie, cookieOptions());
      throw error;
    }
  }

  @Post('logout')
  @HttpCode(204)
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    sessionRequest(request);
    await this.sessions.revoke(cookieToken(request));
    response.clearCookie(refreshCookie, cookieOptions());
    response.setHeader('Cache-Control', 'no-store');
  }

  @Post('register')
  register(@Body() data: RegisterDto) {
    return this.auth.register(data);
  }
}
