import { Outlet } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Cpu } from 'lucide-react';
import { useThemeStore } from '../store/themeStore';

export function AuthLayout() {
  const { theme, toggleTheme } = useThemeStore();

  return (
    <div style={{
      minHeight: '100vh',
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      background: 'var(--bg-base)',
    }}>
      {/* Left panel — brand */}
      <div style={{
        background: 'linear-gradient(135deg, var(--color-primary-600) 0%, var(--color-primary-950) 100%)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: 48,
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Background pattern */}
        <div style={{
          position: 'absolute', inset: 0, opacity: 0.08,
          backgroundImage: `radial-gradient(circle at 20% 50%, white 1px, transparent 1px),
            radial-gradient(circle at 80% 50%, white 1px, transparent 1px)`,
          backgroundSize: '60px 60px',
        }} />

        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 40, height: 40, background: 'rgba(255,255,255,0.2)',
              borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Cpu size={22} color="white" />
            </div>
            <span style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 22, color: 'white' }}>
              AgnoHire
            </span>
          </div>
        </div>

        <div style={{ position: 'relative', zIndex: 1 }}>
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.6 }}
          >
            <h1 style={{
              fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 40,
              color: 'white', lineHeight: 1.2, marginBottom: 16,
            }}>
              AI-Powered<br />Recruitment<br />Platform
            </h1>
            <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: 15, lineHeight: 1.7, maxWidth: 360 }}>
              Streamline your entire hiring pipeline — from candidate sourcing to AI-driven interviews and smart validation — all in one intelligent system.
            </p>
          </motion.div>

          {/* Feature pills */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 32 }}
          >
            {['AI Interviews', 'Smart Scoring', 'Real-time Notifs', 'Multi-role Access'].map((feat) => (
              <span key={feat} style={{
                background: 'rgba(255,255,255,0.15)',
                color: 'rgba(255,255,255,0.9)',
                padding: '6px 14px',
                borderRadius: 999,
                fontSize: 12,
                fontWeight: 600,
                backdropFilter: 'blur(8px)',
              }}>
                {feat}
              </span>
            ))}
          </motion.div>
        </div>

        <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, position: 'relative', zIndex: 1 }}>
          © {new Date().getFullYear()} AgnoHire. All rights reserved.
        </p>
      </div>

      {/* Right panel — form */}
      <div style={{
        display: 'flex', flexDirection: 'column',
        justifyContent: 'center', alignItems: 'center',
        padding: '48px 64px',
        position: 'relative',
      }}>
        <motion.div
          style={{ width: '100%', maxWidth: 400 }}
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
