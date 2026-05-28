import { useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, Users, Building2, FileText, ClipboardList,
  Calendar, CheckSquare, BookOpen, Mail, Settings, LogOut,
  ChevronLeft, ChevronRight, ShieldAlert,
  Target, BarChart3,
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useThemeStore } from '../../store/themeStore';
import { useConfigStore } from '../../store/configStore';
import { Avatar } from '../ui/Avatar';
import api from '../../services/api';
import toast from 'react-hot-toast';

const navConfig = {
  superadmin: [
    { path: '/superadmin', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/superadmin/sectors', icon: Building2, label: 'Sectors' },
    { path: '/superadmin/audit-logs', icon: ShieldAlert, label: 'Audit Logs' },
    { path: '/superadmin/analytics', icon: BarChart3, label: 'Analytics' },
    { path: '/superadmin/config', icon: Settings, label: 'System Config' },
  ],
  admin: [
    { path: '/admin', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/admin/users', icon: Users, label: 'User Management' },
    { path: '/admin/question-bank', icon: BookOpen, label: 'Question Bank' },
    { path: '/admin/config', icon: Settings, label: 'Configuration' },
  ],
  hr: [
    { path: '/hr', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/hr/upload', icon: FileText, label: 'Candidate Upload' },
    { path: '/hr/assignment', icon: ClipboardList, label: 'Assignment' },
    { path: '/hr/schedule', icon: Calendar, label: 'Schedule Management' },
    { path: '/hr/email-templates', icon: Mail, label: 'Email Templates' },
  ],
  recruiter: [
    { path: '/recruiter', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/recruiter/scheduling', icon: Calendar, label: 'Interview Scheduling' },
    { path: '/recruiter/review', icon: CheckSquare, label: 'Review & Validate' },
    { path: '/recruiter/question-bank', icon: BookOpen, label: 'Question Bank' },
  ],
};

export function Sidebar({ collapsed, onToggle }) {
  const { user, clearAuth } = useAuthStore();
  const role = user?.role?.name;
  const navItems = navConfig[role] || [];
  const navigate = useNavigate();
  const { fetchConfigs } = useConfigStore();
  const platformName = useConfigStore(state => state.configs['platform_name'] || 'AgnoHire');

  useEffect(() => {
    fetchConfigs();
  }, [fetchConfigs]);

  async function handleLogout() {
    try {
      await api.post('/auth/logout');
    } catch {
      // Logout should continue locally even if the server session is already gone.
    }
    clearAuth();
    navigate('/login');
    toast.success('Logged out successfully');
  }

  return (
    <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
      {/* Logo */}
      <div style={{
        height: 72, display: 'flex', alignItems: 'center', padding: '0 18px',
        borderBottom: '1px solid var(--border-color)', gap: 12, overflow: 'hidden',
      }}>
        <div className="sidebar-logo-mark">
          <Target size={19} />
        </div>
        <AnimatePresence>
          {!collapsed && (
            <motion.span
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: 'auto' }}
              exit={{ opacity: 0, width: 0 }}
              style={{
                fontWeight: 800, fontSize: 18,
                color: '#ffffff', whiteSpace: 'nowrap', overflow: 'hidden',
              }}
            >
              {platformName}
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '14px 12px', display: 'flex', flexDirection: 'column', gap: '7px', overflowY: 'auto', overflowX: 'hidden' }}>


        {navItems.map(({ path, icon: Icon, label }) => (
          <NavLink
            key={path}
            to={path}
            end={path.split('/').length === 2}
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            title={collapsed ? label : undefined}
            style={{ width: '100%', justifyContent: collapsed ? 'center' : 'flex-start' }}
          >
            <Icon size={20} className="nav-icon" style={{ flexShrink: 0 }} />
            <AnimatePresence>
              {!collapsed && (
                <motion.span
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  style={{ whiteSpace: 'nowrap' }}
                >
                  {label}
                </motion.span>
              )}
            </AnimatePresence>
          </NavLink>
        ))}
      </nav>

      {/* User + Collapse */}
      <div style={{
        borderTop: '1px solid rgba(255, 255, 255, 0.08)',
        padding: '12px 12px',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}>
        {/* User row */}
        {!collapsed ? (
          <div style={{
            padding: '4px 8px 8px',
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
            alignItems: 'flex-start'
          }}>
            <span style={{
              background: '#fae8ff',
              color: '#86198f',
              fontSize: 11,
              fontWeight: 700,
              padding: '2px 10px',
              borderRadius: 9999,
              display: 'inline-block'
            }}>
              {role === 'superadmin' ? 'Super Admin' : role === 'admin' ? 'Admin' : role === 'hr' ? 'HR Manager' : role === 'recruiter' ? 'Recruiter' : 'Candidate'}
            </span>
            <div style={{ fontSize: 11, color: '#94a3b8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: '100%' }}>
              {user?.email || 'superadmin@agnohire.com'}
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '4px 0' }}>
            <Avatar name={user?.name} src={user?.avatarUrl} size="sm" />
          </div>
        )}

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="nav-item"
          title={collapsed ? 'Logout' : undefined}
          style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', justifyContent: collapsed ? 'center' : 'flex-start' }}
        >
          <LogOut size={18} style={{ flexShrink: 0, color: 'var(--color-danger)' }} />
          <AnimatePresence>
            {!collapsed && (
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                style={{ color: 'var(--color-danger)', whiteSpace: 'nowrap' }}
              >
                Logout
              </motion.span>
            )}
          </AnimatePresence>
        </button>

        {/* Collapse toggle */}
        <button
          onClick={onToggle}
          className="nav-item"
          style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', justifyContent: collapsed ? 'center' : 'flex-start' }}
        >
          {collapsed ? <ChevronRight size={18} style={{ flexShrink: 0 }} /> : <><ChevronLeft size={18} style={{ flexShrink: 0 }} /><span>Collapse</span></>}
        </button>
      </div>
    </aside>
  );
}
