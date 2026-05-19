import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Calendar, CheckCircle, Clock, Award, Star,
  Play, ShieldAlert, ArrowRight, UserCheck
} from 'lucide-react';
import { KPICard, ChartCard } from '../../components/shared/StatCard';
import { Button } from '../../components/ui/Button';
import { StatusBadge } from '../../components/ui/Badge';
import { CandidateCard } from '../../components/ui/CandidateCard';
import { useAuthStore } from '../../store/authStore';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import toast from 'react-hot-toast';

export default function RecruiterDashboard() {
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  const user = useAuthStore(state => state.user);

  useEffect(() => {
    async function load() {
      try {
        const res = await api.get(`/candidates?limit=1000&recruiterId=${user.id}`);
        setCandidates(res.data.data.candidates || []);
      } catch {
        toast.error('Failed to load recruiter workspace metrics');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [user.id]);

  const scheduled = candidates.filter(c => c.status === 'scheduled').length;
  const completed = candidates.filter(c => ['interviewed', 'passed', 'failed', 'held'].includes(c.status)).length;
  const pending = candidates.filter(c => c.status === 'interviewed').length;

  const kpis = [
    { label: 'Upcoming Appraisals', value: scheduled, icon: Calendar, color: '#f59e0b' },
    { label: 'Completed Assessments', value: completed, icon: CheckCircle, color: '#10b981' },
    { label: 'Awaiting Recruiter Review', value: pending, icon: Clock, color: '#3b82f6' },
    { label: 'Average Candidate Score', value: completed > 0 ? '81.6%' : '0%', icon: Star, color: '#6366f1' }
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Recruiter Workspace</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 4 }}>
            Review candidate voice appraisals, dynamic question performance, and render final hiring choices
          </p>
        </div>
      </div>

      {/* Stats row */}
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

      {/* Pipeline listings */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>
        {/* Candidates queue */}
        <div className="card" style={{ padding: 24 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>Active Evaluation Pipeline</h3>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12 }}>
            {loading ? (
              <div className="skeleton" style={{ height: 100 }} />
            ) : candidates.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>
                No candidates currently assigned to you
              </div>
            ) : (
              candidates.slice(0, 5).map(c => (
                <div key={c.id} style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <div style={{ flex: 1 }}>
                    <CandidateCard candidate={c} />
                  </div>
                  <Link to="/recruiter/review">
                    <Button size="sm" variant="secondary" rightIcon={<ArrowRight size={14} />}>
                      Review
                    </Button>
                  </Link>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Action card */}
        <div className="card" style={{ padding: 24, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>Assessor Guidance</h3>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: '1.6' }}>
              Ensure to evaluate candidate audio responses for professional articulation and logic. Use the Decision Center to render dynamic outcomes: Pass, Fail, or Hold.
            </p>
          </div>

          <div style={{ padding: 16, background: 'var(--bg-card-header)', borderRadius: 12, border: '1px solid var(--border-color)', marginTop: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600 }}>
              <UserCheck size={16} style={{ color: 'var(--color-success)' }} />
              Ready for verification
            </div>
            <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
              You have {pending} candidates waiting for review feedback in your decision dashboard.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
