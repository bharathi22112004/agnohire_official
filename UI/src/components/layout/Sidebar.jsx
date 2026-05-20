import { useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, Users, Building2, FileText, ClipboardList,
  Calendar, CheckSquare, BookOpen, Mail, Settings, LogOut,
  ChevronLeft, ChevronRight, ShieldAlert,
  Cpu, BarChart3,
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useAuthStore } from '../../store/authStore';
import { useThemeStore } from '../../store/themeStore';
import { useConfigStore } from '../../store/configStore';
import { Avatar } from '../ui/Avatar';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { useEffect } from 'react';

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
          <Cpu size={19} />
        </div>
        <AnimatePresence>
          {!collapsed && (
            <motion.span
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: 'auto' }}
              exit={{ opacity: 0, width: 0 }}
              style={{
                fontWeight: 800, fontSize: 18,
                color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden',
              }}
            >
              {platformName}
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '14px 12px', display: 'flex', flexDirection: 'column', gap: '7px', overflowY: 'auto', overflowX: 'hidden' }}>
        {!collapsed && (
          <div style={{ padding: '8px 8px 4px', marginBottom: 4 }}>
            <span className={`badge badge-role-${role?.toLowerCase() || 'candidate'}`}>
              {role?.toUpperCase()}
            </span>
          </div>
        )}

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
        borderTop: '1px solid var(--border-color)',
        padding: '12px 12px',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}>
        {/* User row */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '8px 8px', borderRadius: 8, overflow: 'hidden',
          background: 'var(--bg-surface-2)',
          border: '1px solid var(--border-color)',
        }}>
          <Avatar name={user?.name} src={user?.avatarUrl} size="sm" />
          <AnimatePresence>
            {!collapsed && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                style={{ flex: 1, overflow: 'hidden', minWidth: 0 }}
              >
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {user?.name}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                  {role}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

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
