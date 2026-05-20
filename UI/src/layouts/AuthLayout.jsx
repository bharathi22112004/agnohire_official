import { Outlet } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Cpu } from 'lucide-react';

export function AuthLayout() {
  return (
    <div className="auth-shell">
      <div className="auth-brand-panel">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div className="auth-logo-mark">
              <Cpu size={22} />
            </div>
            <span style={{ fontWeight: 800, fontSize: 22, color: 'white' }}>
              AgnoHire
            </span>
          </div>
        </div>

        <div>
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.6 }}
          >
            <h1 style={{
              fontWeight: 800,
              fontSize: 44,
              color: 'white',
              lineHeight: 1.1,
              marginBottom: 18,
            }}>
              AI-Powered<br />Recruitment<br />Platform
            </h1>
            <p style={{ color: 'rgba(255,255,255,0.78)', fontSize: 15, lineHeight: 1.8, maxWidth: 390 }}>
              Streamline your entire hiring pipeline from candidate sourcing to AI-driven interviews and smart validation in one executive workspace.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 32 }}
          >
            {['AI Interviews', 'Smart Scoring', 'Real-time Notifs', 'Multi-role Access'].map((feat) => (
              <span key={feat} style={{
                background: 'rgba(255,255,255,0.13)',
                color: 'rgba(255,255,255,0.9)',
                padding: '6px 14px',
                borderRadius: 9999,
                fontSize: 12,
                fontWeight: 700,
                border: '1px solid rgba(255,255,255,0.18)',
              }}>
                {feat}
              </span>
            ))}
          </motion.div>
        </div>

        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>
          © {new Date().getFullYear()} AgnoHire. All rights reserved.
        </p>
      </div>

      <div className="auth-form-panel">
        <motion.div
          className="auth-form-card"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        >
          <Outlet />
        </motion.div>
      </div>
    </div>
  );
}
