import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Calendar, Clock, Send, Search, User } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Input, Select } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { StatusBadge } from '../../components/ui/Badge';
import { Avatar } from '../../components/ui/Avatar';
import { SkeletonTable } from '../../components/ui/Skeleton';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { formatDate } from '../../utils/cn';

export default function InterviewScheduling() {
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showSchedule, setShowSchedule] = useState(false);
  const [selected, setSelected] = useState(null);
  const [scheduling, setScheduling] = useState(false);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({ date: '', timeStart: '09:00', timeEnd: '10:00', sendEmail: true });

  // Bulk action states
  const [selectedCandidates, setSelectedCandidates] = useState([]);
  const [showBulkSchedule, setShowBulkSchedule] = useState(false);
  const [bulkForm, setBulkForm] = useState({ date: '', timeStart: '09:00', timeEnd: '18:00', sendEmail: true });
  const [bulkScheduling, setBulkScheduling] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      const res = await api.get('/candidates?status=assigned&limit=100');
      setCandidates(res.data.data.candidates);
    } catch { toast.error('Failed to load candidates'); }
    finally { setLoading(false); }
  }

  async function handleSchedule(e) {
    e.preventDefault();
    if (!selected || !form.date) return;
    setScheduling(true);
    try {
      const res = await api.post('/interviews/schedule', {
        candidateId: selected.id,
        ...form,
      });
      toast.success('Interview scheduled and invitation sent!');
      setShowSchedule(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Failed to schedule');
    } finally { setScheduling(false); }
  }

  async function handleBulkSchedule(e) {
    e.preventDefault();
    if (selectedCandidates.length === 0 || !bulkForm.date) return;
    setBulkScheduling(true);
    try {
      const res = await api.post('/interviews/bulk-schedule', {
        candidateIds: selectedCandidates,
        ...bulkForm,
      });
      toast.success(`Successfully scheduled ${res.data.data.scheduledCount} interviews in bulk!`);
      setShowBulkSchedule(false);
      setSelectedCandidates([]);
      load();
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Failed to schedule bulk interviews');
    } finally {
      setBulkScheduling(false);
    }
  }

  const filtered = candidates.filter(c =>
    c.name?.toLowerCase().includes(search.toLowerCase()) ||
    c.email?.toLowerCase().includes(search.toLowerCase())
  );

  const allSelected = filtered.length > 0 && selectedCandidates.length === filtered.length;
  function toggleSelectAll() {
    if (allSelected) {
      setSelectedCandidates([]);
    } else {
      setSelectedCandidates(filtered.map(c => c.id));
    }
  }

  function toggleSelectCandidate(id) {
    if (selectedCandidates.includes(id)) {
      setSelectedCandidates(selectedCandidates.filter(cid => cid !== id));
    } else {
      setSelectedCandidates([...selectedCandidates, id]);
    }
  }

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 className="page-title">Interview Scheduling</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 4 }}>
            Schedule assessment interviews for assigned candidates
          </p>
        </div>
        {selectedCandidates.length > 0 && (
          <Button
            onClick={() => {
              setBulkForm({
                date: new Date().toISOString().split('T')[0],
                timeStart: '09:00',
                timeEnd: '18:00',
                sendEmail: true
              });
              setShowBulkSchedule(true);
            }}
            variant="primary"
            leftIcon={<Calendar size={15} />}
          >
            Bulk Schedule Selected ({selectedCandidates.length})
          </Button>
        )}
      </div>

      <div className="card" style={{ padding: '16px 20px', marginBottom: 16 }}>
        <Input
          placeholder="Search candidates..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ maxWidth: 320 }}
          leftIcon={<Search size={15} />}
        />
      </div>

      <div className="card" style={{ overflow: 'hidden' }}>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th style={{ width: 40, textAlign: 'center' }}>
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleSelectAll}
                    style={{ accentColor: 'var(--color-primary-500)', cursor: 'pointer' }}
                  />
                </th>
                <th>Candidate</th>
                <th>Domain</th>
                <th>Experience</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6}><SkeletonTable rows={6} cols={6} /></td></tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: 48, color: 'var(--text-muted)' }}>
                    No assigned candidates found
                  </td>
                </tr>
              ) : filtered.map((candidate, i) => (
                <motion.tr key={candidate.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
                  <td style={{ textAlign: 'center' }}>
                    <input
                      type="checkbox"
                      checked={selectedCandidates.includes(candidate.id)}
                      onChange={() => toggleSelectCandidate(candidate.id)}
                      style={{ accentColor: 'var(--color-primary-500)', cursor: 'pointer' }}
                    />
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <Avatar name={candidate.name} size="sm" />
                      <div>
                        <div style={{ fontWeight: 600 }}>{candidate.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{candidate.email}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{candidate.domain?.name || '—'}</td>
                  <td style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{candidate.experienceLevel || '—'}</td>
                  <td><StatusBadge status={candidate.status} /></td>
                  <td>
                    <Button
                      size="sm"
                      leftIcon={<Calendar size={14} />}
                      onClick={() => { setSelected(candidate); setForm({ ...form, date: new Date().toISOString().split('T')[0] }); setShowSchedule(true); }}
                    >
                      Schedule
                    </Button>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Schedule Modal */}
      <Modal
        isOpen={showSchedule}
        onClose={() => setShowSchedule(false)}
        title={`Schedule Interview — ${selected?.name}`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowSchedule(false)}>Cancel</Button>
            <Button onClick={handleSchedule} loading={scheduling} leftIcon={<Send size={15} />}>
              Schedule & Send Invite
            </Button>
          </>
        }
      >
        <form onSubmit={handleSchedule} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{
            padding: 16, background: 'var(--bg-surface-2)', borderRadius: 10,
            display: 'flex', alignItems: 'center', gap: 12,
          }}>
            <Avatar name={selected?.name} size="md" />
            <div>
              <div style={{ fontWeight: 600 }}>{selected?.name}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{selected?.email}</div>
            </div>
          </div>

          <Input
            label="Interview Date"
            type="date"
            value={form.date}
            onChange={e => setForm({ ...form, date: e.target.value })}
            required
            id="interview-date"
          />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Input label="Start Time" type="time" value={form.timeStart} onChange={e => setForm({ ...form, timeStart: e.target.value })} id="time-start" />
            <Input label="End Time" type="time" value={form.timeEnd} onChange={e => setForm({ ...form, timeEnd: e.target.value })} id="time-end" />
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={form.sendEmail}
              onChange={e => setForm({ ...form, sendEmail: e.target.checked })}
              style={{ accentColor: 'var(--color-primary-500)' }}
            />
            <span style={{ fontSize: 13 }}>Send interview invitation email to candidate</span>
          </label>
        </form>
      </Modal>

      {/* Bulk Schedule Modal */}
      <Modal
        isOpen={showBulkSchedule}
        onClose={() => setShowBulkSchedule(false)}
        title={`Bulk Schedule Interviews — ${selectedCandidates.length} Selected`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowBulkSchedule(false)}>Cancel</Button>
            <Button onClick={handleBulkSchedule} loading={bulkScheduling} leftIcon={<Send size={15} />}>
              Schedule & Send Invites ({selectedCandidates.length})
            </Button>
          </>
        }
      >
        <form onSubmit={handleBulkSchedule} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{
            padding: 16, background: 'var(--bg-surface-2)', borderRadius: 10,
            fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5
          }}>
            You are scheduling <strong>{selectedCandidates.length} candidates</strong> at once. A dynamic invite token will be generated for each candidate, and they will receive personalized invitation emails.
          </div>

          <Input
            label="Interview Date"
            type="date"
            value={bulkForm.date}
            onChange={e => setBulkForm({ ...bulkForm, date: e.target.value })}
            required
            id="bulk-interview-date"
          />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Input label="Start Time" type="time" value={bulkForm.timeStart} onChange={e => setBulkForm({ ...bulkForm, timeStart: e.target.value })} id="bulk-time-start" />
            <Input label="End Time" type="time" value={bulkForm.timeEnd} onChange={e => setBulkForm({ ...bulkForm, timeEnd: e.target.value })} id="bulk-time-end" />
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={bulkForm.sendEmail}
              onChange={e => setBulkForm({ ...bulkForm, sendEmail: e.target.checked })}
              style={{ accentColor: 'var(--color-primary-500)' }}
            />
            <span style={{ fontSize: 13 }}>Send interview invitation emails to candidates</span>
          </label>
        </form>
      </Modal>
    </div>
  );
}
