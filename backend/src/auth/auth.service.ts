import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { RefreshService } from './refresh.service.js';
import { LoginDto } from './dto/login.dto.js';
import { compare, hash, truncates } from 'bcryptjs';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { RegisterDto } from './dto/register.dto.js';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async login({ email, password }: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true, role: true, isActive: true, passwordHash: true },
    });
    if (
      !user?.isActive ||
      !user.passwordHash ||
      truncates(password) ||
      !(await compare(password, user.passwordHash))
    ) {
      throw new UnauthorizedException('Invalid credentials');
    }
    return new RefreshService(this.prisma, this.jwt).issue(user);
  }

  async register({ password, name, email, role }: RegisterDto) {
    if (truncates(password)) {
      throw new BadRequestException('Password must not exceed 72 UTF-8 bytes');
    }
    const passwordHash = await hash(password, 12);
    try {
      return await this.prisma.user.create({
        data: { name, email, role, passwordHash },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Email already exists');
      }
      throw error;
    }
  }
}
