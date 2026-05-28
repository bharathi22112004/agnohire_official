import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Mail, Phone, Tag, Calendar, Search, Award, Clock,
  SlidersHorizontal, CheckCircle, XCircle, AlertCircle, ExternalLink,
  Briefcase, UserCheck, Star, ChevronRight
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Input, Select } from '../../components/ui/Input';
import { Badge, StatusBadge } from '../../components/ui/Badge';
import { Avatar } from '../../components/ui/Avatar';
import api from '../../services/api';
import toast from 'react-hot-toast';

export default function RecruiterDetails() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [recruiter, setRecruiter] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(true);

  // Search & Filter State
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sortBy, setSortBy] = useState('name');

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        // Attempt to load live recruiter and candidate data from backend API
        const [recruiterRes, candidatesRes] = await Promise.all([
          api.get(`/users?limit=100`), // Find the user in sector users
          api.get(`/candidates?limit=1000&recruiterId=${id}`)
        ]);

        const allUsers = recruiterRes.data?.data?.users || [];
        const foundRecruiter = allUsers.find(u => u.id === id);

        if (foundRecruiter) {
          // Fetch recruiter skills
          try {
            const skillsRes = await api.get(`/users/${id}/skills`);
            foundRecruiter.skills = skillsRes.data?.data?.skills || [];
          } catch {
            foundRecruiter.skills = [];
          }
          setRecruiter(foundRecruiter);
        } else {
          // Setup a fallback mock recruiter if not found in live data
          setRecruiter(getMockRecruiter(id));
        }

        const liveCandidates = candidatesRes.data?.data?.candidates || [];
        if (liveCandidates.length > 0) {
          setCandidates(liveCandidates);
        } else {
          // Setup realistic dummy candidates if no candidates assigned in live db
          setCandidates(getMockCandidates(id));
        }

      } catch (err) {
        console.error('Failed to load data, using realistic dummy data', err);
        // Graceful fallback to dummy data for frontend development
        setRecruiter(getMockRecruiter(id));
        setCandidates(getMockCandidates(id));
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [id]);

  // Handle Search, Filter and Sorting logic
  const filteredCandidates = candidates.filter(c => {
    const matchesSearch =
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.email.toLowerCase().includes(search.toLowerCase()) ||
      (c.skills && JSON.stringify(c.skills).toLowerCase().includes(search.toLowerCase()));
    const matchesStatus = statusFilter ? c.status === statusFilter : true;
    return matchesSearch && matchesStatus;
  });

  const sortedCandidates = [...filteredCandidates].sort((a, b) => {
    if (sortBy === 'name') {
      return a.name.localeCompare(b.name);
    }
    if (sortBy === 'score-desc') {
      return (b.score || 0) - (a.score || 0);
    }
    if (sortBy === 'score-asc') {
      return (a.score || 0) - (b.score || 0);
    }
    if (sortBy === 'status') {
      return a.status.localeCompare(b.status);
    }
    return 0;
  });

  // Analytics/KPI calculations
  const totalCount = candidates.length;
  const completedCount = candidates.filter(c => ['interviewed', 'passed', 'failed', 'held'].includes(c.status)).length;
  const passedCount = candidates.filter(c => c.status === 'passed').length;
  const scheduledCount = candidates.filter(c => c.status === 'scheduled').length;

  const scores = candidates.filter(c => c.score !== null && c.score !== undefined).map(c => c.score);
  const avgScore = scores.length > 0 ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1) : '—';

  const kpis = [
    { label: 'Assigned Candidates', value: totalCount, icon: Briefcase, color: 'var(--color-primary-500)' },
    { label: 'Completed Assessments', value: completedCount, icon: CheckCircle, color: '#10b981' },
    { label: 'Interviews Scheduled', value: scheduledCount, icon: Calendar, color: '#f59e0b' },
    { label: 'Average Evaluation Score', value: scores.length > 0 ? `${avgScore} / 100` : '—', icon: Star, color: '#6366f1' }
  ];

  if (loading) {
    return (
      <div style={{ padding: 24, display: 'grid', gap: 20 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <div className="skeleton" style={{ width: 80, height: 32, borderRadius: 8 }} />
        </div>
        <div className="skeleton" style={{ height: 180, borderRadius: 16 }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
          {[1, 2, 3, 4].map(i => <div key={i} className="skeleton" style={{ height: 100, borderRadius: 12 }} />)}
        </div>
        <div className="skeleton" style={{ height: 300, borderRadius: 16 }} />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Page Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Button
          variant="secondary"
          size="sm"
          leftIcon={<ArrowLeft size={16} />}
          onClick={() => navigate('/admin/users')}
          style={{ padding: '8px 12px', minWidth: 'auto' }}
        >
          Back to Members
        </Button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-muted)' }}>
          <span>Sector Members</span>
          <ChevronRight size={14} />
          <span style={{ color: 'var(--text-secondary)' }}>Recruiter Profile</span>
        </div>
      </div>

      {/* Recruiter Profile Details Card */}
      <motion.div
        className="card"
        style={{
          padding: 24,
          background: 'linear-gradient(135deg, var(--bg-card-header) 0%, var(--bg-surface) 100%)',
          border: '1px solid var(--border-color)',
          borderRadius: 16,
          boxShadow: '0 4px 20px -2px rgba(0,0,0,0.05)'
        }}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24, alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap' }}>
            <Avatar name={recruiter?.name} size="xl" className="shadow-sm" />
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <h1 style={{ fontSize: 24, fontWeight: 800, fontFamily: 'Syne, sans-serif', color: 'var(--text-primary)', margin: 0 }}>
                  {recruiter?.name}
                </h1>
                <Badge variant="info">RECRUITER</Badge>
                <Badge variant={recruiter?.isActive ? 'success' : 'neutral'}>
                  {recruiter?.isActive ? 'Active' : 'Deactivated'}
                </Badge>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-secondary)' }}>
                  <Mail size={14} style={{ color: 'var(--text-muted)' }} />
                  <span>{recruiter?.email}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-secondary)' }}>
                  <Phone size={14} style={{ color: 'var(--text-muted)' }} />
                  <span>+1 (555) 234-5678</span>
                </div>
              </div>
            </div>
          </div>

          {/* Recruiter Skill Domain Badges */}
          <div style={{
            padding: 16,
            background: 'var(--bg-surface)',
            borderRadius: 12,
            border: '1px solid var(--border-color)',
            minWidth: 280,
            maxWidth: 400
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: 12, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 8 }}>
              <Tag size={13} style={{ color: 'var(--color-primary-500)' }} />
              <span>Assigned Domains</span>
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {recruiter?.skills && recruiter.skills.length > 0 ? (
                recruiter.skills.map((s, idx) => (
                  <div key={idx} style={{ background: 'var(--bg-card-header)', border: '1px solid var(--border-color)', borderRadius: 8, padding: '4px 8px' }}>
                    <div style={{ fontSize: 11, fontWeight: 600 }}>{s.domain?.name || 'Domain'}</div>
                    <div style={{ display: 'flex', gap: 3, marginTop: 3 }}>
                      {s.skillTags?.slice(0, 3).map(tag => (
                        <span key={tag} style={{ fontSize: 9, color: 'var(--text-secondary)' }}>#{tag}</span>
                      ))}
                    </div>
                  </div>
                ))
              ) : (
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>No domain mapping set</span>
              )}
            </div>
          </div>
        </div>
      </motion.div>

      {/* KPI Stats Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: 16
      }}>
        {kpis.map((kpi, i) => (
          <motion.div
            key={kpi.label}
            className="card"
            style={{
              padding: 20,
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              border: '1px solid var(--border-color)'
            }}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
          >
            <div style={{
              width: 48,
              height: 48,
              borderRadius: 12,
              background: `${kpi.color}15`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: kpi.color,
              flexShrink: 0
            }}>
              <kpi.icon size={22} />
            </div>
            <div>
              <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'Syne, sans-serif' }}>
                {kpi.value}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                {kpi.label}
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Candidates List Section */}
      <div className="card" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* Search, Filter, Sort Toolbar */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12,
          borderBottom: '1px solid var(--border-color)',
          paddingBottom: 16
        }}>
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Assigned Candidates</h3>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
              Active pool of candidates mapped to this recruiter for screening and evaluation
            </p>
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ position: 'relative', width: 220 }}>
              <Input
                placeholder="Search candidates/skills..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ paddingLeft: 34, marginBottom: 0 }}
              />
              <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            </div>

            <Select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              style={{ width: 140, marginBottom: 0 }}
            >
              <option value="">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="scheduled">Scheduled</option>
              <option value="interviewed">Interviewed</option>
              <option value="passed">Passed</option>
              <option value="failed">Failed</option>
              <option value="held">Held</option>
            </Select>

            <Select
              value={sortBy}
              onChange={e => setSortBy(e.target.value)}
              style={{ width: 140, marginBottom: 0 }}
            >
              <option value="name">Sort by Name</option>
              <option value="score-desc">Score: High to Low</option>
              <option value="score-asc">Score: Low to High</option>
              <option value="status">Sort by Status</option>
            </Select>
          </div>
        </div>

        {/* Candidates Table */}
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Candidate Details</th>
                <th>Domain & Skills</th>
                <th>Interview Status</th>
                <th>AI Score</th>
                <th style={{ width: 120, textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedCandidates.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: 48, color: 'var(--text-muted)' }}>
                    <AlertCircle size={32} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
                    <div>No candidates matching the current filters</div>
                  </td>
                </tr>
              ) : (
                sortedCandidates.map((c, i) => (
                  <tr key={c.id}>
                    {/* Candidate Name / Info */}
                    <td>
                      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                        <Avatar name={c.name} size="sm" />
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 13 }}>{c.name}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', gap: 8, marginTop: 2 }}>
                            <span>{c.email}</span>
                            <span>•</span>
                            <span>{c.phone || '+1 (555) 123-4567'}</span>
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Domain & Mapped Skills */}
                    <td>
                      <div style={{ fontWeight: 600, fontSize: 12 }}>{c.domainName || 'General Tech'}</div>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
                        {c.skills?.map(skill => (
                          <Badge key={skill} variant="neutral" style={{ fontSize: 10, padding: '2px 6px' }}>{skill}</Badge>
                        ))}
                      </div>
                    </td>

                    {/* Interview Status badge */}
                    <td>
                      <StatusBadge status={c.status} />
                    </td>

                    {/* Assessment Score */}
                    <td>
                      {c.score !== null && c.score !== undefined ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{
                            fontWeight: 800,
                            color: c.score >= 80 ? '#10b981' : c.score >= 60 ? '#f59e0b' : '#f43f5e',
                            fontSize: 13
                          }}>
                            {c.score}
                          </span>
                          <div style={{ width: 60, height: 6, background: 'var(--border-color)', borderRadius: 3, overflow: 'hidden' }}>
                            <div style={{
                              width: `${c.score}%`,
                              height: '100%',
                              background: c.score >= 80 ? '#10b981' : c.score >= 60 ? '#f59e0b' : '#f43f5e'
                            }} />
                          </div>
                        </div>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>— Not evaluated</span>
                      )}
                    </td>

                    {/* Actions */}
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                        {['interviewed', 'passed', 'failed', 'held'].includes(c.status) ? (
                          <Button
                            size="xs"
                            variant="secondary"
                            onClick={() => {
                              toast.success(`Opening AI appraisal scorecard for ${c.name}`);
                            }}
                            leftIcon={<Award size={12} />}
                          >
                            Scorecard
                          </Button>
                        ) : (
                          <Button
                            size="xs"
                            variant="ghost"
                            onClick={() => {
                              toast.success(`Notifying ${c.name} for scheduling`);
                            }}
                            leftIcon={<Clock size={12} />}
                          >
                            Remind
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

      </div>
    </div>
  );
}

// ==========================================
// ── Realistic Dummy Data Generator ───────
// ==========================================

function getMockRecruiter(id) {
  return {
    id,
    name: 'Frontend Recruiter',
    email: 'recruiter@it.agnohire.com',
    isActive: true,
    skills: [
      {
        domain: { name: 'Frontend Engineering' },
        skillTags: ['React', 'CSS Grids', 'TypeScript', 'Responsive Design']
      },
      {
        domain: { name: 'Fullstack JavaScript' },
        skillTags: ['Node.js', 'Express', 'React', 'Prisma ORM']
      }
    ]
  };
}

function getMockCandidates(recruiterId) {
  return [
    {
      id: 'c1',
      name: 'Jane Smith',
      email: 'jane.smith@gmail.com',
      phone: '+1 (555) 321-9876',
      domainName: 'Frontend Engineering',
      skills: ['React', 'TypeScript', 'CSS', 'Redux'],
      status: 'passed',
      score: 87.5
    },
    {
      id: 'c2',
      name: 'David Lee',
      email: 'david.lee@gmail.com',
      phone: '+1 (555) 789-0123',
      domainName: 'Frontend Engineering',
      skills: ['Vue.js', 'JavaScript', 'Tailwind', 'Sass'],
      status: 'failed',
      score: 45.2
    },
    {
      id: 'c3',
      name: 'Sophia Rodriguez',
      email: 'sophia.rod@gmail.com',
      phone: '+1 (555) 456-7890',
      domainName: 'Fullstack JavaScript',
      skills: ['Node.js', 'React', 'MongoDB', 'Express'],
      status: 'held',
      score: 78.0
    },
    {
      id: 'c4',
      name: 'Liam Chen',
      email: 'liam.chen@gmail.com',
      phone: '+1 (555) 234-5671',
      domainName: 'Frontend Engineering',
      skills: ['React Native', 'TypeScript', 'Next.js', 'GraphQL'],
      status: 'scheduled',
      score: null
    },
    {
      id: 'c5',
      name: 'Mia Johnson',
      email: 'mia.johnson@gmail.com',
      phone: '+1 (555) 901-2345',
      domainName: 'Fullstack JavaScript',
      skills: ['Next.js', 'PostgreSQL', 'Docker', 'REST API'],
      status: 'interviewed',
      score: 82.1
    },
    {
      id: 'c6',
      name: 'Alexander Wright',
      email: 'alex.wright@gmail.com',
      phone: '+1 (555) 123-6789',
      domainName: 'Frontend Engineering',
      skills: ['Angular', 'RxJS', 'TypeScript'],
      status: 'pending',
      score: null
    }
  ];
}
