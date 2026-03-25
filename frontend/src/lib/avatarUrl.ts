/** 默认头像（静态资源，内网无外链依赖） */
export const DEFAULT_AVATAR_SRC = '/default-avatar.svg';

export function userAvatarSrc(
  userId: string,
  hasCustomAvatar: boolean,
  token: string | null,
  cacheBust?: number,
): string {
  if (!hasCustomAvatar || !token) return DEFAULT_AVATAR_SRC;
  const q = new URLSearchParams({ token });
  if (cacheBust != null && cacheBust > 0) q.set('_', String(cacheBust));
  return `/api/v1/users/${encodeURIComponent(userId)}/avatar/file?${q.toString()}`;
}
