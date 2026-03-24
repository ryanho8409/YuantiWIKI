import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import type { Location } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Copy } from '../constants/copy';

/** 登录成功后回跳：保留 pathname + search + hash，与 PrivateRoute 传入的 Location 一致 */
function redirectPathFromState(state: unknown): string {
  const from = (state as { from?: Location })?.from;
  if (!from) return '/';
  return `${from.pathname}${from.search ?? ''}${from.hash ?? ''}`;
}

export function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { user, isLoading, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const redirectTo = useMemo(() => redirectPathFromState(location.state), [location.state]);

  useEffect(() => {
    if (!isLoading && user) navigate(redirectTo, { replace: true });
  }, [user, isLoading, navigate, redirectTo]);

  useEffect(() => {
    document.title = '登录 - 元体WIKI';
  }, []);

  if (isLoading) {
    return <div className="login-page">{Copy.common.loading}</div>;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await login(username, password);
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : Copy.login.failed);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="login-page">
      <img src="/logo1.png" alt="元体WIKI Logo" className="login-logo-page-corner" />
      <div className="login-card">
        <h1 className="login-brand">
          元体WIKI
        </h1>
        <p className="sub">{Copy.login.subtitle}</p>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>{Copy.login.usernameLabel}</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              required
            />
          </div>
          <div className="form-group">
            <label>{Copy.login.passwordLabel}</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>
          {error && <p className="error-text">{error}</p>}
          <button type="submit" className="btn btn-primary login-submit" disabled={submitting}>
            {submitting ? Copy.login.submitting : Copy.login.submit}
          </button>
        </form>
      </div>
    </div>
  );
}
