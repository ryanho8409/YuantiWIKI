import { FastifyInstance } from 'fastify';
import { satisfiesSpacePermission, type SpacePermissionLevel } from '../lib/permissions';

function isValidLevel(x: unknown): x is SpacePermissionLevel {
  return x === 'read' || x === 'write' || x === 'admin';
}

export async function registerSpacePermissionRoutes(app: FastifyInstance) {
  async function requireSpaceAdmin(
    request: { user: { id: string; role?: string } | null },
    reply: any,
    spaceId: string
  ) {
    if (!request.user) {
      reply.status(401).send({ code: 'UNAUTHORIZED', message: '缺少或无效的令牌' });
      return false;
    }
    if (request.user.role === 'system_admin') return true;
    const perm = await app.prisma.spacePermission.findFirst({
      where: { spaceId, subjectType: 'user', subjectId: request.user.id },
      select: { permission: true },
    });
    if (!perm) {
      reply.status(403).send({ code: 'FORBIDDEN', message: '当前用户无知识库权限' });
      return false;
    }
    const ok = satisfiesSpacePermission(perm.permission as SpacePermissionLevel, 'admin');
    if (!ok) {
      reply.status(403).send({ code: 'FORBIDDEN', message: '需要知识库管理员权限' });
      return false;
    }
    return true;
  }

  app.get<{ Params: { id: string } }>(
    '/spaces/:id/permissions',
    async (request, reply) => {
      const spaceId = request.params.id;
      if (!(await requireSpaceAdmin(request, reply, spaceId))) return;

      const list = await app.prisma.spacePermission.findMany({
        where: { spaceId, subjectType: 'user' },
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          subjectId: true,
          permission: true,
          subjectUser: { select: { id: true, username: true, displayName: true, role: true } },
        },
      });

      return {
        list: list.map((p) => ({
          id: p.id,
          user: p.subjectUser,
          permission: p.permission,
        })),
      };
    }
  );

  app.put<{
    Params: { id: string };
    Body: { permissions?: Array<{ userId: string; permission: SpacePermissionLevel }> };
  }>('/spaces/:id/permissions', async (request, reply) => {
    const spaceId = request.params.id;
    if (!(await requireSpaceAdmin(request, reply, spaceId))) return;

    const perms = request.body?.permissions;
    if (!Array.isArray(perms)) {
      return reply
        .status(400)
        .send({ code: 'BAD_REQUEST', message: 'permissions[] 为必填项' });
    }
    for (const p of perms) {
      if (!p?.userId || !isValidLevel(p.permission)) {
        return reply.status(400).send({
          code: 'BAD_REQUEST',
          message: 'permissions[] 项必须包含 userId 与 permission',
        });
      }
    }

    const systemAdmins = await app.prisma.user.findMany({
      where: { role: 'system_admin' },
      select: { id: true },
    });
    const systemAdminIds = new Set(systemAdmins.map((u) => u.id));
    for (const adminId of systemAdminIds) {
      const matched = perms.find((p) => p.userId === adminId);
      if (!matched || matched.permission !== 'admin') {
        return reply.status(409).send({
          code: 'IMMUTABLE_SYSTEM_ADMIN',
          message: 'system_admin 必须保留 admin 权限且不可移除',
        });
      }
    }

    const userIds = [...new Set(perms.map((p) => p.userId))];
    const users = await app.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, role: true },
    });
    const userRoleMap = new Map(users.map((u) => [u.id, u.role] as const));
    for (const p of perms) {
      const role = userRoleMap.get(p.userId);
      if (role !== 'system_admin' && p.permission === 'admin') {
        return reply.status(409).send({
          code: 'INVALID_PERMISSION_LEVEL',
          message: '普通用户仅支持 read/write 权限',
        });
      }
    }

    await app.prisma.$transaction(async (tx) => {
      await tx.spacePermission.deleteMany({ where: { spaceId, subjectType: 'user' } });
      await tx.spacePermission.createMany({
        data: perms.map((p) => ({
          spaceId,
          subjectType: 'user',
          subjectId: p.userId,
          permission: p.permission,
        })),
      });
    });

    return reply.status(204).send();
  });
}

