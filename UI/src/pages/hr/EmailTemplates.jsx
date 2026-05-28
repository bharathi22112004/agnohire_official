import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Mail, Edit, Check, RefreshCw, Sparkles, Send } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { StatusBadge } from '../../components/ui/Badge';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { useAuthStore } from '../../store/authStore';

export default function EmailTemplates() {
  const { user } = useAuthStore();
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(null);

  const [subject, setSubject] = useState('');
  const [bodyHtml, setBodyHtml] = useState('');

  const [testing, setTesting] = useState(false);

  // States for manual bulk dispatch modal
  const [isDispatchModalOpen, setIsDispatchModalOpen] = useState(false);
  const [dispatchCandidates, setDispatchCandidates] = useState([]);
  const [selectedCandidateIds, setSelectedCandidateIds] = useState([]);
  const [fetchingCandidates, setFetchingCandidates] = useState(false);
  const [dispatching, setDispatching] = useState(false);
  const [candidateSearch, setCandidateSearch] = useState('');

  const templateStatusMap = {
    'Interview Invitation': 'assigned',
    'Interview Passed': 'passed',
    'Interview Failed': 'failed',
    'Interview On Hold': 'held'
  };

  async function handleOpenDispatch() {
    const status = templateStatusMap[selectedTemplate.name];
    if (!status) {
      toast.error(`Dispatch is not supported for ${selectedTemplate.name} template.`);
      return;
    }

    setIsDispatchModalOpen(true);
    setFetchingCandidates(true);
    setSelectedCandidateIds([]);
    setCandidateSearch('');

    try {
      const res = await api.get(`/candidates?status=${status}&limit=1000`);
      setDispatchCandidates(res.data.data.candidates || []);
    } catch {
      toast.error('Failed to fetch eligible candidates.');
    } finally {
      setFetchingCandidates(false);
    }
  }

  async function handleBulkEmailDispatch() {
    if (selectedCandidateIds.length === 0) {
      toast.error('Please select at least one candidate.');
      return;
    }

    setDispatching(true);
    try {
      const res = await api.post('/candidates/bulk-email', {
        templateId: selectedTemplate.id,
        candidateIds: selectedCandidateIds
      });
      toast.success(res.data.data.message || 'Successfully dispatched bulk emails.');
      setIsDispatchModalOpen(false);
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Failed to dispatch bulk emails.');
    } finally {
      setDispatching(false);
    }
  }

  function handleSelectCandidate(id) {
    if (selectedCandidateIds.includes(id)) {
      setSelectedCandidateIds(selectedCandidateIds.filter(cid => cid !== id));
    } else {
      setSelectedCandidateIds([...selectedCandidateIds, id]);
    }
  }

  function handleSelectAll(filtered) {
    const allFilteredIds = filtered.map(c => c.id);
    const areAllSelected = allFilteredIds.every(id => selectedCandidateIds.includes(id));

    if (areAllSelected) {
      setSelectedCandidateIds(selectedCandidateIds.filter(id => !allFilteredIds.includes(id)));
    } else {
      const newSelection = Array.from(new Set([...selectedCandidateIds, ...allFilteredIds]));
      setSelectedCandidateIds(newSelection);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function load() {
    try {
      const res = await api.get('/users/config/email-templates');
      const list = res.data.data.templates || [];
      setTemplates(list);
      if (list.length > 0) {
        selectTemplate(list[0]);
      }
    } catch {
      toast.error('Failed to load email templates');
    } finally {
      setLoading(false);
    }
  }

  function selectTemplate(t) {
    setSelectedTemplate(t);
    setSubject(t.subject);
    setBodyHtml(t.bodyHtml);
  }

  async function handleSave() {
    setSaving(true);
    try {
      await api.put(`/users/config/email-templates/${selectedTemplate.id}`, {
        subject,
        bodyHtml
      });
      toast.success('Email Template updated');
      load();
    } catch {
      toast.error('Failed to save template changes');
    } finally {
      setSaving(false);
    }
  }

  async function handleSendTest() {
    const targetEmail = user?.email;
    if (!targetEmail) {
      const promptEmail = window.prompt("Enter a real email address to receive this test preview:", "your-real-email@gmail.com");
      if (!promptEmail) return;
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(promptEmail.trim())) {
        return toast.error('Please enter a valid email address');
      }
      return executeSendTest(promptEmail.trim());
    }
    return executeSendTest(targetEmail);
  }

  async function executeSendTest(email) {
    setTesting(true);
    try {
      await api.post('/users/config/email-templates/test', {
        email,
        subject,
        bodyHtml
      });
      toast.success(`Test email successfully sent to ${email}! Check your inbox/spam.`);
    } catch (err) {
      const errMsg = err.response?.data?.error?.message || '';
      if (errMsg.includes('SMTP') || errMsg.includes('transport')) {
        toast((t) => (
          <span style={{ fontSize: 13, lineHeight: 1.4 }}>
            💡 <strong>Template Valid!</strong> But server SMTP credentials in <code>server/.env</code> are still the default placeholders. Configure your real SMTP credentials there to receive real emails!
          </span>
        ), { duration: 6000, icon: '⚠️' });
      } else {
        toast.error(errMsg || 'Failed to dispatch test email');
      }
    } finally {
      setTesting(false);
    }
  }

  function insertVariable(variable) {
    // Inserts at the end of body textarea
    setBodyHtml(prev => prev + ` ${variable} `);
  }

  if (loading) {
    return (
      <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div className="skeleton" style={{ height: 40, width: '30%' }} />
        <div className="skeleton" style={{ height: 320 }} />
      </div>
    );
  }

  const variableTokens = [
    { token: '{{candidateName}}', desc: 'Full name of candidate' },
    { token: '{{link}}', desc: 'Secure assessment execution link' },
    { token: '{{platformName}}', desc: 'AgnoHire custom system tag' },
    { token: '{{recruiterName}}', desc: 'Assigned recruiter name' },
    { token: '{{sectorName}}', desc: 'Assigned industrial sector' }
  ];

  const filteredCandidates = dispatchCandidates.filter(c =>
    (c.name || '').toLowerCase().includes(candidateSearch.toLowerCase()) ||
    (c.email || '').toLowerCase().includes(candidateSearch.toLowerCase())
  );

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Transactional Email Templates</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 4 }}>
            Customize dynamic auto-responder notifications, interview alerts, and decision templates
          </p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 20 }}>
        {/* Sidebar: List of templates */}
        <div className="card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <h3 style={{ fontSize: 13, fontWeight: 700, margin: '0 0 8px', color: 'var(--text-muted)' }}>Template Templates</h3>
          {templates.map(t => (
            <button
              key={t.id}
              onClick={() => selectTemplate(t)}
              className={`btn btn-block ${selectedTemplate?.id === t.id ? 'btn-primary' : 'btn-ghost'}`}
              style={{
                textAlign: 'left',
                justifyContent: 'flex-start',
                padding: '10px 14px',
                fontSize: 13,
                fontWeight: 600,
                border: '1px solid transparent',
                borderRadius: 10
              }}
            >
              <Mail size={14} style={{ marginRight: 8 }} />
              {t.name}
            </button>
          ))}
        </div>

        {/* Content: Selected template editor */}
        {selectedTemplate ? (
          <motion.div
            className="card"
            style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
          >
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Configure {selectedTemplate.name}</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 2 }}>Edit SMTP email templates utilizing markup tags</p>
            </div>

            {/* Insertion tokens */}
            <div>
              <h4 style={{ fontSize: 12, fontWeight: 700, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
                <Sparkles size={13} style={{ color: 'var(--color-brand)' }} />
                Click Dynamic Variable Pills to Insert:
              </h4>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {variableTokens.map(v => (
                  <button
                    key={v.token}
                    type="button"
                    onClick={() => insertVariable(v.token)}
                    className="badge badge-brand"
                    style={{ border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center' }}
                    title={v.desc}
                  >
                    {v.token}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <Input
                label="Email Subject Title"
                value={subject}
                onChange={e => setSubject(e.target.value)}
                required
              />

              <div className="input-group">
                <label className="label" style={{ fontWeight: 600, fontSize: 13, marginBottom: 6 }}>Email HTML Body Layout</label>
                <textarea
                  className="input"
                  style={{ minHeight: 280, fontFamily: 'DM Mono, Courier, monospace', fontSize: 13, lineHeight: '1.5' }}
                  value={bodyHtml}
                  onChange={e => setBodyHtml(e.target.value)}
                  required
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-color)', paddingTop: 20, marginTop: 12 }}>
              <Button variant="secondary" leftIcon={<Send size={14} />} onClick={handleSendTest} loading={testing}>
                Send Test Email
              </Button>
              <div style={{ display: 'flex', gap: 10 }}>
                {templateStatusMap[selectedTemplate.name] && (
                  <Button variant="outline" onClick={handleOpenDispatch} leftIcon={<Mail size={14} />}>
                    Dispatch to Candidates
                  </Button>
                )}
                <Button onClick={handleSave} loading={saving} leftIcon={<Check size={14} />}>
                  Save Template Changes
                </Button>
              </div>
            </div>
          </motion.div>
        ) : (
          <div className="card" style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>
            No Email Template Selected
          </div>
        )}
      </div>

      {/* Bulk Dispatch Modal */}
      <Modal
        isOpen={isDispatchModalOpen}
        onClose={() => setIsDispatchModalOpen(false)}
        title={`Dispatch Bulk Email: ${selectedTemplate?.name}`}
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setIsDispatchModalOpen(false)}>Cancel</Button>
            <Button
              onClick={handleBulkEmailDispatch}
              loading={dispatching}
              disabled={selectedCandidateIds.length === 0}
              leftIcon={<Send size={14} />}
            >
              Send to {selectedCandidateIds.length} Candidate{selectedCandidateIds.length !== 1 ? 's' : ''}
            </Button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13, margin: 0 }}>
            Select the validated candidates you want to send this template email to.
          </p>

          <Input
            placeholder="Search candidates by name or email..."
            value={candidateSearch}
            onChange={e => setCandidateSearch(e.target.value)}
          />

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              padding: '10px 14px',
              borderRadius: 8,
              background: 'var(--bg-card-header)',
              border: '1px solid var(--border-color)',
              fontSize: 12,
              fontWeight: 700,
              color: 'var(--text-muted)'
            }}>
              <div style={{ width: 40, display: 'flex', alignItems: 'center' }}>
                <input
                  type="checkbox"
                  checked={filteredCandidates.length > 0 && filteredCandidates.every(c => selectedCandidateIds.includes(c.id))}
                  ref={el => {
                    if (el) {
                      el.indeterminate = filteredCandidates.length > 0 &&
                        filteredCandidates.some(c => selectedCandidateIds.includes(c.id)) &&
                        !filteredCandidates.every(c => selectedCandidateIds.includes(c.id));
                    }
                  }}
                  onChange={() => handleSelectAll(filteredCandidates)}
                  style={{ cursor: 'pointer' }}
                />
              </div>
              <div style={{ flex: 2 }}>Candidate Details</div>
              <div style={{ flex: 1.5 }}>Sector / Department</div>
              <div style={{ flex: 1.2 }}>Current Status</div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 300, overflowY: 'auto', paddingRight: 4 }}>
              {fetchingCandidates ? (
                <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)' }}>
                  <RefreshCw className="animate-spin" size={20} style={{ margin: '0 auto 8px', color: 'var(--color-brand)' }} />
                  Fetching eligible candidates...
                </div>
              ) : filteredCandidates.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)', fontSize: 13 }}>
                  No candidates found with status <strong>{templateStatusMap[selectedTemplate?.name]}</strong>.
                </div>
              ) : (
                filteredCandidates.map(c => {
                  const isSelected = selectedCandidateIds.includes(c.id);
                  return (
                    <div
                      key={c.id}
                      onClick={() => handleSelectCandidate(c.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        padding: '10px 14px',
                        borderRadius: 10,
                        background: isSelected ? 'rgba(99, 102, 241, 0.04)' : 'var(--bg-surface)',
                        border: isSelected ? '1px solid var(--color-brand)' : '1px solid var(--border-color)',
                        fontSize: 13,
                        cursor: 'pointer',
                        transition: 'all 0.15s'
                      }}
                    >
                      <div style={{ width: 40, display: 'flex', alignItems: 'center' }} onClick={e => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleSelectCandidate(c.id)}
                          style={{ cursor: 'pointer' }}
                        />
                      </div>
                      <div style={{ flex: 2 }}>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{c.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{c.email}</div>
                      </div>
                      <div style={{ flex: 1.5, color: 'var(--text-secondary)', fontSize: 12 }}>
                        {c.sector?.name || 'N/A'}
                      </div>
                      <div style={{ flex: 1.2 }}>
                        <StatusBadge status={c.status} />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
