import { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Header } from '../components/layout/Header';
import { Sidebar } from '../components/layout/Sidebar';
import { ThemeCustomizer } from '../components/layout/ThemeCustomizer';
import { socketService } from '../services/socket.service';
import { useAuthStore } from '../store/authStore';

export function DashboardLayout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { user } = useAuthStore();

  useEffect(() => {
    // Connect socket for non-candidates
    if (user && user.role?.name !== 'candidate') {
      socketService.connect();
    }
    return () => {};
  }, [user]);

  return (
    <div className="app-shell">
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
      />
      <div className={`main-content ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
        <Header onMenuToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />
        <motion.main
          className="page-content"
          key={location.pathname}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        >
          <Outlet />
        </motion.main>
      </div>
      <ThemeCustomizer />
    </div>
  );
}
