import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Layout } from '../components/Layout';
import { userAvatarSrc } from '../lib/avatarUrl';

interface Space {
  id: string;
  name: string;
  description?: string | null;
  icon?: string | null;
}

function IconFolderSimple() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden>
      <path
        d="M3 7.75A2.75 2.75 0 0 1 5.75 5h3.06c.6 0 1.17.24 1.59.66l.88.88c.14.14.34.22.53.22h6.5A2.75 2.75 0 0 1 21 9.5v7.75A2.75 2.75 0 0 1 18.25 20H5.75A2.75 2.75 0 0 1 3 17.25z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

type DashboardItem = {
  pageId: string;
  spaceId: string;
  title: string;
  spaceName: string;
  updatedAt?: string;
  createdAt?: string;
};

type DashboardData = {
  stats: {
    totalSpaces: number;
    totalPages: number;
    edits7d: number;
  };
  recentUpdated: DashboardItem[];
  recentCreated: DashboardItem[];
};

const SPACE_LAST_VISIT_KEY = 'yuanti.wiki.spaceLastVisitMap';
const DASHBOARD_RECENT_LIMIT = 4;

function readLastVisitMap(): Record<string, number> {
  try {
    const raw = localStorage.getItem(SPACE_LAST_VISIT_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, number>;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeLastVisitMap(next: Record<string, number>) {
  try {
    localStorage.setItem(SPACE_LAST_VISIT_KEY, JSON.stringify(next));
  } catch {
    // no-op
  }
}

async function fetchSpaces(token: string | null): Promise<Space[]> {
  const res = await fetch('/api/v1/spaces', {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error('加载知识库失败');
  return res.json();
}

async function fetchDashboard(token: string | null): Promise<DashboardData> {
  const res = await fetch('/api/v1/dashboard', {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error('加载首页数据失败');
  return res.json();
}

function formatRelativeTime(value?: string): string {
  if (!value) return '-';
  const ts = new Date(value).getTime();
  if (Number.isNaN(ts)) return '-';
  const diff = Date.now() - ts;
  if (diff < 60_000) return '刚刚';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 小时前`;
  return `${Math.floor(diff / 86_400_000)} 天前`;
}

export function HomePage() {
  const { user, token, avatarRevision } = useAuth();
  const navigate = useNavigate();
  const [spaceExpanded, setSpaceExpanded] = useState(false);

  const { data: spaces, isLoading, isError } = useQuery({
    queryKey: ['spaces'],
    queryFn: () => fetchSpaces(token),
  });
  const dashboardQuery = useQuery({
    queryKey: ['dashboard-overview'],
    queryFn: () => fetchDashboard(token),
  });

  useEffect(() => {
    document.title = '首页 - 元体WIKI';
  }, []);

  const sortedSpaces = useMemo(() => {
    const list = [...(spaces ?? [])];
    const lastVisit = readLastVisitMap();
    list.sort((a, b) => {
      const ta = lastVisit[a.id] ?? 0;
      const tb = lastVisit[b.id] ?? 0;
      if (tb !== ta) return tb - ta;
      return a.name.localeCompare(b.name, 'zh-CN');
    });
    return list;
  }, [spaces]);

  const visibleSpaces = spaceExpanded ? sortedSpaces : sortedSpaces.slice(0, 4);
  const hasMoreSpaces = sortedSpaces.length > 4;

  const openSpace = (id: string) => {
    const next = { ...readLastVisitMap(), [id]: Date.now() };
    writeLastVisitMap(next);
    navigate(`/space/${id}`);
  };

  const recentUpdatedItems = (dashboardQuery.data?.recentUpdated ?? []).slice(0, DASHBOARD_RECENT_LIMIT);
  const recentCreatedItems = (dashboardQuery.data?.recentCreated ?? []).slice(0, DASHBOARD_RECENT_LIMIT);

  const dashboardAvatarSrc = useMemo(() => {
    if (!user || !token) return null;
    return userAvatarSrc(
      user.id,
      Boolean(user.hasCustomAvatar),
      token,
      avatarRevision,
    );
  }, [user, token, avatarRevision]);

  return (
    <Layout>
      <div className="dash-header">
        <div className="dash-header-greet">
          {dashboardAvatarSrc ? (
            <img
              src={dashboardAvatarSrc}
              alt=""
              className="dash-header-avatar"
              width={56}
              height={56}
            />
          ) : null}
          <div className="dash-header-text">
            <h1 className="dash-title">欢迎回来，{user?.username ?? ''}</h1>
            <p className="dash-sub">快速查看知识库与文档动态。</p>
          </div>
        </div>
      </div>

      <div className="dash-grid">
        <div className="dash-col">
          <section className="card">
            <div className="card-header">
              <div>
                <div className="card-title">知识库总览</div>
                <div className="card-sub">你有权限访问的知识库</div>
              </div>
            </div>
            <div className="stats-row">
              <div className="stat-pill">
                <span>知识库总数</span>
                <strong>{dashboardQuery.data?.stats.totalSpaces ?? spaces?.length ?? 0}</strong>
              </div>
              <div className="stat-pill">
                <span>文档总数</span>
                <strong>{dashboardQuery.data?.stats.totalPages ?? 0}</strong>
              </div>
              <div className="stat-pill">
                <span>近 7 日编辑</span>
                <strong>{dashboardQuery.data?.stats.edits7d ?? 0}</strong>
              </div>
            </div>

            {isLoading && <p className="card-sub">正在加载知识库...</p>}
            {isError && (
              <p className="error-text">
                加载知识库失败，请稍后重试。
              </p>
            )}
            {!isLoading && !isError && (
              <div className="space-grid">
                {visibleSpaces.map((space) => (
                  <div
                    key={space.id}
                    onClick={() => openSpace(space.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') openSpace(space.id);
                    }}
                    role="button"
                    tabIndex={0}
                    className="space-card"
                  >
                    <div className="icon">
                      <IconFolderSimple />
                    </div>
                    <h3>{space.name}</h3>
                    {space.description && <p className="desc">{space.description}</p>}
                    {!space.description && <p className="desc">暂无描述</p>}
                    <p className="meta">点击进入知识库</p>
                  </div>
                ))}
              </div>
            )}
            {hasMoreSpaces && (
              <button
                type="button"
                className="btn btn-ghost btn-sm space-grid-toggle"
                onClick={() => setSpaceExpanded((v) => !v)}
              >
                {spaceExpanded ? '收起' : `显示更多（+${sortedSpaces.length - 4}）`}
              </button>
            )}
          </section>
        </div>

        <div className="dash-col">
          <section className="card">
            <div className="card-header">
              <div>
                <div className="card-title">最近更新</div>
                <div className="card-sub">最新变更的文档</div>
              </div>
            </div>
            <ul className="list">
              {recentUpdatedItems.map((item) => (
                <li
                  className="list-item"
                  key={`${item.spaceId}-${item.pageId}-u`}
                  role="button"
                  tabIndex={0}
                  onClick={() => navigate(`/space/${item.spaceId}/page/${item.pageId}`)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      navigate(`/space/${item.spaceId}/page/${item.pageId}`);
                    }
                  }}
                >
                  <div className="list-item-main">
                    <p className="list-item-title">{item.title}</p>
                    <p className="list-item-meta">{item.spaceName}</p>
                  </div>
                  <span className="list-item-time">{formatRelativeTime(item.updatedAt)}</span>
                </li>
              ))}
              {recentUpdatedItems.length === 0 && (
                <li className="list-item">
                  <p className="list-item-meta">暂无更新记录</p>
                </li>
              )}
            </ul>
          </section>

          <section className="card">
            <div className="card-header">
              <div>
                <div className="card-title">最近创建</div>
                <div className="card-sub">最新创建的文档</div>
              </div>
            </div>
            <ul className="list">
              {recentCreatedItems.map((item) => (
                <li
                  className="list-item"
                  key={`${item.spaceId}-${item.pageId}-c`}
                  role="button"
                  tabIndex={0}
                  onClick={() => navigate(`/space/${item.spaceId}/page/${item.pageId}`)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      navigate(`/space/${item.spaceId}/page/${item.pageId}`);
                    }
                  }}
                >
                  <div className="list-item-main">
                    <p className="list-item-title">{item.title}</p>
                    <p className="list-item-meta">{item.spaceName}</p>
                  </div>
                  <span className="list-item-time">{formatRelativeTime(item.createdAt)}</span>
                </li>
              ))}
              {recentCreatedItems.length === 0 && (
                <li className="list-item">
                  <p className="list-item-meta">暂无创建记录</p>
                </li>
              )}
            </ul>
          </section>
        </div>
      </div>
    </Layout>
  );
}
