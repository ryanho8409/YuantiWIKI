import { FastifyInstance } from 'fastify';
import { hash } from 'bcryptjs';

export async function registerAdminRoutes(app: FastifyInstance) {
  function requireSystemAdmin(
    request: { user: { role?: string } | null },
    reply: any
  ) {
    if (!request.user) {
      reply.status(401).send({ code: 'UNAUTHORIZED', message: '缺少或无效的令牌' });
      return false;
    }
    if (request.user.role !== 'system_admin') {
      reply.status(403).send({ code: 'FORBIDDEN', message: '需要系统管理员权限' });
      return false;
    }
    return true;
  }

  app.get('/admin/users', async (request, reply) => {
    if (!requireSystemAdmin(request, reply)) return;

    const users = await app.prisma.user.findMany({
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        username: true,
        displayName: true,
        email: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return { list: users, total: users.length };
  });

  app.post<{
    Body: {
      username?: string;
      password?: string;
      displayName?: string;
      email?: string;
      role?: 'system_admin' | 'user';
    };
  }>('/admin/users', async (request, reply) => {
    if (!requireSystemAdmin(request, reply)) return;

    const username = (request.body?.username ?? '').trim();
    const password = request.body?.password ?? '';
    const displayName = request.body?.displayName?.trim() || null;
    const email = request.body?.email?.trim() || null;
    const role = 'user';

    if (!username || !password) {
      return reply.status(400).send({
        code: 'BAD_REQUEST',
        message: '用户名和密码为必填项',
      });
    }
    if (password.length < 6) {
      return reply.status(400).send({
        code: 'BAD_REQUEST',
        message: '密码长度至少 6 位',
      });
    }

    const exists = await app.prisma.user.findUnique({ where: { username }, select: { id: true } });
    if (exists) {
      return reply.status(409).send({ code: 'CONFLICT', message: '用户名已存在' });
    }

    const passwordHash = await hash(password, 10);
    const created = await app.prisma.user.create({
      data: {
        username,
        passwordHash,
        displayName,
        email,
        role,
      },
      select: {
        id: true,
        username: true,
        displayName: true,
        email: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return reply.status(201).send(created);
  });

  app.patch<{
    Params: { id: string };
    Body: {
      displayName?: string | null;
      email?: string | null;
      password?: string;
      role?: 'system_admin' | 'user';
    };
  }>('/admin/users/:id', async (request, reply) => {
    if (!requireSystemAdmin(request, reply)) return;

    const userId = request.params.id;
    const exists = await app.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true },
    });
    if (!exists) {
      return reply.status(404).send({ code: 'NOT_FOUND', message: '用户不存在' });
    }
    if (exists.role === 'system_admin') {
      return reply.status(403).send({
        code: 'FORBIDDEN',
        message: 'system_admin 用户不可删除',
      });
    }

    const patch: Record<string, unknown> = {};
    if (request.body?.displayName !== undefined) {
      patch.displayName = request.body.displayName?.trim() || null;
    }
    if (request.body?.email !== undefined) {
      patch.email = request.body.email?.trim() || null;
    }
    if (request.body?.role !== undefined) {
      return reply.status(400).send({
        code: 'BAD_REQUEST',
        message: '用户管理不支持修改系统角色',
      });
    }
    if (request.body?.password !== undefined) {
      if (request.body.password.length < 6) {
        return reply.status(400).send({
          code: 'BAD_REQUEST',
          message: '密码长度至少 6 位',
        });
      }
      patch.passwordHash = await hash(request.body.password, 10);
    }

    const updated = await app.prisma.user.update({
      where: { id: userId },
      data: patch,
      select: {
        id: true,
        username: true,
        displayName: true,
        email: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return updated;
  });

  app.delete<{ Params: { id: string } }>('/admin/users/:id', async (request, reply) => {
    if (!requireSystemAdmin(request, reply)) return;

    const userId = request.params.id;
    if (request.user?.id === userId) {
      return reply.status(400).send({ code: 'BAD_REQUEST', message: '不能删除当前登录用户' });
    }

    const exists = await app.prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!exists) {
      return reply.status(404).send({ code: 'NOT_FOUND', message: '用户不存在' });
    }

    try {
      await app.prisma.user.delete({ where: { id: userId } });
      return reply.status(204).send();
    } catch {
      return reply.status(409).send({
        code: 'CONFLICT',
        message: '用户存在关联记录，无法删除',
      });
    }
  });

  app.get<{
    Querystring: { q?: string; spaceId?: string; page?: string; pageSize?: string };
  }>('/admin/pages', async (request, reply) => {
    if (!requireSystemAdmin(request, reply)) return;

    const q = (request.query.q ?? '').trim();
    const spaceId = (request.query.spaceId ?? '').trim();
    const page = Math.max(1, Number.parseInt(request.query.page ?? '1', 10) || 1);
    const pageSize = Math.min(100, Math.max(1, Number.parseInt(request.query.pageSize ?? '20', 10) || 20));
    const skip = (page - 1) * pageSize;

    const where = {
      deletedAt: null as null,
      ...(spaceId ? { spaceId } : {}),
      ...(q
        ? {
            OR: [
              { title: { contains: q, mode: 'insensitive' as const } },
              { space: { name: { contains: q, mode: 'insensitive' as const } } },
            ],
          }
        : {}),
    };

    const [total, rows] = await Promise.all([
      app.prisma.page.count({ where }),
      app.prisma.page.findMany({
        where,
        orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
        skip,
        take: pageSize,
        select: {
          id: true,
          title: true,
          spaceId: true,
          updatedAt: true,
          updatedBy: { select: { id: true, username: true, displayName: true } },
          space: { select: { name: true } },
        },
      }),
    ]);

    return {
      list: rows.map((row) => ({
        pageId: row.id,
        title: row.title,
        spaceId: row.spaceId,
        spaceName: row.space?.name ?? '',
        updatedAt: row.updatedAt,
        updatedBy: row.updatedBy,
      })),
      total,
      page,
      pageSize,
    };
  });
}

