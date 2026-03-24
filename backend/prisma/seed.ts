import 'dotenv/config';
import { hash } from 'bcryptjs';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is not set');
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  const passwordHash = await hash('admin123', 10);
  await prisma.user.upsert({
    where: { username: 'admin' },
    create: {
      username: 'admin',
      displayName: 'System admin',
      passwordHash,
      role: 'system_admin',
    },
    update: { passwordHash, displayName: 'System admin', role: 'system_admin' },
  });
  console.log('Seed done: admin user (admin / admin123)');
  console.log('Seed done: no demo users/spaces/pages are injected');
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
