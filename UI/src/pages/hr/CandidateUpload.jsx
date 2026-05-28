import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Upload, FileText, Download, CheckCircle, AlertCircle,
  X, Users, Search, Trash2, Calendar, FileSpreadsheet
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge, StatusBadge } from '../../components/ui/Badge';
import { Avatar } from '../../components/ui/Avatar';
import api from '../../services/api';
import toast from 'react-hot-toast';

export default function CandidateUpload() {
  const navigate = useNavigate();
  const [file, setFile] = useState(null);
  const [listName, setListName] = useState('');
  const [uploading, setUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef();

  // Persistent Upload History State
  const [uploadHistory, setUploadHistory] = useState(() => {
    try {
      const stored = localStorage.getItem('agnohire_upload_history');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const [activeBatchId, setActiveBatchId] = useState(() => {
    try {
      const stored = localStorage.getItem('agnohire_upload_history');
      const history = stored ? JSON.parse(stored) : [];
      return history.length > 0 ? history[0].id : null;
    } catch {
      return null;
    }
  });

  // Real-time Filter States
  const [searchTerm, setSearchTerm] = useState('');
  const [expFilter, setExpFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Persist history changes
  useEffect(() => {
    localStorage.setItem('agnohire_upload_history', JSON.stringify(uploadHistory));
  }, [uploadHistory]);

  function handleDrop(e) {
    e.preventDefault();
    setIsDragging(false);
    const f = e.dataTransfer.files[0];
    const isAllowed = f && (
      f.type === 'text/csv' ||
      f.name.endsWith('.csv') ||
      f.name.endsWith('.xlsx') ||
      f.name.endsWith('.xls') ||
      f.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    if (isAllowed) {
      setFile(f);
    } else {
      toast.error('Please upload a CSV or Excel (.xlsx, .xls) file');
    }
  }

  async function handleUpload() {
    if (!file) return toast.error('Please select an Excel or CSV file');
    if (!listName) return toast.error('Please enter a list name');

    setUploading(true);
    const fd = new FormData();
    fd.append('csv', file);
    fd.append('listName', listName);

    try {
      const res = await api.post('/candidates/bulk-upload', fd);

      const payload = res.data.data;

      // Construct a new history batch object
      const newBatch = {
        id: Date.now().toString(),
        fileName: file.name,
        listName: listName,
        uploadedAt: new Date().toISOString(),
        importedCount: payload.imported,
        totalRows: payload.total,
        errors: payload.errors || [],
        candidates: payload.candidates || []
      };

      // Put the newest batch at the very top (uploaded order, newest first)
      const updatedHistory = [newBatch, ...uploadHistory];
      setUploadHistory(updatedHistory);
      setActiveBatchId(newBatch.id);

      // Reset form states
      setFile(null);
      setListName('');

      toast.success(`Successfully imported ${payload.imported} candidates from ${file.name}`);

      // Auto-redirect to the workload allocation (assignment) page so they can allocate workloads immediately
      setTimeout(() => {
        navigate('/hr/assignment');
      }, 1200);
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  function handleDeleteBatch(e, batchId) {
    e.stopPropagation(); // prevent setting selected batch
    const updated = uploadHistory.filter(b => b.id !== batchId);
    setUploadHistory(updated);
    if (activeBatchId === batchId) {
      setActiveBatchId(updated.length > 0 ? updated[0].id : null);
    }
    toast.success('Upload record deleted');
  }

  function downloadSample() {
    const csv = `name,email,phone,experience_level,skills,projects_description\nJohn Smith,john@example.com,9876543210,mid,"JavaScript, React","E-commerce website"\nJane Doe,jane@example.com,9876543211,senior,"Python, Django","Data pipeline"`;
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'candidate_sample.csv';
    a.click();
  }

  // Derive current selected batch
  const activeBatch = uploadHistory.find(b => b.id === activeBatchId) || null;

  // Filter candidates of active batch
  const filteredCandidates = activeBatch
    ? activeBatch.candidates.filter(c => {
        // Search filter
        const term = searchTerm.toLowerCase();
        const matchesSearch = !term ||
          c.name?.toLowerCase().includes(term) ||
          c.email?.toLowerCase().includes(term) ||
          (c.skills && c.skills.some(s => s.toLowerCase().includes(term)));

        // Experience Level filter
        const matchesExp = !expFilter || c.experienceLevel?.toLowerCase() === expFilter.toLowerCase();

        // Status filter
        const matchesStatus = !statusFilter || c.status?.toLowerCase() === statusFilter.toLowerCase();

        return matchesSearch && matchesExp && matchesStatus;
      })
    : [];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Candidate Bulk Upload</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 4 }}>
            Upload a CSV or Excel spreadsheet to onboard candidates at scale
          </p>
        </div>
        <Button variant="secondary" leftIcon={<Download size={15} />} onClick={downloadSample}>
          Download Sample CSV
        </Button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* Upload Card */}
        <div className="card" style={{ padding: 24 }}>
          <h3 className="section-title" style={{ marginBottom: 20 }}>Upload File</h3>

          <Input
            label="List Name"
            placeholder="e.g. IT Batch May 2026"
            value={listName}
            onChange={e => setListName(e.target.value)}
            style={{ marginBottom: 20 }}
          />

          {/* Drop Zone */}
          <div
            className={`dropzone ${isDragging ? 'active' : ''}`}
            onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
          >
            <input
              ref={inputRef}
              type="file"
              accept=".csv, .xlsx, .xls, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              style={{ display: 'none' }}
              onChange={e => setFile(e.target.files[0])}
            />
            <Upload size={36} style={{ margin: '0 auto 12px', color: 'var(--color-primary-500)', display: 'block' }} />
            <p style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
              {file ? file.name : 'Drop file here'}
            </p>
            <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              or click to browse — CSV or Excel (.xlsx, .xls), max 10MB
            </p>
          </div>

          {file && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '12px 16px', background: 'var(--bg-surface-2)',
              borderRadius: 10, marginTop: 12,
            }}>
              <FileText size={16} style={{ color: 'var(--color-primary-500)' }} />
              <span style={{ flex: 1, fontSize: 13 }}>{file.name}</span>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{(file.size / 1024).toFixed(1)} KB</span>
              <button
                onClick={() => setFile(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                <X size={14} />
              </button>
            </div>
          )}

          <Button
            onClick={handleUpload}
            loading={uploading}
            style={{ width: '100%', marginTop: 16 }}
            disabled={!file || !listName}
          >
            Upload & Process
          </Button>
        </div>

        {/* Format Guide */}
        <div className="card" style={{ padding: 24 }}>
          <h3 className="section-title" style={{ marginBottom: 16 }}>CSV Format Guide</h3>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Column</th>
                  <th>Required</th>
                  <th>Format</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { col: 'name', req: true, fmt: 'Text' },
                  { col: 'email', req: true, fmt: 'Valid email' },
                  { col: 'phone', req: false, fmt: 'Number' },
                  { col: 'experience_level', req: false, fmt: 'junior/mid/senior' },
                  { col: 'skills', req: false, fmt: 'Comma-separated string (e.g. React, CSS)' },
                  { col: 'projects_description', req: false, fmt: 'Text' },
                ].map(r => (
                  <tr key={r.col}>
                    <td><code style={{ fontFamily: 'DM Mono, monospace', fontSize: 12 }}>{r.col}</code></td>
                    <td>{r.req ? <Badge variant="danger">Required</Badge> : <Badge variant="neutral">Optional</Badge>}</td>
                    <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{r.fmt}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* History & Results Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 20, marginTop: 24 }}>

        {/* Left Column: Upload History List */}
        <div className="card" style={{ padding: 20, alignSelf: 'start' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <FileSpreadsheet size={18} style={{ color: 'var(--color-primary-500)' }} />
            <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>Uploaded Batches</h3>
          </div>

          {uploadHistory.length === 0 ? (
            <div style={{ padding: '36px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
              <p style={{ fontSize: 13, margin: 0 }}>No upload history found</p>
              <p style={{ fontSize: 11, marginTop: 4, opacity: 0.8 }}>Upload a CSV or Excel sheet above</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 500, overflowY: 'auto' }}>
              {uploadHistory.map(batch => {
                const isActive = batch.id === activeBatchId;
                const dateStr = new Date(batch.uploadedAt).toLocaleString([], {
                  month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                });
                return (
                  <div
                    key={batch.id}
                    onClick={() => setActiveBatchId(batch.id)}
                    style={{
                      padding: '12px 16px',
                      borderRadius: 12,
                      cursor: 'pointer',
                      background: isActive ? 'rgba(99, 102, 241, 0.08)' : 'var(--bg-surface-2)',
                      border: isActive ? '2px solid var(--color-primary-500)' : '2px solid transparent',
                      transition: 'all 0.2s',
                      position: 'relative'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 4 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', wordBreak: 'break-all', paddingRight: 20 }}>
                        {batch.listName}
                      </span>
                      <button
                        onClick={(e) => handleDeleteBatch(e, batch.id)}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          position: 'absolute',
                          top: 12,
                          right: 12,
                          padding: 4
                        }}
                        title="Delete from history"
                      >
                        <Trash2 size={13} style={{ color: 'var(--color-danger)' }} />
                      </button>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>
                      <Calendar size={11} />
                      <span>{dateStr}</span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontFamily: 'DM Mono, monospace', wordBreak: 'break-all', maxWidth: '60%' }}>
                        {batch.fileName}
                      </span>
                      <Badge variant={batch.importedCount > 0 ? 'success' : 'neutral'} style={{ fontSize: 10 }}>
                        {batch.importedCount} {batch.importedCount === 1 ? 'candidate' : 'candidates'}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Batch details & Candidate List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {activeBatch ? (
            <motion.div
              className="card"
              style={{ padding: 24 }}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                <div>
                  <h3 className="section-title" style={{ margin: 0 }}>Results: {activeBatch.listName}</h3>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    Uploaded file: <strong>{activeBatch.fileName}</strong>
                  </span>
                </div>
              </div>

              {/* KPI stat blocks */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 20 }}>
                {[
                  { label: 'Total Rows', value: activeBatch.totalRows, icon: FileText, color: '#6366f1' },
                  { label: 'Imported', value: activeBatch.importedCount, icon: CheckCircle, color: '#10b981' },
                  { label: 'Errors', value: activeBatch.errors?.length || 0, icon: AlertCircle, color: '#f43f5e' },
                ].map(s => (
                  <div key={s.label} className="kpi-card" style={{ padding: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <s.icon size={20} style={{ color: s.color }} />
                      <div>
                        <div style={{ fontSize: 22, fontWeight: 800, fontFamily: 'Syne' }}>{s.value}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{s.label}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Row Errors */}
              {activeBatch.errors?.length > 0 && (
                <div style={{ marginBottom: 20 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: 'var(--color-danger)' }}>
                    Row Errors ({activeBatch.errors.length})
                  </p>
                  <div style={{ maxHeight: 150, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {activeBatch.errors.map((e, i) => (
                      <div key={i} style={{
                        padding: '8px 12px', background: 'rgba(244,63,94,0.06)',
                        borderRadius: 8, fontSize: 12, color: 'var(--color-danger)',
                      }}>
                        Row {e.row}: {e.error}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Candidates list table */}
              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Users size={18} style={{ color: 'var(--color-primary-500)' }} />
                    <h4 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>Candidates Mapped</h4>
                  </div>

                  {/* Dynamic Filtering Controls */}
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                    {/* Search Field */}
                    <div style={{ position: 'relative', width: 220 }}>
                      <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                      <input
                        type="text"
                        placeholder="Search name, email, skills..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        style={{
                          paddingLeft: 30,
                          fontSize: 12,
                          height: 32,
                          borderRadius: 8,
                          border: '1px solid var(--border-color)',
                          background: 'var(--bg-surface-2)',
                          color: 'var(--text-primary)',
                          width: '100%',
                          outline: 'none',
                        }}
                      />
                    </div>

                    {/* Experience Select */}
                    <select
                      value={expFilter}
                      onChange={e => setExpFilter(e.target.value)}
                      style={{
                        fontSize: 12,
                        height: 32,
                        padding: '0 12px',
                        width: 145,
                        borderRadius: 8,
                        border: '1px solid var(--border-color)',
                        background: 'var(--bg-surface-2)',
                        color: 'var(--text-primary)',
                        cursor: 'pointer',
                        outline: 'none',
                      }}
                    >
                      <option value="">All Experience</option>
                      <option value="junior">Junior</option>
                      <option value="mid">Mid</option>
                      <option value="senior">Senior</option>
                    </select>

                    {/* Status Select */}
                    <select
                      value={statusFilter}
                      onChange={e => setStatusFilter(e.target.value)}
                      style={{
                        fontSize: 12,
                        height: 32,
                        padding: '0 12px',
                        width: 130,
                        borderRadius: 8,
                        border: '1px solid var(--border-color)',
                        background: 'var(--bg-surface-2)',
                        color: 'var(--text-primary)',
                        cursor: 'pointer',
                        outline: 'none',
                      }}
                    >
                      <option value="">All Statuses</option>
                      <option value="pending">Pending</option>
                      <option value="assigned">Assigned</option>
                      <option value="interviewed">Interviewed</option>
                    </select>
                  </div>
                </div>

                {filteredCandidates.length === 0 ? (
                  <div style={{ padding: '48px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
                    <Users size={32} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
                    <p style={{ fontSize: 13, margin: 0 }}>No matching candidates found</p>
                    <p style={{ fontSize: 11, marginTop: 4, opacity: 0.8 }}>Try adjusting your filters or search term</p>
                  </div>
                ) : (
                  <div className="table-wrapper">
                    <table>
                      <thead>
                        <tr>
                          <th>Candidate</th>
                          <th>Phone</th>
                          <th>Experience Level</th>
                          <th>Skills Mapped</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredCandidates.map((c, idx) => (
                          <tr key={idx}>
                            <td>
                              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                                <Avatar name={c.name} size="sm" />
                                <div>
                                  <div style={{ fontWeight: 700, fontSize: 13 }}>{c.name}</div>
                                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{c.email}</div>
                                </div>
                              </div>
                            </td>
                            <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                              {c.phone || '—'}
                            </td>
                            <td>
                              {c.experienceLevel ? (
                                <Badge variant={
                                  c.experienceLevel.toLowerCase() === 'senior' ? 'success' :
                                  c.experienceLevel.toLowerCase() === 'mid' ? 'info' : 'neutral'
                                }>
                                  {c.experienceLevel.toUpperCase()}
                                </Badge>
                              ) : (
                                <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>—</span>
                              )}
                            </td>
                            <td>
                              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                                {c.skills && c.skills.length > 0 ? (
                                  c.skills.map(skill => (
                                    <Badge key={skill} variant="neutral" style={{ fontSize: 10, padding: '2px 6px' }}>
                                      {skill}
                                    </Badge>
                                  ))
                                ) : (
                                  <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>—</span>
                                )}
                              </div>
                            </td>
                            <td>
                              <StatusBadge status={c.status} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </motion.div>
          ) : (
            <div className="card" style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>
              <Users size={40} style={{ margin: '0 auto 16px', opacity: 0.3 }} />
              <h4 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>Select an Uploaded Batch</h4>
              <p style={{ margin: '8px 0 0', fontSize: 12 }}>Click any record in the batch history list to review imported candidates, details, and errors.</p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
