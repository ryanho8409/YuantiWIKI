import { useEffect, useState, type FormEvent } from 'react';

type Props = {
  open: boolean;
  onClose: () => void;
  token: string | null;
};

export function ChangePasswordModal({ open, onClose, token }: Props) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setError('');
    setSuccess(false);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (!token) {
      setError('未登录或会话已失效');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('两次输入的新密码不一致');
      return;
    }
    if (newPassword.length < 6) {
      setError('新密码长度至少为 6 位');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/v1/auth/change-password', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.message || '修改密码失败');
      }
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        onClose();
      }, 1200);
    } catch (err) {
      setError((err as Error)?.message || '修改密码失败');
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <>
      <div className="overlay show change-password-overlay" role="presentation" onClick={onClose} />
      <div
        className="change-password-modal"
        role="dialog"
        aria-labelledby="change-password-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="change-password-title" className="change-password-title">
          修改密码
        </h2>
        <p className="change-password-hint">
          请使用当前密码验证身份后设置新密码，建议使用更复杂的密码以保护账号安全。
        </p>
        <form onSubmit={handleSubmit} className="change-password-form">
          <label className="change-password-label">
            <span>当前密码</span>
            <input
              type="password"
              className="header-search-input change-password-input"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
            />
          </label>
          <label className="change-password-label">
            <span>新密码</span>
            <input
              type="password"
              className="header-search-input change-password-input"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
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
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={6}
            />
          </label>
          {error && <p className="error-text change-password-error">{error}</p>}
          {success && <p className="change-password-success">密码已更新</p>}
          <div className="change-password-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={submitting}>
              取消
            </button>
            <button type="submit" className="btn btn-primary" disabled={submitting || success}>
              {submitting ? '提交中...' : '确认修改'}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
