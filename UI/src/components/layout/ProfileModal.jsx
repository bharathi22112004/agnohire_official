import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { User, Lock, Eye, EyeOff, Check } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { useAuthStore } from '../../store/authStore';
import api from '../../services/api';
import toast from 'react-hot-toast';

const AVATAR_PRESETS = [
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150',
  'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150',
  'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150'
];

export function ProfileModal({ isOpen, onClose }) {
  const { user, updateUser } = useAuthStore();

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // General Form States
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');

  useEffect(() => {
    if (isOpen && user) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setName(user.name || '');
      setEmail(user.email || '');
      setPassword('');
      setAvatarUrl(user.avatarUrl || '');
    }
  }, [isOpen, user]);

  async function handleSave() {
    setLoading(true);
    try {
      const payload = {
        name,
        email,
        avatarUrl,
      };

      if (password) {
        payload.password = password;
      }

      const res = await api.put('/users/profile/update', payload);
      const updatedUser = res.data.data.user;

      // Update local storage and global state
      updateUser(updatedUser);

      toast.success('Profile settings saved successfully!');
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Failed to update profile settings');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="User Profile Settings"
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSave} loading={loading}>
            Save Changes
          </Button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Personal Profile Details</h3>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>Update your display identity, password, and avatar</p>
        </div>

        {/* Avatar Presets Selection */}
        <div>
          <label className="label" style={{ fontSize: 12, fontWeight: 600, marginBottom: 8, display: 'block' }}>Choose Avatar Profile Image:</label>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            {AVATAR_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setAvatarUrl(preset)}
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: '50%',
                  backgroundImage: `url(${preset})`,
                  backgroundSize: 'cover',
                  border: avatarUrl === preset ? '3px solid var(--color-brand)' : '2px solid transparent',
                  cursor: 'pointer',
                  position: 'relative',
                  transition: 'all 0.15s'
                }}
              >
                {avatarUrl === preset && (
                  <div style={{
                    position: 'absolute', right: -2, bottom: -2,
                    background: 'var(--color-brand)', color: 'white',
                    borderRadius: '50%', padding: 2, display: 'flex', alignItems: 'center'
                  }}>
                    <Check size={8} strokeWidth={4} />
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Input
            label="Username"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <Input
            label="Email ID"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        <div style={{ position: 'relative' }}>
          <Input
            label="New Password"
            type={showPassword ? 'text' : 'password'}
            placeholder="Leave blank to keep current password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            style={{
              position: 'absolute', right: 12, top: 38,
              background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)'
            }}
          >
            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>

        <Input
          label="Custom Avatar URL"
          placeholder="https://example.com/avatar.jpg"
          value={avatarUrl}
          onChange={(e) => setAvatarUrl(e.target.value)}
        />
      </div>
    </Modal>
  );
}
