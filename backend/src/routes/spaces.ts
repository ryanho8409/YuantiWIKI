import { FastifyInstance } from 'fastify';
import { satisfiesSpacePermission, type SpacePermissionLevel } from '../lib/permissions';

export async function registerSpaceRoutes(app: FastifyInstance) {
  function requireAuth(request: { user: unknown }, reply: any) {
    if (!request.user) {
      reply.status(401).send({
        code: 'UNAUTHORIZED',
        message: '缺少或无效的令牌',
      });
      return false;
    }
    return true;
  }

  async function requireSpacePermission(
    request: { user: { id: string; role?: string } | null },
    reply: any,
    spaceId: string,
    required: SpacePermissionLevel
  ) {
    if (!requireAuth(request, reply)) return false;
    if (request.user?.role === 'system_admin') return true;

    const perm = await app.prisma.spacePermission.findFirst({
      where: {
        spaceId,
        subjectType: 'user',
        subjectId: request.user!.id,
      },
      select: { permission: true },
    });
    if (!perm) {
      reply.status(403).send({ code: 'FORBIDDEN', message: '当前用户无知识库权限' });
      return false;
    }
    const ok = satisfiesSpacePermission(perm.permission as SpacePermissionLevel, required);
    if (!ok) {
      reply.status(403).send({ code: 'FORBIDDEN', message: '当前用户知识库权限不足' });
      return false;
    }
    return true;
  }

  function requireSystemAdmin(
    request: { user: { role?: string } | null },
    reply: any
  ) {
    if (!requireAuth(request, reply)) return false;
    if (request.user?.role !== 'system_admin') {
      reply.status(403).send({
        code: 'FORBIDDEN',
        message: '需要系统管理员权限',
      });
      return false;
    }
    return true;
  }

  app.get('/spaces', async (request, reply) => {
    if (!requireAuth(request, reply)) return;

    const spaces =
      request.user?.role === 'system_admin'
        ? await app.prisma.space.findMany({
            where: { deletedAt: null },
            orderBy: { sortOrder: 'asc' },
            select: {
              id: true,
              name: true,
              description: true,
              icon: true,
            },
          })
        : await app.prisma.space.findMany({
            where: {
              deletedAt: null,
              permissions: {
                some: {
                  subjectType: 'user',
                  subjectId: request.user!.id,
                  permission: { in: ['read', 'write', 'admin'] },
                },
              },
            },
            orderBy: { sortOrder: 'asc' },
            select: {
              id: true,
              name: true,
              description: true,
              icon: true,
            },
          });

    return spaces;
  });

  app.get<{ Params: { id: string } }>('/spaces/:id', async (request, reply) => {
    if (!(await requireSpacePermission(request, reply, request.params.id, 'read'))) return;
    const myPermission =
      request.user?.role === 'system_admin'
        ? 'admin'
        : (
            await app.prisma.spacePermission.findFirst({
              where: {
                spaceId: request.params.id,
                subjectType: 'user',
                subjectId: request.user!.id,
              },
              select: { permission: true },
            })
          )?.permission ?? 'read';

    const space = await app.prisma.space.findFirst({
      where: { id: request.params.id, deletedAt: null },
      select: {
        id: true,
        name: true,
        description: true,
        icon: true,
        sortOrder: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    if (!space) {
      return reply.status(404).send({ code: 'NOT_FOUND', message: '知识库不存在' });
    }
    return { ...space, myPermission };
  });

  app.post<{
    Body: { name?: string; description?: string; icon?: string; sortOrder?: number };
  }>('/spaces', async (request, reply) => {
    if (!requireSystemAdmin(request, reply)) return;
    const { name, description, icon, sortOrder } = request.body ?? {};
    if (!name) {
      return reply.status(400).send({ code: 'BAD_REQUEST', message: '名称为必填项' });
    }
    const created = await app.prisma.space.create({
      data: {
        name,
        description,
        icon,
        sortOrder: typeof sortOrder === 'number' ? sortOrder : 0,
        createdById: request.user!.id,
      },
      select: { id: true, name: true, description: true, icon: true, sortOrder: true },
    });
    return reply.status(201).send(created);
  });

  app.patch<{
    Params: { id: string };
    Body: { name?: string; description?: string | null; icon?: string | null; sortOrder?: number };
  }>('/spaces/:id', async (request, reply) => {
    if (!(await requireSpacePermission(request, reply, request.params.id, 'admin'))) return;
    const exists = await app.prisma.space.findFirst({
      where: { id: request.params.id, deletedAt: null },
      select: { id: true },
    });
    if (!exists) {
      return reply.status(404).send({ code: 'NOT_FOUND', message: '知识库不存在' });
    }
    const { name, description, icon, sortOrder } = request.body ?? {};
    const updated = await app.prisma.space.update({
      where: { id: request.params.id },
      data: {
        ...(typeof name === 'string' ? { name } : {}),
        ...(description !== undefined ? { description } : {}),
        ...(icon !== undefined ? { icon } : {}),
        ...(typeof sortOrder === 'number' ? { sortOrder } : {}),
      },
      select: { id: true, name: true, description: true, icon: true, sortOrder: true },
    });
    return updated;
  });

  app.delete<{ Params: { id: string } }>('/spaces/:id', async (request, reply) => {
    if (!(await requireSpacePermission(request, reply, request.params.id, 'admin'))) return;
    const exists = await app.prisma.space.findFirst({
      where: { id: request.params.id, deletedAt: null },
      select: { id: true },
    });
    if (!exists) {
      return reply.status(404).send({ code: 'NOT_FOUND', message: '知识库不存在' });
    }
    await app.prisma.space.update({
      where: { id: request.params.id },
      data: { deletedAt: new Date() },
    });
    return reply.status(204).send();
  });
}

