import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Layout } from '../components/Layout';

type SearchResult = {
  spaceId: string;
  pageId: string;
  title: string;
  path: string;
  excerpt: string;
};

async function fetchSearchResults(token: string | null, q: string): Promise<{
  count: number;
  results: SearchResult[];
}> {
  const url = `/api/v1/search?q=${encodeURIComponent(q)}`;
  const res = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = data?.message || '搜索失败';
    throw new Error(message);
  }
  return data;
}

export function SearchPage() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const qFromUrl = useMemo(() => (searchParams.get('q') ?? '').trim(), [searchParams]);
  const [qDraft, setQDraft] = useState(qFromUrl);
  const [mainFilter, setMainFilter] = useState<'all' | 'title' | 'excerpt'>('all');

  // 当 URL query 变化时，把草稿同步到输入框（例如从 Header 搜索跳转到 /search?q=...）
  useEffect(() => {
    setQDraft(qFromUrl);
  }, [qFromUrl]);

  useEffect(() => {
    document.title = qFromUrl ? `搜索：${qFromUrl} - 元体WIKI` : '搜索 - 元体WIKI';
  }, [qFromUrl]);

  const { data, isError } = useQuery({
    queryKey: ['search', qFromUrl],
    queryFn: () => fetchSearchResults(token, qFromUrl),
    enabled: !!qFromUrl,
    retry: 0,
  });

  const rawResults = data?.results ?? [];
  const results = rawResults.filter((r) => {
    if (mainFilter === 'title') return r.title.toLowerCase().includes(qFromUrl.toLowerCase());
    if (mainFilter === 'excerpt') {
      return r.excerpt.toLowerCase().includes(qFromUrl.toLowerCase());
    }
    return true;
  });

  return (
    <Layout>
      <div className="search-box-wrap">
        <input
          type="search"
          placeholder="搜索文档..."
          value={qDraft}
          onChange={(e) => setQDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== 'Enter') return;
            const q = qDraft.trim();
            if (!q) return;
            navigate(`/search?q=${encodeURIComponent(q)}`);
          }}
          className="search-input"
        />
        <div className="search-filters">
          <span className="search-filter-label">主筛选：</span>
          <button
            type="button"
            className={`btn btn-secondary ${mainFilter === 'all' ? 'is-active' : ''}`}
            onClick={() => setMainFilter('all')}
          >
            全部
          </button>
          <button
            type="button"
            className={`btn btn-secondary ${mainFilter === 'title' ? 'is-active' : ''}`}
            onClick={() => setMainFilter('title')}
          >
            标题
          </button>
          <button
            type="button"
            className={`btn btn-secondary ${mainFilter === 'excerpt' ? 'is-active' : ''}`}
            onClick={() => setMainFilter('excerpt')}
          >
            正文摘要
          </button>
        </div>
      </div>

      {!!qFromUrl && (
        <p className="search-meta">
          {isError ? '搜索失败' : `共找到 ${results.length} 条结果`}
        </p>
      )}

      {isError && (
        <p className="error-text">
          你没有权限访问相关内容，或搜索请求失败。
        </p>
      )}

      {!isError && !!qFromUrl && results.length === 0 && (
        <div className="search-empty card">
          <div className="card-title">未找到匹配结果</div>
          <p className="card-sub">
            建议更换关键词，或将主筛选切换为“全部”后重试。
          </p>
        </div>
      )}

      {!isError && !!qFromUrl && results.length > 0 && (
        <div className="search-results">
          {results.map((r) => (
            <div
              key={`${r.spaceId}:${r.pageId}`}
              className="search-result"
              role="button"
              tabIndex={0}
              onClick={() => navigate(`/space/${r.spaceId}/page/${r.pageId}`)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  navigate(`/space/${r.spaceId}/page/${r.pageId}`);
                }
              }}
            >
              <h3>{r.title}</h3>
              <p className="path">{r.path}</p>
              <p className="excerpt">{r.excerpt}</p>
            </div>
          ))}
        </div>
      )}
    </Layout>
  );
}

