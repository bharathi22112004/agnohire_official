import { useState, useEffect } from 'react';
import { motion, Reorder } from 'framer-motion';
import { Plus, BookOpen, HelpCircle, Eye, Trash2, Cpu, FileText, Code } from 'lucide-react';
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
  const [activeTab, setActiveTab] = useState('manual'); // 'manual' or 'coding'
  const [manualQuestions, setManualQuestions] = useState([]);
  const [qForm, setQForm] = useState({ text: '', type: 'coding', difficulty: 'medium', optionA: '', optionB: '', optionC: '', optionD: '', correctAnswer: 'a', skillTags: '' });
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
      const payload = {
        ...bankForm,
        recruiterId: user.id,
        ...(manualQuestions.length > 0 && {
          questions: {
            create: manualQuestions.map((q, idx) => ({
              text: q.text,
              type: q.type,
              difficulty: q.difficulty,
              skillTags: q.skillTags.split(',').map(s => s.trim()).filter(Boolean),
              order: idx + 1,
              createdBy: user.id,
              ...(q.type === 'coding' && {
                options: {
                  languages: ['javascript', 'python', 'cpp'],
                  starters: {
                    javascript: 'function solution() {\n  // Write your code here\n}',
                    python: 'def solution():\n    # Write your code here\n    pass',
                    cpp: '#include <iostream>\n\nint main() {\n    // Write your code here\n    return 0;\n}'
                  }
                }
              })
            }))
          }
        })
      };
      await api.post('/questions/banks', payload);
      toast.success('Assessment template bank created');
      setShowCreateBank(false);
      setBankForm({ name: '', domainId: '' });
      setManualQuestions([]);
      setActiveTab('manual');
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
            languages: ['javascript', 'python', 'cpp'],
            starters: {
              javascript: 'function solution() {\n  // Write your code here\n}',
              python: 'def solution():\n    # Write your code here\n    pass',
              cpp: '#include <iostream>\n\nint main() {\n    // Write your code here\n    return 0;\n}'
            }
          }
        })
      };
      await api.post(`/questions/banks/${activeBank.id}/questions`, payload);
      toast.success('Question successfully mapped');
      setShowCreateQuestion(false);
      setQForm({ text: '', type: 'coding', difficulty: 'medium', optionA: '', optionB: '', optionC: '', optionD: '', correctAnswer: 'a', skillTags: '' });
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

      <Modal
        isOpen={showCreateBank}
        onClose={() => setShowCreateBank(false)}
        title="New Assessment Template"
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => { setShowCreateBank(false); setManualQuestions([]); setActiveTab('manual'); }}>Cancel</Button>
            <Button onClick={handleCreateBank} loading={submitting}>Create Bank</Button>
          </>
        }
      >
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, borderBottom: '1px solid var(--border-color)', paddingBottom: 12 }}>
          <button 
            type="button"
            onClick={() => { setActiveTab('manual'); setManualQuestions([]); }}
            className={`btn btn-sm ${activeTab === 'manual' ? 'btn-primary' : 'btn-ghost'}`}
          >
            <Plus size={14} style={{ marginRight: 6 }} /> Manual Creation
          </button>
          <button 
            type="button"
            onClick={() => { setActiveTab('coding'); setManualQuestions([{ text: '', type: 'coding', difficulty: 'medium', skillTags: '' }]); }}
            className={`btn btn-sm ${activeTab === 'coding' ? 'btn-primary' : 'btn-ghost'}`}
          >
            <Code size={14} style={{ marginRight: 6 }} /> Coding Questions
          </button>
        </div>

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

          {/* Manual Questions list */}
          <div style={{ marginTop: 8, borderTop: '1px solid var(--border-color)', paddingTop: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)' }}>
                {activeTab === 'coding' ? 'Coding Challenges' : 'Template Questions'} ({manualQuestions.length})
              </label>
              <div style={{ display: 'flex', gap: 8 }}>
                {activeTab === 'coding' ? (
                  <Button 
                    type="button" 
                    size="sm" 
                    variant="secondary"
                    onClick={() => setManualQuestions([...manualQuestions, { text: '', type: 'coding', difficulty: 'medium', skillTags: '' }])}
                  >
                    + Add Coding Question
                  </Button>
                ) : (
                  <>
                    <Button 
                      type="button" 
                      size="sm" 
                      variant="secondary"
                      onClick={() => setManualQuestions([...manualQuestions, { text: '', type: 'coding', difficulty: 'medium', skillTags: '' }])}
                    >
                      + Add Coding Question
                    </Button>
                    <Button 
                      type="button" 
                      size="sm" 
                      variant="secondary"
                      onClick={() => setManualQuestions([...manualQuestions, { text: '', type: 'text', difficulty: 'medium', skillTags: '' }])}
                    >
                      + Add Subjective Question
                    </Button>
                  </>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxHeight: 300, overflowY: 'auto', paddingRight: 4 }}>
              {manualQuestions.map((q, idx) => (
                <div key={idx} style={{ padding: 14, border: '1px solid var(--border-color)', borderRadius: 12, background: 'var(--bg-card-header)', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)' }}>
                      {q.type === 'coding' ? 'Coding Question' : 'Subjective Question'} #{idx + 1}
                    </span>
                    <button 
                      type="button"
                      className="btn btn-ghost btn-sm btn-icon"
                      style={{ color: 'var(--color-danger)' }}
                      onClick={() => setManualQuestions(manualQuestions.filter((_, i) => i !== idx))}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  
                  <Input 
                    label="Question Wording" 
                    value={q.text} 
                    onChange={e => {
                      const newQs = [...manualQuestions];
                      newQs[idx].text = e.target.value;
                      setManualQuestions(newQs);
                    }} 
                    placeholder={q.type === 'coding' ? 'e.g. Implement function to detect cycle in linked list...' : 'e.g. Explain how virtual DOM reconciles in React...'}
                    required 
                  />

                  <div style={{ display: 'grid', gridTemplateColumns: activeTab === 'coding' ? '1fr 1fr' : '1fr 1fr 1fr', gap: 10 }}>
                    {activeTab !== 'coding' && (
                      <Select 
                        label="Type" 
                        value={q.type} 
                        onChange={e => {
                          const newQs = [...manualQuestions];
                          newQs[idx].type = e.target.value;
                          setManualQuestions(newQs);
                        }}
                      >
                        <option value="coding">Coding Challenge</option>
                        <option value="text">Subjective Text</option>
                      </Select>
                    )}

                    <Select 
                      label="Difficulty" 
                      value={q.difficulty} 
                      onChange={e => {
                        const newQs = [...manualQuestions];
                        newQs[idx].difficulty = e.target.value;
                        setManualQuestions(newQs);
                      }}
                    >
                      <option value="easy">Easy</option>
                      <option value="medium">Medium</option>
                      <option value="hard">Hard</option>
                    </Select>

                    <Input 
                      label="Skill Tags" 
                      value={q.skillTags} 
                      onChange={e => {
                        const newQs = [...manualQuestions];
                        newQs[idx].skillTags = e.target.value;
                        setManualQuestions(newQs);
                      }} 
                      placeholder="React, algorithms..."
                    />
                  </div>
                </div>
              ))}
              {manualQuestions.length === 0 && (
                <div style={{ textAlign: 'center', padding: 24, fontSize: 12, color: 'var(--text-muted)', border: '1px dashed var(--border-color)', borderRadius: 12 }}>
                  {activeTab === 'coding' ? 'Add coding challenges to initialize the bank with.' : 'Optional: Add coding and subjective questions to initialize the bank with.'}
                </div>
              )}
            </div>
          </div>
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
                {questions.map(q => {
                  const diffColor = q.difficulty === 'hard' ? '#ef4444' : q.difficulty === 'easy' ? '#10b981' : '#f59e0b';
                  const diffBg = q.difficulty === 'hard' ? 'rgba(239,68,68,0.1)' : q.difficulty === 'easy' ? 'rgba(16,185,129,0.1)' : 'rgba(245,158,11,0.1)';
                  
                  return (
                    <Reorder.Item key={q.id} value={q} style={{ border: `1px solid var(--border-color)`, borderLeft: `4px solid ${diffColor}`, borderRadius: 12, padding: 16, background: 'var(--bg-surface)', cursor: 'grab' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div style={{ fontWeight: 600, fontSize: 13, display: 'flex', gap: 8, alignItems: 'center' }}>
                          <span style={{ cursor: 'grab', color: 'var(--text-muted)' }}>⋮⋮</span>
                          {q.text}
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

                      {q.type === 'mcq' && q.options && (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 12 }}>
                          {Object.entries(q.options).map(([key, val]) => (
                            <div key={key} style={{
                              fontSize: 12, padding: '6px 10px', borderRadius: 8,
                              background: q.correctAnswer === key ? 'var(--bg-card-header)' : 'var(--bg-surface)',
                              border: q.correctAnswer === key ? '1px solid var(--color-success)' : '1px solid var(--border-color)',
                              color: q.correctAnswer === key ? 'var(--color-success)' : 'var(--text-secondary)'
                            }}>
                              <strong>{key.toUpperCase()}:</strong> {val}
                            </div>
                          ))}
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
              <option value="coding">Coding Challenge</option>
              <option value="text">Subjective Text Response</option>
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

      {/* AI Generate Modal */}
      <Modal
        isOpen={showAIGenerate}
        onClose={() => setShowAIGenerate(false)}
        title="AI Automation Engine"
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
            <span style={{ fontSize: 13 }}>Generating AI interview template for: <strong>{activeBank?.domain?.name}</strong></span>
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
