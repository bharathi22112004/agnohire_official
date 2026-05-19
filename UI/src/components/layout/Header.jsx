import { useState, useRef, useEffect } from 'react';
import { Bell, Moon, Sun, Search, Menu } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useThemeStore } from '../../store/themeStore';
import { useNotificationStore } from '../../store/notificationStore';
import { useAuthStore } from '../../store/authStore';
import { Avatar } from '../ui/Avatar';
import { formatRelativeTime } from '../../utils/cn';
import { ProfileModal } from './ProfileModal';
import { useLocation } from 'react-router-dom';
import api from '../../services/api';

export function Header({ onMenuToggle }) {
  const location = useLocation();
  const { theme, toggleTheme } = useThemeStore();
  const { notifications, unreadCount, markRead, markAllRead } = useNotificationStore();
  const { user, clearAuth } = useAuthStore();
  const [showNotif, setShowNotif] = useState(false);
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const notifRef = useRef(null);
  const userDropdownRef = useRef(null);

  useEffect(() => {
    // Load notifications on mount
    if (user && user.role?.name !== 'candidate') {
      api.get('/notifications?limit=10').then((res) => {
        const { notifications, unreadCount } = res.data.data;
        useNotificationStore.getState().setNotifications(notifications, unreadCount);
      }).catch(() => {});
    }
  }, [user]);

  useEffect(() => {
    function handleClick(e) {
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setShowNotif(false);
      }
      if (userDropdownRef.current && !userDropdownRef.current.contains(e.target)) {
        setShowUserDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  async function handleMarkAllRead() {
    await api.put('/notifications/read-all').catch(() => {});
    markAllRead();
  }

  const isCandidate = user?.role?.name === 'candidate';

  return (
    <header className="header">
      {/* Mobile menu toggle */}
      <button
        onClick={onMenuToggle}
        className="btn btn-ghost btn-icon"
        style={{ display: 'none' }} // Show on mobile via media query in CSS
        id="mobile-menu-btn"
      >
        <Menu size={20} />
      </button>

      {/* Breadcrumb / Location path */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 500, color: 'var(--text-muted)' }}>
        <span style={{ textTransform: 'capitalize' }}>{user?.role?.name || 'Home'}</span>
        {location.pathname.split('/').filter(Boolean).slice(1).map(part => (
          <div key={part} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>/</span>
            <span style={{ color: 'var(--text-primary)', textTransform: 'capitalize' }}>{part.replace('-', ' ')}</span>
          </div>
        ))}
      </div>

      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
        {/* Theme toggle */}
        <button onClick={toggleTheme} className="btn btn-ghost btn-icon" title="Toggle theme">
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        {/* Notifications — only for non-candidates */}
        {!isCandidate && (
          <div style={{ position: 'relative' }} ref={notifRef}>
            <button
              onClick={() => setShowNotif(!showNotif)}
              className="btn btn-ghost btn-icon"
              style={{ position: 'relative' }}
              title="Notifications"
            >
              <Bell size={18} />
              {unreadCount > 0 && (
                <span
                  style={{
                    position: 'absolute', top: 4, right: 4,
                    background: 'var(--color-danger)', color: 'white',
                    borderRadius: '50%', width: 16, height: 16,
                    fontSize: 10, fontWeight: 700,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    border: '2px solid var(--bg-surface)',
                  }}
                >
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            <AnimatePresence>
              {showNotif && (
                <motion.div
                  className="dropdown"
                  style={{
                    position: 'absolute', right: 0, top: 'calc(100% + 8px)',
                    width: 360, maxHeight: 480, overflowY: 'auto', zIndex: 200,
                  }}
                  initial={{ opacity: 0, y: -8, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                >
                  <div style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '10px 12px 8px', borderBottom: '1px solid var(--border-color)',
                  }}>
                    <span style={{ fontSize: 14, fontWeight: 700 }}>Notifications</span>
                    {unreadCount > 0 && (
                      <button
                        onClick={handleMarkAllRead}
                        style={{ fontSize: 12, color: 'var(--color-primary-500)', background: 'none', border: 'none', cursor: 'pointer' }}
                      >
                        Mark all read
                      </button>
                    )}
                  </div>

                  {notifications.length === 0 ? (
                    <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                      No notifications
                    </div>
                  ) : (
                    notifications.slice(0, 10).map((n) => (
                      <div
                        key={n.id}
                        onClick={() => {
                          if (!n.isRead) {
                            api.put(`/notifications/${n.id}/read`).catch(() => {});
                            markRead(n.id);
                          }
                        }}
                        style={{
                          padding: '12px 12px',
                          borderBottom: '1px solid var(--border-color)',
                          cursor: 'pointer',
                          background: n.isRead ? 'transparent' : 'rgba(99,102,241,0.04)',
                          transition: 'background 0.1s',
                        }}
                      >
                        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                          {!n.isRead && (
                            <div style={{
                              width: 8, height: 8, background: 'var(--color-primary-500)',
                              borderRadius: '50%', flexShrink: 0, marginTop: 4,
                            }} />
                          )}
                          <div style={{ flex: 1 }}>
                            <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                              {n.title}
                            </p>
                            <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '2px 0 0' }}>
                              {n.message}
                            </p>
                            <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '4px 0 0' }}>
                              {formatRelativeTime(n.createdAt)}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* User avatar & dropdown */}
        <div style={{ position: 'relative' }} ref={userDropdownRef}>
          <button
            onClick={() => setShowUserDropdown(!showUserDropdown)}
            style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}
          >
            <Avatar name={user?.name} src={user?.avatarUrl} size="sm" />
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }} className="hide-mobile">
              {user?.name || 'User'}
            </span>
          </button>

          <AnimatePresence>
            {showUserDropdown && (
              <motion.div
                className="dropdown"
                style={{
                  position: 'absolute', right: 0, top: 'calc(100% + 8px)',
                  width: 220, zIndex: 200, padding: 8, display: 'flex', flexDirection: 'column', gap: 4
                }}
                initial={{ opacity: 0, y: -8, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.95 }}
                transition={{ duration: 0.15 }}
              >
                {/* User Info Header */}
                <div style={{ padding: '6px 12px 10px', borderBottom: '1px solid var(--border-color)', marginBottom: 4 }}>
                  <p style={{ fontSize: 13, fontWeight: 700, margin: 0, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {user?.name}
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                    <span className={`badge badge-role-${user?.role?.name?.toLowerCase() || 'candidate'}`} style={{ fontSize: 10, padding: '2px 8px' }}>
                      {user?.role?.name}
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      • {user?.sector?.name || 'System'}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => {
                    setShowUserDropdown(false);
                    setShowProfileModal(true);
                  }}
                  className="btn btn-ghost btn-block"
                  style={{ justifyContent: 'flex-start', fontSize: 12, padding: '8px 12px', fontWeight: 600, borderRadius: 8, border: 'none', cursor: 'pointer', background: 'transparent', textAlign: 'left' }}
                >
                  Profile & SMTP settings
                </button>

                <button
                  onClick={() => {
                    clearAuth();
                    window.location.reload();
                  }}
                  className="btn btn-ghost btn-block"
                  style={{ justifyContent: 'flex-start', fontSize: 12, padding: '8px 12px', fontWeight: 600, borderRadius: 8, color: 'var(--color-danger)', border: 'none', cursor: 'pointer', background: 'transparent', textAlign: 'left' }}
                >
                  Logout
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Profile settings modal */}
        <ProfileModal isOpen={showProfileModal} onClose={() => setShowProfileModal(false)} />
      </div>
    </header>
  );
}
