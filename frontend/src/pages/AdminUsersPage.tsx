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

export function AdminUsersPage() {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<UserForm>({
    username: '',
    password: '',
    displayName: '',
    email: '',
  });

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

  return (
    <Layout>
      <section className="card">
        <div className="card-header">
          <div>
            <div className="card-title">用户管理</div>
            <div className="card-sub">仅系统管理员可访问；此处仅支持新建/删除普通用户</div>
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
                        <button
                          type="button"
                          className="btn btn-ghost"
                          onClick={() => deleteMutation.mutate(u.id)}
                        >
                          删除
                        </button>
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
    </Layout>
  );
}

