import { useState, useEffect } from 'react';
import { motion, Reorder } from 'framer-motion';
import { Plus, BookOpen, HelpCircle, Eye, Trash2, Cpu, FileText } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Input, Select } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { Badge } from '../../components/ui/Badge';
import { useAuthStore } from '../../store/authStore';
import api from '../../services/api';
import toast from 'react-hot-toast';

export default function RecruiterQuestionBank() {
  const [banks, setBanks] = useState([]);
  const [domains, setDomains] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [showCreateBank, setShowCreateBank] = useState(false);
  const [showQuestions, setShowQuestions] = useState(false);
  const [showCreateQuestion, setShowCreateQuestion] = useState(false);
  const [showAIGenerate, setShowAIGenerate] = useState(false);

  // Selection
  const [activeBank, setActiveBank] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [loadingQuestions, setLoadingQuestions] = useState(false);

  // Forms
  const [bankForm, setBankForm] = useState({ name: '', domainId: '' });
  const [qForm, setQForm] = useState({
    text: '', type: 'coding', difficulty: 'medium',
    options: null,
    correctAnswer: null, skillTags: ''
  });
  const [aiForm, setAiForm] = useState({ difficulty: 'medium', count: 5 });

  const [submitting, setSubmitting] = useState(false);

  const user = useAuthStore(state => state.user);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [banksRes, domainsRes] = await Promise.all([
        api.get('/questions/banks'),
        api.get(`/sectors/${user.sectorId}/domains`)
      ]);
      setBanks(banksRes.data.data.banks || []);
      setDomains(domainsRes.data.data.domains || []);
    } catch {
      toast.error('Failed to load assessment banks');
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateBank(e) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post('/questions/banks', {
        ...bankForm,
        recruiterId: user.id
      });
      toast.success('Assessment template bank created');
      setShowCreateBank(false);
      setBankForm({ name: '', domainId: '' });
      loadData();
    } catch {
      toast.error('Failed to create question bank');
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
      setQuestions(res.data.data.questions || []);
    } catch {
      toast.error('Failed to retrieve question listings');
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
      toast.success('Question successfully mapped');
      setShowCreateQuestion(false);
      setQForm({
        text: '', type: 'coding', difficulty: 'medium',
        options: null,
        correctAnswer: null, skillTags: ''
      });
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
      const domainName = activeBank.domain?.name || 'Software Development';
      await api.post('/questions/ai-generate', {
        bankId: activeBank.id,
        domain: domainName,
        difficulty: aiForm.difficulty,
        count: parseInt(aiForm.count)
      });
      toast.success('AI questions generated and saved');
      setShowAIGenerate(false);
      loadData();
      handleOpenQuestions(activeBank);
    } catch {
      toast.error('Failed to generate AI questions');
    } finally {
      setSubmitting(false);
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
          <h1 className="page-title">Assessor Question Bank</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 4 }}>
            Create and maintain interview assessment templates and custom question queues
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
            No question banks created in your profile yet
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
                  {bank.isAiGenerated && (
                    <Badge variant="brand">
                      <Cpu size={11} style={{ marginRight: 4 }} /> AI SEEDED
                    </Badge>
                  )}
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
        title="New Assessment Template"
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowCreateBank(false)}>Cancel</Button>
            <Button onClick={handleCreateBank} loading={submitting}>Create Bank</Button>
          </>
        }
      >
        <form onSubmit={handleCreateBank} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Input
            label="Template Name"
            placeholder="e.g. React Front-End Assessment"
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
        </form>
      </Modal>

      {/* View Questions Modal */}
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
              <Reorder.Group axis="y" values={questions} onReorder={setQuestions} style={{ listStyleType: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
                 {questions.map((q, idx) => {
                  const diffColor = q.difficulty === 'hard' ? '#ef4444' : q.difficulty === 'easy' ? '#10b981' : '#f59e0b';
                  const diffBg = q.difficulty === 'hard' ? 'rgba(239,68,68,0.1)' : q.difficulty === 'easy' ? 'rgba(16,185,129,0.1)' : 'rgba(245,158,11,0.1)';

                  return (
                    <Reorder.Item key={q.id} value={q} style={{ border: `1px solid var(--border-color)`, borderLeft: `4px solid ${diffColor}`, borderRadius: 12, padding: 16, background: 'var(--bg-surface)', cursor: 'grab' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div style={{ fontWeight: 600, fontSize: 13, display: 'flex', gap: 8, alignItems: 'center' }}>
                          <span style={{ cursor: 'grab', color: 'var(--text-muted)' }}>⋮⋮</span>
                          {q.order || (idx + 1)}. {q.text}
                        </div>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <span className="badge" style={{ background: diffBg, color: diffColor, textTransform: 'uppercase' }}>
                            {q.difficulty}
                          </span>
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
                    </Reorder.Item>
                  );
                })}
              </Reorder.Group>
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

          <Input label="Skill Tags" placeholder="React, Redux, Context API" value={qForm.skillTags} onChange={e => setQForm({ ...qForm, skillTags: e.target.value })} />
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
