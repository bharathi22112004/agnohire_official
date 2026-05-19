import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Settings, X, Sun, Moon, RotateCcw, Palette } from 'lucide-react';
import { useThemeStore } from '../../store/themeStore';

const TOP_BAR_COLORS = [
  'default', '#134e4a', '#f5f5f4', '#94a3b8', '#94a3b8', '#f87171', '#8b5cf6', '#0ea5e9', 'linear-gradient(to right, #ec4899, #8b5cf6)', 'linear-gradient(to right, #000000, #434343)'
];

const SIDEBAR_COLORS = [
  'default', '#0f172a', '#172554', '#312e81', '#1d4ed8', '#4c1d95', 'linear-gradient(to bottom, #000000, #434343)'
];

const SIDEBAR_IMAGES = [
  '',
  'https://images.unsplash.com/photo-1557683316-973673baf926?q=80&w=200&auto=format&fit=crop', // Purple abstract
  'https://images.unsplash.com/photo-1478760329108-5c3ed9d495a0?q=80&w=200&auto=format&fit=crop', // Dark textured
  'https://images.unsplash.com/photo-1506744626753-143d67b7e283?q=80&w=200&auto=format&fit=crop', // City night
  'https://images.unsplash.com/photo-1518098268026-4e89f1a2cd8e?q=80&w=200&auto=format&fit=crop', // Green aesthetic
  'https://images.unsplash.com/photo-1616046229478-9901c5536a45?q=80&w=200&auto=format&fit=crop'  // Warm abstract
];

const THEME_COLORS = [
  '#f97316', '#3b82f6', '#22c55e', '#8b5cf6', '#ec4899', '#eab308', '#ef4444', '#171717'
];

export function ThemeCustomizer() {
  const [isOpen, setIsOpen] = useState(false);
  const { 
    theme, setTheme,
    themeColor, setThemeColor,
    topBarColor, setTopBarColor,
    sidebarColor, setSidebarColor,
    sidebarBgImage, setSidebarBgImage,
    resetCustomizer
  } = useThemeStore();

  return (
    <>
      {/* Floating Gear Button */}
      <button
        onClick={() => setIsOpen(true)}
        style={{
          position: 'fixed',
          right: 0,
          top: '50%',
          transform: 'translateY(-50%)',
          background: 'var(--color-brand)',
          color: 'white',
          border: 'none',
          padding: '12px 14px 12px 10px',
          borderRadius: '12px 0 0 12px',
          cursor: 'pointer',
          zIndex: 1000,
          boxShadow: '-4px 0 15px rgba(0,0,0,0.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 4, ease: 'linear' }}>
          <Settings size={22} />
        </motion.div>
      </button>

      {/* Backdrop */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsOpen(false)}
            style={{
              position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(2px)', zIndex: 1001
            }}
          />
        )}
      </AnimatePresence>

      {/* Sidebar Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            style={{
              position: 'fixed', top: 0, right: 0, bottom: 0, width: 340,
              background: 'var(--bg-surface)', borderLeft: '1px solid var(--border-color)',
              boxShadow: '-10px 0 30px rgba(0,0,0,0.15)', zIndex: 1002,
              display: 'flex', flexDirection: 'column'
            }}
          >
            {/* Header */}
            <div style={{
              padding: '20px 24px', background: 'var(--bg-card-header)', borderBottom: '1px solid var(--border-color)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center'
            }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>Theme Customizer</h2>
                <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>Choose your themes & layouts etc.</p>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                style={{ background: 'rgba(150,150,150,0.2)', border: 'none', borderRadius: '50%', padding: 6, cursor: 'pointer', display: 'flex' }}
              >
                <X size={16} style={{ color: 'var(--text-primary)' }} />
              </button>
            </div>

            {/* Scrollable Content */}
            <div style={{ flex: 1, overflowY: 'auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 24 }}>
              
              {/* Color Mode */}
              <div>
                <h3 style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 600 }}>Color Mode</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <button
                    onClick={() => setTheme('light')}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', borderRadius: 8,
                      background: 'var(--bg-surface)', cursor: 'pointer',
                      border: theme === 'light' ? '2px solid var(--color-brand)' : '1px solid var(--border-color)',
                      color: 'var(--text-primary)', fontWeight: 500, fontSize: 13
                    }}
                  >
                    <Sun size={16} style={{ color: '#f59e0b' }} /> Light Mode
                  </button>
                  <button
                    onClick={() => setTheme('dark')}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', borderRadius: 8,
                      background: 'var(--bg-surface)', cursor: 'pointer',
                      border: theme === 'dark' ? '2px solid var(--color-brand)' : '1px solid var(--border-color)',
                      color: 'var(--text-primary)', fontWeight: 500, fontSize: 13
                    }}
                  >
                    <Moon size={16} /> Dark Mode
                  </button>
                </div>
              </div>

              {/* Top Bar Color */}
              <div>
                <h3 style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 600 }}>Top Bar Color</h3>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                  {TOP_BAR_COLORS.map((c, i) => (
                    <button
                      key={i}
                      onClick={() => setTopBarColor(c)}
                      style={{
                        width: 36, height: 36, borderRadius: 8, cursor: 'pointer',
                        background: c === 'default' ? '#fff' : c,
                        border: topBarColor === c ? '2px solid var(--color-brand)' : '1px solid var(--border-color)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                      }}
                      title={c}
                    >
                      {c === 'default' && <span style={{ fontSize: 10, color: '#aaa' }}>/</span>}
                    </button>
                  ))}
                  <div style={{ position: 'relative', width: 36, height: 36, borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000', cursor: 'pointer' }} title="Custom Color">
                    <Palette size={14} style={{ color: '#fff' }} />
                    <input 
                      type="color" 
                      onChange={(e) => setTopBarColor(e.target.value)} 
                      style={{ position: 'absolute', inset: 0, opacity: 0, width: '100%', height: '100%', cursor: 'pointer' }}
                    />
                  </div>
                </div>
              </div>

              {/* Sidebar Color */}
              <div>
                <h3 style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 600 }}>Sidebar Color</h3>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                  {SIDEBAR_COLORS.map((c, i) => (
                    <button
                      key={i}
                      onClick={() => setSidebarColor(c)}
                      style={{
                        width: 36, height: 36, borderRadius: 8, cursor: 'pointer',
                        background: c === 'default' ? '#0f172a' : c,
                        border: sidebarColor === c ? '2px solid var(--color-brand)' : '1px solid var(--border-color)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                      }}
                      title={c}
                    >
                      {c === 'default' && <span style={{ fontSize: 10, color: '#fff' }}>/</span>}
                    </button>
                  ))}
                  <div style={{ position: 'relative', width: 36, height: 36, borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000', cursor: 'pointer' }} title="Custom Color">
                    <Palette size={14} style={{ color: '#fff' }} />
                    <input 
                      type="color" 
                      onChange={(e) => setSidebarColor(e.target.value)} 
                      style={{ position: 'absolute', inset: 0, opacity: 0, width: '100%', height: '100%', cursor: 'pointer' }}
                    />
                  </div>
                </div>
              </div>

              {/* Sidebar Background Image */}
              <div>
                <h3 style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 600 }}>Sidebar Background</h3>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                  {SIDEBAR_IMAGES.map((url, i) => (
                    <button
                      key={i}
                      onClick={() => setSidebarBgImage(url)}
                      style={{
                        width: 50, height: 50, borderRadius: 8, cursor: 'pointer',
                        background: url ? `url(${url}) center/cover` : '#e2e8f0',
                        border: sidebarBgImage === url ? '2px solid var(--color-brand)' : '1px solid var(--border-color)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                      }}
                    >
                      {!url && <span style={{ fontSize: 14, color: '#aaa' }}>/</span>}
                    </button>
                  ))}
                </div>
              </div>

              {/* Theme Colors */}
              <div>
                <h3 style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 600 }}>Theme Colors</h3>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                  {THEME_COLORS.map((c, i) => (
                    <button
                      key={i}
                      onClick={() => setThemeColor(c)}
                      style={{
                        width: 32, height: 32, borderRadius: '50%', cursor: 'pointer',
                        background: c,
                        border: themeColor === c ? '3px solid white' : 'none',
                        outline: themeColor === c ? `2px solid ${c}` : 'none',
                      }}
                    />
                  ))}
                  <div style={{ position: 'relative', width: 32, height: 32, borderRadius: '50%', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000', cursor: 'pointer' }} title="Custom Color">
                    <Palette size={14} style={{ color: '#fff' }} />
                    <input 
                      type="color" 
                      onChange={(e) => setThemeColor(e.target.value)} 
                      style={{ position: 'absolute', inset: 0, opacity: 0, width: '100%', height: '100%', cursor: 'pointer' }}
                    />
                  </div>
                </div>
              </div>

            </div>

            {/* Footer */}
            <div style={{ padding: 20, borderTop: '1px solid var(--border-color)', background: 'var(--bg-surface)' }}>
              <button
                onClick={resetCustomizer}
                style={{
                  width: '100%', padding: '12px', background: 'var(--bg-card-header)', border: '1px solid var(--border-color)',
                  borderRadius: 8, color: 'var(--text-primary)', fontWeight: 600, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
                }}
              >
                <RotateCcw size={16} /> Reset
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
