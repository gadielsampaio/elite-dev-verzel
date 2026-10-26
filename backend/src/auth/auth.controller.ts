import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { AuthService } from './auth.service.js';
import { LoginDto } from './dto/login.dto.js';
import { RegisterDto } from './dto/register.dto.js';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  @HttpCode(200)
  login(@Body() data: LoginDto) {
    return this.auth.login(data);
  }

  @Post('register')
  register(@Body() data: RegisterDto) {
    return this.auth.register(data);
  }
}
