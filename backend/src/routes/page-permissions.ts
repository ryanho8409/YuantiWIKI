import { FastifyInstance } from 'fastify';
import { satisfiesSpacePermission, type SpacePermissionLevel } from '../lib/permissions';

function isValidPagePermissionLevel(x: unknown): x is 'read' | 'write' {
  return x === 'read' || x === 'write';
}

type EffectivePermission = 'inherit' | 'read' | 'write';

function isValidEffectivePermission(x: unknown): x is EffectivePermission {
  return x === 'inherit' || x === 'read' || x === 'write';
}

export async function registerPagePermissionRoutes(app: FastifyInstance) {
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

  // Used for the Page settings modal.
  // Return members (from space permissions) + page override (or inherit).
  app.get<{
    Params: { spaceId: string; pageId: string };
  }>('/spaces/:spaceId/pages/:pageId/permissions', async (request, reply) => {
    const { spaceId, pageId } = request.params;
    if (!(await requireSpaceAdmin(request as any, reply, spaceId))) return;

    const spacePerms = await app.prisma.spacePermission.findMany({
      where: { spaceId, subjectType: 'user' },
      orderBy: { createdAt: 'asc' },
      select: {
        subjectId: true,
        permission: true,
        subjectUser: { select: { id: true, username: true, displayName: true } },
      },
    });

    // explicit page overrides only
    const pagePerms = await app.prisma.pagePermission.findMany({
      where: { pageId, subjectType: 'user' },
      select: { subjectId: true, permission: true },
    });
    const pagePermBySubject = new Map(pagePerms.map((p) => [p.subjectId, p.permission] as const));

    const members = spacePerms
      .map((sp) => {
        const override = pagePermBySubject.get(sp.subjectId);
        let pagePermission: 'inherit' | 'read' | 'write' = 'inherit';
        if (override) {
          pagePermission = isValidPagePermissionLevel(override) ? override : 'read';
        }

        return {
          userId: sp.subjectId,
          user: sp.subjectUser,
          spacePermission: sp.permission as SpacePermissionLevel,
          pagePermission,
        };
      })
      .filter((m) => m.user);

    return { pageId, members };
  });

  app.put<{
    Params: { spaceId: string; pageId: string };
    Body: { permissions?: Array<{ userId: string; permission: EffectivePermission }> };
  }>('/spaces/:spaceId/pages/:pageId/permissions', async (request, reply) => {
    const { spaceId, pageId } = request.params;
    if (!(await requireSpaceAdmin(request as any, reply, spaceId))) return;

    const perms = request.body?.permissions;
    if (!Array.isArray(perms)) {
      return reply.status(400).send({ code: 'BAD_REQUEST', message: 'permissions[] 为必填项' });
    }

    for (const p of perms) {
      if (!p?.userId || !isValidEffectivePermission(p.permission)) {
        return reply.status(400).send({
          code: 'BAD_REQUEST',
          message: 'permissions[] 项必须包含 userId 与 permission',
        });
      }
    }

    // Upsert overrides. "inherit" means delete override rows.
    await app.prisma.$transaction(async (tx) => {
      await tx.pagePermission.deleteMany({
        where: {
          pageId,
          subjectType: 'user',
          subjectId: { in: perms.map((p) => p.userId) },
        },
      });

      const toCreate = perms
        .filter((p) => p.permission !== 'inherit')
        .map((p) => ({
          pageId,
          subjectType: 'user',
          subjectId: p.userId,
          permission: p.permission, // 'read' | 'write'
        }));

      if (toCreate.length) {
        await tx.pagePermission.createMany({ data: toCreate });
      }
    });

    return reply.status(204).send();
  });
}

