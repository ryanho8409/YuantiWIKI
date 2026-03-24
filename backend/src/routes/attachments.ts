import { randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { FastifyInstance } from 'fastify';
import { satisfiesSpacePermission, type SpacePermissionLevel } from '../lib/permissions';
import { verifyToken, type JwtPayload } from '../lib/auth';

function uploadRoot() {
  return process.env.UPLOAD_DIR
    ? path.resolve(process.env.UPLOAD_DIR)
    : path.join(process.cwd(), 'uploads');
}

async function requireSpacePermission(
  app: FastifyInstance,
  request: { user: JwtPayload | null },
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

async function getEffectivePagePermission(
  app: FastifyInstance,
  user: JwtPayload,
  spaceId: string,
  pageId: string
): Promise<SpacePermissionLevel | null> {
  if (user.role === 'system_admin') return 'admin';

  const spacePerm = await app.prisma.spacePermission.findFirst({
    where: { spaceId, subjectType: 'user', subjectId: user.id },
    select: { permission: true },
  });
  if (!spacePerm) return null;

  const pagePerm = await app.prisma.pagePermission.findFirst({
    where: { pageId, subjectType: 'user', subjectId: user.id },
    select: { permission: true },
  });

  if (!pagePerm) {
    return spacePerm.permission as SpacePermissionLevel;
  }
  return pagePerm.permission === 'write' ? 'write' : 'read';
}

function resolveUser(request: { user: JwtPayload | null; query: any }): JwtPayload | null {
  if (request.user) return request.user;
  const t = request.query?.token;
  if (typeof t === 'string' && t) {
    return verifyToken(t);
  }
  return null;
}

export async function registerAttachmentRoutes(app: FastifyInstance) {
  app.post<{
    Params: { spaceId: string };
    Querystring: { pageId?: string };
  }>('/spaces/:spaceId/attachments', async (request, reply) => {
    const { spaceId } = request.params;
    const pageId = request.query?.pageId;

    if (!(await requireSpacePermission(app, request as any, reply, spaceId, 'write'))) return;

    const spaceOk = await app.prisma.space.findFirst({
      where: { id: spaceId, deletedAt: null },
      select: { id: true },
    });
    if (!spaceOk) {
      return reply.status(404).send({ code: 'NOT_FOUND', message: '知识库不存在' });
    }

    if (pageId) {
      const page = await app.prisma.page.findFirst({
        where: { id: pageId, spaceId, deletedAt: null },
        select: { id: true },
      });
      if (!page) {
        return reply.status(400).send({ code: 'BAD_REQUEST', message: 'pageId 不属于当前知识库' });
      }
      const u = request.user!;
      const eff = await getEffectivePagePermission(app, u, spaceId, pageId);
      if (!eff || !satisfiesSpacePermission(eff, 'write')) {
        return reply.status(403).send({ code: 'FORBIDDEN', message: '页面权限不足' });
      }
    }

    const data = await (request as any).file();
    if (!data) {
      return reply.status(400).send({ code: 'BAD_REQUEST', message: 'file 为必填项' });
    }

    const buffer = await data.toBuffer();
    const original = (data.filename as string) || 'upload.bin';
    const ext = path.extname(original) || '';
    const safe = `${randomUUID()}${ext}`;
    const dir = path.join(uploadRoot(), spaceId);
    await fs.mkdir(dir, { recursive: true });
    const abs = path.join(dir, safe);
    await fs.writeFile(abs, buffer);

    const rel = `${spaceId}/${safe}`.replace(/\\/g, '/');
    const mime = (data.mimetype as string) || 'application/octet-stream';

    const row = await app.prisma.attachment.create({
      data: {
        spaceId,
        pageId: pageId ?? null,
        fileName: original,
        filePath: rel,
        fileSize: BigInt(buffer.length),
        mimeType: mime,
        uploadedById: request.user!.id,
      },
      select: { id: true },
    });

    return {
      id: row.id,
      fileName: original,
      mimeType: mime,
      url: `/api/v1/attachments/${row.id}/file`,
    };
  });

  app.get<{
    Params: { id: string };
    Querystring: { token?: string };
  }>('/attachments/:id/file', async (request, reply) => {
    const { id } = request.params;
    const user = resolveUser(request as any);
    if (!user) {
      return reply.status(401).send({ code: 'UNAUTHORIZED', message: '缺少或无效的令牌' });
    }

    const att = await app.prisma.attachment.findFirst({
      where: { id },
      select: {
        id: true,
        spaceId: true,
        pageId: true,
        filePath: true,
        mimeType: true,
        fileName: true,
      },
    });
    if (!att) {
      return reply.status(404).send({ code: 'NOT_FOUND', message: '附件不存在' });
    }

    const space = await app.prisma.space.findFirst({
      where: { id: att.spaceId, deletedAt: null },
      select: { id: true },
    });
    if (!space) {
      return reply.status(404).send({ code: 'NOT_FOUND', message: '知识库不存在' });
    }

    if (!(await requireSpacePermission(app, { user } as any, reply, att.spaceId, 'read'))) {
      return;
    }

    if (att.pageId) {
      const eff = await getEffectivePagePermission(app, user, att.spaceId, att.pageId);
      if (!eff) {
        return reply.status(403).send({ code: 'FORBIDDEN', message: '当前用户无页面有效权限' });
      }
      if (!satisfiesSpacePermission(eff, 'read')) {
        return reply.status(403).send({ code: 'FORBIDDEN', message: '页面权限不足' });
      }
    }

    const abs = path.join(uploadRoot(), att.filePath);
    try {
      await fs.access(abs);
    } catch {
      return reply.status(404).send({ code: 'NOT_FOUND', message: '磁盘文件不存在' });
    }

    reply.header('Content-Type', att.mimeType);
    reply.header('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(att.fileName)}`);
    return reply.send(createReadStream(abs));
  });

  app.delete<{
    Params: { spaceId: string; id: string };
  }>('/spaces/:spaceId/attachments/:id', async (request, reply) => {
    const { spaceId, id } = request.params;
    if (!(await requireSpacePermission(app, request as any, reply, spaceId, 'write'))) return;

    const att = await app.prisma.attachment.findFirst({
      where: { id, spaceId },
      select: { id: true, filePath: true, pageId: true },
    });
    if (!att) {
      return reply.status(404).send({ code: 'NOT_FOUND', message: '附件不存在' });
    }

    if (att.pageId) {
      const u = request.user!;
      const eff = await getEffectivePagePermission(app, u, spaceId, att.pageId);
      if (!eff || !satisfiesSpacePermission(eff, 'write')) {
        return reply.status(403).send({ code: 'FORBIDDEN', message: '页面权限不足' });
      }
    }

    const abs = path.join(uploadRoot(), att.filePath);
    await app.prisma.attachment.delete({ where: { id: att.id } });
    try {
      await fs.unlink(abs);
    } catch {
      // ignore
    }
    return reply.status(204).send();
  });
}
