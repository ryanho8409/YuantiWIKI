import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import type { Location } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { Copy } from '../constants/copy';
import {
  LoginCharacterPanel,
  type LoginCharFocus,
  type LoginCharMood,
} from '../components/LoginCharacterPanel';

const REMEMBER_USERNAME_KEY = 'yuanti-login-remember-username';

/** 登录成功后回跳：保留 pathname + search + hash，与 PrivateRoute 传入的 Location 一致 */
function redirectPathFromState(state: unknown): string {
  const from = (state as { from?: Location })?.from;
  if (!from) return '/';
  return `${from.pathname}${from.search ?? ''}${from.hash ?? ''}`;
}

function IconEyeOpen() {
  return (
    <svg className="login-pw-toggle-icon" viewBox="0 0 24 24" width="20" height="20" aria-hidden>
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"
      />
      <circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

function IconEyeClosed() {
  return (
    <svg className="login-pw-toggle-icon" viewBox="0 0 24 24" width="20" height="20" aria-hidden>
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"
      />
      <line x1="4" y1="4" x2="20" y2="20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [focusField, setFocusField] = useState<LoginCharFocus>('none');
  const [charMood, setCharMood] = useState<LoginCharMood>('idle');
  const [delayRedirect, setDelayRedirect] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [showForgotHint, setShowForgotHint] = useState(false);
  const { user, isLoading, login } = useAuth();
  const { mode } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const redirectTo = useMemo(() => redirectPathFromState(location.state), [location.state]);

  const reducedMotion = useMemo(() => {
    if (typeof window === 'undefined') return true;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, []);

  useEffect(() => {
    if (!isLoading && user && !delayRedirect) navigate(redirectTo, { replace: true });
  }, [user, isLoading, navigate, redirectTo]);

  useEffect(() => {
    document.title = '登录 - 元体WIKI';
  }, []);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(REMEMBER_USERNAME_KEY);
      if (saved) {
        setUsername(saved);
        setRememberMe(true);
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (charMood !== 'error') return;
    const t = window.setTimeout(() => setCharMood('idle'), 1400);
    return () => window.clearTimeout(t);
  }, [charMood]);

  if (isLoading) {
    return (
      <div className="login-page login-page--split">
        <div className="login-card login-card--split login-card--loading-only">{Copy.common.loading}</div>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      try {
        if (rememberMe) {
          localStorage.setItem(REMEMBER_USERNAME_KEY, username.trim());
        } else {
          localStorage.removeItem(REMEMBER_USERNAME_KEY);
        }
      } catch {
        /* ignore */
      }
      await login(username, password);
      // 登录成功：给角色一个“开心弹跳”的短动画窗口，再跳转
      setDelayRedirect(true);
      setCharMood('success');
      window.setTimeout(() => {
        navigate(redirectTo, { replace: true });
      }, 520);
    } catch (err) {
      setCharMood('error');
      setError(err instanceof Error ? err.message : Copy.login.failed);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="login-page login-page--split">
      <div className="login-card login-card--split">
        <div className="login-left-panel" aria-hidden>
          <img
            src={`${import.meta.env.BASE_URL}${mode === 'dark' ? 'logo_dark.png' : 'logo1.png'}`}
            alt="元体智能"
            className="login-left-logo"
            draggable={false}
          />
          <LoginCharacterPanel
            mood={charMood}
            focusField={focusField}
            passwordVisible={showPassword}
            reducedMotion={reducedMotion}
          />
        </div>
        <div className="login-form-panel">
          <h1 className="login-form-title">{Copy.login.welcomeBack}</h1>
          <p className="login-form-sub">{Copy.login.enterDetails}</p>
          <form className="login-form" onSubmit={handleSubmit} noValidate>
            <div className="login-field">
              <label className="login-field-label" htmlFor="login-username">
                {Copy.login.usernameLabel}
              </label>
              <div className="login-field-line-wrap">
                <input
                  id="login-username"
                  name="username"
                  type="text"
                  className="login-field-input"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  onFocus={() => setFocusField('username')}
                  onBlur={() => setFocusField((f) => (f === 'username' ? 'none' : f))}
                  autoComplete="username"
                  required
                  placeholder=" "
                />
              </div>
            </div>
            <div className="login-field">
              <label className="login-field-label" htmlFor="login-password">
                {Copy.login.passwordLabel}
              </label>
              <div className="login-field-line-wrap login-field-line-wrap--password">
                <input
                  id="login-password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  className="login-field-input"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onFocus={() => setFocusField('password')}
                  onBlur={() => setFocusField((f) => (f === 'password' ? 'none' : f))}
                  autoComplete="current-password"
                  required
                  placeholder=" "
                />
                <button
                  type="button"
                  className="login-pw-toggle"
                  aria-label={showPassword ? '隐藏密码' : '显示密码'}
                  onClick={() => setShowPassword((v) => !v)}
                >
                  {showPassword ? <IconEyeClosed /> : <IconEyeOpen />}
                </button>
              </div>
            </div>

            <div className="login-row-options">
              <label className="login-remember">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                />
                <span>{Copy.login.remember30}</span>
              </label>
              <button
                type="button"
                className="login-link-btn"
                onClick={() => setShowForgotHint((v) => !v)}
              >
                {Copy.login.forgotPassword}
              </button>
            </div>
            {showForgotHint && <p className="login-inline-hint">{Copy.login.forgotHint}</p>}

            {error && <p className="error-text login-error">{error}</p>}

            <button type="submit" className="btn btn-primary login-submit login-pill-btn" disabled={submitting}>
              {submitting ? Copy.login.submitting : Copy.login.submit}
            </button>
          </form>
          <p className="login-footer-hint">
            {Copy.login.noAccount} <strong>{Copy.login.contactAdmin}</strong>
          </p>
        </div>
      </div>
    </div>
  );
}
