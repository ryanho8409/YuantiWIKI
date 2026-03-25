import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Layout } from '../components/Layout';
import { useAuth, type User } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { userAvatarSrc } from '../lib/avatarUrl';

function roleLabel(role: string): string {
  if (role === 'system_admin') return '系统管理员';
  return '普通用户';
}

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('zh-CN', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  } catch {
    return '—';
  }
}

export function SettingsPage() {
  const { token, setUser, avatarRevision, bumpAvatarRevision } = useAuth();
  const queryClient = useQueryClient();
  const { mode, setDarkEnabled } = useTheme();
  const dark = mode === 'dark';

  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [profileError, setProfileError] = useState<string | null>(null);
  const [avatarError, setAvatarError] = useState<string | null>(null);

  const profileQuery = useQuery({
    queryKey: ['auth', 'profile'],
    queryFn: async (): Promise<User> => {
      const res = await fetch('/api/v1/auth/me', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.message || '加载个人资料失败');
      }
      return body as User;
    },
    enabled: !!token,
  });

  useEffect(() => {
    const p = profileQuery.data;
    if (!p) return;
    setDisplayName(p.displayName ?? '');
    setEmail(p.email ?? '');
  }, [profileQuery.data]);

  const uploadAvatar = useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/v1/auth/avatar', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof body.message === 'string' ? body.message : '上传失败');
      }
      return body as { user: User };
    },
    onSuccess: (data) => {
      setUser(data.user);
      queryClient.setQueryData(['auth', 'profile'], data.user);
      bumpAvatarRevision();
      setAvatarError(null);
    },
    onError: (e: Error) => {
      setAvatarError(e.message || '上传失败');
    },
  });

  const removeAvatar = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/v1/auth/avatar', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof body.message === 'string' ? body.message : '移除失败');
      }
      return body as { user: User };
    },
    onSuccess: (data) => {
      setUser(data.user);
      queryClient.setQueryData(['auth', 'profile'], data.user);
      bumpAvatarRevision();
      setAvatarError(null);
    },
    onError: (e: Error) => {
      setAvatarError(e.message || '移除失败');
    },
  });

  const saveProfile = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/v1/auth/profile', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          displayName,
          email,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        const err = new Error(
          typeof body.message === 'string' ? body.message : '保存失败',
        );
        (err as Error & { code?: string }).code =
          typeof body.code === 'string' ? body.code : undefined;
        throw err;
      }
      return body as { user: User };
    },
    onSuccess: (data) => {
      setUser(data.user);
      queryClient.setQueryData(['auth', 'profile'], data.user);
      setProfileError(null);
    },
    onError: (e: Error & { code?: string }) => {
      setProfileError(e.message || '保存失败');
    },
  });

  const p = profileQuery.data;

  return (
    <Layout>
      <div className="settings-page">
        <h1 className="settings-page-title">个人设置</h1>

        <section
          className="settings-section"
          aria-labelledby="settings-account-heading"
        >
          <h2 id="settings-account-heading" className="settings-section-title">
            个人资料
          </h2>

          {profileQuery.isLoading && (
            <p className="settings-muted">加载中…</p>
          )}
          {profileQuery.isError && (
            <p className="settings-inline-error" role="alert">
              {(profileQuery.error as Error)?.message ?? '加载失败'}
            </p>
          )}

          {p && (
            <>
              <div className="settings-account-readonly">
                <div className="settings-kv">
                  <span className="settings-k">用户名</span>
                  <span className="settings-v">{p.username}</span>
                </div>
                <div className="settings-kv">
                  <span className="settings-k">角色</span>
                  <span className="settings-v">{roleLabel(p.role)}</span>
                </div>
                <div className="settings-kv">
                  <span className="settings-k">注册时间</span>
                  <span className="settings-v">{formatDateTime(p.createdAt)}</span>
                </div>
                <div className="settings-kv">
                  <span className="settings-k">最近登录</span>
                  <span className="settings-v">{formatDateTime(p.lastLoginAt)}</span>
                </div>
              </div>

              <div className="settings-avatar-block">
                <div className="settings-avatar-preview">
                  <img
                    src={userAvatarSrc(
                      p.id,
                      Boolean(p.hasCustomAvatar),
                      token,
                      avatarRevision,
                    )}
                    alt=""
                    className="settings-avatar-img"
                  />
                </div>
                <div className="settings-avatar-actions">
                  <label className="btn btn-secondary settings-avatar-upload-label">
                    {uploadAvatar.isPending ? '上传中…' : '上传头像'}
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      className="settings-avatar-file-input"
                      disabled={uploadAvatar.isPending || removeAvatar.isPending}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        e.target.value = '';
                        if (f) uploadAvatar.mutate(f);
                      }}
                    />
                  </label>
                  {p.hasCustomAvatar ? (
                    <button
                      type="button"
                      className="btn btn-ghost"
                      disabled={uploadAvatar.isPending || removeAvatar.isPending}
                      onClick={() => removeAvatar.mutate()}
                    >
                      {removeAvatar.isPending ? '移除中…' : '恢复默认头像'}
                    </button>
                  ) : null}
                </div>
                <p className="settings-field-hint">
                  支持 JPEG、PNG、WebP、GIF，单张不超过 512KB；文件保存在服务器（内网可用）。
                </p>
                {avatarError ? (
                  <p className="settings-inline-error" role="alert">
                    {avatarError}
                  </p>
                ) : null}
              </div>

              <form
                className="settings-profile-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  setProfileError(null);
                  saveProfile.mutate();
                }}
              >
                <div className="settings-form-field">
                  <label htmlFor="settings-displayName">显示名称</label>
                  <input
                    id="settings-displayName"
                    type="text"
                    className="header-search-input settings-input-full"
                    autoComplete="nickname"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="可选，在界面中展示的名称"
                  />
                </div>
                <div className="settings-form-field">
                  <label htmlFor="settings-email">邮箱</label>
                  <input
                    id="settings-email"
                    type="email"
                    className="header-search-input settings-input-full"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="可选"
                  />
                </div>

                {profileError ? (
                  <p className="settings-inline-error" role="alert">
                    {profileError}
                  </p>
                ) : null}

                <div className="settings-form-actions">
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={saveProfile.isPending}
                  >
                    {saveProfile.isPending ? '保存中…' : '保存资料'}
                  </button>
                </div>
              </form>
            </>
          )}
        </section>

        <section
          className="settings-section settings-section--spaced"
          aria-labelledby="settings-display-heading"
        >
          <h2 id="settings-display-heading" className="settings-section-title">
            显示设置
          </h2>
          <label className="settings-row">
            <div className="settings-row-text">
              <div className="settings-row-label">深色模式</div>
              <div id="settings-dark-desc" className="settings-row-desc">
                启用深色主题
              </div>
            </div>
            <input
              type="checkbox"
              className="settings-checkbox"
              checked={dark}
              onChange={(e) => setDarkEnabled(e.target.checked)}
              aria-describedby="settings-dark-desc"
            />
          </label>
        </section>
      </div>
    </Layout>
  );
}
