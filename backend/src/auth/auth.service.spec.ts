import {
  BadRequestException,
  ConflictException,
  ValidationPipe,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { compare } from 'bcryptjs';
import { vi } from 'vitest';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuthService } from './auth.service.js';
import { RegisterDto } from './dto/register.dto.js';

describe('Registration', () => {
  const create = vi.fn();
  const service = new AuthService(
    {
      user: { create },
    } as unknown as PrismaService,
    new JwtService(),
  );
  const data = {
    name: 'Test Bidder',
    email: 'bidder@example.com',
    password: 'test-password-123',
    role: 'bidder',
  } satisfies RegisterDto;
  beforeEach(() => vi.resetAllMocks());

  it('stores a verifiable hash and selects only public fields', async () => {
    const publicUser = {
      id: 'test-id',
      name: data.name,
      email: data.email,
      role: data.role,
    };
    create.mockResolvedValue(publicUser);
    expect(await service.register(data)).toEqual(publicUser);
    const query = create.mock.calls[0][0];
    expect(query.data).not.toHaveProperty('password');
    expect(query.data.passwordHash).not.toBe(data.password);
    expect(await compare(data.password, query.data.passwordHash)).toBe(true);
    expect(query.select).toEqual({
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
    });
  });

  it('maps duplicate email to conflict', async () => {
    create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('duplicate', {
        code: 'P2002',
        clientVersion: '7',
      }),
    );
    await expect(service.register(data)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('propagates unexpected database errors', async () => {
    const error = new Error('unavailable');
    create.mockRejectedValue(error);
    await expect(service.register(data)).rejects.toBe(error);
  });

  it('rejects passwords bcrypt would truncate, including multibyte input', async () => {
    await expect(
      service.register({ ...data, password: 'é'.repeat(37) }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(create).not.toHaveBeenCalled();
  });

  const pipe = new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  });
  it.each([
    { password: 'short' },
    { password: null },
    { email: 'bad' },
    { role: 'admin' },
    { isActive: false },
    { passwordHash: 'injected' },
  ])('rejects invalid registration %j', async (patch) => {
    await expect(
      pipe.transform(
        { ...data, ...patch },
        { type: 'body', metatype: RegisterDto },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
