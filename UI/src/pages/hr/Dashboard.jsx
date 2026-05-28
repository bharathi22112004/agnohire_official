import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Users, BriefcaseIcon, FileText, CheckCircle, Clock, ArrowRight } from 'lucide-react';
import { KPICard, ChartCard } from '../../components/shared/StatCard';
import { Button } from '../../components/ui/Button';
import { useAuthStore } from '../../store/authStore';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import toast from 'react-hot-toast';

export default function HRDashboard() {
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  const currentUser = useAuthStore(state => state.user);

  useEffect(() => {
    async function load() {
      try {
        const res = await api.get('/candidates?limit=100');
        setCandidates(res.data.data.candidates || []);
      } catch {
        toast.error('Failed to load HR metrics');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const total = candidates.length;
  const pending = candidates.filter(c => c.status === 'pending').length;
  const assigned = candidates.filter(c => c.status === 'assigned').length;
  const interviewed = candidates.filter(c => ['interviewed', 'passed', 'failed', 'held'].includes(c.status)).length;

  const kpis = [
    { label: 'Total Candidates', value: total, icon: Users, color: '#6366f1' },
    { label: 'Pending Assignment', value: pending, icon: Clock, color: '#f59e0b' },
    { label: 'Assigned to Recruiters', value: assigned, icon: BriefcaseIcon, color: '#0ea5e9' },
    { label: 'Interviews Administered', value: interviewed, icon: CheckCircle, color: '#10b981' }
  ];

  const quickLinks = [
    { title: 'Bulk Import Candidates', desc: 'Onboard candidates using CSV sheets', to: '/hr/upload', btn: 'Upload CSV' },
    { title: 'Allocate Workload', desc: 'Equally distribute candidates among recruiters', to: '/hr/assignment', btn: 'Go to Assignment' },
    { title: 'Transactional Emails', desc: 'Customize invite, pass, fail, hold templates', to: '/hr/email-templates', btn: 'Edit Templates' }
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">HR Operations Dashboard</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 4 }}>
            Coordinate candidate onboarding, recruiter allocations, and interview tracking for {currentUser?.sector?.name || 'your assigned sector'}
          </p>
        </div>
      </div>

      {/* KPI stats */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: 16,
        marginBottom: 24
      }}>
        {kpis.map((kpi, i) => (
          <motion.div
            key={kpi.label}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
          >
            <KPICard {...kpi} loading={loading} />
          </motion.div>
        ))}
      </div>

      {/* Grid quick actions */}
      <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>Recruitment Workflows</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
        {quickLinks.map((link, idx) => (
          <motion.div
            key={link.title}
            className="card"
            style={{ padding: 20, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: 150 }}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.06 }}
          >
            <div>
              <h4 style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>{link.title}</h4>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>{link.desc}</p>
            </div>

            <div style={{ marginTop: 16 }}>
              <Link to={link.to}>
                <Button size="sm" variant="secondary" rightIcon={<ArrowRight size={13} style={{ marginLeft: 4 }} />}>
                  {link.btn}
                </Button>
              </Link>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
