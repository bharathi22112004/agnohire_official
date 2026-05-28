import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users, Mail, Phone, Calendar, Paperclip, MoreVertical,
  Edit2, Trash2, Send, Upload, Eye, Check, X, FileText
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Input, Select } from '../../components/ui/Input';
import { Modal, ConfirmDialog } from '../../components/ui/Modal';
import { Badge, StatusBadge } from '../../components/ui/Badge';
import api from '../../services/api';
import toast from 'react-hot-toast';

export default function ScheduleManagement() {
  const [candidates, setCandidates] = useState([]);
  const [recruiters, setRecruiters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [recruiterFilter, setRecruiterFilter] = useState('');

  // Selection states
  const [selectedIds, setSelectedIds] = useState([]);
  const [showBulkSelectedConfirm, setShowBulkSelectedConfirm] = useState(false);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [invitingSelected, setInvitingSelected] = useState(false);
  const [deletingSelected, setDeletingSelected] = useState(false);

  // Modals and Forms
  const [activeCandidate, setActiveCandidate] = useState(null);
  const [showDetail, setShowDetail] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', email: '', phone: '', experienceLevel: 'mid', additionalInfo: [] });
  const [uploadingResume, setUploadingResume] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showBulkConfirm, setShowBulkConfirm] = useState(false);
  const [bulkScheduling, setRunningBulk] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [candidatesRes, usersRes] = await Promise.all([
        api.get('/candidates?limit=1000'),
        api.get('/users?limit=100&role=recruiter')
      ]);
      const freshCandidates = candidatesRes.data.data.candidates || [];
      setCandidates(freshCandidates);
      setRecruiters(usersRes.data.data.users.filter(u => u.role?.name === 'recruiter'));
      // Keep only selected IDs that are still in the returned candidates list
      const freshIds = freshCandidates.map(c => c.id);
      setSelectedIds(prev => prev.filter(id => freshIds.includes(id)));
    } catch {
      toast.error('Failed to load candidate and recruiter queues');
    } finally {
      setLoading(false);
    }
  }

  async function handleOpenDetail(candidate) {
    // Fetch full candidate profile including resumes
    try {
      const res = await api.get(`/candidates/${candidate.id}`);
      const fullCand = res.data.data.candidate;
      setActiveCandidate(fullCand);
      setEditForm({
        name: fullCand.name,
        email: fullCand.email,
        phone: fullCand.phone || '',
        experienceLevel: fullCand.experienceLevel || 'mid',
        additionalInfo: Array.isArray(fullCand.additionalInfo) ? fullCand.additionalInfo : []
      });
      setIsEditing(false);
      setShowDetail(true);
    } catch {
      toast.error('Failed to fetch candidate record details');
    }
  }

  function handleAddInfo() {
    setEditForm(prev => ({
      ...prev,
      additionalInfo: [...(prev.additionalInfo || []), { title: '', text: '' }]
    }));
  }

  function handleUpdateInfo(index, field, value) {
    setEditForm(prev => {
      const updated = [...(prev.additionalInfo || [])];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, additionalInfo: updated };
    });
  }

  function handleRemoveInfo(index) {
    setEditForm(prev => ({
      ...prev,
      additionalInfo: (prev.additionalInfo || []).filter((_, idx) => idx !== index)
    }));
  }

  async function handleUpdateCandidate(e) {
    e.preventDefault();
    if (!editForm.name || !editForm.name.trim()) {
      return toast.error('Name is required');
    }
    if (!editForm.email || !editForm.email.trim()) {
      return toast.error('Email address is required and cannot be empty');
    }
    if (!editForm.phone || !editForm.phone.trim()) {
      return toast.error('Phone number is required and cannot be empty');
    }
    try {
      const res = await api.put(`/candidates/${activeCandidate.id}`, editForm);
      toast.success('Candidate profile updated');
      setActiveCandidate(res.data.data.candidate);
      setIsEditing(false);
      loadData();
    } catch {
      toast.error('Failed to update candidate profile');
    }
  }

  async function handleResumeUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    setUploadingResume(true);
    const fd = new FormData();
    fd.append('resume', file);

    try {
      await api.post(`/candidates/${activeCandidate.id}/resume`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      toast.success('Resume uploaded successfully');
      // Reload candidate detail
      handleOpenDetail(activeCandidate);
    } catch {
      toast.error('Failed to upload resume file');
    } finally {
      setUploadingResume(false);
    }
  }

  async function handleSendInvite() {
    try {
      await api.post('/candidates/bulk-schedule', { candidateIds: [activeCandidate.id] });
      toast.success('Interview scheduled and invite link issued');
      setShowDetail(false);
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Failed to schedule interview');
    }
  }

  async function handleBulkSchedule() {
    setRunningBulk(true);
    try {
      const ids = assignedCandidates.map(c => c.id);
      const res = await api.post('/candidates/bulk-schedule', { candidateIds: ids });
      toast.success(`Successfully launched overall schedules and invites for ${res.data.data.scheduledCount} candidates!`);
      setShowBulkConfirm(false);
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Failed to process bulk scheduling');
    } finally {
      setRunningBulk(false);
    }
  }

  function handleSelectRow(id) {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  }

  function handleSelectAllToggle() {
    const allFilteredIds = filtered.map(c => c.id);
    const allAreSelected = allFilteredIds.every(id => selectedIds.includes(id));

    if (allAreSelected) {
      // Uncheck all currently filtered
      setSelectedIds(prev => prev.filter(id => !allFilteredIds.includes(id)));
    } else {
      // Check all currently filtered
      setSelectedIds(prev => {
        const next = [...prev];
        allFilteredIds.forEach(id => {
          if (!next.includes(id)) {
            next.push(id);
          }
        });
        return next;
      });
    }
  }

  async function handleInviteSelected() {
    setInvitingSelected(true);
    try {
      const res = await api.post('/candidates/bulk-schedule', { candidateIds: selectedIds });
      toast.success(`Successfully sent interview invitations to ${res.data.data.scheduledCount} selected candidates!`);
      setSelectedIds([]);
      setShowBulkSelectedConfirm(false);
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Failed to send invites');
    } finally {
      setInvitingSelected(false);
    }
  }

  async function handleDeleteSelected() {
    setDeletingSelected(true);
    try {
      await api.post('/candidates/bulk-delete', { candidateIds: selectedIds });
      toast.success(`Successfully deleted ${selectedIds.length} candidate(s)`);
      setSelectedIds([]);
      setShowBulkDeleteConfirm(false);
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Failed to delete selected candidates');
    } finally {
      setDeletingSelected(false);
    }
  }

  async function handleDeleteCandidate() {
    try {
      await api.delete(`/candidates/${activeCandidate.id}`);
      toast.success('Candidate removed successfully');
      setShowDetail(false);
      setShowDeleteConfirm(false);
      loadData();
    } catch {
      toast.error('Failed to remove candidate');
    }
  }

  const filtered = candidates.filter(c => {
    const matchesSearch = c.name.toLowerCase().includes(search.toLowerCase()) || c.email.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter ? c.status === statusFilter : true;
    
    const assignedRecruiter = c.assignments?.[0]?.recruiter;
    const matchesRecruiter = recruiterFilter ? assignedRecruiter?.id === recruiterFilter : true;
    
    return matchesSearch && matchesStatus && matchesRecruiter;
  });

  const assignedCandidates = candidates.filter(c => c.status === 'assigned');
  const assignedCount = assignedCandidates.length;

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 className="page-title">Workload & Schedules</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 4 }}>
            Monitor recruiter assignment mappings, view schedules, upload resumes, and launch assessment pipelines
          </p>
        </div>
        {selectedIds.length > 0 && (
          <Button
            onClick={() => setShowBulkDeleteConfirm(true)}
            variant="danger"
            leftIcon={<Trash2 size={15} />}
          >
            Delete Selected ({selectedIds.length})
          </Button>
        )}
      </div>

      {/* Search and Filters */}
      <div className="card" style={{ padding: '16px 20px', marginBottom: 16, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <Input
          placeholder="Search by candidate name or email..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ maxWidth: 300, marginBottom: 0 }}
        />
        
        <Select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          style={{ width: 180, marginBottom: 0 }}
        >
          <option value="">All Statuses</option>
          <option value="pending">Pending Assignment</option>
          <option value="assigned">Assigned</option>
          <option value="scheduled">Scheduled</option>
          <option value="interviewed">Interviewed</option>
          <option value="passed">Passed</option>
          <option value="failed">Failed</option>
          <option value="held">On Hold</option>
        </Select>

        <Select
          value={recruiterFilter}
          onChange={e => setRecruiterFilter(e.target.value)}
          style={{ width: 180, marginBottom: 0 }}
        >
          <option value="">All Recruiters</option>
          {recruiters.map(r => (
            <option key={r.id} value={r.id}>{r.name}</option>
          ))}
        </Select>
      </div>

      {/* Listing */}
      <div className="card" style={{ padding: 0 }}>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th style={{ width: 48, paddingLeft: 16 }}>
                  <input
                    type="checkbox"
                    checked={filtered.length > 0 && filtered.every(c => selectedIds.includes(c.id))}
                    onChange={handleSelectAllToggle}
                    style={{ cursor: 'pointer', width: 16, height: 16, verticalAlign: 'middle' }}
                  />
                </th>
                <th>Candidate Name</th>
                <th>Assigned Recruiter</th>
                <th>Status</th>
                <th>Experience</th>
                <th style={{ width: 80, textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: 24 }}>
                    <div className="skeleton" style={{ height: 40 }} />
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: 48, color: 'var(--text-muted)' }}>
                    No candidates matched the filter options.
                  </td>
                </tr>
              ) : (
                filtered.map(c => {
                  const rec = c.assignments?.[0]?.recruiter;
                  return (
                    <tr key={c.id}>
                      <td style={{ width: 48, paddingLeft: 16 }}>
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(c.id)}
                          onChange={() => handleSelectRow(c.id)}
                          style={{ cursor: 'pointer', width: 16, height: 16, verticalAlign: 'middle' }}
                        />
                      </td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{c.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{c.email}</div>
                      </td>
                      <td style={{ fontSize: 13 }}>
                        {rec ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--bg-card-header)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700 }}>
                              {rec.name[0]}
                            </div>
                            {rec.name}
                          </div>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>Unassigned</span>
                        )}
                      </td>
                      <td>
                        <StatusBadge status={c.status} />
                      </td>
                      <td>
                        <Badge variant="neutral">{c.experienceLevel?.toUpperCase() || 'MID'}</Badge>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <Button size="xs" variant="secondary" onClick={() => handleOpenDetail(c)}>
                          Manage
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Candidate Details Slideover/Modal */}
      <Modal
        isOpen={showDetail}
        onClose={() => setShowDetail(false)}
        title={activeCandidate ? `${activeCandidate.name} Profile` : 'Candidate details'}
        size="lg"
      >
        {activeCandidate && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Inline Info / Edit Form */}
            {isEditing ? (
               <form onSubmit={handleUpdateCandidate} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <Input label="Name" id="edit-name" value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} required />
                <Input label="Email" id="edit-email" value={editForm.email} onChange={e => setEditForm({ ...editForm, email: e.target.value })} required />
                <Input label="Phone" id="edit-phone" value={editForm.phone} onChange={e => setEditForm({ ...editForm, phone: e.target.value })} required />
                <Select label="Experience Level" value={editForm.experienceLevel} onChange={e => setEditForm({ ...editForm, experienceLevel: e.target.value })}>
                  <option value="junior">Junior</option>
                  <option value="mid">Mid-Level</option>
                  <option value="senior">Senior</option>
                </Select>

                {/* Additional Info Fields */}
                <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: 16, marginTop: 4 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <h4 style={{ fontSize: 13, fontWeight: 700, margin: 0 }}>Additional Details</h4>
                    <Button type="button" size="xs" variant="secondary" onClick={handleAddInfo}>
                      + Add Info
                    </Button>
                  </div>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {editForm.additionalInfo && editForm.additionalInfo.map((info, idx) => (
                      <div key={idx} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', background: 'var(--bg-surface-2)', padding: 12, borderRadius: 8, border: '1px solid var(--border-color)' }}>
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                          <Input
                            placeholder="Title (e.g. Projects)"
                            value={info.title}
                            onChange={e => handleUpdateInfo(idx, 'title', e.target.value)}
                            style={{ marginBottom: 0 }}
                          />
                          <Input
                            placeholder="Detail description..."
                            value={info.text}
                            onChange={e => handleUpdateInfo(idx, 'text', e.target.value)}
                            style={{ marginBottom: 0 }}
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveInfo(idx)}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            color: 'var(--color-danger)',
                            padding: '6px 4px 0 0'
                          }}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
                  <Button variant="ghost" size="sm" onClick={() => setIsEditing(false)}>Cancel</Button>
                  <Button type="submit" size="sm">Save Changes</Button>
                </div>
              </form>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>{activeCandidate.name}</h3>
                    <div style={{ display: 'flex', gap: 12, marginTop: 6, fontSize: 13, color: 'var(--text-secondary)', flexWrap: 'wrap' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Mail size={13} />
                        <span>{activeCandidate.email}</span>
                      </span>
                      {activeCandidate.phone && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Phone size={13} />
                          <span>{activeCandidate.phone}</span>
                        </span>
                      )}
                    </div>
                  </div>
                  <Button size="xs" variant="secondary" leftIcon={<Edit2 size={12} />} onClick={() => setIsEditing(true)}>Edit Info</Button>
                </div>

                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <StatusBadge status={activeCandidate.status} />
                  <Badge variant="neutral">EXP: {activeCandidate.experienceLevel?.toUpperCase() || 'MID'}</Badge>
                </div>

                {/* Additional Details Display */}
                {activeCandidate.additionalInfo && activeCandidate.additionalInfo.length > 0 && (
                  <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: 16 }}>
                    <h4 style={{ fontSize: 13, fontWeight: 700, margin: '0 0 12px 0', color: 'var(--text-primary)' }}>Additional Details</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {activeCandidate.additionalInfo.map((info, idx) => (
                        <div key={idx} style={{ background: 'var(--bg-surface-2)', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border-color)' }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-primary-500)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{info.title}</div>
                          <div style={{ fontSize: 13, color: 'var(--text-primary)', marginTop: 4 }}>{info.text}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <h4 style={{ fontSize: 13, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}><Paperclip size={14} /> Resume File</h4>
                    <label className="btn btn-secondary btn-xs" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Upload size={12} /> Upload New
                      <input type="file" accept=".pdf,.doc,.docx" onChange={handleResumeUpload} style={{ display: 'none' }} disabled={uploadingResume} />
                    </label>
                  </div>

                  {activeCandidate.resumes?.length > 0 ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 12, border: '1px solid var(--border-color)', borderRadius: 12, background: 'var(--bg-card-header)' }}>
                      <FileText size={16} style={{ color: 'var(--color-brand)' }} />
                      <div style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>{activeCandidate.resumes[0].fileName}</div>
                      <a href={activeCandidate.resumes[0].fileUrl} target="_blank" rel="noreferrer" className="btn btn-ghost btn-xs">View</a>
                    </div>
                  ) : (
                    <div style={{ border: '1px dashed var(--border-color)', borderRadius: 12, padding: 20, textAlign: 'center', fontSize: 12, color: 'var(--text-muted)' }}>
                      No resume uploaded yet. Click upload to attach candidate profile.
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', gap: 8, borderTop: '1px solid var(--border-color)', paddingTop: 16, marginTop: 12 }}>
                  <Button variant="ghost" style={{ color: 'var(--color-danger)', width: '100%' }} leftIcon={<Trash2 size={14} />} onClick={() => setShowDeleteConfirm(true)}>
                    Remove Candidate
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDeleteCandidate}
        title="Remove Candidate Profile"
        message="Are you sure you want to permanently remove this candidate? This will delete all interview recordings, profiles, and associated tokens."
        confirmText="Remove"
        variant="danger"
      />



      {/* Bulk Selected Deletion Confirmation */}
      <ConfirmDialog
        isOpen={showBulkDeleteConfirm}
        onClose={() => setShowBulkDeleteConfirm(false)}
        onConfirm={handleDeleteSelected}
        loading={deletingSelected}
        title="Delete Selected Candidates"
        message={`Are you sure you want to permanently delete the ${selectedIds.length} selected candidate(s)? This action will remove all schedules, resumes, results, and answers associated with them and cannot be undone.`}
        confirmText="Delete All"
        variant="danger"
      />
    </div>
  );
}
