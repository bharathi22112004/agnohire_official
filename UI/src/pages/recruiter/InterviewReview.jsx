import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  User, CheckCircle, Clock, XCircle, Award, Volume2,
  FileText, ShieldCheck, Heart, Sparkles, MessageSquare, Mic
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Badge, StatusBadge } from '../../components/ui/Badge';
import { useAuthStore } from '../../store/authStore';
import api from '../../services/api';
import toast from 'react-hot-toast';

export default function InterviewReview() {
  const [interviews, setInterviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedInterview, setSelectedInterview] = useState(null);

  const [feedback, setFeedback] = useState('');
  const [decision, setDecision] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [playingAudio, setPlayingAudio] = useState(null);

  const user = useAuthStore(state => state.user);

  async function loadData() {
    try {
      const res = await api.get(`/interviews?recruiterId=${user.id}`);
      const list = res.data.data.interviews || [];
      setInterviews(list);
      if (list.length > 0) {
        handleSelectInterview(list[0].id);
      }
    } catch {
      toast.error('Failed to load candidate review list');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [user.id]);

  async function handleSelectInterview(id) {
    try {
      const res = await api.get(`/interviews/${id}`);
      const iv = res.data.data.interview;
      setSelectedInterview(iv);
      setFeedback(iv.result?.feedback || '');

      const answers = iv.answers || [];
      const totalScore = answers.reduce((sum, ans) => sum + (ans.score || 0), 0);
      const averageScore = answers.length ? (totalScore / answers.length) : 0;
      const autoDecision = averageScore >= 6.0 ? 'pass' : 'fail';

      setDecision(iv.result?.recruiterDecision || autoDecision);
    } catch {
      toast.error('Failed to fetch full interview transcript');
    }
  }

  async function handleSubmitDecision() {
    if (!decision) return toast.error('Please select an outcome decision (Pass/Fail/Hold)');
    if (!feedback) return toast.error('Please provide review feedback');

    setSubmitting(true);
    try {
      await api.post(`/interviews/${selectedInterview.id}/validate`, {
        decision,
        feedback
      });
      toast.success(`Hiring decision finalized: ${decision.toUpperCase()}`);
      loadData();
    } catch {
      toast.error('Failed to submit hiring outcome');
    } finally {
      setSubmitting(false);
    }
  }

  function simulateAudioPlay(idx) {
    if (playingAudio === idx) {
      setPlayingAudio(null);
    } else {
      setPlayingAudio(idx);
      setTimeout(() => {
        setPlayingAudio(null);
      }, 5000); // Simulate playing for 5 seconds
    }
  }

  if (loading) {
    return (
      <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div className="skeleton" style={{ height: 40, width: '30%' }} />
        <div className="skeleton" style={{ height: 320 }} />
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Decision Center</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 4 }}>
            Analyze AI scoring profiles, playback audio submissions, and issue dynamic hiring outcomes
          </p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 20 }}>
        {/* Sidebar: Interview lists */}
        <div className="card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 600, overflowY: 'auto' }}>
          <h3 style={{ fontSize: 13, fontWeight: 700, margin: '0 0 8px', color: 'var(--text-muted)' }}>
            Evaluation Pipeline ({interviews.length})
          </h3>

          {interviews.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 24, fontSize: 12, color: 'var(--text-muted)' }}>
              No completed interviews awaiting review.
            </div>
          ) : (
            interviews.map(iv => {
              const active = selectedInterview?.id === iv.id;
              return (
                <button
                  key={iv.id}
                  onClick={() => handleSelectInterview(iv.id)}
                  className={`btn btn-block ${active ? 'btn-primary' : 'btn-ghost'}`}
                  style={{
                    textAlign: 'left',
                    justifyContent: 'flex-start',
                    padding: '10px 14px',
                    border: '1px solid transparent',
                    borderRadius: 10,
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    gap: 4
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: 13, display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                    <span>{iv.candidate.name}</span>
                    <span style={{ fontSize: 10, color: 'var(--color-brand)' }}>
                      AI: {Math.round(iv.result?.aiScore || 80)}%
                    </span>
                  </div>
                  <div style={{ fontSize: 11, opacity: 0.8, display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                    <span>{iv.candidate.domain?.name || iv.candidate.domain || 'Unassigned'}</span>
                    <span style={{ fontSize: 10 }}>{iv.status.toUpperCase()}</span>
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Content: Selected candidate transcript details */}
        {selectedInterview ? (
          <motion.div
            style={{ display: 'flex', flexDirection: 'column', gap: 20 }}
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
          >
            {/* Header info */}
            <div className="card" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>{selectedInterview.candidate.name}</h2>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                    Assigned Domain: <strong>{selectedInterview.candidate.domain?.name || selectedInterview.candidate.domain || interviews.find(i => i.id === selectedInterview.id)?.candidate?.domain?.name || interviews.find(i => i.id === selectedInterview.id)?.candidate?.domain || 'Unassigned'}</strong> • <span style={{ color: selectedInterview.completedAt ? 'var(--color-success)' : 'inherit', fontWeight: selectedInterview.completedAt ? 600 : 'normal' }}>Completed: {selectedInterview.completedAt ? new Date(selectedInterview.completedAt).toLocaleDateString() : 'Pending'}</span>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Aggregate AI Competency</div>
                    <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--color-brand)', fontFamily: 'Geist, sans-serif' }}>
                      {Math.round(selectedInterview.result?.aiScore || 80)} / 100
                    </div>
                  </div>
                </div>
              </div>

              {/* Interview Timeline Step-Indicator */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
                {['scheduled', 'in_progress', 'completed', 'validated'].map((step, idx, arr) => {
                  const cStatus = selectedInterview.status?.toLowerCase() || '';
                  const stepIndex = ['scheduled', 'in_progress', 'completed', 'validated'].indexOf(step);
                  
                  let currentStepIndex = 0;
                  if (['passed', 'failed', 'held', 'validated'].includes(cStatus)) currentStepIndex = 3;
                  else if (cStatus === 'completed' || cStatus === 'interviewed') currentStepIndex = 2;
                  else if (cStatus === 'in_progress' || cStatus === 'pending') currentStepIndex = 1;
                  else currentStepIndex = 0; // scheduled or unknown
                  
                  const isCompleted = currentStepIndex > stepIndex;
                  const isCurrent = currentStepIndex === stepIndex;

                  return (
                    <div key={step} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, zIndex: 1 }}>
                        <div style={{
                          width: 24, height: 24, borderRadius: '50%',
                          background: isCompleted ? 'var(--color-success)' : isCurrent ? 'var(--color-primary-500)' : 'var(--bg-surface-3)',
                          border: isCurrent ? '3px solid var(--color-primary-200)' : 'none',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: 'white',
                          boxShadow: isCompleted ? '0 0 10px rgba(16, 185, 129, 0.4)' : 'none'
                        }}>
                          {isCompleted ? <CheckCircle size={12} strokeWidth={3} /> : <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor' }} />}
                        </div>
                        <span style={{ fontSize: 11, fontWeight: isCurrent ? 700 : 500, color: isCompleted ? 'var(--color-success)' : isCurrent ? 'var(--text-primary)' : 'var(--text-muted)', textTransform: 'capitalize' }}>
                          {step.replace('_', ' ')}
                        </span>
                      </div>
                      {idx < arr.length - 1 && (
                        <div style={{ flex: 1, height: 2, background: currentStepIndex > idx ? 'var(--color-success)' : 'var(--bg-surface-3)', margin: '0 8px', transform: 'translateY(-12px)' }} />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* AI Scorecard Dashboard */}
            {(() => {
              const answersList = selectedInterview.answers || [];
              const totalPoints = answersList.reduce((sum, ans) => sum + (ans.score || 0), 0);
              const maxPoints = answersList.length * 10;
              const averageRating = answersList.length ? parseFloat((totalPoints / answersList.length).toFixed(1)) : 0;
              const recommendedResult = averageRating >= 6.0 ? 'pass' : 'fail';

              return (
                <div className="card" style={{
                  padding: 24,
                  background: 'linear-gradient(135deg, var(--bg-surface) 0%, rgba(99, 102, 241, 0.03) 100%)',
                  border: '1px solid rgba(99, 102, 241, 0.15)',
                  borderRadius: 16,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 16
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ fontSize: 15, fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-primary)' }}>
                      <Award size={18} style={{ color: 'var(--color-brand)' }} /> AI Grading Scorecard
                    </h3>
                    <Badge variant={recommendedResult === 'pass' ? 'success' : 'danger'} style={{ fontSize: 12, padding: '6px 12px', borderRadius: 8 }}>
                      AI Recommendation: {recommendedResult.toUpperCase()}
                    </Badge>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
                    {/* Total Score */}
                    <div style={{
                      padding: 16,
                      background: 'var(--bg-surface-2)',
                      border: '1px solid var(--border-color)',
                      borderRadius: 12,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6
                    }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.05em' }}>TOTAL POINTS</span>
                      <span style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)' }}>
                        {totalPoints} <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-muted)' }}>/ {maxPoints}</span>
                      </span>
                    </div>

                    {/* Average Rating */}
                    <div style={{
                      padding: 16,
                      background: 'var(--bg-surface-2)',
                      border: '1px solid var(--border-color)',
                      borderRadius: 12,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6
                    }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.05em' }}>AVERAGE RATING</span>
                      <span style={{ fontSize: 24, fontWeight: 800, color: 'var(--color-brand)' }}>
                        {averageRating.toFixed(1)} <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-muted)' }}>/ 10</span>
                      </span>
                    </div>

                    {/* Outcome Status */}
                    <div style={{
                      padding: 16,
                      background: 'var(--bg-surface-2)',
                      border: '1px solid var(--border-color)',
                      borderRadius: 12,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6
                    }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.05em' }}>RECOMMENDED DECISION</span>
                      <span style={{
                        fontSize: 18,
                        fontWeight: 800,
                        color: recommendedResult === 'pass' ? 'var(--color-success)' : 'var(--color-danger)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6
                      }}>
                        {recommendedResult === 'pass' ? <CheckCircle size={16} /> : <XCircle size={16} />}
                        {recommendedResult === 'pass' ? 'PASS' : 'FAIL'}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* AI Analytical reports */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div className="card" style={{ padding: 20 }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Volume2 size={16} style={{ color: 'var(--color-brand)' }} /> Vocal Articulation
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {[
                    { label: 'Voice Confidence Index', val: 86 },
                    { label: 'Speech Clarity Rating', val: 84 },
                    { label: 'Grammar Alignment', val: 88 },
                  ].map(v => (
                    <div key={v.label}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                        <span style={{ color: 'var(--text-secondary)' }}>{v.label}</span>
                        <strong>{v.val}%</strong>
                      </div>
                      <div style={{ height: 6, background: 'var(--border-color)', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${v.val}%`, background: 'var(--color-brand)', borderRadius: 3 }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="card" style={{ padding: 20 }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Sparkles size={16} style={{ color: 'var(--color-brand)' }} /> Cognitive Feedback
                </h3>
                <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: '1.6', margin: 0 }}>
                  Candidate demonstrated consistent technical skills, structured logic layout, and solid conceptual descriptions. Voice pacing is natural, matching the senior scope criteria.
                </p>
              </div>
            </div>

            {/* Detailed Q&A answers */}
            <div className="card" style={{ padding: 24 }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 6 }}>
                <FileText size={16} style={{ color: 'var(--color-brand)' }} /> Question Answer Breakdown
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {selectedInterview.answers?.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)', fontSize: 12 }}>
                    No recorded Q&A answers registered for this candidate.
                  </div>
                ) : (
                  selectedInterview.answers?.map((ans, idx) => (
                    <div key={ans.id} style={{ padding: 16, border: '1px solid var(--border-color)', borderRadius: 12, background: 'var(--bg-surface)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                        <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)' }}>
                          Q{idx + 1}: {ans.question?.text || 'Evaluation Question'}
                        </div>
                        <Badge variant="brand">Score: {ans.score || 8}/10</Badge>
                      </div>

                      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 8, padding: '10px 12px', background: 'var(--bg-card-header)', borderRadius: 8, fontStyle: 'italic' }}>
                        &ldquo;{ans.answerText}&rdquo;
                      </div>

                      {/* Custom Simulated Audio Recording Component */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 12 }}>
                        <Button
                          size="xs"
                          variant="secondary"
                          leftIcon={<Mic size={12} />}
                          onClick={() => simulateAudioPlay(idx)}
                          style={{ minWidth: 100 }}
                        >
                          {playingAudio === idx ? 'Playing...' : 'Play Audio'}
                        </Button>

                        {playingAudio === idx && (
                          <div style={{ display: 'flex', gap: 2, alignItems: 'center', height: 16 }}>
                            {[1, 2, 3, 4, 5, 4, 3, 2, 1, 2, 3, 4].map((h, i) => (
                              <motion.div
                                key={i}
                                style={{ width: 2, height: `${h * 4}px`, background: 'var(--color-brand)', borderRadius: 1 }}
                                animate={{ height: [ `${h * 2}px`, `${h * 4}px`, `${h * 2}px` ] }}
                                transition={{ repeat: Infinity, duration: 0.8, delay: i * 0.05 }}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Decision Center Card */}
            <div className="card" style={{ padding: 24, border: '1px solid var(--border-color)', background: 'var(--bg-card-header)' }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 6 }}>
                <ShieldCheck size={18} style={{ color: 'var(--color-brand)' }} /> Assessor Decision Center
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {/* Decision selector buttons */}
                <div>
                  <label className="label" style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>Render Selection Decision</label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                    {[
                      { type: 'pass', label: 'Pass Candidate', color: 'var(--color-success)', bg: 'rgba(16,185,129,0.06)' },
                      { type: 'hold', label: 'Place On Hold', color: 'var(--color-warning)', bg: 'rgba(245,158,11,0.06)' },
                      { type: 'fail', label: 'Reject Profile', color: 'var(--color-danger)', bg: 'rgba(244,63,94,0.06)' }
                    ].map(btn => {
                      const active = decision === btn.type;
                      return (
                        <button
                          key={btn.type}
                          type="button"
                          onClick={() => setDecision(btn.type)}
                          style={{
                            padding: '12px',
                            borderRadius: 12,
                            border: active ? `2px solid ${btn.color}` : '1px solid var(--border-color)',
                            background: active ? btn.bg : 'var(--bg-surface)',
                            color: btn.color,
                            fontWeight: 700,
                            fontSize: 13,
                            cursor: 'pointer',
                            transition: 'all 0.15s'
                          }}
                        >
                          {btn.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="input-group">
                  <label className="label" style={{ fontWeight: 600, fontSize: 13, marginBottom: 6 }}>Executive Feedback Summary</label>
                  <textarea
                    className="input"
                    placeholder="Provide detailed evaluation feedback on technical skill logic, voice clarity, and cognitive articulation..."
                    style={{ minHeight: 100 }}
                    value={feedback}
                    onChange={e => setFeedback(e.target.value)}
                    required
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
                  <Button onClick={handleSubmitDecision} loading={submitting} disabled={!decision || !feedback}>
                    Validate & Finalize Outcome
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        ) : (
          <div className="card" style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>
            No Interview Selected For Evaluation
          </div>
        )}
      </div>
    </div>
  );
}
