import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Layout } from '../components/Layout';
import { useAuth } from '../context/AuthContext';

type AdminUser = {
  id: string;
  username: string;
  displayName?: string | null;
  email?: string | null;
  role: string;
};

type UserForm = {
  username: string;
  password: string;
  displayName: string;
  email: string;
};

function roleLabel(role: string) {
  return role === 'system_admin' ? '系统管理员' : '普通用户';
}

async function fetchAdminUsers(token: string | null): Promise<AdminUser[]> {
  const res = await fetch('/api/v1/admin/users', {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.message || '加载用户列表失败');
  }
  return Array.isArray(data?.list) ? data.list : [];
}

async function createUser(token: string | null, payload: UserForm) {
  const res = await fetch('/api/v1/admin/users', {
    method: 'POST',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || '创建用户失败');
}

async function deleteUser(token: string | null, userId: string) {
  const res = await fetch(`/api/v1/admin/users/${userId}`, {
    method: 'DELETE',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data?.message || '删除用户失败');
  }
}

async function resetUserPassword(token: string | null, userId: string, password: string) {
  const res = await fetch(`/api/v1/admin/users/${userId}/reset-password`, {
    method: 'POST',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ password }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data?.message || '重置密码失败');
  }
}

export function AdminUsersPage() {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<UserForm>({
    username: '',
    password: '',
    displayName: '',
    email: '',
  });
  const [resetTarget, setResetTarget] = useState<{ id: string; username: string } | null>(null);
  const [resetPassword, setResetPassword] = useState('');
  const [resetConfirm, setResetConfirm] = useState('');
  const [resetError, setResetError] = useState('');

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => fetchAdminUsers(token),
  });

  useEffect(() => {
    document.title = '用户管理 - 元体WIKI';
  }, []);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['admin-users'] });

  const createMutation = useMutation({
    mutationFn: async () => createUser(token, form),
    onSuccess: async () => {
      setForm({ username: '', password: '', displayName: '', email: '' });
      await refresh();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => deleteUser(token, id),
    onSuccess: async () => {
      await refresh();
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: async ({ userId, password }: { userId: string; password: string }) =>
      resetUserPassword(token, userId, password),
    onSuccess: async () => {
      setResetTarget(null);
      setResetPassword('');
      setResetConfirm('');
      setResetError('');
      await refresh();
    },
    onError: (err) => setResetError((err as Error)?.message || '重置密码失败'),
  });

  return (
    <Layout>
      <section className="card">
            <div className="card-header">
          <div>
            <div className="card-title">用户管理</div>
            <div className="card-sub">
              仅系统管理员可访问；支持新建/删除普通用户。普通用户忘记密码时，可由管理员重置为临时密码，用户登录后请自行修改密码。
            </div>
          </div>
        </div>
        <div className="admin-toolbar">
          <input
            className="header-search-input"
            placeholder="用户名"
            value={form.username}
            onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
          />
          <input
            className="header-search-input"
            type="password"
            placeholder="初始密码（至少 6 位）"
            value={form.password}
            onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
          />
          <input
            className="header-search-input"
            placeholder="显示名"
            value={form.displayName}
            onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))}
          />
          <input
            className="header-search-input"
            placeholder="邮箱"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
          />
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => createMutation.mutate()}
            disabled={createMutation.isPending}
          >
            {createMutation.isPending ? '创建中...' : '新建用户'}
          </button>
        </div>
        {createMutation.isError && (
          <p className="error-text">{(createMutation.error as Error)?.message || '创建用户失败'}</p>
        )}
        {deleteMutation.isError && (
          <p className="error-text">{(deleteMutation.error as Error)?.message || '删除用户失败'}</p>
        )}
        {isLoading && <p className="card-sub">加载中...</p>}
        {isError && (
          <p className="error-text">
            {(error as Error)?.message || '加载用户列表失败'}
          </p>
        )}
        {!isLoading && !isError && (
          <table className="admin-table">
            <thead>
              <tr>
                <th>用户名</th>
                <th>显示名</th>
                <th>邮箱</th>
                <th>系统角色</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {data?.map((u) => (
                <tr key={u.id}>
                  <td>{u.username}</td>
                  <td>{u.displayName || '-'}</td>
                  <td>{u.email || '-'}</td>
                  <td>{roleLabel(u.role)}</td>
                  <td>
                    <div className="admin-toolbar">
                      {u.role === 'system_admin' ? (
                        <span className="card-sub">不可删除</span>
                      ) : (
                        <>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => {
                              setResetError('');
                              setResetPassword('');
                              setResetConfirm('');
                              setResetTarget({ id: u.id, username: u.username });
                            }}
                          >
                            重置密码
                          </button>
                          <button
                            type="button"
                            className="btn btn-ghost"
                            onClick={() => deleteMutation.mutate(u.id)}
                          >
                            删除
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {data?.length === 0 && (
                <tr>
                  <td colSpan={5} className="admin-empty">
                    暂无用户
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </section>

      {resetTarget && (
        <>
          <div
            className="overlay show change-password-overlay"
            role="presentation"
            onClick={() => {
              if (!resetPasswordMutation.isPending) setResetTarget(null);
            }}
          />
          <div
            className="change-password-modal"
            role="dialog"
            aria-labelledby="admin-reset-pw-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="admin-reset-pw-title" className="change-password-title">
              重置密码
            </h2>
            <p className="change-password-hint">
              用户 <strong>{resetTarget.username}</strong>
              ：请设置新的临时密码（至少 6 位），并告知用户尽快登录后在「设置 → 修改密码」中更换。
            </p>
            <form
              className="change-password-form"
              onSubmit={(e) => {
                e.preventDefault();
                setResetError('');
                if (resetPassword !== resetConfirm) {
                  setResetError('两次输入的密码不一致');
                  return;
                }
                if (resetPassword.length < 6) {
                  setResetError('密码长度至少为 6 位');
                  return;
                }
                resetPasswordMutation.mutate({ userId: resetTarget.id, password: resetPassword });
              }}
            >
              <label className="change-password-label">
                <span>新密码</span>
                <input
                  type="password"
                  className="header-search-input change-password-input"
                  autoComplete="new-password"
                  value={resetPassword}
                  onChange={(e) => setResetPassword(e.target.value)}
                  required
                  minLength={6}
                />
              </label>
              <label className="change-password-label">
                <span>确认新密码</span>
                <input
                  type="password"
                  className="header-search-input change-password-input"
                  autoComplete="new-password"
                  value={resetConfirm}
                  onChange={(e) => setResetConfirm(e.target.value)}
                  required
                  minLength={6}
                />
              </label>
              {resetError && <p className="error-text change-password-error">{resetError}</p>}
              <div className="change-password-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setResetTarget(null)}
                  disabled={resetPasswordMutation.isPending}
                >
                  取消
                </button>
                <button type="submit" className="btn btn-primary" disabled={resetPasswordMutation.isPending}>
                  {resetPasswordMutation.isPending ? '保存中...' : '确认重置'}
                </button>
              </div>
            </form>
          </div>
        </>
      )}
    </Layout>
  );
}

