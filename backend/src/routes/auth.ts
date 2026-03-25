import fs from 'node:fs/promises';
import path from 'node:path';
import type { FastifyInstance } from 'fastify';
import { compare, hash } from 'bcryptjs';
import type { JwtPayload } from '../lib/auth';
import { signToken, verifyToken } from '../lib/auth';
import {
  AVATAR_MAX_BYTES,
  absoluteAvatarPath,
  avatarRelativePath,
  createAvatarReadStream,
  deleteAvatarFileIfExists,
  extensionForAvatarMime,
  isAllowedAvatarMime,
} from '../lib/userAvatar';
import { uploadRoot } from '../lib/uploadRoot';

const DISPLAY_NAME_MAX = 64;

const userProfileSelect = {
  id: true,
  username: true,
  role: true,
  displayName: true,
  email: true,
  avatarPath: true,
  createdAt: true,
  updatedAt: true,
  lastLoginAt: true,
} as const;

type UserProfileRow = {
  id: string;
  username: string;
  role: string;
  displayName: string | null;
  email: string | null;
  avatarPath: string | null;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt: Date | null;
};

function serializeUser(u: UserProfileRow) {
  return {
    id: u.id,
    username: u.username,
    role: u.role,
    displayName: u.displayName,
    email: u.email,
    hasCustomAvatar: Boolean(u.avatarPath),
    createdAt: u.createdAt.toISOString(),
    updatedAt: u.updatedAt.toISOString(),
    lastLoginAt: u.lastLoginAt ? u.lastLoginAt.toISOString() : null,
  };
}

function isValidEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

function normalizeString(v: unknown): string | undefined {
  if (v === undefined) return undefined;
  if (v === null) return '';
  if (typeof v !== 'string') return undefined;
  return v;
}

function resolveUser(request: {
  user: JwtPayload | null;
  query: unknown;
}): JwtPayload | null {
  if (request.user) return request.user;
  const q = request.query as { token?: string };
  const t = q?.token;
  if (typeof t === 'string' && t) {
    return verifyToken(t);
  }
  return null;
}

export async function registerAuthRoutes(app: FastifyInstance) {
  app.post<{
    Body: { username?: string; password?: string };
  }>('/auth/login', async (request, reply) => {
    const { username, password } = request.body ?? {};
    if (!username || !password) {
      return reply.status(400).send({
        code: 'BAD_REQUEST',
        message: '用户名和密码为必填项',
      });
    }
    const user = await app.prisma.user.findUnique({ where: { username } });
    if (!user) {
      return reply.status(401).send({
        code: 'UNAUTHORIZED',
        message: '用户名或密码错误',
      });
    }
    const ok = await compare(password, user.passwordHash);
    if (!ok) {
      return reply.status(401).send({
        code: 'UNAUTHORIZED',
        message: '用户名或密码错误',
      });
    }
    const updated = await app.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
      select: userProfileSelect,
    });
    const token = signToken({
      id: updated.id,
      username: updated.username,
      role: updated.role,
    });
    return { token, user: serializeUser(updated) };
  });

  app.get('/auth/me', async (request, reply) => {
    if (!request.user) {
      return reply.status(401).send({
        code: 'UNAUTHORIZED',
        message: '缺少或无效的令牌',
      });
    }
    const row = await app.prisma.user.findUnique({
      where: { id: request.user.id },
      select: userProfileSelect,
    });
    if (!row) {
      return reply.status(404).send({
        code: 'NOT_FOUND',
        message: '用户不存在',
      });
    }
    return serializeUser(row);
  });

  app.post('/auth/avatar', async (request, reply) => {
    if (!request.user) {
      return reply.status(401).send({
        code: 'UNAUTHORIZED',
        message: '缺少或无效的令牌',
      });
    }
    const data = await (request as { file: () => Promise<unknown> }).file();
    if (!data || typeof data !== 'object') {
      return reply.status(400).send({
        code: 'BAD_REQUEST',
        message: '请使用 multipart 上传字段 file',
      });
    }
    const f = data as {
      toBuffer: () => Promise<Buffer>;
      mimetype?: string;
      filename?: string;
    };
    const buffer = await f.toBuffer();
    if (buffer.length === 0) {
      return reply.status(400).send({
        code: 'BAD_REQUEST',
        message: '文件为空',
      });
    }
    if (buffer.length > AVATAR_MAX_BYTES) {
      return reply.status(400).send({
        code: 'BAD_REQUEST',
        message: `头像大小不超过 ${AVATAR_MAX_BYTES / 1024}KB`,
      });
    }
    const mime = (f.mimetype as string) || 'application/octet-stream';
    if (!isAllowedAvatarMime(mime)) {
      return reply.status(400).send({
        code: 'BAD_REQUEST',
        message: '仅支持 JPEG、PNG、WebP、GIF 图片',
      });
    }
    const ext = extensionForAvatarMime(mime);
    if (!ext) {
      return reply.status(400).send({
        code: 'BAD_REQUEST',
        message: '无法识别图片类型',
      });
    }

    const userId = request.user.id;
    const rel = avatarRelativePath(userId, ext);
    const avDir = path.join(uploadRoot(), 'avatars');
    await fs.mkdir(avDir, { recursive: true });

    const prev = await app.prisma.user.findUnique({
      where: { id: userId },
      select: { avatarPath: true },
    });
    if (prev?.avatarPath && prev.avatarPath !== rel) {
      await deleteAvatarFileIfExists(prev.avatarPath);
    }

    const abs = absoluteAvatarPath(rel);
    await fs.writeFile(abs, buffer);

    const updated = await app.prisma.user.update({
      where: { id: userId },
      data: { avatarPath: rel },
      select: userProfileSelect,
    });
    return { user: serializeUser(updated) };
  });

  app.delete('/auth/avatar', async (request, reply) => {
    if (!request.user) {
      return reply.status(401).send({
        code: 'UNAUTHORIZED',
        message: '缺少或无效的令牌',
      });
    }
    const row = await app.prisma.user.findUnique({
      where: { id: request.user.id },
      select: { avatarPath: true },
    });
    if (row?.avatarPath) {
      await deleteAvatarFileIfExists(row.avatarPath);
    }
    const updated = await app.prisma.user.update({
      where: { id: request.user.id },
      data: { avatarPath: null },
      select: userProfileSelect,
    });
    return { user: serializeUser(updated) };
  });

  app.get<{
    Params: { userId: string };
    Querystring: { token?: string };
  }>('/users/:userId/avatar/file', async (request, reply) => {
    const user = resolveUser(request as { user: JwtPayload | null; query: unknown });
    if (!user) {
      return reply.status(401).send({
        code: 'UNAUTHORIZED',
        message: '缺少或无效的令牌',
      });
    }
    const { userId } = request.params;
    const row = await app.prisma.user.findUnique({
      where: { id: userId },
      select: { avatarPath: true },
    });
    if (!row?.avatarPath) {
      return reply.status(404).send({
        code: 'NOT_FOUND',
        message: '未设置自定义头像',
      });
    }
    const abs = absoluteAvatarPath(row.avatarPath);
    try {
      await fs.access(abs);
    } catch {
      return reply.status(404).send({
        code: 'NOT_FOUND',
        message: '头像文件不存在',
      });
    }
    const ext = path.extname(row.avatarPath).toLowerCase();
    const mime =
      ext === '.png'
        ? 'image/png'
        : ext === '.webp'
          ? 'image/webp'
          : ext === '.gif'
            ? 'image/gif'
            : 'image/jpeg';
    reply.header('Content-Type', mime);
    reply.header('Cache-Control', 'private, max-age=3600');
    return reply.send(createAvatarReadStream(row.avatarPath));
  });

  app.patch<{
    Body: { displayName?: unknown; email?: unknown };
  }>('/auth/profile', async (request, reply) => {
    if (!request.user) {
      return reply.status(401).send({
        code: 'UNAUTHORIZED',
        message: '缺少或无效的令牌',
      });
    }

    const dDisplay = normalizeString(request.body?.displayName);
    const dEmail = normalizeString(request.body?.email);

    if (dDisplay === undefined && dEmail === undefined) {
      return reply.status(400).send({
        code: 'BAD_REQUEST',
        message: '请至少提供要更新的字段',
      });
    }

    const data: {
      displayName?: string | null;
      email?: string | null;
    } = {};

    if (dDisplay !== undefined) {
      const t = dDisplay.trim();
      if (t.length > DISPLAY_NAME_MAX) {
        return reply.status(400).send({
          code: 'BAD_REQUEST',
          message: `显示名称长度不超过 ${DISPLAY_NAME_MAX} 个字符`,
        });
      }
      data.displayName = t.length === 0 ? null : t;
    }

    if (dEmail !== undefined) {
      const t = dEmail.trim();
      if (t.length === 0) {
        data.email = null;
      } else if (!isValidEmail(t)) {
        return reply.status(400).send({
          code: 'BAD_REQUEST',
          message: '邮箱格式不正确',
        });
      } else {
        data.email = t;
      }
    }

    if (data.email !== undefined && data.email !== null) {
      const taken = await app.prisma.user.findFirst({
        where: {
          email: data.email,
          NOT: { id: request.user.id },
        },
        select: { id: true },
      });
      if (taken) {
        return reply.status(409).send({
          code: 'EMAIL_IN_USE',
          message: '该邮箱已被其他账号使用',
        });
      }
    }

    try {
      const updated = await app.prisma.user.update({
        where: { id: request.user.id },
        data,
        select: userProfileSelect,
      });
      return { user: serializeUser(updated) };
    } catch (e: unknown) {
      const msg = e && typeof e === 'object' && 'code' in e ? String((e as { code?: string }).code) : '';
      if (msg === 'P2002') {
        return reply.status(409).send({
          code: 'EMAIL_IN_USE',
          message: '该邮箱已被其他账号使用',
        });
      }
      throw e;
    }
  });

  app.post('/auth/logout', async (_, reply) => {
    return reply.status(204).send();
  });

  app.post<{
    Body: { currentPassword?: string; newPassword?: string };
  }>('/auth/change-password', async (request, reply) => {
    if (!request.user) {
      return reply.status(401).send({
        code: 'UNAUTHORIZED',
        message: '缺少或无效的令牌',
      });
    }
    const { currentPassword, newPassword } = request.body ?? {};
    if (!currentPassword || !newPassword) {
      return reply.status(400).send({
        code: 'BAD_REQUEST',
        message: '当前密码与新密码均为必填项',
      });
    }
    if (newPassword.length < 6) {
      return reply.status(400).send({
        code: 'BAD_REQUEST',
        message: '新密码长度至少为 6 位',
      });
    }
    if (currentPassword === newPassword) {
      return reply.status(400).send({
        code: 'BAD_REQUEST',
        message: '新密码不能与当前密码相同',
      });
    }

    const user = await app.prisma.user.findUnique({
      where: { id: request.user.id },
      select: { id: true, passwordHash: true },
    });
    if (!user) {
      return reply.status(404).send({
        code: 'NOT_FOUND',
        message: '用户不存在',
      });
    }

    const ok = await compare(currentPassword, user.passwordHash);
    if (!ok) {
      return reply.status(401).send({
        code: 'UNAUTHORIZED',
        message: '当前密码不正确',
      });
    }

    await app.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await hash(newPassword, 10) },
    });

    return reply.status(204).send();
  });
}
