import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Mic, MicOff, Video, VideoOff, ChevronRight, Clock,
  AlertTriangle, CheckCircle, Cpu, Eye, EyeOff,
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import api from '../../services/api';
import toast from 'react-hot-toast';

const PHASE = {
  LOADING: 'loading',
  PROFILE: 'profile',
  BRIEFING: 'briefing',
  INTERVIEW: 'interview',
  SUBMITTED: 'submitted',
  ERROR: 'error',
};

export default function InterviewRoom() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');

  const [phase, setPhase] = useState(PHASE.LOADING);
  const [schedule, setSchedule] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState({});
  const [timeLeft, setTimeLeft] = useState(90);
  const [isRecording, setIsRecording] = useState(false);
  const [webcamOn, setWebcamOn] = useState(false);
  const [micOn, setMicOn] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [tabWarnings, setTabWarnings] = useState(0);
  const [error, setError] = useState('');

  const videoRef = useRef();
  const streamRef = useRef();
  const timerRef = useRef();
  const recognitionRef = useRef();

  // Load interview details
  useEffect(() => {
    if (!token) {
      setError('Invalid interview link. Please check the URL.');
      setPhase(PHASE.ERROR);
      return;
    }
    loadInterview();
  }, [token]);

  async function loadInterview() {
    try {
      const res = await api.get(`/interviews/token/${token}`);
      setSchedule(res.data.data.schedule);
      setPhase(PHASE.PROFILE);
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Interview not found or link expired.');
      setPhase(PHASE.ERROR);
    }
  }

  // Anti-cheat — tab visibility
  useEffect(() => {
    if (phase !== PHASE.INTERVIEW) return;
    const handleVisibility = () => {
      if (document.hidden) {
        setTabWarnings(w => {
          const next = w + 1;
          toast.error(`Warning ${next}/3: Do not switch tabs during the interview!`);
          if (next >= 3) {
            toast.error('Maximum warnings reached. Interview will be auto-submitted.');
            handleSubmit();
          }
          return next;
        });
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [phase]);

  // Timer per question
  useEffect(() => {
    if (phase !== PHASE.INTERVIEW) return;
    setTimeLeft(90);
    timerRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          clearInterval(timerRef.current);
          handleNextQuestion();
          return 90;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [currentQ, phase]);

  async function startWebcam() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setWebcamOn(true);
      setMicOn(true);
    } catch {
      toast.error('Could not access camera/microphone');
    }
  }

  function toggleMic() {
    if (!streamRef.current) return;
    streamRef.current.getAudioTracks().forEach(t => { t.enabled = !t.enabled; });
    setMicOn(m => !m);
  }

  function toggleWebcam() {
    if (!streamRef.current) return;
    streamRef.current.getVideoTracks().forEach(t => { t.enabled = !t.enabled; });
    setWebcamOn(w => !w);
  }

  async function startInterview() {
    // Load questions
    try {
      const interview = schedule?.interview;
      const domainId = interview?.candidate?.domain?.id;
      const res = await api.get(`/questions/for-interview?domainId=${domainId || ''}&count=10`);
      setQuestions(res.data.data.questions);
    } catch {
      // fallback: use sample questions
      setQuestions(getSampleQuestions());
    }

    // Start interview on server
    try {
      await api.post(`/interviews/${schedule.interview.id}/start`);
    } catch {}

    setPhase(PHASE.INTERVIEW);
  }

  function handleNextQuestion() {
    clearInterval(timerRef.current);
    if (currentQ < questions.length - 1) {
      setCurrentQ(c => c + 1);
    } else {
      handleSubmit();
    }
  }

  async function handleSubmit() {
    setSubmitting(true);
    clearInterval(timerRef.current);

    // Stop media
    streamRef.current?.getTracks().forEach(t => t.stop());

    const answersArr = Object.entries(answers).map(([questionId, answerText]) => ({
      questionId,
      answerText,
      timeTaken: 90,
    }));

    try {
      await api.post(`/interviews/${schedule.interview.id}/submit`, { answers: answersArr });
      setPhase(PHASE.SUBMITTED);
    } catch {
      toast.error('Submission failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  const q = questions[currentQ];
  const progress = questions.length ? ((currentQ + 1) / questions.length) * 100 : 0;

  if (phase === PHASE.LOADING) return <LoadingScreen />;
  if (phase === PHASE.ERROR) return <ErrorScreen message={error} />;
  if (phase === PHASE.SUBMITTED) return <SubmittedScreen />;

  return (
    <div className="interview-room">
      {/* Header */}
      <div style={{
        background: 'var(--bg-surface)',
        borderBottom: '1px solid var(--border-color)',
        padding: '14px 24px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Cpu size={20} style={{ color: 'var(--color-primary-500)' }} />
          <span style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 18 }}>AgnoHire</span>
          <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>|</span>
          <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>AI Interview Session</span>
        </div>
        {phase === PHASE.INTERVIEW && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {tabWarnings > 0 && (
              <span style={{ fontSize: 12, color: 'var(--color-warning)', display: 'flex', alignItems: 'center', gap: 4 }}>
                <AlertTriangle size={14} /> {tabWarnings}/3 warnings
              </span>
            )}
          </div>
        )}
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 24 }}>

        {/* PROFILE PHASE */}
        {phase === PHASE.PROFILE && (
          <motion.div
            style={{ maxWidth: 560, width: '100%' }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="card" style={{ padding: 32 }}>
              <h2 style={{ fontFamily: 'Syne', fontSize: 24, marginBottom: 4 }}>Welcome!</h2>
              <p style={{ color: 'var(--text-secondary)', marginBottom: 24 }}>
                Please verify your details before starting.
              </p>

              {schedule && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 28 }}>
                  {[
                    { label: 'Candidate', value: schedule.interview?.candidate?.name },
                    { label: 'Email', value: schedule.interview?.candidate?.email },
                    { label: 'Interviewer', value: schedule.interview?.recruiter?.name },
                    { label: 'Date', value: new Date(schedule.date).toLocaleDateString() },
                    { label: 'Time', value: `${schedule.timeStart} – ${schedule.timeEnd}` },
                  ].map(({ label, value }) => (
                    <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-color)' }}>
                      <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>{label}</span>
                      <span style={{ fontWeight: 600, fontSize: 13 }}>{value || '—'}</span>
                    </div>
                  ))}
                </div>
              )}

              <Button style={{ width: '100%' }} onClick={() => setPhase(PHASE.BRIEFING)} rightIcon={<ChevronRight size={16} />}>
                Confirm & Continue
              </Button>
            </div>
          </motion.div>
        )}

        {/* BRIEFING PHASE */}
        {phase === PHASE.BRIEFING && (
          <motion.div
            style={{ maxWidth: 600, width: '100%' }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="card" style={{ padding: 32 }}>
              <h2 style={{ fontFamily: 'Syne', fontSize: 22, marginBottom: 16 }}>Interview Instructions</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 28 }}>
                {[
                  'You will be asked up to 10 questions — text and multiple choice.',
                  'Each question has a 90-second timer. Answer before time runs out.',
                  'Do NOT switch browser tabs or windows — this is monitored.',
                  'Copy-paste is disabled during the interview.',
                  'Ensure you are in a quiet, well-lit environment.',
                  'Enable your webcam and microphone for the best experience.',
                ].map((inst, i) => (
                  <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                    <div style={{
                      width: 24, height: 24, background: 'var(--color-primary-500)', borderRadius: '50%',
                      color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 12, fontWeight: 700, flexShrink: 0,
                    }}>{i + 1}</div>
                    <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.6 }}>{inst}</p>
                  </div>
                ))}
              </div>

              {/* Camera setup */}
              <div className="card" style={{ padding: 20, marginBottom: 20, background: 'var(--bg-surface-2)' }}>
                <p style={{ fontWeight: 600, fontSize: 14, marginBottom: 12 }}>Camera & Microphone</p>
                {webcamOn ? (
                  <video ref={videoRef} autoPlay muted style={{ width: '100%', borderRadius: 10, background: '#000', maxHeight: 200 }} />
                ) : (
                  <div style={{ height: 160, background: '#1e293b', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <p style={{ color: '#64748b', fontSize: 13 }}>Camera off</p>
                  </div>
                )}
                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                  <button onClick={webcamOn ? toggleWebcam : startWebcam} className="btn btn-secondary btn-sm">
                    {webcamOn ? <><VideoOff size={14} /> Disable Camera</> : <><Video size={14} /> Enable Camera</>}
                  </button>
                  {webcamOn && (
                    <button onClick={toggleMic} className="btn btn-secondary btn-sm">
                      {micOn ? <><MicOff size={14} /> Mute</> : <><Mic size={14} /> Unmute</>}
                    </button>
                  )}
                </div>
              </div>

              <Button style={{ width: '100%' }} onClick={startInterview}>
                Begin Interview
              </Button>
            </div>
          </motion.div>
        )}

        {/* INTERVIEW PHASE */}
        {phase === PHASE.INTERVIEW && q && (
          <div style={{ maxWidth: 720, width: '100%' }}>
            {/* Progress */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                  Question {currentQ + 1} of {questions.length}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Clock size={14} style={{ color: timeLeft <= 20 ? 'var(--color-danger)' : 'var(--text-muted)' }} />
                  <span style={{
                    fontSize: 14, fontWeight: 700, fontFamily: 'DM Mono, monospace',
                    color: timeLeft <= 20 ? 'var(--color-danger)' : 'var(--text-primary)',
                  }}>
                    {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, '0')}
                  </span>
                </div>
              </div>
              <div className="progress-bar">
                <motion.div
                  className="progress-fill"
                  style={{ width: `${progress}%` }}
                  animate={{ width: `${progress}%` }}
                />
              </div>
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={currentQ}
                className="card"
                style={{ padding: 28 }}
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -30 }}
                transition={{ duration: 0.25 }}
              >
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 20 }}>
                  <span className="badge badge-brand">{q.difficulty?.toUpperCase()}</span>
                  <span className="badge badge-neutral">{q.type?.toUpperCase()}</span>
                </div>

                <p style={{ fontSize: 17, fontWeight: 600, lineHeight: 1.6, marginBottom: 24 }}>
                  {q.text}
                </p>

                {q.type === 'mcq' && q.options ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {Object.entries(q.options).map(([key, val]) => (
                      <label
                        key={key}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 12,
                          padding: '14px 16px',
                          border: `2px solid ${answers[q.id] === key ? 'var(--color-primary-500)' : 'var(--border-color)'}`,
                          borderRadius: 10, cursor: 'pointer',
                          background: answers[q.id] === key ? 'rgba(99,102,241,0.08)' : 'transparent',
                          transition: 'all 0.15s',
                        }}
                      >
                        <input
                          type="radio"
                          name={`q-${q.id}`}
                          value={key}
                          checked={answers[q.id] === key}
                          onChange={() => setAnswers(a => ({ ...a, [q.id]: key }))}
                          style={{ accentColor: 'var(--color-primary-500)' }}
                        />
                        <span style={{ fontSize: 14 }}>
                          <strong style={{ color: 'var(--color-primary-500)' }}>{key.toUpperCase()}.</strong> {val}
                        </span>
                      </label>
                    ))}
                  </div>
                ) : (
                  <textarea
                    className="input"
                    placeholder="Type your answer here..."
                    value={answers[q.id] || ''}
                    onChange={e => setAnswers(a => ({ ...a, [q.id]: e.target.value }))}
                    onCopy={e => e.preventDefault()}
                    onPaste={e => e.preventDefault()}
                    style={{ minHeight: 140, resize: 'vertical' }}
                  />
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20 }}>
                  <Button onClick={handleNextQuestion} rightIcon={<ChevronRight size={16} />} loading={submitting}>
                    {currentQ < questions.length - 1 ? 'Next Question' : 'Submit Interview'}
                  </Button>
                </div>
              </motion.div>
            </AnimatePresence>

            {/* Webcam inset */}
            {webcamOn && (
              <div style={{
                position: 'fixed', bottom: 24, right: 24,
                width: 160, borderRadius: 12, overflow: 'hidden',
                boxShadow: 'var(--shadow-lg)',
                border: '2px solid var(--color-primary-500)',
              }}>
                <video ref={videoRef} autoPlay muted style={{ width: '100%', display: 'block' }} />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function LoadingScreen() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <Cpu size={40} style={{ color: 'var(--color-primary-500)', margin: '0 auto 16px', display: 'block', animation: 'spin 2s linear infinite' }} />
        <p style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 18 }}>Loading Interview...</p>
      </div>
    </div>
  );
}

function ErrorScreen({ message }) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="card" style={{ padding: 40, textAlign: 'center', maxWidth: 480 }}>
        <AlertTriangle size={48} style={{ color: 'var(--color-danger)', margin: '0 auto 16px', display: 'block' }} />
        <h2 style={{ fontFamily: 'Syne', fontSize: 22, marginBottom: 8 }}>Interview Error</h2>
        <p style={{ color: 'var(--text-secondary)' }}>{message}</p>
      </div>
    </div>
  );
}

function SubmittedScreen() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <motion.div
        className="card"
        style={{ padding: 48, textAlign: 'center', maxWidth: 480 }}
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
      >
        <CheckCircle size={56} style={{ color: 'var(--color-success)', margin: '0 auto 20px', display: 'block' }} />
        <h2 style={{ fontFamily: 'Syne', fontSize: 26, marginBottom: 10 }}>Interview Submitted!</h2>
        <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7 }}>
          Thank you for completing your AI interview. Your responses have been submitted and are being analyzed.
          The recruiter will review your results and get back to you shortly.
        </p>
        <div style={{
          marginTop: 24, padding: 16, background: 'var(--bg-surface-2)', borderRadius: 10,
          fontSize: 13, color: 'var(--text-muted)',
        }}>
          You may now close this window.
        </div>
      </motion.div>
    </div>
  );
}

function getSampleQuestions() {
  return [
    { id: 'q1', text: 'Tell us about yourself and your professional background.', type: 'text', difficulty: 'easy', options: null },
    { id: 'q2', text: 'What is the primary purpose of React hooks?', type: 'mcq', difficulty: 'medium', options: { a: 'State management only', b: 'Replace class components and manage state/lifecycle', c: 'Handle HTTP requests', d: 'Manage routing' } },
    { id: 'q3', text: 'Describe a challenging technical problem you solved recently.', type: 'text', difficulty: 'medium', options: null },
    { id: 'q4', text: 'What does REST stand for?', type: 'mcq', difficulty: 'easy', options: { a: 'Remote Execution State Transfer', b: 'Representational State Transfer', c: 'Resource Entity State Transfer', d: 'Responsive Event State Transfer' } },
    { id: 'q5', text: 'How do you approach code reviews and maintaining code quality?', type: 'text', difficulty: 'medium', options: null },
  ];
}
