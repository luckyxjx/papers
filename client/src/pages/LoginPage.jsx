import { useState } from 'react';
import Icon from '../components/Icon';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import * as api from '../api';

const DEMO_USERS = [
  { email: 'alice@ajaia.com', name: 'Alice Chen', role: 'Owner / Tech Lead', color: '#6366f1' },
  { email: 'bob@ajaia.com', name: 'Bob Kim', role: 'Editor / Product Eng', color: '#10b981' },
  { email: 'carol@ajaia.com', name: 'Carol Davis', role: 'Viewer / Designer', color: '#f59e0b' },
];

export default function LoginPage() {
  const { login } = useAuth();
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await api.login(email, password);
      login(data.user, data.token);
      toast.success(`Welcome back, ${data.user.name}!`);
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  function quickLogin(demoEmail) {
    setEmail(demoEmail);
    setPassword('password123');
  }

  return (
    <div className="login-page-light">
      <div className="login-card-light">
        <div className="login-logo-header">
          <Icon name="new-document" size={28} style={{ marginRight: '10px', display: 'inline-block', verticalAlign: 'middle' }} />
          <span className="login-brand-text">Papers</span>
        </div>

        <h1 className="login-title-text">Sign in to your account</h1>
        <p className="login-subtitle-text">
          Lightweight collaborative document editor for your team.
        </p>

        <form className="login-form-inner" onSubmit={handleSubmit}>
          {error && <div className="login-alert-error">{error}</div>}

          <div className="form-field-group">
            <label className="field-label">Email address</label>
            <input
              id="email"
              className="field-input"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="alice@ajaia.com"
              required
              autoFocus
            />
          </div>

          <div className="form-field-group">
            <label className="field-label">Password</label>
            <input
              id="password"
              className="field-input"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>

          <button
            id="login-submit"
            type="submit"
            className="btn btn-primary-mock login-submit-btn"
            disabled={loading}
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <div className="login-demo-accounts">
          <div className="demo-accounts-title">Quick Demo Sign-in (password: password123)</div>
          <div className="demo-users-grid">
            {DEMO_USERS.map(u => (
              <button
                key={u.email}
                type="button"
                className="demo-user-card"
                onClick={() => quickLogin(u.email)}
              >
                <div className="demo-avatar" style={{ backgroundColor: u.color }}>
                  {u.name[0]}
                </div>
                <div className="demo-user-details">
                  <div className="demo-user-name">{u.name}</div>
                  <div className="demo-user-role">{u.role}</div>
                </div>
                <span className="demo-fill-arrow">→</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
