import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { ResponsiveContainer, LineChart, Line } from 'recharts';

export function KPICard({ label, value, icon: Icon, color = '#3b82f6', trend, trendValue, sparklineData, loading }) {
  if (loading) {
    return (
      <div className="kpi-card">
        <div className="skeleton" style={{ width: 40, height: 40, borderRadius: 10, marginBottom: 16 }} />
        <div className="skeleton" style={{ width: '50%', height: 32, marginBottom: 8 }} />
        <div className="skeleton" style={{ width: '70%', height: 12 }} />
      </div>
    );
  }

  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;
  const trendColor = trend === 'up' ? '#10b981' : trend === 'down' ? '#ef4444' : '#64748b';

  return (
    <motion.div
      className="kpi-card card-hover"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      style={{ display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div className="kpi-label">{label}</div>
          <div className="kpi-value" style={{ marginTop: 8 }}>{value?.toLocaleString() ?? '—'}</div>
        </div>
        <div style={{
          width: 40, height: 40,
          background: `${color}15`,
          borderRadius: 12,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon size={20} style={{ color }} />
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 16, flex: 1 }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          fontSize: 12, color: trendColor, background: `${trendColor}15`, padding: '4px 8px', borderRadius: 20
        }}>
          <TrendIcon size={14} />
          <span style={{ fontWeight: 600 }}>{trendValue || '0%'}</span>
        </div>

        {sparklineData && sparklineData.length > 0 && (
          <div style={{ width: 80, height: 30 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={sparklineData}>
                <Line type="monotone" dataKey="value" stroke={color} strokeWidth={2} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </motion.div>
  );
}

export function ChartCard({ title, subtitle, children, action }) {
  return (
    <div className="chart-card">
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 24,
      }}>
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 600, margin: 0, fontFamily: 'Geist, sans-serif' }}>{title}</h3>
          {subtitle && <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '4px 0 0' }}>{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}
