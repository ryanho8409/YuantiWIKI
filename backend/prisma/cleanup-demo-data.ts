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

function isApplyMode() {
  return process.env.APPLY === '1' || process.env.APPLY === 'true' || process.argv.includes('--apply');
}

async function main() {
  const targets = await prisma.space.findMany({
    where: {
      deletedAt: null,
      OR: [
        { name: { startsWith: 'Week' } },
        { name: { startsWith: 'week' } },
        { name: '示例知识库' },
        { name: { contains: 'demo', mode: 'insensitive' } },
        { description: { contains: '演示', mode: 'insensitive' } },
      ],
    },
    select: {
      id: true,
      name: true,
      description: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  console.log(`matched_spaces=${targets.length}`);
  for (const row of targets) {
    console.log(
      `[match] id=${row.id} name=${row.name} createdAt=${row.createdAt.toISOString()} desc=${row.description ?? ''}`,
    );
  }

  if (!isApplyMode()) {
    console.log('dry_run=true (set APPLY=1 to execute soft delete)');
    return;
  }

  const ids = targets.map((x) => x.id);
  if (ids.length === 0) {
    console.log('soft_deleted_spaces=0');
    return;
  }

  const res = await prisma.space.updateMany({
    where: { id: { in: ids }, deletedAt: null },
    data: { deletedAt: new Date() },
  });
  console.log(`soft_deleted_spaces=${res.count}`);
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

