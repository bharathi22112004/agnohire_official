import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import toast from 'react-hot-toast';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    // Simulate API call
    await new Promise(r => setTimeout(r, 1000));
    setSent(true);
    toast.success('Reset instructions sent if that email exists.');
    setLoading(false);
  }

  return (
    <div>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontFamily: 'Syne, sans-serif', fontSize: 28, fontWeight: 800, marginBottom: 8 }}>
          Reset Password
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
          Enter your email and we'll send you instructions.
        </p>
      </div>

      {sent ? (
        <div style={{
          padding: 24, background: 'rgba(16,185,129,0.08)', borderRadius: 12,
          border: '1px solid rgba(16,185,129,0.2)', textAlign: 'center',
        }}>
          <p style={{ color: 'var(--color-success)', fontWeight: 600, marginBottom: 8 }}>Email Sent!</p>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
            Check your inbox for password reset instructions.
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Input
            label="Email Address"
            type="email"
            id="forgot-email"
            placeholder="you@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            leftIcon={<Mail size={16} />}
          />
          <Button type="submit" loading={loading} style={{ width: '100%' }}>
            Send Reset Instructions
          </Button>
        </form>
      )}

      <p style={{ textAlign: 'center', marginTop: 24, fontSize: 13, color: 'var(--text-secondary)' }}>
        <Link to="/login" style={{ color: 'var(--color-primary-500)', textDecoration: 'none' }}>
          Back to Sign In
        </Link>
      </p>
    </div>
  );
}
