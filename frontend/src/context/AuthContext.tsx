import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';

const TOKEN_KEY = 'yuanti_wiki_token';

export interface User {
  id: string;
  username: string;
  role: string;
  displayName?: string | null;
  email?: string | null;
  /** 是否已上传服务端存储的头像（见 POST /auth/avatar） */
  hasCustomAvatar?: boolean;
  createdAt?: string;
  updatedAt?: string;
  lastLoginAt?: string | null;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  /** 头像 URL 缓存破坏（上传/移除后递增，供顶栏与首页等共用） */
  avatarRevision: number;
}

interface AuthContextValue extends AuthState {
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  setUser: (user: User | null) => void;
  setToken: (token: string | null) => void;
  bumpAvatarRevision: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setTokenState] = useState<string | null>(() =>
    localStorage.getItem(TOKEN_KEY)
  );
  const [isLoading, setIsLoading] = useState(!!token);
  const [avatarRevision, setAvatarRevision] = useState(0);

  const bumpAvatarRevision = useCallback(() => {
    setAvatarRevision((n) => n + 1);
  }, []);

  const setToken = useCallback((t: string | null) => {
    setTokenState(t);
    if (t) localStorage.setItem(TOKEN_KEY, t);
    else localStorage.removeItem(TOKEN_KEY);
  }, []);

  useEffect(() => {
    if (!token) {
      setUser(null);
      setIsLoading(false);
      setAvatarRevision(0);
      return;
    }
    let cancelled = false;
    fetch('/api/v1/auth/me', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => {
        if (!res.ok) throw new Error('Invalid token');
        return res.json();
      })
      .then((data) => {
        if (!cancelled) {
          setUser({
            id: data.id,
            username: data.username,
            role: data.role,
            displayName: data.displayName ?? null,
            email: data.email ?? null,
            hasCustomAvatar: Boolean(data.hasCustomAvatar),
            createdAt: data.createdAt,
            updatedAt: data.updatedAt,
            lastLoginAt: data.lastLoginAt ?? null,
          });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setToken(null);
          setUser(null);
          setAvatarRevision(0);
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token, setToken]);

  const login = useCallback(
    async (username: string, password: string) => {
      const res = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Login failed');
      }
      setToken(data.token);
      setUser({
        id: data.user.id,
        username: data.user.username,
        role: data.user.role,
        displayName: data.user.displayName ?? null,
        email: data.user.email ?? null,
        hasCustomAvatar: Boolean(data.user.hasCustomAvatar),
        createdAt: data.user.createdAt,
        updatedAt: data.user.updatedAt,
        lastLoginAt: data.user.lastLoginAt ?? null,
      });
    },
    [setToken]
  );

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    setAvatarRevision(0);
  }, [setToken]);

  const value: AuthContextValue = {
    user,
    token,
    isLoading,
    avatarRevision,
    login,
    logout,
    setUser,
    setToken,
    bumpAvatarRevision,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
