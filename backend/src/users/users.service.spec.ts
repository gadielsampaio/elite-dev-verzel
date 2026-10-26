import { Test } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';
import { vi } from 'vitest';

import { Prisma, UserRole } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { UsersService } from './users.service.js';

describe('UsersService', () => {
  let service: UsersService;

  const prismaMock = {
    user: {
      create: vi.fn(),
    },
  };

  const userData = {
    name: 'John Doe',
    email: 'john@example.com',
    role: UserRole.bidder,
  };

  beforeEach(async () => {
    vi.resetAllMocks();

    const module = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  describe('create', () => {
    it('should create a user successfully', async () => {
      const createdUser = {
        id: 'b2c7e109-1de2-4fcb-9603-bc1784c97e41',
        ...userData,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      prismaMock.user.create.mockResolvedValue(createdUser);

      const result = await service.create(userData);

      expect(result).toEqual(createdUser);
      expect(prismaMock.user.create).toHaveBeenCalledWith({
        data: userData,
      });
    });

    it('should throw ConflictException for duplicate email', async () => {
      const error = new Prisma.PrismaClientKnownRequestError(
        'Unique constraint failed',
        {
          code: 'P2002',
          clientVersion: '7.10.1',
        },
      );

      prismaMock.user.create.mockRejectedValue(error);

      await expect(service.create(userData)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should rethrow unexpected database errors', async () => {
      const error = new Error('Database unavailable');

      prismaMock.user.create.mockRejectedValue(error);

      await expect(service.create(userData)).rejects.toThrow(error);
    });
  });
});
