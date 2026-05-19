import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ListFilter, Users, CheckCircle, HelpCircle, ArrowRight, UserPlus, RefreshCw, Trash2 } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Select } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { useAuthStore } from '../../store/authStore';
import api from '../../services/api';
import toast from 'react-hot-toast';

export default function CandidateAssignment() {
  const [lists, setLists] = useState([]);
  const [recruiters, setRecruiters] = useState([]);
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [selectedListId, setSelectedListId] = useState('');
  const [selectedRecruiters, setSelectedRecruiters] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [deletingList, setDeletingList] = useState(false);

  const currentUser = useAuthStore(state => state.user);

  useEffect(() => {
    loadData();
  }, []);

  async function handleDeleteList() {
    if (!selectedListId) return;
    const confirmDelete = window.confirm(
      "Are you absolutely sure you want to delete this ingestion list? This will permanently delete the list, all candidates inside it, and any associated recruiter assignments or scheduled interviews."
    );
    if (!confirmDelete) return;

    setDeletingList(true);
    try {
      await api.delete(`/candidates/lists/${selectedListId}`);
      toast.success("Ingestion list and all associated data deleted successfully");
      setSelectedListId('');
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.error?.message || "Failed to delete ingestion list");
    } finally {
      setDeletingList(false);
    }
  }

  async function loadData() {
    try {
      const [listsRes, recruitersRes, candidatesRes] = await Promise.all([
        api.get('/candidates/lists'),
        api.get('/users?limit=100&role=recruiter'),
        api.get('/candidates?limit=1000')
      ]);
      setLists(listsRes.data.data.lists || []);
      setRecruiters(recruitersRes.data.data.users.filter(u => u.role?.name === 'recruiter'));
      setCandidates(candidatesRes.data.data.candidates || []);
    } catch {
      toast.error('Failed to load allocation data');
    } finally {
      setLoading(false);
    }
  }

  // Filter candidates associated with the selected list
  const listCandidates = candidates.filter(c => c.listId === selectedListId);
  const pendingCandidates = listCandidates.filter(c => c.status === 'pending');
  const pendingCount = pendingCandidates.length;
  const assignedCandidatesCount = listCandidates.filter(c => c.status === 'assigned').length;

  function toggleRecruiter(id) {
    if (selectedRecruiters.includes(id)) {
      setSelectedRecruiters(selectedRecruiters.filter(r => r !== id));
    } else {
      setSelectedRecruiters([...selectedRecruiters, id]);
    }
  }

  async function handleAssign() {
    if (!selectedListId) return toast.error('Please select an ingestion list');
    if (selectedRecruiters.length === 0) return toast.error('Please select at least one recruiter');
    if (pendingCount === 0) return toast.error('No pending candidates remaining in this list');

    setSubmitting(true);
    try {
      const candidateIds = pendingCandidates.map(c => c.id);
      await api.post('/candidates/assign', {
        candidateIds,
        recruiterIds: selectedRecruiters,
        listId: selectedListId
      });
      toast.success(`Successfully allocated ${candidateIds.length} candidates evenly`);
      setSelectedRecruiters([]);
      setSelectedListId('');
      loadData();
    } catch {
      toast.error('Failed to allocate workloads');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div className="skeleton" style={{ height: 40, width: '30%' }} />
        <div className="skeleton" style={{ height: 260 }} />
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Workload Allocation</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 4 }}>
            Distribute candidate lists evenly among sector recruiters for review
          </p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* Left Side: Select List and view candidates */}
        <div className="card" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <ListFilter size={18} style={{ color: 'var(--color-brand)' }} />
            1. Select Batch Ingestion List
          </h3>

          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}>
              <Select
                label="Active Lists"
                value={selectedListId}
                onChange={e => setSelectedListId(e.target.value)}
              >
                <option value="">Choose a list...</option>
                {lists.map(list => (
                  <option key={list.id} value={list.id}>{list.name} ({list.candidateCount} candidates)</option>
                ))}
              </Select>
            </div>
            {selectedListId && (
              <Button
                onClick={handleDeleteList}
                loading={deletingList}
                style={{ 
                  height: 40, 
                  background: 'var(--color-danger, #ef4444)', 
                  borderColor: 'var(--color-danger, #ef4444)',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6
                }}
                leftIcon={<Trash2 size={16} />}
              >
                Delete List
              </Button>
            )}
          </div>

          {selectedListId && (
            <motion.div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 16
              }}
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
            >
              <div style={{ padding: 16, background: 'var(--bg-card-header)', border: '1px solid var(--border-color)', borderRadius: 12 }}>
                <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>Ingestion Allocation Status</div>
                <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                  <div className="kpi-card" style={{ padding: 12, flex: 1, background: 'var(--bg-surface)' }}>
                    <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--color-brand)' }}>{pendingCount}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Pending Assign</div>
                  </div>
                  <div className="kpi-card" style={{ padding: 12, flex: 1, background: 'var(--bg-surface)' }}>
                    <div style={{ fontSize: 18, fontWeight: 800 }}>{assignedCandidatesCount}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Already Mapped</div>
                  </div>
                </div>
              </div>

              {/* Scrollable list of candidates */}
              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: 16 }}>
                <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Users size={14} style={{ color: 'var(--color-brand)' }} />
                  Candidates in Batch ({listCandidates.length})
                </div>
                
                {listCandidates.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '16px 0', color: 'var(--text-muted)', fontSize: 12 }}>
                    No candidates found in this list.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 180, overflowY: 'auto', paddingRight: 4 }}>
                    {listCandidates.map(c => (
                      <div
                        key={c.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '8px 12px',
                          borderRadius: 8,
                          background: 'var(--bg-surface)',
                          border: '1px solid var(--border-color)',
                          fontSize: 12
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{c.name}</div>
                          <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{c.email}</div>
                        </div>
                        <Badge variant={c.status === 'pending' ? 'neutral' : 'success'}>
                          {c.status.toUpperCase()}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </div>

        {/* Right Side: Select Recruiters */}
        <div className="card" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Users size={18} style={{ color: 'var(--color-brand)' }} />
            2. Choose Recruiters ({selectedRecruiters.length} selected)
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 220, overflowY: 'auto', paddingRight: 6 }}>
            {recruiters.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)', fontSize: 12 }}>
                No recruiters found in this sector.
              </div>
            ) : (
              recruiters.map(r => (
                <div
                  key={r.id}
                  onClick={() => toggleRecruiter(r.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '10px 14px',
                    borderRadius: 12,
                    border: selectedRecruiters.includes(r.id) ? '1px solid var(--color-brand)' : '1px solid var(--border-color)',
                    background: selectedRecruiters.includes(r.id) ? 'var(--bg-card-header)' : 'var(--bg-surface)',
                    cursor: 'pointer',
                    transition: 'all 0.15s'
                  }}
                >
                  <input
                    type="checkbox"
                    checked={selectedRecruiters.includes(r.id)}
                    onChange={() => {}} // handled by div click
                    style={{ pointerEvents: 'none' }}
                  />
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{r.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{r.email}</div>
                  </div>
                </div>
              ))
            )}
          </div>

          <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
            <Button
              onClick={handleAssign}
              loading={submitting}
              disabled={!selectedListId || selectedRecruiters.length === 0 || pendingCount === 0}
              leftIcon={<UserPlus size={15} />}
            >
              Distribute Candidates
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
