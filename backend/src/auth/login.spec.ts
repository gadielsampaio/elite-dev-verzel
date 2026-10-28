import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { hash } from 'bcryptjs';
import { vi } from 'vitest';
import { AuthService } from './auth.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { jwtOptions } from './jwt.config.js';

describe('Login', () => {
  const findUnique = vi.fn();
  const secret = 'test-only-secret-at-least-32-characters';
  const jwt = new JwtService({
    secret,
    signOptions: { expiresIn: 900, algorithm: 'HS256' },
  });
  const service = new AuthService(
    {
      user: { findUnique },
      refreshSession: { create: vi.fn() },
    } as unknown as PrismaService,
    jwt,
  );
  const password = 'test-password-123';
  let passwordHash: string;
  beforeAll(async () => {
    passwordHash = await hash(password, 4);
  });
  beforeEach(() => vi.resetAllMocks());

  it('issues a signed, expiring token containing identity, role and a revocable session ID', async () => {
    findUnique.mockResolvedValue({
      id: 'user-id',
      role: 'bidder',
      isActive: true,
      passwordHash,
    });
    const result = await service.login({
      email: 'bidder@example.com',
      password,
    });
    const payload = await jwt.verifyAsync(result.accessToken);
    expect(payload).toEqual({
      sub: 'user-id',
      role: 'bidder',
      sid: expect.any(String),
      iat: expect.any(Number),
      exp: expect.any(Number),
    });
    expect(payload.exp - payload.iat).toBe(900);
    expect(result.tokenType).toBe('Bearer');
    expect(result.expiresIn).toBe(900);
  });

  it.each(['missing', 'inactive', 'passwordless', 'wrong', 'truncated'])(
    'rejects %s credentials without a token',
    async (scenario) => {
      findUnique.mockResolvedValue(
        scenario === 'missing'
          ? null
          : {
              id: 'user-id',
              role: 'bidder',
              isActive: scenario !== 'inactive',
              passwordHash: scenario === 'passwordless' ? null : passwordHash,
            },
      );
      await expect(
        service.login({
          email: 'bidder@example.com',
          password:
            scenario === 'wrong'
              ? 'wrong-password'
              : scenario === 'truncated'
                ? 'é'.repeat(37)
                : password,
        }),
      ).rejects.toEqual(new UnauthorizedException('Invalid credentials'));
    },
  );

  it('does not hide database errors as invalid credentials', async () => {
    const error = new Error('database unavailable');
    findUnique.mockRejectedValue(error);
    await expect(
      service.login({ email: 'bidder@example.com', password }),
    ).rejects.toBe(error);
  });

  it('requires a configured signing secret', () => {
    const previous = process.env.JWT_SECRET;
    try {
      delete process.env.JWT_SECRET;
      expect(jwtOptions).toThrow('JWT_SECRET');
      process.env.JWT_SECRET = 'short';
      expect(jwtOptions).toThrow('JWT_SECRET');
      process.env.JWT_SECRET = secret;
      expect(jwtOptions().signOptions.expiresIn).toBe(900);
    } finally {
      if (previous === undefined) delete process.env.JWT_SECRET;
      else process.env.JWT_SECRET = previous;
    }
  });
});
