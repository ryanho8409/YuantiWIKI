import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is not set');
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

async function main() {
  const result = await prisma.space.updateMany({
    where: {
      deletedAt: null,
      OR: [{ name: { startsWith: 'Week' } }, { name: { startsWith: 'week' } }],
    },
    data: { deletedAt: new Date() },
  });
  console.log(`week_space_deleted_count=${result.count}`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
