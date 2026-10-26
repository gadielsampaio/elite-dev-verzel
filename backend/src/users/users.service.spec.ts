import { Test } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { vi } from 'vitest';

import { Prisma, UserRole } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { UsersService } from './users.service.js';

describe('UsersService', () => {
  const expectedPublicFields = {
    id: true,
    name: true,
    email: true,
    role: true,
    isActive: true,
    createdAt: true,
    updatedAt: true,
  };
  let service: UsersService;

  const prismaMock = {
    user: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
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
        select: expectedPublicFields,
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

      await expect(service.create(userData)).rejects.toThrow(ConflictException);
    });

    it('should rethrow unexpected database errors', async () => {
      const error = new Error('Database unavailable');

      prismaMock.user.create.mockRejectedValue(error);

      await expect(service.create(userData)).rejects.toThrow(error);
    });
  });

  describe('findAll', () => {
    it('should return all users', async () => {
      const users = [{ id: '123', ...userData }];

      prismaMock.user.findMany.mockResolvedValue(users);

      const result = await service.findAll();

      expect(result).toEqual(users);
      expect(prismaMock.user.findMany).toHaveBeenCalledWith({
        select: expectedPublicFields,
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should return an empty array when there are no users', async () => {
      prismaMock.user.findMany.mockResolvedValue([]);

      const result = await service.findAll();

      expect(result).toEqual([]);
    });
  });

  describe('findOne', () => {
    const id = '6b3603a0-806b-4e87-95b0-ac78f78cb19f';

    it('should return a user by ID', async () => {
      const user = { id, ...userData };

      prismaMock.user.findUnique.mockResolvedValue(user);

      const result = await service.findOne(id);

      expect(result).toEqual(user);
      expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
        select: expectedPublicFields,
        where: { id },
      });
    });

    it('should throw NotFoundException if user does not exist', async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);

      await expect(service.findOne(id)).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    const id = '6b3603a0-806b-4e87-95b0-ac78f78cb19f';
    const data = { name: 'Updated Name' };

    it('should update a user', async () => {
      const updatedUser = { id, ...userData, ...data };

      prismaMock.user.update.mockResolvedValue(updatedUser);

      const result = await service.update(id, data);

      expect(result).toEqual(updatedUser);
      expect(prismaMock.user.update).toHaveBeenCalledWith({
        select: expectedPublicFields,
        where: { id },
        data,
      });
    });

    it('should throw NotFoundException for missing user', async () => {
      const error = new Prisma.PrismaClientKnownRequestError(
        'Record not found',
        { code: 'P2025', clientVersion: '7.10.1' },
      );

      prismaMock.user.update.mockRejectedValue(error);

      await expect(service.update(id, data)).rejects.toThrow(NotFoundException);
    });

    it('should reject duplicate emails', async () => {
      const error = new Prisma.PrismaClientKnownRequestError(
        'Unique constraint failed',
        { code: 'P2002', clientVersion: '7.10.1' },
      );

      prismaMock.user.update.mockRejectedValue(error);

      await expect(
        service.update(id, { email: 'existing@example.com' }),
      ).rejects.toThrow(ConflictException);
    });
  });
});
