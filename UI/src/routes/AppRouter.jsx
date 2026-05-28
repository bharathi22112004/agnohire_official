import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ProtectedRoute, RoleGuard, GuestRoute } from './ProtectedRoute';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { AuthLayout } from '../layouts/AuthLayout';
import { Skeleton } from '../components/ui/Skeleton';

// Auth
const Login = lazy(() => import('../pages/auth/Login'));
const ForgotPassword = lazy(() => import('../pages/auth/ForgotPassword'));

// Superadmin
const SuperadminDashboard = lazy(() => import('../pages/superadmin/Dashboard'));
const SuperadminSectors = lazy(() => import('../pages/superadmin/Sectors'));
const SuperadminAuditLogs = lazy(() => import('../pages/superadmin/AuditLogs'));
const SuperadminConfig = lazy(() => import('../pages/superadmin/SystemConfig'));
const SuperadminAnalytics = lazy(() => import('../pages/superadmin/Analytics'));

// Admin
const AdminDashboard = lazy(() => import('../pages/admin/Dashboard'));
const AdminUsers = lazy(() => import('../pages/admin/Users'));
const AdminRecruiterDetails = lazy(() => import('../pages/admin/RecruiterDetails'));
const AdminQuestionBank = lazy(() => import('../pages/admin/QuestionBank'));
const AdminConfig = lazy(() => import('../pages/admin/SystemConfig'));

// HR
const HRDashboard = lazy(() => import('../pages/hr/Dashboard'));
const HRUpload = lazy(() => import('../pages/hr/CandidateUpload'));
const HRAssignment = lazy(() => import('../pages/hr/CandidateAssignment'));
const HREmailTemplates = lazy(() => import('../pages/hr/EmailTemplates'));

// Recruiter
const RecruiterDashboard = lazy(() => import('../pages/recruiter/Dashboard'));
const RecruiterScheduling = lazy(() => import('../pages/recruiter/InterviewScheduling'));
const RecruiterReview = lazy(() => import('../pages/recruiter/InterviewReview'));
const RecruiterQuestionBank = lazy(() => import('../pages/recruiter/QuestionBank'));
const LiveSessionMonitor = lazy(() => import('../modules/recruiter/pages/LiveSessionMonitor'));

// Candidate
const InterviewRoom = lazy(() => import('../pages/candidate/InterviewRoom'));
const InterviewCompletion = lazy(() => import('../pages/candidate/Completion'));

const PageLoader = () => (
  <div style={{ padding: 32 }}>
    <div style={{ display: 'grid', gap: 16 }}>
      <Skeleton style={{ height: 40, width: '30%' }} />
      <Skeleton style={{ height: 200 }} />
    </div>
  </div>
);

export function AppRouter() {
  return (
    <BrowserRouter>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* Auth Routes */}
          <Route element={<AuthLayout />}>
            <Route path="/login" element={<GuestRoute><Login /></GuestRoute>} />
            <Route path="/forgot-password" element={<GuestRoute><ForgotPassword /></GuestRoute>} />
          </Route>

          {/* Superadmin */}
          <Route element={<ProtectedRoute><RoleGuard allowedRoles={['superadmin']}><DashboardLayout /></RoleGuard></ProtectedRoute>}>
            <Route path="/superadmin" element={<SuperadminDashboard />} />
            <Route path="/superadmin/sectors" element={<SuperadminSectors />} />
            <Route path="/superadmin/audit-logs" element={<SuperadminAuditLogs />} />
            <Route path="/superadmin/analytics" element={<SuperadminAnalytics />} />
            <Route path="/superadmin/config" element={<SuperadminConfig />} />
          </Route>

          {/* Admin */}
          <Route element={<ProtectedRoute><RoleGuard allowedRoles={['admin', 'superadmin']}><DashboardLayout /></RoleGuard></ProtectedRoute>}>
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/users" element={<AdminUsers />} />
            <Route path="/admin/recruiters/:id" element={<AdminRecruiterDetails />} />
            <Route path="/admin/question-bank" element={<AdminQuestionBank />} />
            <Route path="/admin/config" element={<AdminConfig />} />
          </Route>

          {/* HR */}
          <Route element={<ProtectedRoute><RoleGuard allowedRoles={['hr', 'admin', 'superadmin']}><DashboardLayout /></RoleGuard></ProtectedRoute>}>
            <Route path="/hr" element={<HRDashboard />} />
            <Route path="/hr/upload" element={<HRUpload />} />
            <Route path="/hr/assignment" element={<HRAssignment />} />
            <Route path="/hr/email-templates" element={<HREmailTemplates />} />
          </Route>

          {/* Recruiter */}
          <Route element={<ProtectedRoute><RoleGuard allowedRoles={['recruiter', 'admin', 'superadmin']}><DashboardLayout /></RoleGuard></ProtectedRoute>}>
            <Route path="/recruiter" element={<RecruiterDashboard />} />
            <Route path="/recruiter/scheduling" element={<RecruiterScheduling />} />
            <Route path="/recruiter/review" element={<RecruiterReview />} />
            <Route path="/recruiter/question-bank" element={<RecruiterQuestionBank />} />
            <Route path="/recruiter/live-monitor" element={<LiveSessionMonitor />} />
          </Route>

          {/* Candidate — Public */}
          <Route path="/interview" element={<InterviewRoom />} />
          <Route path="/interview/complete" element={<InterviewCompletion />} />

          {/* Redirects */}
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/auth/callback" element={<OAuthCallback />} />
          <Route path="/unauthorized" element={<Unauthorized />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

function OAuthCallback() {
  const params = new URLSearchParams(window.location.search);
  const token = params.get('token');
  if (token) {
    // Fetch user and set auth
    import('../services/api').then(({ default: api }) => {
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      api.get('/auth/me').then((res) => {
        import('../store/authStore').then(({ useAuthStore }) => {
          useAuthStore.getState().setAuth(res.data.data.user, token);
          window.location.href = '/';
        });
      });
    });
  }
  return <div style={{ padding: 48, textAlign: 'center' }}>Signing you in...</div>;
}

function Unauthorized() {
  return (
    <div style={{ padding: 48, textAlign: 'center' }}>
      <h1 style={{ fontFamily: 'Syne, sans-serif', fontSize: 48, color: 'var(--color-danger)' }}>403</h1>
      <p style={{ color: 'var(--text-secondary)' }}>You don't have permission to access this page.</p>
    </div>
  );
}

function NotFound() {
  return (
    <div style={{ padding: 48, textAlign: 'center' }}>
      <h1 style={{ fontFamily: 'Syne, sans-serif', fontSize: 48 }}>404</h1>
      <p style={{ color: 'var(--text-secondary)' }}>Page not found.</p>
    </div>
  );
}
