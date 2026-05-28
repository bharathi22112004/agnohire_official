import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Plus, BookOpen, User, HelpCircle, Eye, Trash2, Cpu, FileText, CheckCircle } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Input, Select } from '../../components/ui/Input';
import { Modal, ConfirmDialog } from '../../components/ui/Modal';
import { Badge } from '../../components/ui/Badge';
import { useAuthStore } from '../../store/authStore';
import api from '../../services/api';
import toast from 'react-hot-toast';

export default function QuestionBank() {
  const [banks, setBanks] = useState([]);
  const [domains, setDomains] = useState([]);
  const [recruiters, setRecruiters] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal Controls
  const [showCreateBank, setShowCreateBank] = useState(false);
  const [showQuestions, setShowQuestions] = useState(false);
  const [showCreateQuestion, setShowCreateQuestion] = useState(false);
  const [showAIGenerate, setShowAIGenerate] = useState(false);

  // Selections
  const [activeBank, setActiveBank] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [loadingQuestions, setLoadingQuestions] = useState(false);

  // Forms
  const [bankForm, setBankForm] = useState({ name: '', domainId: '', recruiterId: '', file: null });
  const [qForm, setQForm] = useState({
    text: '', type: 'coding', difficulty: 'medium',
    options: null,
    correctAnswer: null, skillTags: ''
  });
  const [aiForm, setAiForm] = useState({ difficulty: 'medium', count: 5 });
  const [activeTab, setActiveTab] = useState('upload'); // 'upload' or 'manual'

  const [submitting, setSubmitting] = useState(false);

  const user = useAuthStore(state => state.user);
  const fileInputRef = useRef(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [banksRes, domainsRes, usersRes] = await Promise.all([
        api.get('/questions/banks'),
        api.get(`/sectors/${user.sectorId}/domains`),
        api.get('/users?limit=100&role=recruiter')
      ]);
      setBanks(banksRes.data.data.banks);
      setDomains(domainsRes.data.data.domains || []);
      setRecruiters(usersRes.data.data.users.filter(u => u.role?.name === 'recruiter'));
    } catch {
      toast.error('Failed to load question bank data');
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateBank(e) {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (activeTab === 'upload' && bankForm.file) {
        const formData = new FormData();
        formData.append('name', bankForm.name);
        if (bankForm.domainId) formData.append('domainId', bankForm.domainId);
        formData.append('file', bankForm.file);

        await api.post('/questions/banks/upload', formData);
        toast.success('Document parsed and Question Bank created');
      } else {
        await api.post('/questions/banks', {
          name: bankForm.name,
          domainId: bankForm.domainId,
          recruiterId: bankForm.recruiterId
        });
        toast.success('Empty Question Bank created');
      }

      setShowCreateBank(false);
      setBankForm({ name: '', domainId: '', recruiterId: '', file: null });
      setActiveTab('upload');
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create question bank');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleOpenQuestions(bank) {
    setActiveBank(bank);
    setShowQuestions(true);
    setLoadingQuestions(true);
    try {
      const res = await api.get(`/questions/banks/${bank.id}/questions`);
      setQuestions(res.data.data.questions);
    } catch {
      toast.error('Failed to load questions');
    } finally {
      setLoadingQuestions(false);
    }
  }

  async function handleCreateQuestion(e) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = {
        text: qForm.text,
        type: qForm.type,
        difficulty: qForm.difficulty,
        skillTags: qForm.skillTags.split(',').map(s => s.trim()).filter(Boolean),
        ...(qForm.type === 'coding' && {
          options: {
            languages: ['javascript', 'python'],
            starters: {
              javascript: 'function solution() {\n  // Write your code here\n}',
              python: 'def solution():\n    # Write your code here\n    pass'
            },
            testCases: [
              { input: '()', output: 'true' }
            ]
          },
          correctAnswer: null
        })
      };
      await api.post(`/questions/banks/${activeBank.id}/questions`, payload);
      toast.success('Question added successfully');
      setShowCreateQuestion(false);
      setQForm({
        text: '', type: 'coding', difficulty: 'medium',
        options: null,
        correctAnswer: null, skillTags: ''
      });
      // Reload questions
      handleOpenQuestions(activeBank);
    } catch {
      toast.error('Failed to create question');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAIGenerate(e) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const domainName = activeBank.domain?.name || 'Software';
      await api.post('/questions/ai-generate', {
        bankId: activeBank.id,
        domain: domainName,
        difficulty: aiForm.difficulty,
        count: parseInt(aiForm.count)
      });
      toast.success(`Generated AI questions successfully`);
      setShowAIGenerate(false);
      loadData();
      handleOpenQuestions(activeBank);
    } catch {
      toast.error('Failed to generate AI questions');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteBank(bankId) {
    if (!window.confirm('Are you sure you want to delete this Question Bank? All associated questions will also be deleted.')) return;
    try {
      await api.delete(`/questions/banks/${bankId}`);
      toast.success('Question Bank deleted');
      setBanks(banks.filter(b => b.id !== bankId));
    } catch {
      toast.error('Failed to delete question bank');
    }
  }

  async function handleDeleteQuestion(qid) {
    try {
      await api.delete(`/questions/banks/${activeBank.id}/questions/${qid}`);
      toast.success('Question removed');
      setQuestions(questions.filter(q => q.id !== qid));
    } catch {
      toast.error('Failed to delete question');
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Sector Question Bank</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 4 }}>
            Create and maintain interview assessment templates and AI question queues
          </p>
        </div>
        <Button leftIcon={<Plus size={16} />} onClick={() => setShowCreateBank(true)}>
          New Question Bank
        </Button>
      </div>

      {/* Grid of Banks */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
        {loading ? (
          [1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: 160 }} />)
        ) : banks.length === 0 ? (
          <div className="card" style={{ gridColumn: '1 / -1', padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>
            <BookOpen size={32} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
            No question banks created in this sector yet
          </div>
        ) : (
          banks.map((bank, i) => (
            <motion.div
              key={bank.id}
              className="card"
              style={{ padding: 20, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: 180 }}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>{bank.name}</h3>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    {bank.isAiGenerated && (
                      <Badge variant="brand">
                        <Cpu size={11} style={{ marginRight: 4 }} /> AI SEEDED
                      </Badge>
                    )}
                    <button
                      onClick={() => handleDeleteBank(bank.id)}
                      className="btn btn-ghost btn-sm btn-icon"
                      style={{ color: 'var(--color-danger)', padding: 4 }}
                      title="Delete Question Bank"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-secondary)' }}>
                    <HelpCircle size={13} style={{ color: 'var(--text-muted)' }} />
                    {bank._count?.questions || 0} Questions Loaded
                  </div>
                  {bank.domain && (
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      Core Domain: <strong style={{ color: 'var(--text-secondary)' }}>{bank.domain.name}</strong>
                    </div>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8, marginTop: 20, paddingTop: 12, borderTop: '1px solid var(--border-color)' }}>
                <Button variant="secondary" size="sm" leftIcon={<Eye size={13} />} onClick={() => handleOpenQuestions(bank)} style={{ flex: 1 }}>
                  View Questions
                </Button>
                <Button variant="ghost" size="sm" leftIcon={<Cpu size={13} />} onClick={() => { setActiveBank(bank); setShowAIGenerate(true); }} style={{ color: 'var(--color-brand)' }}>
                  Auto-Gen AI
                </Button>
              </div>
            </motion.div>
          ))
        )}
      </div>

      {/* Create Bank Modal */}
      <Modal
        isOpen={showCreateBank}
        onClose={() => setShowCreateBank(false)}
        title="Question Bank Workspace"
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowCreateBank(false)}>Cancel</Button>
            <Button onClick={handleCreateBank} loading={submitting}>
              {activeTab === 'upload' ? 'Upload & Extract Questions' : 'Create Bank'}
            </Button>
          </>
        }
      >
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, borderBottom: '1px solid var(--border-color)', paddingBottom: 12 }}>
          <button
            type="button"
            onClick={() => setActiveTab('upload')}
            className={`btn btn-sm ${activeTab === 'upload' ? 'btn-primary' : 'btn-ghost'}`}
          >
            <FileText size={14} style={{ marginRight: 6 }} /> Document Upload
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('manual')}
            className={`btn btn-sm ${activeTab === 'manual' ? 'btn-primary' : 'btn-ghost'}`}
          >
            <Plus size={14} style={{ marginRight: 6 }} /> Manual Creation
          </button>
        </div>

        <form onSubmit={handleCreateBank} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Input
            label="Template Name"
            placeholder="e.g. Node.js Mid-Level Assessment"
            value={bankForm.name}
            onChange={e => setBankForm({ ...bankForm, name: e.target.value })}
            required
          />

          <Select
            label="Assigned Skill Domain"
            value={bankForm.domainId}
            onChange={e => setBankForm({ ...bankForm, domainId: e.target.value })}
            required
          >
            <option value="">Select Domain...</option>
            {domains.map(d => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </Select>

          {activeTab === 'upload' && (
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>
                Upload Assessment Document (PDF or Word)
              </label>
              <div
                style={{
                  border: '2px dashed var(--color-primary-300)',
                  borderRadius: 12,
                  padding: 32,
                  textAlign: 'center',
                  background: 'var(--bg-surface)',
                  cursor: 'pointer',
                  transition: 'background 0.2s',
                  position: 'relative'
                }}
                onClick={() => fileInputRef.current?.click()}
                className="hover:bg-indigo-50 dark:hover:bg-slate-800"
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  style={{ display: 'none' }}
                  accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  onChange={e => {
                    if (e.target.files && e.target.files[0]) {
                      setBankForm({ ...bankForm, file: e.target.files[0] });
                    }
                  }}
                />
                {!bankForm.file ? (
                  <>
                    <FileText size={32} style={{ margin: '0 auto 12px', color: 'var(--color-primary-400)' }} />
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--color-primary-600)' }}>
                      Click to upload Document
                    </p>
                    <p style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--text-muted)' }}>
                      Supports PDF or DOCX formats
                    </p>
                  </>
                ) : (
                  <>
                    <CheckCircle size={32} style={{ margin: '0 auto 12px', color: 'var(--color-success)' }} />
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--color-success)' }}>
                      {bankForm.file.name}
                    </p>
                    <p style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--text-muted)' }}>
                      {(bankForm.file.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setBankForm({ ...bankForm, file: null }); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                      style={{ marginTop: 12, fontSize: 12, color: 'var(--color-danger)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}
                    >
                      Remove File
                    </button>
                  </>
                )}
              </div>
            </div>
          )}

          {activeTab === 'manual' && (
            <Select
              label="Assigned Recruiter (Optional)"
              value={bankForm.recruiterId}
              onChange={e => setBankForm({ ...bankForm, recruiterId: e.target.value })}
            >
              <option value="">No Recruiter (Unassigned)</option>
              {recruiters.map(r => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </Select>
          )}
        </form>
      </Modal>

      {/* View/Edit Questions Modal */}
      <Modal
        isOpen={showQuestions}
        onClose={() => setShowQuestions(false)}
        title={`Template Questions — ${activeBank?.name}`}
        size="lg"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h4 style={{ fontSize: 13, fontWeight: 700, margin: 0 }}>Questions Array ({questions.length})</h4>
            <Button size="sm" leftIcon={<Plus size={13} />} onClick={() => setShowCreateQuestion(true)}>Add Question</Button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxHeight: 400, overflowY: 'auto', paddingRight: 6 }}>
            {loadingQuestions ? (
              <div className="skeleton" style={{ height: 120 }} />
            ) : questions.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)', border: '1px dashed var(--border-color)', borderRadius: 12 }}>
                No questions exist inside this template bank
              </div>
            ) : (
              questions.map((q, idx) => (
                <div key={q.id} style={{ border: '1px solid var(--border-color)', borderRadius: 12, padding: 16, background: 'var(--bg-surface)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{q.order || (idx + 1)}. {q.text}</div>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <Badge variant={q.difficulty === 'hard' ? 'danger' : q.difficulty === 'easy' ? 'success' : 'warning'}>
                        {q.difficulty.toUpperCase()}
                      </Badge>
                      <Badge variant="neutral">
                        {q.type.toUpperCase()}
                      </Badge>
                    </div>
                  </div>

                  {q.type === 'coding' && (
                    <div style={{ marginTop: 12, padding: 10, background: 'var(--bg-card-header)', border: '1px dashed var(--color-primary-300)', borderRadius: 8, fontSize: 11, fontFamily: 'monospace', color: 'var(--text-secondary)' }}>
                      📄 Interactive Code Notepad Enabled (Languages: JavaScript, Python)
                    </div>
                  )}
                  {q.type === 'text' && (
                    <div style={{ marginTop: 12, padding: 10, background: 'var(--bg-card-header)', border: '1px dashed var(--border-color)', borderRadius: 8, fontSize: 11, fontStyle: 'italic', color: 'var(--text-muted)' }}>
                      ✍ Subjective Text Response Required (Voice to Text Enabled)
                    </div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
                    <button
                      onClick={() => handleDeleteQuestion(q.id)}
                      className="btn btn-ghost btn-icon btn-sm"
                      style={{ color: 'var(--color-danger)' }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </Modal>

      {/* Create Manual Question Modal */}
      <Modal
        isOpen={showCreateQuestion}
        onClose={() => setShowCreateQuestion(false)}
        title="Add Assessment Question"
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowCreateQuestion(false)}>Cancel</Button>
            <Button onClick={handleCreateQuestion} loading={submitting}>Add Question</Button>
          </>
        }
      >
        <form onSubmit={handleCreateQuestion} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Input label="Question Wording" value={qForm.text} onChange={e => setQForm({ ...qForm, text: e.target.value })} required />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Select label="Type" value={qForm.type} onChange={e => setQForm({ ...qForm, type: e.target.value })}>
              <option value="coding">Coding Lab</option>
            </Select>
            <Select label="Difficulty" value={qForm.difficulty} onChange={e => setQForm({ ...qForm, difficulty: e.target.value })}>
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </Select>
          </div>

          <Input label="Skill Tags" placeholder="Node.js, Express, Middleware" value={qForm.skillTags} onChange={e => setQForm({ ...qForm, skillTags: e.target.value })} />
        </form>
      </Modal>

      <Modal
        isOpen={showAIGenerate}
        onClose={() => setShowAIGenerate(false)}
        title="Auto-Gen Engine"
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowAIGenerate(false)}>Cancel</Button>
            <Button onClick={handleAIGenerate} loading={submitting} leftIcon={<Cpu size={14} />}>Generate Questions</Button>
          </>
        }
      >
        <form onSubmit={handleAIGenerate} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-secondary)', padding: '10px 14px', borderRadius: 12, border: '1px solid var(--border-color)', background: 'var(--bg-card-header)' }}>
            <Cpu size={16} style={{ color: 'var(--color-brand)' }} />
            <span style={{ fontSize: 13 }}>Seeding assessment template for: <strong>{activeBank?.domain?.name}</strong></span>
          </div>

          <Select label="Cognitive Difficulty" value={aiForm.difficulty} onChange={e => setAiForm({ ...aiForm, difficulty: e.target.value })}>
            <option value="easy">Easy Entry Level</option>
            <option value="medium">Medium Experienced</option>
            <option value="hard">Hard Senior Expert</option>
          </Select>

          <Input label="Target Question Count" type="number" min={1} max={15} value={aiForm.count} onChange={e => setAiForm({ ...aiForm, count: e.target.value })} />
        </form>
      </Modal>
    </div>
  );
}
