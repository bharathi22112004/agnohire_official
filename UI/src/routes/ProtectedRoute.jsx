import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

export function ProtectedRoute({ children }) {
  const { isAuthenticated } = useAuthStore();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return children;
}

export function RoleGuard({ allowedRoles, children }) {
  const { user } = useAuthStore();
  const role = user?.role?.name;
  if (!allowedRoles.includes(role)) {
    return <Navigate to="/unauthorized" replace />;
  }
  return children;
}

export function GuestRoute({ children }) {
  const { isAuthenticated, user } = useAuthStore();
  if (isAuthenticated) {
    const role = user?.role?.name;
    const redirectMap = {
      superadmin: '/superadmin',
      admin: '/admin',
      hr: '/hr',
      recruiter: '/recruiter',
      candidate: '/interview',
    };
    return <Navigate to={redirectMap[role] || '/'} replace />;
  }
  return children;
}
