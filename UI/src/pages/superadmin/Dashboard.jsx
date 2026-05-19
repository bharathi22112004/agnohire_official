import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area, Legend,
} from 'recharts';
import {
  Building2, Users, BriefcaseIcon, UserCheck, FileText,
  TrendingUp, Activity, Download,
} from 'lucide-react';
import { KPICard, ChartCard } from '../../components/shared/StatCard';
import { Button } from '../../components/ui/Button';
import api from '../../services/api';

const COLORS = ['#6366f1', '#10b981', '#f43f5e', '#f59e0b', '#0ea5e9'];

export default function SuperadminDashboard() {
  const [stats, setStats] = useState(null);
  const [trends, setTrends] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [statsRes, trendsRes] = await Promise.all([
          api.get('/analytics/global'),
          api.get('/analytics/trends?days=30'),
        ]);
        setStats(statsRes.data.data.stats);
        setTrends(trendsRes.data.data.trends);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const kpis = [
    { label: 'Total Sectors', value: stats?.sectors, icon: Building2, color: '#6366f1' },
    { label: 'Total Admins', value: stats?.admins, icon: Users, color: '#0ea5e9' },
    { label: 'Total HRs', value: stats?.hrs, icon: UserCheck, color: '#10b981' },
    { label: 'Recruiters', value: stats?.recruiters, icon: BriefcaseIcon, color: '#f59e0b' },
    { label: 'Candidates', value: stats?.candidates, icon: FileText, color: '#f43f5e' },
    { label: 'Interviews Done', value: stats?.interviews?.total, icon: Activity, color: '#8b5cf6' },
  ];

  const pieData = [
    { name: 'Passed', value: stats?.interviews?.passed || 0 },
    { name: 'Failed', value: stats?.interviews?.failed || 0 },
    { name: 'Held', value: stats?.interviews?.held || 0 },
  ];

  return (
    <div>
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Platform Overview</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 4 }}>
            Real-time platform analytics and insights
          </p>
        </div>
        <Button variant="secondary" leftIcon={<Download size={15} />}>
          Export Report
        </Button>
      </div>

      {/* KPI Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: 16,
        marginBottom: 24,
      }}>
        {kpis.map((kpi, i) => (
          <motion.div
            key={kpi.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}
          >
            <KPICard {...kpi} loading={loading} />
          </motion.div>
        ))}
      </div>

      {/* Charts Row */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16, marginBottom: 24 }}>
        <ChartCard title="Interview Trends" subtitle="Last 30 days">
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={trends}>
              <defs>
                <linearGradient id="grad-total" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="grad-pass" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
              <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
              <Tooltip
                contentStyle={{
                  background: 'var(--bg-surface)', border: '1px solid var(--border-color)',
                  borderRadius: 10, fontSize: 12,
                }}
              />
              <Legend />
              <Area type="monotone" dataKey="total" stroke="#6366f1" fill="url(#grad-total)" name="Total" />
              <Area type="monotone" dataKey="passed" stroke="#10b981" fill="url(#grad-pass)" name="Passed" />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Interview Outcomes">
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={90}
                paddingAngle={4}
                dataKey="value"
              >
                {pieData.map((_, index) => (
                  <Cell key={index} fill={COLORS[index]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  background: 'var(--bg-surface)', border: '1px solid var(--border-color)',
                  borderRadius: 10, fontSize: 12,
                }}
              />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Recent Activity */}
      <div className="card" style={{ padding: 24 }}>
        <h3 className="section-title" style={{ marginBottom: 16 }}>Recent Platform Activity</h3>
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="skeleton" style={{ height: 44 }} />
            ))}
          </div>
        ) : (
          <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 32 }}>
            <Activity size={32} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
            <p>Activity feed coming from audit logs</p>
          </div>
        )}
      </div>
    </div>
  );
}
