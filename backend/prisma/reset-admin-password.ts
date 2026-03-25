/**
 * 仅在服务器/可直连数据库的受信环境执行，用于 system_admin 忘记密码时的线下恢复。
 * 不在应用内提供 HTTP 接口，避免被滥用。
 *
 * 用法：
 *   cd backend && npx ts-node prisma/reset-admin-password.ts
 *   npx ts-node prisma/reset-admin-password.ts --username admin
 */
import 'dotenv/config';
import { createInterface } from 'node:readline';
import { stdin as input, stdout as output } from 'node:process';
import { hash } from 'bcryptjs';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is not set');
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

function getArg(name: string): string | undefined {
  const idx = process.argv.findIndex((a: string) => a === `--${name}`);
  if (idx !== -1 && process.argv[idx + 1] && !process.argv[idx + 1].startsWith('--')) {
    return process.argv[idx + 1];
  }
  const prefixed = process.argv.find((a: string) => a.startsWith(`--${name}=`));
  if (prefixed) return prefixed.slice(`--${name}=`.length);
  return undefined;
}

function ask(question: string): Promise<string> {
  const rl = createInterface({ input, output });
  return new Promise<string>((resolve) => {
    rl.question(question, (answer: string) => {
      rl.close();
      resolve(answer);
    });
  });
}

async function main() {
  console.log(
    '【警告】此脚本将直接修改数据库中的管理员密码，仅在受信环境（如服务器 SSH）执行。',
  );
  console.log('');

  const admins: { id: string; username: string }[] = await prisma.user.findMany({
    where: { role: 'system_admin' },
    select: { id: true, username: true },
    orderBy: { username: 'asc' },
  });

  if (admins.length === 0) {
    console.error('错误：数据库中不存在 role=system_admin 的用户。');
    process.exit(1);
  }

  const usernameArg = getArg('username');
  let target =
    usernameArg != null
      ? admins.find((u) => u.username === usernameArg)
      : admins.length === 1
        ? admins[0]
        : undefined;

  if (usernameArg != null && !target) {
    console.error(`错误：未找到用户名为「${usernameArg}」的 system_admin。`);
    process.exit(1);
  }

  if (!target && admins.length > 1) {
    console.log('存在多个系统管理员，请指定其一：');
    for (const a of admins) {
      console.log(`  - ${a.username} (id=${a.id})`);
    }
    console.log('');
    console.log('示例：npx ts-node prisma/reset-admin-password.ts --username admin');
    process.exit(1);
  }

  if (!target) {
    target = admins[0]!;
  }

  console.log(`将重置用户：${target.username}（system_admin）`);
  const confirm = (await ask('确认继续？输入 YES 后回车： ')).trim();
  if (confirm !== 'YES') {
    console.log('已取消。');
    return;
  }

  const pw1 = await ask('新密码（至少 6 位，终端内可见）： ');
  const pw2 = await ask('再次输入新密码： ');
  if (pw1 !== pw2) {
    console.error('错误：两次输入的密码不一致。');
    process.exit(1);
  }
  if (pw1.length < 6) {
    console.error('错误：密码长度至少 6 位。');
    process.exit(1);
  }

  const passwordHash = await hash(pw1, 10);
  await prisma.user.update({
    where: { id: target.id },
    data: { passwordHash },
  });

  console.log('');
  console.log(`已更新用户「${target.username}」的密码，请尽快登录并在界面中再次修改为强密码。`);
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
