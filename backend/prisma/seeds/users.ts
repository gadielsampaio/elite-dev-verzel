import { hash } from 'bcryptjs';
import type { Prisma, UserRole } from '../../src/generated/prisma/client.js';
import users from './data/users.json' with { type: 'json' };

export async function seedUsers(tx: Prisma.TransactionClient) {
  const password = process.env.SEED_PASSWORD;
  if (!password) throw new Error('SEED_PASSWORD NOT FOUND');
  const passwordHash = await hash(password, 12);
  for (const user of users) {
    await tx.user.upsert({
      where: { id: user.id },
      update: {},
      create: { ...user, role: user.role as UserRole, passwordHash },
    });
  }
}
