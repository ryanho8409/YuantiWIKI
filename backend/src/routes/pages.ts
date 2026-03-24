import { FastifyInstance } from 'fastify';
import { satisfiesSpacePermission, type SpacePermissionLevel } from '../lib/permissions';

type PageNode = {
  id: string;
  spaceId: string;
  parentId: string | null;
  title: string;
  sortOrder: number;
  children: PageNode[];
};

function toTree(
  rows: Array<{
    id: string;
    spaceId: string;
    parentId: string | null;
    title: string;
    sortOrder: number;
  }>
) {
  const map = new Map<string, PageNode>();
  const roots: PageNode[] = [];

  for (const row of rows) {
    map.set(row.id, { ...row, children: [] });
  }

  for (const row of rows) {
    const node = map.get(row.id)!;
    if (row.parentId && map.has(row.parentId)) {
      map.get(row.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

export async function registerPageRoutes(app: FastifyInstance) {
  async function requireSpacePermission(
    request: { user: { id: string; role?: string } | null },
    reply: any,
    spaceId: string,
    required: SpacePermissionLevel
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
    const ok = satisfiesSpacePermission(perm.permission as SpacePermissionLevel, required);
    if (!ok) {
      reply.status(403).send({ code: 'FORBIDDEN', message: '当前用户知识库权限不足' });
      return false;
    }
    return true;
  }

  async function getMyEffectivePagePermission(
    request: { user: { id: string; role?: string } | null },
    spaceId: string,
    pageId: string
  ): Promise<SpacePermissionLevel | null> {
    if (!request.user) return null;
    if (request.user.role === 'system_admin') return 'admin';

    const spacePerm = await app.prisma.spacePermission.findFirst({
      where: { spaceId, subjectType: 'user', subjectId: request.user.id },
      select: { permission: true },
    });
    if (!spacePerm) return null;

    const pagePerm = await app.prisma.pagePermission.findFirst({
      where: { pageId, subjectType: 'user', subjectId: request.user.id },
      select: { permission: true },
    });

    if (!pagePerm) {
      return spacePerm.permission as SpacePermissionLevel;
    }

    // pagePermission.permission only supports 'read'|'write'
    return pagePerm.permission === 'write' ? 'write' : 'read';
  }

  async function ensureSpaceExists(spaceId: string, reply: any) {
    const space = await app.prisma.space.findFirst({
      where: { id: spaceId, deletedAt: null },
      select: { id: true },
    });
    if (!space) {
      reply.status(404).send({ code: 'NOT_FOUND', message: '知识库不存在' });
      return false;
    }
    return true;
  }

  const emptyTiptapDoc = {
    type: 'doc',
    content: [{ type: 'paragraph' }],
  };

  app.get<{
    Params: { spaceId: string };
    Querystring: { format?: 'tree' | 'list' };
  }>('/spaces/:spaceId/pages', async (request, reply) => {
    const { spaceId } = request.params;
    if (!(await requireSpacePermission(request, reply, spaceId, 'read'))) return;
    if (!(await ensureSpaceExists(spaceId, reply))) return;

    const format = request.query?.format ?? 'tree';
    if (format !== 'tree' && format !== 'list') {
      return reply.status(400).send({ code: 'BAD_REQUEST', message: 'format 必须为 tree 或 list' });
    }

    const pages = await app.prisma.page.findMany({
      where: { spaceId, deletedAt: null },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      select: { id: true, spaceId: true, parentId: true, title: true, sortOrder: true },
    });

    if (format === 'list') return { list: pages };
    return { tree: toTree(pages) };
  });

  app.get<{
    Params: { spaceId: string; id: string };
  }>('/spaces/:spaceId/pages/:id', async (request, reply) => {
    const { spaceId, id } = request.params;
    if (!(await requireSpacePermission(request, reply, spaceId, 'read'))) return;
    if (!(await ensureSpaceExists(spaceId, reply))) return;

    const page = await app.prisma.page.findFirst({
      where: { id, spaceId, deletedAt: null },
      select: {
        id: true,
        spaceId: true,
        parentId: true,
        title: true,
        content: true,
        createdAt: true,
        updatedAt: true,
        createdBy: { select: { username: true, displayName: true } },
        updatedBy: { select: { username: true, displayName: true } },
      },
    });

    if (!page) {
      return reply.status(404).send({ code: 'NOT_FOUND', message: '页面不存在' });
    }

    const myPermission = await getMyEffectivePagePermission(request as any, spaceId, id);
    if (!myPermission) {
      return reply.status(403).send({ code: 'FORBIDDEN', message: '当前用户无页面有效权限' });
    }

    return { ...page, myPermission };
  });

  app.post<{
    Params: { spaceId: string };
    Body: { title?: string; parentId?: string | null; sortOrder?: number; content?: any };
  }>('/spaces/:spaceId/pages', async (request, reply) => {
    const { spaceId } = request.params;
    if (!(await requireSpacePermission(request, reply, spaceId, 'write'))) return;
    if (!(await ensureSpaceExists(spaceId, reply))) return;

    const { title, parentId, sortOrder, content } = request.body ?? {};
    const initialContent = content ?? emptyTiptapDoc;
    if (!title?.trim()) {
      return reply.status(400).send({ code: 'BAD_REQUEST', message: '标题为必填项' });
    }

    if (parentId) {
      const parent = await app.prisma.page.findFirst({
        where: { id: parentId, spaceId, deletedAt: null },
        select: { id: true },
      });
      if (!parent) {
        return reply.status(400).send({
          code: 'BAD_REQUEST',
          message: 'parentId 不存在于当前知识库',
        });
      }
    }

    const created = await app.prisma.$transaction(async (tx) => {
      const page = await tx.page.create({
        data: {
          spaceId,
          parentId: parentId ?? null,
          title: title.trim(),
          content: initialContent,
          sortOrder: typeof sortOrder === 'number' ? sortOrder : 0,
          createdById: request.user!.id,
          updatedById: request.user!.id,
        },
        select: { id: true, spaceId: true, parentId: true, title: true, sortOrder: true },
      });

      await tx.pageVersion.create({
        data: {
          pageId: page.id,
          content: initialContent,
          createdById: request.user!.id,
        },
      });

      return page;
    });

    return reply.status(201).send(created);
  });

  app.patch<{
    Params: { spaceId: string; id: string };
    Body: { title?: string; parentId?: string | null; sortOrder?: number; content?: any };
  }>('/spaces/:spaceId/pages/:id', async (request, reply) => {
    const { spaceId, id } = request.params;
    if (!(await requireSpacePermission(request, reply, spaceId, 'read'))) return;
    if (!(await ensureSpaceExists(spaceId, reply))) return;

    const page = await app.prisma.page.findFirst({
      where: { id, spaceId, deletedAt: null },
      select: { id: true },
    });
    if (!page) {
      return reply.status(404).send({ code: 'NOT_FOUND', message: '页面不存在' });
    }

    const myPermission = await getMyEffectivePagePermission(request as any, spaceId, id);
    if (!myPermission || !satisfiesSpacePermission(myPermission, 'write')) {
      return reply.status(403).send({ code: 'FORBIDDEN', message: '页面权限不足' });
    }

    const { title, parentId, sortOrder, content } = request.body ?? {};
    if (title !== undefined && !title.trim()) {
      return reply.status(400).send({ code: 'BAD_REQUEST', message: '标题不能为空' });
    }
    if (parentId === id) {
      return reply.status(400).send({ code: 'BAD_REQUEST', message: 'parentId 不能指向自身' });
    }
    if (parentId) {
      const parent = await app.prisma.page.findFirst({
        where: { id: parentId, spaceId, deletedAt: null },
        select: { id: true },
      });
      if (!parent) {
        return reply
          .status(400)
          .send({ code: 'BAD_REQUEST', message: 'parentId 不存在于当前知识库' });
      }
    }

    const updated = await app.prisma.$transaction(async (tx) => {
      const pageUpdate = await tx.page.update({
        where: { id },
        data: {
          ...(title !== undefined ? { title: title.trim() } : {}),
          ...(parentId !== undefined ? { parentId } : {}),
          ...(typeof sortOrder === 'number' ? { sortOrder } : {}),
          ...(content !== undefined ? { content } : {}),
          updatedById: request.user!.id,
        },
        select: { id: true, spaceId: true, parentId: true, title: true, sortOrder: true, content: true },
      });

      if (content !== undefined) {
        await tx.pageVersion.create({
          data: {
            pageId: id,
            content,
            createdById: request.user!.id,
          },
        });
      }

      return pageUpdate;
    });

    return updated;
  });

  app.get<{
    Params: { spaceId: string; id: string };
  }>('/spaces/:spaceId/pages/:id/versions', async (request, reply) => {
    const { spaceId, id } = request.params;
    if (!(await requireSpacePermission(request, reply, spaceId, 'read'))) return;
    if (!(await ensureSpaceExists(spaceId, reply))) return;

    const page = await app.prisma.page.findFirst({
      where: { id, spaceId, deletedAt: null },
      select: { id: true },
    });
    if (!page) {
      return reply.status(404).send({ code: 'NOT_FOUND', message: '页面不存在' });
    }

    const versions = await app.prisma.pageVersion.findMany({
      where: { pageId: id },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        createdAt: true,
        createdBy: { select: { username: true, displayName: true } },
      },
    });

    return { versions };
  });

  app.get<{
    Params: { spaceId: string; id: string; versionId: string };
  }>('/spaces/:spaceId/pages/:id/versions/:versionId', async (request, reply) => {
    const { spaceId, id, versionId } = request.params;
    if (!(await requireSpacePermission(request, reply, spaceId, 'read'))) return;
    if (!(await ensureSpaceExists(spaceId, reply))) return;

    const version = await app.prisma.pageVersion.findFirst({
      where: {
        id: versionId,
        page: { id, spaceId, deletedAt: null },
      },
      select: { id: true, content: true, createdAt: true, createdById: true },
    });

    if (!version) {
      return reply.status(404).send({ code: 'NOT_FOUND', message: '版本不存在' });
    }

    return { versionId: version.id, content: version.content };
  });

  app.post<{
    Params: { spaceId: string; id: string; versionId: string };
    Body?: {};
  }>('/spaces/:spaceId/pages/:id/versions/:versionId/restore', async (request, reply) => {
    const { spaceId, id, versionId } = request.params;
    if (!(await requireSpacePermission(request, reply, spaceId, 'read'))) return;
    if (!(await ensureSpaceExists(spaceId, reply))) return;

    const myPermission = await getMyEffectivePagePermission(request as any, spaceId, id);
    if (!myPermission || !satisfiesSpacePermission(myPermission, 'write')) {
      return reply.status(403).send({ code: 'FORBIDDEN', message: '页面权限不足' });
    }

    const restored = await app.prisma.$transaction(async (tx) => {
      const version = await tx.pageVersion.findFirst({
        where: {
          id: versionId,
          page: { id, spaceId, deletedAt: null },
        },
        select: { id: true, content: true },
      });

      if (!version) return null;

      await tx.page.update({
        where: { id },
        data: { content: version.content as any, updatedById: request.user!.id },
      });

      const newVersion = await tx.pageVersion.create({
        data: { pageId: id, content: version.content as any, createdById: request.user!.id },
        select: { id: true, createdAt: true },
      });

      return newVersion;
    });

    if (!restored) {
      return reply.status(404).send({ code: 'NOT_FOUND', message: '版本或页面不存在' });
    }

    return { restored: true, versionId: restored.id };
  });

  app.delete<{ Params: { spaceId: string; id: string } }>(
    '/spaces/:spaceId/pages/:id',
    async (request, reply) => {
      const { spaceId, id } = request.params;
      if (!(await requireSpacePermission(request, reply, spaceId, 'read'))) return;
      if (!(await ensureSpaceExists(spaceId, reply))) return;

      const page = await app.prisma.page.findFirst({
        where: { id, spaceId, deletedAt: null },
        select: { id: true },
      });
      if (!page) {
        return reply.status(404).send({ code: 'NOT_FOUND', message: '页面不存在' });
      }

      const myPermission = await getMyEffectivePagePermission(request as any, spaceId, id);
      if (!myPermission || !satisfiesSpacePermission(myPermission, 'admin')) {
        return reply.status(403).send({ code: 'FORBIDDEN', message: '页面权限不足' });
      }

      const childCount = await app.prisma.page.count({
        where: { spaceId, parentId: id, deletedAt: null },
      });
      if (childCount > 0) {
        return reply.status(409).send({
          code: 'HAS_CHILDREN',
          message: '无法删除：页面存在子页面',
        });
      }

      await app.prisma.page.update({
        where: { id },
        data: { deletedAt: new Date(), updatedById: request.user!.id },
      });
      return reply.status(204).send();
    }
  );
}
