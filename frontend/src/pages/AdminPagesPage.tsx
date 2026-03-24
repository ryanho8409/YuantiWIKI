import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { useAuth } from '../context/AuthContext';

type AdminPageRow = {
  pageId: string;
  title: string;
  spaceId: string;
  spaceName: string;
  updatedAt: string;
};

async function fetchAdminPages(token: string | null, q: string): Promise<AdminPageRow[]> {
  const query = new URLSearchParams({
    page: '1',
    pageSize: '50',
    ...(q ? { q } : {}),
  });
  const res = await fetch(`/api/v1/admin/pages?${query.toString()}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.message || '加载全局页面列表失败');
  }
  return Array.isArray(data?.list) ? data.list : [];
}

export function AdminPagesPage() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [keyword, setKeyword] = useState('');
  const q = useMemo(() => keyword.trim(), [keyword]);
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['admin-pages', q],
    queryFn: () => fetchAdminPages(token, q),
  });

  useEffect(() => {
    document.title = '全局页面管理 - 元体WIKI';
  }, []);

  return (
    <Layout>
      <section className="card">
        <div className="card-header">
          <div>
            <div className="card-title">全局页面管理</div>
            <div className="card-sub">方案 A：独立入口 + 列表 + 跳转（不做批量/审核）</div>
          </div>
        </div>

        <div className="admin-toolbar">
          <input
            type="search"
            className="search-input"
            placeholder="按页面标题或知识库名搜索"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
          />
        </div>

        {isLoading && <p className="card-sub">加载中...</p>}
        {isError && (
          <p className="error-text">
            {(error as Error)?.message || '加载全局页面列表失败'}
          </p>
        )}

        {!isLoading && !isError && (
          <table className="admin-table">
            <thead>
              <tr>
                <th>页面标题</th>
                <th>所属知识库</th>
                <th>最近更新时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {data?.map((row) => (
                <tr key={row.pageId}>
                  <td>{row.title}</td>
                  <td>{row.spaceName || row.spaceId}</td>
                  <td>{new Date(row.updatedAt).toLocaleString()}</td>
                  <td>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => navigate(`/space/${row.spaceId}/page/${row.pageId}`)}
                    >
                      打开页面
                    </button>
                  </td>
                </tr>
              ))}
              {data?.length === 0 && (
                <tr>
                  <td colSpan={4} className="admin-empty">
                    暂无页面
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

