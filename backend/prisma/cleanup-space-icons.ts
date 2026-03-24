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
    where: { deletedAt: null, icon: { not: null } },
    select: { id: true, name: true, icon: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  });

  console.log(`matched_spaces=${targets.length}`);
  for (const row of targets) {
    console.log(
      `[match] id=${row.id} name=${row.name} icon=${row.icon ?? ''} createdAt=${row.createdAt.toISOString()}`,
    );
  }

  if (!isApplyMode()) {
    console.log('dry_run=true (append --apply to execute icon cleanup)');
    return;
  }

  const ids = targets.map((x) => x.id);
  if (ids.length === 0) {
    console.log('cleared_icons=0');
    return;
  }

  const result = await prisma.space.updateMany({
    where: { id: { in: ids } },
    data: { icon: null },
  });
  console.log(`cleared_icons=${result.count}`);
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

