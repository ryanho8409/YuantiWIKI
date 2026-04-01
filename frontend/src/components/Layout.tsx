import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useMemo, useRef, useState, type SVGProps } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { userAvatarSrc } from '../lib/avatarUrl';
import { Copy } from '../constants/copy';
import { ChangePasswordModal } from './ChangePasswordModal';

/** Lucide 风格：Settings（齿轮） */
function IconSettings(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...props}
    >
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export function Layout({ children }: { children: React.ReactNode }) {
  const { user, token, logout, avatarRevision } = useAuth();
  const { mode } = useTheme();
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const menuRef = useRef<HTMLDetailsElement>(null);

  const qFromLocation = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return (params.get('q') ?? '').trim();
  }, [location.search]);

  const [qDraft, setQDraft] = useState(qFromLocation);

  useEffect(() => {
    // 仅当当前处于 /search 路由时同步输入值（避免 Home 等页面反复覆盖草稿）
    if (!location.pathname.startsWith('/search')) return;
    setQDraft(qFromLocation);
  }, [location.pathname, qFromLocation]);

  /** 路由变化时收起齿轮菜单 */
  useEffect(() => {
    if (menuRef.current) menuRef.current.open = false;
  }, [location.pathname, location.search]);

  const onHeaderSearch = () => {
    const q = qDraft.trim();
    if (!q) return;
    navigate(`/search?q=${encodeURIComponent(q)}`);
  };

  const isSystemAdmin = user?.role === 'system_admin';

  const headerAvatarSrc = useMemo(() => {
    if (!user || !token) return null;
    return userAvatarSrc(
      user.id,
      Boolean(user.hasCustomAvatar),
      token,
      avatarRevision,
    );
  }, [user, token, avatarRevision]);

  return (
    <>
      <header className="app-header">
        <Link to="/" className="logo">
          <img
            src={`${import.meta.env.BASE_URL}${mode === 'dark' ? 'logo_dark.png' : 'logo1.png'}`}
            alt=""
            className="brand-logo brand-logo--header"
          />
          元体WIKI
        </Link>
        <div className="nav">
          <input
            type="search"
            placeholder={Copy.layout.searchPlaceholder}
            value={qDraft}
            onChange={(e) => setQDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onHeaderSearch();
            }}
            className="header-search-input"
          />
          <details ref={menuRef} className="header-menu">
            <summary className="header-menu-trigger" aria-label="菜单与设置">
              <IconSettings />
            </summary>
            <div className="header-menu-panel" role="menu">
              {isSystemAdmin && (
                <>
                  <div className="header-menu-group-label">管理</div>
                  <Link
                    to="/admin/users"
                    className="header-menu-item"
                    role="menuitem"
                    onClick={() => {
                      if (menuRef.current) menuRef.current.open = false;
                    }}
                  >
                    用户管理
                  </Link>
                  <Link
                    to="/admin/spaces"
                    className="header-menu-item"
                    role="menuitem"
                    onClick={() => {
                      if (menuRef.current) menuRef.current.open = false;
                    }}
                  >
                    知识库管理
                  </Link>
                  <div className="header-menu-divider" role="separator" aria-hidden />
                </>
              )}
              <div className="header-menu-group-label">设置</div>
              <Link
                to="/settings"
                className="header-menu-item"
                role="menuitem"
                onClick={() => {
                  if (menuRef.current) menuRef.current.open = false;
                }}
              >
                个人设置
              </Link>
              <button
                type="button"
                className="header-menu-item"
                role="menuitem"
                onClick={() => {
                  setChangePasswordOpen(true);
                  if (menuRef.current) menuRef.current.open = false;
                }}
              >
                修改密码
              </button>
            </div>
          </details>
          <span className="user user-with-avatar">
            {headerAvatarSrc ? (
              <img
                src={headerAvatarSrc}
                alt=""
                className="header-user-avatar"
                width={28}
                height={28}
              />
            ) : null}
            <span className="user-name-text">
              {user?.username ?? ''}
              {isSystemAdmin ? Copy.layout.systemAdminSuffix : ''}
            </span>
          </span>
          <button type="button" className="btn btn-ghost" onClick={logout}>
            {Copy.common.signOut}
          </button>
        </div>
      </header>
      <main className="main-wrap">{children}</main>
      <ChangePasswordModal
        open={changePasswordOpen}
        onClose={() => setChangePasswordOpen(false)}
        token={token}
      />
    </>
  );
}
