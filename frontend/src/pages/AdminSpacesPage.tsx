import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { Layout } from '../components/Layout';
import { useAuth } from '../context/AuthContext';

type Space = {
  id: string;
  name: string;
  description?: string | null;
};

type User = {
  id: string;
  username: string;
  displayName?: string | null;
  role?: 'system_admin' | 'user';
};

type PermissionValue = 'admin' | 'edit' | 'read';
type AssignablePermissionValue = 'edit' | 'read';
type PermissionRow = {
  userId: string;
  permission: PermissionValue;
};

type SavePermissionsPayload = { spaceId: string; rows: PermissionRow[] };

function normalizePermissionRows(rows: PermissionRow[]): PermissionRow[] {
  return [...rows].sort((a, b) => a.userId.localeCompare(b.userId));
}

function isSamePermissionRows(a: PermissionRow[], b: PermissionRow[]): boolean {
  const left = normalizePermissionRows(a);
  const right = normalizePermissionRows(b);
  if (left.length !== right.length) return false;
  for (let i = 0; i < left.length; i += 1) {
    if (left[i].userId !== right[i].userId || left[i].permission !== right[i].permission) return false;
  }
  return true;
}

/**
 * 后端要求：每个 system_admin 必须出现在 permissions[] 中且为 admin，否则 PUT 返回 409 且不写入。
 * 展示与保存前合并，避免「只加普通成员」时保存失败、刷新后仍为空。
 */
function mergeSystemAdminRows(
  rows: PermissionRow[],
  users: User[] | undefined
): PermissionRow[] {
  const admins = (users ?? []).filter((u) => u.role === 'system_admin');
  if (admins.length === 0) return rows;
  const map = new Map(rows.map((r) => [r.userId, { ...r }]));
  for (const u of admins) {
    const cur = map.get(u.id);
    if (!cur) {
      map.set(u.id, { userId: u.id, permission: 'admin' });
    } else if (cur.permission !== 'admin') {
      map.set(u.id, { userId: u.id, permission: 'admin' });
    }
  }
  return Array.from(map.values());
}

async function fetchSpaces(token: string | null): Promise<Space[]> {
  const res = await fetch('/api/v1/spaces', {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  const data = await res.json().catch(() => []);
  if (!res.ok) throw new Error('加载知识库列表失败');
  return Array.isArray(data) ? data : [];
}

async function fetchUsers(token: string | null): Promise<User[]> {
  const res = await fetch('/api/v1/admin/users', {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || '加载用户列表失败');
  return Array.isArray(data?.list) ? data.list : [];
}

async function fetchSpacePermissions(
  token: string | null,
  spaceId: string
): Promise<Array<{ userId: string; permission: PermissionValue }>> {
  const res = await fetch(`/api/v1/spaces/${spaceId}/permissions`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || '加载知识库权限失败');
  const list = Array.isArray(data?.list) ? data.list : [];
  return list
    .filter((x: any) => x?.user?.id && typeof x?.permission === 'string')
    .map((x: any) => ({
      userId: x.user.id as string,
      permission: x.permission === 'write' ? 'edit' : (x.permission as PermissionValue),
    }));
}

async function updateSpacePermissions(
  token: string | null,
  spaceId: string,
  rows: PermissionRow[]
) {
  const payload = {
    permissions: rows.map((r) => ({
      userId: r.userId,
      permission: r.permission === 'edit' ? 'write' : r.permission,
    })),
  };
  const res = await fetch(`/api/v1/spaces/${spaceId}/permissions`, {
    method: 'PUT',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data?.message || '保存知识库权限失败');
  }
}

async function createSpace(
  token: string | null,
  payload: { name: string; description?: string }
) {
  const res = await fetch('/api/v1/spaces', {
    method: 'POST',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || '创建知识库失败');
}

async function updateSpace(
  token: string | null,
  spaceId: string,
  payload: { name?: string; description?: string }
) {
  const res = await fetch(`/api/v1/spaces/${spaceId}`, {
    method: 'PATCH',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || '更新知识库失败');
}

async function deleteSpace(token: string | null, spaceId: string) {
  const res = await fetch(`/api/v1/spaces/${spaceId}`, {
    method: 'DELETE',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data?.message || '删除知识库失败');
  }
}

export function AdminSpacesPage() {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const [selectedSpaceId, setSelectedSpaceId] = useState('');
  const [createForm, setCreateForm] = useState({ name: '', description: '' });
  const [editForm, setEditForm] = useState({ name: '', description: '' });
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedPermission, setSelectedPermission] = useState<AssignablePermissionValue>('read');
  const [statusText, setStatusText] = useState('');
  const [isEditingMeta, setIsEditingMeta] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  useEffect(() => {
    document.title = '知识库管理 - 元体WIKI';
  }, []);

  const spacesQuery = useQuery({
    queryKey: ['admin-spaces'],
    queryFn: () => fetchSpaces(token),
  });
  const usersQuery = useQuery({
    queryKey: ['admin-users-for-space'],
    queryFn: () => fetchUsers(token),
  });

  const permissionsQuery = useQuery({
    queryKey: ['space-permissions', selectedSpaceId],
    queryFn: () => fetchSpacePermissions(token, selectedSpaceId),
    enabled: !!selectedSpaceId,
  });

  const [pendingRows, setPendingRows] = useState<PermissionRow[]>([]);
  /** 最近一次成功保存权限后，在无未保存变更时显示「已保存」灰态 */
  const [permissionSavedAck, setPermissionSavedAck] = useState(false);

  const rawEffectiveRows = useMemo(
    () => (pendingRows.length > 0 ? pendingRows : permissionsQuery.data ?? []),
    [pendingRows, permissionsQuery.data]
  );

  const effectiveRows = useMemo(
    () => mergeSystemAdminRows(rawEffectiveRows, usersQuery.data),
    [rawEffectiveRows, usersQuery.data]
  );

  const saveMutation = useMutation({
    mutationFn: async ({ spaceId, rows }: SavePermissionsPayload) => {
      if (!spaceId) throw new Error('请先选择知识库');
      await updateSpacePermissions(token, spaceId, rows);
    },
    onSuccess: async (_data, variables) => {
      const { spaceId, rows } = variables;
      setPendingRows([]);
      setPermissionSavedAck(true);
      queryClient.setQueryData<PermissionRow[]>(['space-permissions', spaceId], rows);
      await queryClient.invalidateQueries({ queryKey: ['space-permissions', spaceId] });
    },
    onError: (err) => setStatusText((err as Error)?.message || '保存知识库权限失败'),
  });

  const createSpaceMutation = useMutation({
    mutationFn: async () =>
      createSpace(token, {
        name: createForm.name.trim(),
        description: createForm.description.trim(),
      }),
    onSuccess: async () => {
      setCreateForm({ name: '', description: '' });
      setStatusText('知识库创建成功');
      await queryClient.invalidateQueries({ queryKey: ['admin-spaces'] });
    },
    onError: (err) => setStatusText((err as Error)?.message || '创建知识库失败'),
  });

  const updateSpaceMutation = useMutation({
    mutationFn: async () => {
      if (!selectedSpaceId) throw new Error('请先选择知识库');
      await updateSpace(token, selectedSpaceId, {
        name: editForm.name.trim() || undefined,
        description: editForm.description.trim(),
      });
    },
    onSuccess: async () => {
      setStatusText('知识库信息已更新');
      setIsEditingMeta(false);
      await queryClient.invalidateQueries({ queryKey: ['admin-spaces'] });
    },
    onError: (err) => setStatusText((err as Error)?.message || '更新知识库失败'),
  });

  const deleteSpaceMutation = useMutation({
    mutationFn: async () => {
      if (!selectedSpaceId) throw new Error('请先选择知识库');
      await deleteSpace(token, selectedSpaceId);
    },
    onSuccess: async () => {
      setSelectedSpaceId('');
      setPendingRows([]);
      setDeleteConfirmOpen(false);
      setDeleteConfirmText('');
      setStatusText('知识库已删除');
      await queryClient.invalidateQueries({ queryKey: ['admin-spaces'] });
    },
    onError: (err) => setStatusText((err as Error)?.message || '删除知识库失败'),
  });

  const addOrUpdateRow = () => {
    if (!selectedUserId) return;
    const selectedUser = usersQuery.data?.find((u) => u.id === selectedUserId);
    if (selectedUser?.role === 'system_admin') {
      setStatusText('system_admin 为固定最高权限，不可修改');
      return;
    }
    setPendingRows((prev) => {
      const base = prev.length > 0 ? prev : permissionsQuery.data ?? [];
      const has = base.find((x) => x.userId === selectedUserId);
      if (!has) {
        return [...base, { userId: selectedUserId, permission: selectedPermission }];
      }
      return base.map((x) =>
        x.userId === selectedUserId ? { ...x, permission: selectedPermission } : x
      );
    });
  };

  const removeRow = (userId: string) => {
    const targetUser = usersQuery.data?.find((u) => u.id === userId);
    if (targetUser?.role === 'system_admin') {
      setStatusText('system_admin 为固定最高权限，不可移除');
      return;
    }
    setPendingRows((prev) => {
      const base = prev.length > 0 ? prev : permissionsQuery.data ?? [];
      return base.filter((x) => x.userId !== userId);
    });
  };

  const getUserName = (userId: string) => {
    const user = usersQuery.data?.find((u) => u.id === userId);
    return user?.displayName || user?.username || userId;
  };

  const selectedSpace = useMemo(
    () => (spacesQuery.data ?? []).find((s) => s.id === selectedSpaceId) ?? null,
    [spacesQuery.data, selectedSpaceId]
  );
  const immutableAdminIds = useMemo(
    () => new Set((usersQuery.data ?? []).filter((u) => u.role === 'system_admin').map((u) => u.id)),
    [usersQuery.data]
  );
  const hasPermissionChanges = useMemo(() => {
    const source = permissionsQuery.data ?? [];
    return !isSamePermissionRows(effectiveRows, source);
  }, [effectiveRows, permissionsQuery.data]);

  useEffect(() => {
    if (hasPermissionChanges) {
      setPermissionSavedAck(false);
    }
  }, [hasPermissionChanges]);
  const canConfirmDelete =
    !!selectedSpace && deleteConfirmText.trim() === selectedSpace.name;

  return (
    <Layout>
      <section className="card kb-admin-shell">
        <div className="card-header">
          <div>
            <div className="card-title">知识库管理</div>
            <div className="card-sub">先创建知识库，再配置成员权限与维护信息。</div>
          </div>
        </div>

        {spacesQuery.isError && <p className="error-text">加载知识库列表失败</p>}
        {usersQuery.isError && <p className="error-text">加载用户列表失败</p>}
        {!!statusText && (
          <p className={statusText.includes('失败') ? 'error-text' : 'card-sub'}>{statusText}</p>
        )}

        <div className="kb-admin-grid">
          <section className="kb-admin-card">
            <h3>创建知识库</h3>
            <p>创建后可在右侧选择并配置成员权限（管理员 / 可编辑 / 只读）。</p>
            <div className="kb-form-grid">
              <input
                className="header-search-input"
                placeholder="知识库名称（必填）"
                value={createForm.name}
                onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))}
              />
              <input
                className="header-search-input"
                placeholder="描述（选填）"
                value={createForm.description}
                onChange={(e) => setCreateForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>
            <div className="kb-form-actions">
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => createSpaceMutation.mutate()}
                disabled={createSpaceMutation.isPending || !createForm.name.trim()}
              >
                {createSpaceMutation.isPending ? '创建中...' : '新建知识库'}
              </button>
            </div>
          </section>

          <section className="kb-admin-card">
            <h3>已有知识库管理</h3>
            <p>选择知识库后可更新名称、描述并维护成员权限。</p>

            <div className="kb-manage-toolbar">
              <select
                className="header-search-input"
                value={selectedSpaceId}
                onChange={(e) => {
                  setSelectedSpaceId(e.target.value);
                  setPendingRows([]);
                  setPermissionSavedAck(false);
                  setIsEditingMeta(false);
                  setDeleteConfirmOpen(false);
                  setDeleteConfirmText('');
                  const picked = (spacesQuery.data ?? []).find((s) => s.id === e.target.value);
                  if (picked) {
                    setEditForm({
                      name: picked.name || '',
                      description: picked.description || '',
                    });
                  }
                }}
              >
                <option value="">{spacesQuery.isLoading ? '加载知识库中...' : '选择知识库'}</option>
                {(spacesQuery.data ?? []).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>

              {selectedSpaceId && (
                <>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => {
                      setDeleteConfirmOpen(true);
                      setDeleteConfirmText('');
                    }}
                    disabled={deleteSpaceMutation.isPending}
                  >
                    删除知识库
                  </button>
                </>
              )}
            </div>

            {selectedSpaceId && selectedSpace && deleteConfirmOpen && (
              <div className="kb-delete-confirm">
                <p className="kb-delete-confirm-title">高风险操作：删除知识库</p>
                <p className="kb-delete-confirm-sub">
                  删除后该知识库下的页面与内容将不可恢复。请输入知识库名称
                  <strong>「{selectedSpace.name}」</strong> 以确认删除。
                </p>
                <input
                  className="header-search-input"
                  placeholder="输入知识库名称以确认"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                />
                <div className="kb-delete-confirm-actions">
                  <button
                    type="button"
                    className="btn btn-danger"
                    onClick={() => deleteSpaceMutation.mutate()}
                    disabled={!canConfirmDelete || deleteSpaceMutation.isPending}
                  >
                    {deleteSpaceMutation.isPending ? '删除中...' : '确认删除'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => {
                      setDeleteConfirmOpen(false);
                      setDeleteConfirmText('');
                    }}
                  >
                    取消
                  </button>
                </div>
              </div>
            )}

            {selectedSpaceId && selectedSpace && (
              <>
                <div className="kb-block-title">信息更新</div>
                <div className="kb-meta-block">
                <div className="kb-meta-head">
                  <strong>知识库信息</strong>
                  {!isEditingMeta && (
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => setIsEditingMeta(true)}
                    >
                      编辑信息
                    </button>
                  )}
                </div>
                {!isEditingMeta && (
                  <div className="kb-meta-readonly">
                    <div className="kb-meta-row">
                      <span className="kb-meta-label">名称</span>
                      <span>{selectedSpace.name || '-'}</span>
                    </div>
                    <div className="kb-meta-row">
                      <span className="kb-meta-label">描述</span>
                      <span>{selectedSpace.description?.trim() || '—'}</span>
                    </div>
                  </div>
                )}
                {isEditingMeta && (
                  <>
                    <div className="kb-form-grid">
                      <input
                        className="header-search-input"
                        placeholder="知识库名称"
                        value={editForm.name}
                        onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                      />
                      <input
                        className="header-search-input"
                        placeholder="描述"
                        value={editForm.description}
                        onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
                      />
                    </div>
                    <div className="kb-meta-actions">
                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={() => updateSpaceMutation.mutate()}
                        disabled={updateSpaceMutation.isPending}
                      >
                        {updateSpaceMutation.isPending ? '保存中...' : '保存更改'}
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => {
                          setIsEditingMeta(false);
                          setEditForm({
                            name: selectedSpace.name || '',
                            description: selectedSpace.description || '',
                          });
                        }}
                      >
                        取消
                      </button>
                    </div>
                  </>
                )}
              </div>
              </>
            )}

            {selectedSpaceId && (
              <>
                <div className="kb-section-divider" />
                <div className="kb-perm-block">
                  <div className="kb-block-title">权限更新</div>
                  <div className="kb-manage-toolbar">
                    <select
                      className="header-search-input"
                      value={selectedUserId}
                      onChange={(e) => setSelectedUserId(e.target.value)}
                    >
                      <option value="">选择成员</option>
                      {(usersQuery.data ?? []).map((u) => (
                        <option key={u.id} value={u.id} disabled={u.role === 'system_admin'}>
                          {u.displayName || u.username}
                          {u.role === 'system_admin' ? '（固定最高权限）' : ''}
                        </option>
                      ))}
                    </select>
                    <select
                      className="header-search-input"
                      value={selectedPermission}
                      onChange={(e) => setSelectedPermission(e.target.value as AssignablePermissionValue)}
                    >
                      <option value="edit">可编辑（增改读）</option>
                      <option value="read">只读（仅查看）</option>
                    </select>
                    <button type="button" className="btn btn-secondary" onClick={addOrUpdateRow}>
                      添加/更新成员
                    </button>
                  </div>
                </div>

                {permissionsQuery.isLoading && <p className="card-sub">加载知识库权限中...</p>}
                {permissionsQuery.isError && <p className="error-text">加载知识库权限失败</p>}
                {!permissionsQuery.isLoading && !permissionsQuery.isError && (
                  <>
                    <table className="admin-table">
                      <thead>
                        <tr>
                          <th>成员</th>
                          <th>权限</th>
                          <th>操作</th>
                        </tr>
                      </thead>
                      <tbody>
                        {effectiveRows.map((row) => (
                          <tr key={row.userId}>
                            <td>{getUserName(row.userId)}</td>
                            <td>
                              {immutableAdminIds.has(row.userId)
                                ? '系统管理员（固定）'
                                : row.permission === 'admin'
                                  ? '管理员'
                                  : row.permission === 'edit'
                                    ? '可编辑'
                                    : '只读'}
                            </td>
                            <td>
                              {immutableAdminIds.has(row.userId) ? (
                                <span className="card-sub">不可修改</span>
                              ) : (
                                <button type="button" className="btn btn-ghost" onClick={() => removeRow(row.userId)}>
                                  移除
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                        {effectiveRows.length === 0 && (
                          <tr>
                            <td colSpan={3} className="admin-empty">
                              当前知识库暂无成员权限
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                    <div className="kb-meta-actions">
                      <button
                        type="button"
                        className={`btn ${hasPermissionChanges ? 'btn-primary' : 'btn-secondary'}${!hasPermissionChanges && permissionSavedAck ? ' kb-perm-saved' : ''}`}
                        onClick={() =>
                          saveMutation.mutate({
                            spaceId: selectedSpaceId,
                            rows: effectiveRows,
                          })
                        }
                        disabled={!hasPermissionChanges || saveMutation.isPending}
                      >
                        {saveMutation.isPending
                          ? '保存中...'
                          : hasPermissionChanges
                            ? '保存权限'
                            : permissionSavedAck
                              ? '已保存'
                              : '无需保存'}
                      </button>
                    </div>
                  </>
                )}
              </>
            )}

            {!selectedSpaceId && (
              <div className="admin-empty kb-empty-hint">
                请选择一个知识库开始管理；如果尚未创建，请先在左侧创建。
              </div>
            )}
          </section>
        </div>
      </section>
    </Layout>
  );
}

