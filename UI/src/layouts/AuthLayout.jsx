import { Outlet } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Target } from 'lucide-react';

export function AuthLayout() {
  return (
    <div className="auth-shell">
      <div className="auth-brand-panel" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center', position: 'relative' }}>
        {/* Floating background decorative circles */}
        <div style={{ position: 'absolute', inset: 0, opacity: 0.12, pointerEvents: 'none', zIndex: 0 }}>
          <div style={{ position: 'absolute', top: '10%', left: '10%', width: 120, height: 120, borderRadius: '50%', backgroundColor: 'white' }} />
          <div style={{ position: 'absolute', bottom: '20%', right: '8%', width: 180, height: 180, borderRadius: '50%', backgroundColor: 'white' }} />
          <div style={{ position: 'absolute', top: '50%', left: '33%', width: 80, height: 80, borderRadius: '50%', backgroundColor: 'white' }} />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}
        >
          {/* Logo and platform name horizontally side-by-side */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
            <div style={{
              width: 54, height: 54,
              borderRadius: 14,
              background: 'rgba(255, 255, 255, 0.2)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid rgba(255, 255, 255, 0.3)'
            }}>
              <Target size={30} color="white" />
            </div>
            <h1 style={{
              fontWeight: 800,
              fontSize: 36,
              color: 'white',
              lineHeight: 1,
              letterSpacing: '-0.02em',
              margin: 0
            }}>
              AgnoHire
            </h1>
          </div>
          <p style={{ color: 'rgba(255, 255, 255, 0.9)', fontSize: 18, fontWeight: 500, marginBottom: 20 }}>
            AI-Powered Recruitment Platform
          </p>
          <p style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: 14, lineHeight: 1.7, maxWidth: 360, margin: '0 auto' }}>
            Streamline your hiring process with intelligent candidate screening, automated interviews, and data-driven decisions.
          </p>
        </motion.div>
      </div>

      <div className="auth-form-panel">
        <motion.div
          className="auth-form-card"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          style={{ border: 'none', boxShadow: 'none', background: 'transparent' }}
        >
          <Outlet />
        </motion.div>
      </div>
    </div>
  );
}

export default AuthLayout;
