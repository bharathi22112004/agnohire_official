import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Eye, EyeOff, Mail, Lock } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { useAuthStore } from '../../store/authStore';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { useGoogleLogin } from '@react-oauth/google';

export default function Login() {
  const [form, setForm] = useState({ email: '', password: '' });
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const { setAuth } = useAuthStore();
  const navigate = useNavigate();

  function validate() {
    const errs = {};
    if (!form.email) errs.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(form.email)) errs.email = 'Invalid email format';
    if (!form.password) errs.password = 'Password is required';
    setErrors(errs);
    return !Object.keys(errs).length;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);

    try {
      const res = await api.post('/auth/login', form);
      const { user, accessToken } = res.data.data;
      setAuth(user, accessToken);

      const role = user.role?.name;
      const redirectMap = {
        superadmin: '/superadmin',
        admin: '/admin',
        hr: '/hr',
        recruiter: '/recruiter',
        candidate: '/interview',
      };

      toast.success(`Welcome back, ${user.name}!`);
      navigate(redirectMap[role] || '/', { replace: true });
    } catch (err) {
      const msg = err.response?.data?.error?.message || 'Login failed';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  const handleGoogleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      setLoading(true);
      try {
        const { access_token } = tokenResponse;
        const res = await api.post('/auth/google', { accessToken: access_token });
        const { user, accessToken } = res.data.data;
        setAuth(user, accessToken);

        const role = user.role?.name;
        const redirectMap = {
          superadmin: '/superadmin',
          admin: '/admin',
          hr: '/hr',
          recruiter: '/recruiter',
          candidate: '/interview',
        };

        toast.success(`Welcome back, ${user.name}!`);
        navigate(redirectMap[role] || '/', { replace: true });
      } catch (err) {
        const msg = err.response?.data?.error?.message || 'Google login failed';
        toast.error(msg);
      } finally {
        setLoading(false);
      }
    },
    onError: () => {
      toast.error('Google login failed');
    }
  });

  return (
    <div>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 30, fontWeight: 800, marginBottom: 8 }}>
          Welcome back
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
          Sign in to your AgnoHire account
        </p>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Input
          label="Email Address"
          type="email"
          id="login-email"
          placeholder="you@company.com"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          error={errors.email}
          leftIcon={<Mail size={16} />}
        />

        <Input
          label="Password"
          type={showPwd ? 'text' : 'password'}
          id="login-password"
          placeholder="Enter your password"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          error={errors.password}
          leftIcon={<Lock size={16} />}
          rightIcon={
            <button
              type="button"
              onClick={() => setShowPwd(!showPwd)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}
            >
              {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          }
        />

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Link to="/forgot-password" style={{ fontSize: 13, color: 'var(--color-primary-500)', textDecoration: 'none' }}>
            Forgot password?
          </Link>
        </div>

        <Button type="submit" loading={loading} style={{ width: '100%', marginTop: 4 }}>
          Sign In
        </Button>

        {/* Divider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div className="divider" style={{ flex: 1 }} />
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>OR</span>
          <div className="divider" style={{ flex: 1 }} />
        </div>

        {/* Google OAuth */}
        <button
          type="button"
          onClick={() => handleGoogleLogin()}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            padding: '10px 18px',
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-color)',
            borderRadius: 10,
            cursor: 'pointer',
            fontSize: 14,
            fontWeight: 500,
            color: 'var(--text-primary)',
            transition: 'all 0.15s',
          }}
        >
          <svg width="18" height="18" viewBox="0 0 48 48">
            <path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.6 32.6 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 7.9 3l5.7-5.7C34.5 6.5 29.5 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-3.9z"/>
            <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.5 15.8 18.9 12 24 12c3.1 0 5.8 1.1 7.9 3l5.7-5.7C34.5 6.5 29.5 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
            <path fill="#4CAF50" d="M24 44c5.3 0 10.1-2 13.7-5.2l-6.3-5.3C29.5 35.4 26.9 36 24 36c-5.2 0-9.6-3.4-11.2-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/>
            <path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.3 4.1-4.2 5.4l6.3 5.3C37 36.2 44 30 44 24c0-1.3-.1-2.7-.4-3.9z"/>
          </svg>
          Continue with Google
        </button>
      </form>

      {/* Demo credentials */}
      <div style={{
        marginTop: 24,
        padding: 16,
        background: 'var(--bg-surface-2)',
        borderRadius: 10,
        border: '1px solid var(--border-color)',
      }}>
        <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Demo Credentials
        </p>
        {[
          { role: 'Superadmin', email: 'superadmin@agnohire.com', password: 'SuperAdmin@123' },
          { role: 'Admin', email: 'admin@it.agnohire.com', password: 'Admin@123456' },
          { role: 'HR', email: 'hr@it.agnohire.com', password: 'Hr@123456' },
          { role: 'Recruiter', email: 'recruiter@it.agnohire.com', password: 'Recruiter@123' },
        ].map(({ role, email, password }) => (
          <button
            key={role}
            type="button"
            onClick={() => setForm({ email, password })}
            style={{
              display: 'block', width: '100%', textAlign: 'left',
              background: 'none', border: 'none', cursor: 'pointer',
              padding: '4px 0', fontSize: 12, color: 'var(--text-secondary)',
              transition: 'color 0.1s',
            }}
          >
            <span style={{ color: 'var(--color-primary-500)', fontWeight: 600 }}>{role}</span>
            {' - '}{email}
          </button>
        ))}
      </div>
    </div>
  );
}
