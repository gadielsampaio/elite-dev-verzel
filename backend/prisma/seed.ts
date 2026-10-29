import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { seedUsers } from './seeds/users.js';
import { seedWallets } from './seeds/wallets.js';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL is required');
const prisma = new PrismaClient({
  adapter: new PrismaPg(
    { connectionString },
    {
      schema: new URL(connectionString).searchParams.get('schema') || 'public',
    },
  ),
});

async function main() {
  await prisma.$transaction(
    async (tx) => {
      await seedUsers(tx);
      await seedWallets(tx);
    },
    { timeout: 30000 },
  );
  console.log('Seed complete.');
}

main()
  .catch(() => {
    console.error(
      'Seed failed. Check the database, fixtures and SEED_PASSWORD.',
    );
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
