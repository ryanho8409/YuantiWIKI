import fs from 'node:fs/promises';
import path from 'node:path';
import { createReadStream } from 'node:fs';
import { uploadRoot } from './uploadRoot';

/** 单张头像最大体积（字节） */
export const AVATAR_MAX_BYTES = 512 * 1024;

const ALLOWED_MIME = new Map<string, string>([
  ['image/jpeg', '.jpg'],
  ['image/png', '.png'],
  ['image/webp', '.webp'],
  ['image/gif', '.gif'],
]);

export function isAllowedAvatarMime(mime: string): boolean {
  return ALLOWED_MIME.has(mime);
}

export function extensionForAvatarMime(mime: string): string | null {
  return ALLOWED_MIME.get(mime) ?? null;
}

/** 磁盘相对路径，如 avatars/clxxx.jpg */
export function avatarRelativePath(userId: string, extWithDot: string): string {
  return `avatars/${userId}${extWithDot}`.replace(/\\/g, '/');
}

export function absoluteAvatarPath(relative: string): string {
  return path.join(uploadRoot(), relative);
}

export async function deleteAvatarFileIfExists(relative: string | null): Promise<void> {
  if (!relative) return;
  const abs = absoluteAvatarPath(relative);
  try {
    await fs.unlink(abs);
  } catch {
    // ignore
  }
}

export function createAvatarReadStream(relative: string) {
  return createReadStream(absoluteAvatarPath(relative));
}
