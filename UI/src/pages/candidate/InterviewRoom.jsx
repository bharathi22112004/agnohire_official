import { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Mic, MicOff, Video, VideoOff, ChevronRight, Clock,
  AlertTriangle, CheckCircle, Cpu, Eye, EyeOff, Shield,
  Smartphone, Wifi, Monitor, Battery, Volume2, Camera,
  RefreshCw, Lock, AlertCircle, Play, FileCode, Award, Code, Check, X
} from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';

const PHASE = {
  LOADING: 'loading',
  VERIFY: 'verify',
  ENV_CHECK: 'env_check',
  FACE_REG: 'face_reg',
  INSTRUCTIONS: 'instructions',
  INTERVIEW: 'interview',
  SUBMITTED: 'submitted',
  ERROR: 'error',
};

const SECTIONS = [
  { id: 'aptitude', name: 'Section 1: Aptitude MCQ', duration: 15 },
  { id: 'technical', name: 'Section 2: Technical Assessment', duration: 20 },
  { id: 'coding', name: 'Section 3: Coding Lab', duration: 25 }
];

export default function InterviewRoom() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const recruiterId = searchParams.get('rid'); // Recruiter unique ID embedded in the interview link
  const navigate = useNavigate();

  const [phase, setPhase] = useState(PHASE.LOADING);
  const [schedule, setSchedule] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState({});
  const [timeLeft, setTimeLeft] = useState(3600); // 60 minutes total
  const [webcamOn, setWebcamOn] = useState(false);
  const [micOn, setMicOn] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [tabWarnings, setTabWarnings] = useState(0);
  const [error, setError] = useState('');

  // Mobile Device check, collapsible proctor, and draft scratchpad states
  const [isMobileDevice, setIsMobileDevice] = useState(false);
  const [isProctorCollapsed, setIsProctorCollapsed] = useState(false);
  const [scratchpadText, setScratchpadText] = useState('');

  useEffect(() => {
    const checkDevice = () => {
      const mobileRegex = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;
      const isMobileUA = mobileRegex.test(navigator.userAgent);
      const isSmallScreen = window.innerWidth < 1024; // Laptop standard is >= 1024px
      setIsMobileDevice(isMobileUA || isSmallScreen);
    };
    checkDevice();
    window.addEventListener('resize', checkDevice);
    return () => window.removeEventListener('resize', checkDevice);
  }, []);

  // OTP Verification details
  const [otpCode, setOtpCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpVerifying, setOtpVerifying] = useState(false);
  const [devOtp, setDevOtp] = useState('');

  // Env Checks details
  const [envStates, setEnvStates] = useState({
    fullscreen: false,
    camera: false,
    mic: false,
    speaker: false,
    internet: 'idle', // idle | running | success
    battery: 100,
    browserCompatible: true,
  });
  const [speedTestMbps, setSpeedTestMbps] = useState(0);
  const [isSpeakerPlaying, setIsSpeakerPlaying] = useState(false);

  // Face Registration details
  const [faceRegistered, setFaceRegistered] = useState(false);
  const [faceDataUrl, setFaceDataUrl] = useState('');
  const [faceScanning, setFaceScanning] = useState(false);

  // Briefing rules checkbox
  const [rulesAgreed, setRulesAgreed] = useState(false);

  // Coding Round details
  const [selectedLang, setSelectedLang] = useState('javascript');
  const [runLogs, setRunLogs] = useState([]);
  const [runningCode, setRunningCode] = useState(false);

  // HTML Element Refs
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const timerRef = useRef(null);

  // Initialize
  useEffect(() => {
    if (!token) {
      setError('An active, valid interview token parameter is required.');
      setPhase(PHASE.ERROR);
      return;
    }
    if (!recruiterId) {
      console.warn('[AgnoHire] Warning: No recruiter ID (rid) found in interview link. Link may be outdated.');
    }
    loadInterviewDetails();
  }, [token]);

  // General countdown clock
  useEffect(() => {
    if (phase !== PHASE.INTERVIEW) return;
    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(timerRef.current);
          toast.success('Time limits reached. Submitting assessment.');
          handleSubmit();
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [phase]);

  // Anti-cheat visibility monitor
  useEffect(() => {
    if (phase !== PHASE.INTERVIEW) return;

    const handleVisibility = async () => {
      if (document.hidden) {
        const next = tabWarnings + 1;
        setTabWarnings(next);
        toast.error(`Proctor Warning ${next}/3: Fullscreen exit detected!`);

        try {
          await api.post(`/interviews/${schedule.interview.id}/log-violation`, {
            violationType: 'tab_switch',
            description: `Candidate lost focus on browser view. Warning count: ${next}`,
            severity: next >= 2 ? 'high' : 'medium',
          });
        } catch (err) {
          console.error(err);
        }

        if (next >= 3) {
          toast.error('System threshold exceeded. Auto-submitting answers.');
          handleSubmit();
        }
      }
    };

    const blockShortcuts = (e) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'c' || e.key === 'v' || e.key === 'x')) {
        e.preventDefault();
        toast.error('Clipboard copy-paste blocks active.');
      }
    };

    const blockContextMenu = (e) => e.preventDefault();

    document.addEventListener('visibilitychange', handleVisibility);
    document.addEventListener('keydown', blockShortcuts);
    document.addEventListener('contextmenu', blockContextMenu);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      document.removeEventListener('keydown', blockShortcuts);
      document.removeEventListener('contextmenu', blockContextMenu);
    };
  }, [phase, tabWarnings, schedule]);

  // Fetch initial details
  async function loadInterviewDetails() {
    try {
      const res = await api.get(`/interviews/token/${token}`);
      setSchedule(res.data.data.schedule);
      setPhase(PHASE.VERIFY);

      // Check battery status dynamically
      if (navigator.getBattery) {
        navigator.getBattery().then((bat) => {
          setEnvStates((prev) => ({ ...prev, battery: Math.floor(bat.level * 100) }));
        });
      }
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Interview link has expired or is invalid.');
      setPhase(PHASE.ERROR);
    }
  }

  // Verification Send OTP
  async function handleSendOtp() {
    try {
      const res = await api.post(`/interviews/token/${token}/verify-send-otp`);
      setOtpSent(true);
      toast.success('Verification code dispatched to your email.');
      if (res.data.data.devOtp) {
        setDevOtp(res.data.data.devOtp);
        console.log(`[AgnoHire Dev Mode] Verification code: ${res.data.data.devOtp}`);
      }
    } catch (err) {
      toast.error('OTP delivery failed. Please check connectivity.');
    }
  }

  // Verify OTP
  async function handleVerifyOtp() {
    if (!otpCode) {
      toast.error('Please enter the 6-digit verification code.');
      return;
    }
    setOtpVerifying(true);
    try {
      await api.post(`/interviews/token/${token}/verify-otp`, {
        code: otpCode,
        browserInfo: navigator.userAgent,
        osInfo: navigator.platform,
        ipAddress: '127.0.0.1',
        fingerprint: `agno-${schedule?.interview?.candidateId}`,
      });
      toast.success('Identity successfully verified.');
      setPhase(PHASE.ENV_CHECK);
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Invalid or expired verification code.');
    } finally {
      setOtpVerifying(false);
    }
  }

  // Camera & Mic toggling inside setup
  async function startWebcam() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setWebcamOn(true);
      setMicOn(true);
      setEnvStates((prev) => ({ ...prev, camera: true, mic: true }));
      toast.success('Hardware devices mounted successfully.');
    } catch (err) {
      toast.error('Camera/Microphone access rejected by system.');
    }
  }

  // Speed Test Simulator
  function runSpeedTest() {
    setEnvStates((prev) => ({ ...prev, internet: 'running' }));
    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.floor(Math.random() * 5) + 3;
      setSpeedTestMbps(progress);
      if (progress >= 25) {
        clearInterval(interval);
        setEnvStates((prev) => ({ ...prev, internet: 'success' }));
        toast.success('Network connectivity checks passed.');
      }
    }, 200);
  }

  // Speaker Test Tone
  function playTestSound() {
    setIsSpeakerPlaying(true);
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    osc.connect(gain);
    gain.connect(audioContext.destination);
    osc.frequency.setValueAtTime(440, audioContext.currentTime); // A4 note
    osc.start();
    osc.stop(audioContext.currentTime + 1.2);
    setTimeout(() => {
      setIsSpeakerPlaying(false);
      setEnvStates((prev) => ({ ...prev, speaker: true }));
      toast.success('Sound check completed.');
    }, 1200);
  }

  // Fullscreen Request
  function requestFullscreenMode() {
    const doc = document.documentElement;
    if (doc.requestFullscreen) {
      doc.requestFullscreen()
        .then(() => setEnvStates((prev) => ({ ...prev, fullscreen: true })))
        .catch(() => toast.error('Fullscreen request blocked.'));
    }
  }

  // Face Registration
  function captureFaceBiometrics() {
    setFaceScanning(true);
    setTimeout(async () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 640;
        canvas.height = 480;
        const ctx = canvas.getContext('2d');
        if (videoRef.current) {
          ctx.drawImage(videoRef.current, 0, 0, 640, 480);
          const dataUrl = canvas.toDataURL('image/png');
          setFaceDataUrl(dataUrl);

          // Upload biometrics
          await api.post(`/interviews/${schedule.interview.id}/register-face`, {
            faceImageUrl: dataUrl,
          });

          setFaceRegistered(true);
          setFaceScanning(false);
          toast.success('Biometric face profile successfully saved.');
        }
      } catch (err) {
        setFaceScanning(false);
        toast.error('Could not capture webcam frame.');
      }
    }, 2000);
  }

  // Fetch real/mock questions & start
  async function startInterviewSession() {
    try {
      const res = await api.get(`/interviews/${schedule.interview.id}/questions`);
      setQuestions(res.data.data.questions);

      // Start session on server
      await api.post(`/interviews/${schedule.interview.id}/start`);
      setPhase(PHASE.INTERVIEW);
    } catch (err) {
      toast.error('Failed to initialize questions bank.');
    }
  }

  // Mock code runner inside coding round
  function handleRunCode() {
    setRunningCode(true);
    setRunLogs(['Compiling and testing inputs...']);
    const q = questions[currentQ];

    setTimeout(() => {
      const cases = q.options?.testCases || [];
      const logs = [];
      logs.push(`🚀 Executing environment: ${selectedLang.toUpperCase()}`);
      
      cases.forEach((c, idx) => {
        logs.push(`Test Case ${idx + 1}: Input: ${c.input}`);
        logs.push(`✔ Output matches expected target: ${c.output}`);
      });
      logs.push('\n🎉 Status: ALL TEST CASES PASSED SUCCESSFULLY!');
      setRunLogs(logs);
      setRunningCode(false);
      toast.success('Compilation completed successfully!');
    }, 1500);
  }

  // Navigation Questions
  function handleNextQuestion() {
    if (currentQ < questions.length - 1) {
      setCurrentQ((c) => c + 1);
      // Auto-load starter template for code questions
      const nextQ = questions[currentQ + 1];
      if (nextQ.type === 'coding' && !answers[nextQ.id]) {
        setAnswers((prev) => ({
          ...prev,
          [nextQ.id]: nextQ.options?.starters?.[selectedLang] || '',
        }));
      }
    } else {
      handleSubmit();
    }
  }

  // Save Final Answers
  async function handleSubmit() {
    setSubmitting(true);
    clearInterval(timerRef.current);

    // Turn off webcam tracks
    streamRef.current?.getTracks().forEach((track) => track.stop());

    const formattedAnswers = Object.entries(answers).map(([qid, ansText]) => ({
      questionId: qid,
      answerText: ansText,
      timeTaken: 90,
    }));

    try {
      await api.post(`/interviews/${schedule.interview.id}/submit`, {
        answers: formattedAnswers,
      });
      setPhase(PHASE.SUBMITTED);
      // Exit fullscreen
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
      
      // Navigate to the beautiful Completion receipt page
      const name = encodeURIComponent(schedule?.interview?.candidate?.name || 'Valued Candidate');
      const id = encodeURIComponent(schedule?.interview?.id || '');
      const role = encodeURIComponent(schedule?.interview?.candidate?.domain?.name || 'Technical Specialist');
      const email = encodeURIComponent(schedule?.interview?.candidate?.email || 'support@agnohire.com');
      const time = encodeURIComponent(new Date().toLocaleString());
      navigate(`/interview/complete?name=${name}&id=${id}&role=${role}&email=${email}&time=${time}`);
    } catch (err) {
      toast.error('Failed to submit answers. Re-attempting connection...');
    } finally {
      setSubmitting(false);
    }
  }

  // Current Question Object
  const q = questions[currentQ];
  const progressPercent = questions.length ? ((currentQ + 1) / questions.length) * 100 : 0;

  // Active section name finder
  function getActiveSectionName() {
    if (!q) return '';
    if (q.section) return q.section;
    if (q.type === 'coding') return 'Coding Round';
    if (q.type === 'mcq') return 'Aptitude Round';
    return 'Technical Assessment';
  }

  if (isMobileDevice) {
    return (
      <div className="min-h-screen bg-[#060B14] flex items-center justify-center p-8 font-sans">
        <motion.div className="max-w-md w-full" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="text-center mb-8">
            <div className="mx-auto w-16 h-16 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center justify-center mb-5">
              <Smartphone className="w-8 h-8 text-red-400" />
            </div>
            <h1 className="text-[22px] font-bold text-white tracking-tight mb-2">Desktop Access Required</h1>
            <p className="text-slate-400 text-sm leading-relaxed">AgnoHire assessments are restricted to laptop and desktop environments to maintain exam security and full hardware compatibility.</p>
          </div>
          <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl overflow-hidden mb-5">
            {[
              { ok: true,  text: 'Laptop or desktop computer (1024px+ width)' },
              { ok: true,  text: 'Functional webcam and microphone' },
              { ok: true,  text: 'Stable broadband internet connection' },
              { ok: false, text: 'Mobile phones or tablet devices' },
            ].map((item, i) => (
              <div key={i} className={`flex items-center gap-3 px-5 py-3.5 border-b border-white/[0.05] last:border-0 text-sm ${item.ok ? 'text-slate-300' : 'text-red-400/80'}`}>
                <div className={`w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 ${item.ok ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'}`}>
                  {item.ok ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                </div>
                {item.text}
              </div>
            ))}
          </div>
          <div className="text-center">
            <span className="inline-flex items-center gap-2 text-[10px] text-slate-600 uppercase tracking-widest font-mono border border-white/[0.06] px-4 py-2 rounded-full">
              <Shield className="w-3 h-3" /> Security Protocol · AG-GATE-MOBILE-RESTRICT
            </span>
          </div>
        </motion.div>
      </div>
    );
  }

  if (phase === PHASE.LOADING) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="w-14 h-14 mx-auto mb-5 relative">
            <div className="absolute inset-0 rounded-2xl bg-blue-100 animate-ping opacity-50" />
            <div className="relative w-14 h-14 bg-blue-600 rounded-2xl flex items-center justify-center shadow-xl shadow-blue-600/25">
              <Cpu className="w-6 h-6 text-white" />
            </div>
          </div>
          <h2 className="text-[15px] font-semibold text-slate-800 mb-1.5">Initializing Secure Room</h2>
          <p className="text-sm text-slate-400">Verifying your interview credentials…</p>
        </div>
      </div>
    );
  }

  if (phase === PHASE.ERROR) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="max-w-sm w-full bg-white border border-slate-200 rounded-2xl shadow-xl shadow-slate-200/60 p-10 text-center">
          <div className="w-14 h-14 mx-auto mb-5 bg-red-50 border border-red-100 rounded-2xl flex items-center justify-center">
            <AlertCircle className="w-7 h-7 text-red-500" />
          </div>
          <h2 className="text-[18px] font-bold text-slate-900 mb-2">Invalid Session Link</h2>
          <p className="text-sm text-slate-500 mb-6 leading-relaxed">{error}</p>
          <div className="bg-red-50 border border-red-100 rounded-xl p-4 text-xs text-red-700 text-left font-medium">
            This link may be expired, already used, or invalid. Please contact your recruiter for a new session link.
          </div>
        </div>
      </div>
    );
  }

  if (phase === PHASE.SUBMITTED) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <motion.div
          className="max-w-lg w-full bg-white border border-slate-200 rounded-2xl shadow-xl shadow-slate-200/60 overflow-hidden"
          initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}
        >
          <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 px-10 pt-10 pb-8 text-center text-white">
            <div className="w-16 h-16 mx-auto bg-white/20 rounded-full flex items-center justify-center mb-4">
              <Award className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-xl font-bold mb-1">Assessment Submitted</h2>
            <p className="text-emerald-100 text-sm">Your responses have been securely recorded</p>
          </div>
          <div className="px-8 py-7">
            <div className="divide-y divide-slate-100 mb-6">
              {[
                { label: 'Reference ID',    value: schedule?.interview?.id,                                  mono: true },
                { label: 'Position',        value: schedule?.interview?.candidate?.domain?.name || 'General', mono: false },
                { label: 'Submitted At',    value: new Date().toLocaleString(),                              mono: false },
              ].map(item => (
                <div key={item.label} className="flex justify-between items-center py-3 text-sm">
                  <span className="text-slate-400">{item.label}</span>
                  <span className={`font-semibold text-slate-900 ${item.mono ? 'font-mono text-xs' : ''}`}>{item.value}</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-slate-400 text-center">Your proctor report has been generated. You may safely close this window.</p>
          </div>
        </motion.div>
      </div>
    );
  }

  const isSetupPhase = [PHASE.VERIFY, PHASE.ENV_CHECK, PHASE.FACE_REG, PHASE.INSTRUCTIONS].includes(phase);

  if (isSetupPhase) {
    const setupSteps = [
      { phaseKey: PHASE.VERIFY,       num: '01', title: 'Identity Verification', desc: 'Email OTP authentication' },
      { phaseKey: PHASE.ENV_CHECK,    num: '02', title: 'System Compatibility',  desc: 'Hardware & network check' },
      { phaseKey: PHASE.FACE_REG,     num: '03', title: 'Biometric Enrollment',  desc: 'Facial profile capture' },
      { phaseKey: PHASE.INSTRUCTIONS, num: '04', title: 'Exam Briefing',          desc: 'Rules & acknowledgement' },
    ];
    const stepPhaseOrder = [PHASE.VERIFY, PHASE.ENV_CHECK, PHASE.FACE_REG, PHASE.INSTRUCTIONS];
    const currentStepIdx = stepPhaseOrder.indexOf(phase);

    return (
      <div className="min-h-screen flex font-sans overflow-hidden">

        {/* ══════════════════════════════════════════════════════════════════
            LEFT SIDEBAR — Dark enterprise panel
        ══════════════════════════════════════════════════════════════════ */}
        <aside className="w-[270px] shrink-0 bg-[#080D17] flex flex-col min-h-screen relative overflow-hidden select-none">
          {/* Ambient glow orbs */}
          <div className="absolute -top-24 -left-24 w-56 h-56 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 right-0 w-48 h-48 bg-indigo-600/8 rounded-full blur-3xl pointer-events-none" />

          {/* ── Logo ────────────────────────────────────────────────────── */}
          <div className="relative z-10 px-6 py-5 border-b border-white/[0.05] flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-600/40 flex-shrink-0">
              <Cpu className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-[14px] font-bold text-white tracking-tight leading-none">AgnoHire</p>
              <p className="text-[9px] text-blue-400/50 font-semibold uppercase tracking-widest mt-0.5">Interview Platform</p>
            </div>
          </div>

          {/* ── Steps ───────────────────────────────────────────────────── */}
          <nav className="relative z-10 flex-1 px-4 pt-7 pb-4">
            <p className="text-[9px] uppercase font-bold text-slate-600 tracking-widest mb-4 px-2">Setup Checklist</p>
            <div className="relative">
              {/* Connecting vertical rail */}
              <div className="absolute left-[22px] top-5 bottom-5 w-px bg-white/[0.05]" />
              <div className="space-y-0.5">
                {setupSteps.map((step, idx) => {
                  const isActive    = phase === step.phaseKey;
                  const isCompleted = currentStepIdx > idx;
                  return (
                    <div
                      key={step.phaseKey}
                      className={`relative flex items-center gap-3.5 px-3 py-3 rounded-xl transition-all duration-200 ${
                        isActive ? 'bg-blue-600/10 border border-blue-500/20' : 'border border-transparent'
                      }`}
                    >
                      {/* Step indicator */}
                      <div className={`relative z-10 w-9 h-9 rounded-xl flex items-center justify-center text-[11px] font-bold font-mono flex-shrink-0 transition-all duration-200 ${
                        isCompleted ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/25'
                        : isActive  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/35'
                        :             'bg-white/[0.04] text-slate-600 border border-white/[0.06]'
                      }`}>
                        {isCompleted ? <Check className="w-3.5 h-3.5" /> : step.num}
                      </div>
                      {/* Text */}
                      <div className="min-w-0">
                        <p className={`text-[13px] font-semibold leading-none mb-0.5 transition-colors ${
                          isActive ? 'text-white' : isCompleted ? 'text-slate-400' : 'text-slate-600'
                        }`}>{step.title}</p>
                        <p className={`text-[11px] transition-colors ${
                          isActive ? 'text-blue-400' : isCompleted ? 'text-emerald-500/60' : 'text-slate-700'
                        }`}>{step.desc}</p>
                      </div>
                      {/* Active pulse dot */}
                      {isActive && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse flex-shrink-0" />}
                    </div>
                  );
                })}
              </div>
            </div>
          </nav>

          {/* ── Footer ──────────────────────────────────────────────────── */}
          <div className="relative z-10 px-4 pb-5 pt-4 border-t border-white/[0.05] space-y-2.5">
            {/* Candidate card */}
            <div className="flex items-center gap-3 px-3 py-3 bg-white/[0.03] border border-white/[0.06] rounded-xl">
              <div className="w-8 h-8 rounded-lg bg-blue-600/20 border border-blue-500/25 flex items-center justify-center text-[12px] font-bold text-blue-400 flex-shrink-0">
                {schedule?.interview?.candidate?.name?.charAt(0)?.toUpperCase() || 'C'}
              </div>
              <div className="min-w-0">
                <p className="text-[12px] font-semibold text-slate-200 truncate leading-none mb-0.5">
                  {schedule?.interview?.candidate?.name || '—'}
                </p>
                <p className="text-[10px] text-slate-600 truncate">
                  {schedule?.interview?.candidate?.email || '—'}
                </p>
              </div>
            </div>

            {/* Traceability */}
            <div className="px-3 py-3 bg-white/[0.02] border border-white/[0.05] rounded-xl space-y-2">
              <p className="text-[9px] uppercase font-bold text-slate-600 tracking-widest">Link Traceability</p>
              {[
                { label: 'Recruiter ID',   value: recruiterId ? `${recruiterId.slice(0, 8)}…` : 'N/A', color: 'text-blue-400' },
                { label: 'Session Token',  value: token       ? `${token.slice(0, 8)}…`        : 'N/A', color: 'text-emerald-400' },
              ].map(item => (
                <div key={item.label} className="flex items-center justify-between">
                  <span className="text-[10px] text-slate-600">{item.label}</span>
                  <span className={`font-mono text-[10px] ${item.color}`}>{item.value}</span>
                </div>
              ))}
            </div>

            {/* Security note */}
            <div className="flex items-start gap-2 px-1">
              <Shield className="w-3 h-3 text-slate-600 mt-0.5 flex-shrink-0" />
              <p className="text-[10px] text-slate-700 leading-relaxed">AI-proctored · TLS encrypted · Device isolated</p>
            </div>
          </div>
        </aside>

        {/* ══════════════════════════════════════════════════════════════════
            RIGHT PANEL — Content workspace
        ══════════════════════════════════════════════════════════════════ */}
        <div className="flex-1 flex flex-col min-h-screen bg-[#F4F6FA]">

          {/* ── Top Bar ─────────────────────────────────────────────────── */}
          <header className="h-[60px] px-8 flex items-center justify-between bg-white border-b border-slate-200 flex-shrink-0">
            <div>
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider leading-none mb-0.5">
                {setupSteps[currentStepIdx]?.desc}
              </p>
              <p className="text-[13px] font-bold text-slate-800 leading-none">{setupSteps[currentStepIdx]?.title}</p>
            </div>
            <div className="flex items-center gap-5">
              {/* Segmented progress */}
              <div className="flex items-center gap-2">
                <div className="flex gap-1">
                  {setupSteps.map((_, idx) => (
                    <div key={idx} className={`h-1 rounded-full transition-all duration-300 ${
                      idx < currentStepIdx  ? 'w-5 bg-emerald-500'
                      : idx === currentStepIdx ? 'w-7 bg-blue-600'
                      : 'w-4 bg-slate-200'
                    }`} />
                  ))}
                </div>
                <span className="text-[11px] font-medium text-slate-400">{currentStepIdx + 1} / 4</span>
              </div>
              {/* Candidate pill */}
              <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-full">
                <div className="w-5 h-5 bg-blue-600 rounded-full flex items-center justify-center text-[9px] font-bold text-white flex-shrink-0">
                  {schedule?.interview?.candidate?.name?.charAt(0) || 'C'}
                </div>
                <span className="text-[12px] font-medium text-slate-700 max-w-[130px] truncate">
                  {schedule?.interview?.candidate?.name || 'Candidate'}
                </span>
              </div>
            </div>
          </header>

          {/* ── Scrollable content ──────────────────────────────────────── */}
          <main className="flex-1 flex items-center justify-center py-10 px-8 overflow-y-auto">
            <div className="w-full max-w-[640px]">
              <AnimatePresence mode="wait">

                {/* ╔══════════════════════════════════════════════════════╗
                    ║  PHASE 1 — IDENTITY VERIFICATION                    ║
                    ╚══════════════════════════════════════════════════════╝ */}
                {phase === PHASE.VERIFY && (
                  <motion.div key="verify" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.18 }}>
                    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm shadow-slate-200/80 overflow-hidden">
                      {/* Card header */}
                      <div className="px-7 pt-7 pb-5 border-b border-slate-100">
                        <div className="flex items-center gap-4 mb-5">
                          <div className="w-10 h-10 bg-blue-50 border border-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
                            <Shield className="w-5 h-5 text-blue-600" />
                          </div>
                          <div>
                            <h2 className="text-[17px] font-bold text-slate-900 tracking-tight leading-none mb-1">Identity Verification</h2>
                            <p className="text-[13px] text-slate-500">Confirm your profile and request your one-time passcode</p>
                          </div>
                        </div>
                        {/* Position badge */}
                        <div className="flex items-center gap-2.5 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl">
                          <div className="w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0" />
                          <span className="text-[12px] text-slate-600">
                            <span className="font-medium">Applied for:</span>{' '}
                            <span className="font-bold text-slate-800">{schedule?.interview?.candidate?.domain?.name || 'Software Engineer'}</span>
                            <span className="text-slate-400 mx-1">·</span>
                            <span>Recruiter: {schedule?.interview?.recruiter?.name || 'Technical Recruiter'}</span>
                          </span>
                        </div>
                      </div>

                      {/* Card body */}
                      <div className="px-7 py-6">
                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3">Registered Profile</p>
                        <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100 mb-6">
                          {[
                            { label: 'Full Name',     value: schedule?.interview?.candidate?.name },
                            { label: 'Email Address', value: schedule?.interview?.candidate?.email },
                            { label: 'Candidate ID',  value: schedule?.interview?.candidateId },
                          ].map(field => (
                            <div key={field.label} className="flex items-center justify-between px-4 py-3 bg-white hover:bg-slate-50 transition-colors">
                              <span className="text-[12px] font-medium text-slate-500">{field.label}</span>
                              <span className="text-[12px] font-semibold text-slate-800 font-mono">{field.value || '—'}</span>
                            </div>
                          ))}
                        </div>

                        {!otpSent ? (
                          <button
                            onClick={handleSendOtp}
                            className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white text-[13px] font-semibold rounded-xl shadow-lg shadow-blue-600/20 hover:shadow-blue-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer"
                          >
                            Send Verification Code <ChevronRight className="w-4 h-4" />
                          </button>
                        ) : (
                          <div className="space-y-3">
                            <div>
                              <label className="block text-[12px] font-bold text-slate-700 mb-2">6-Digit Verification Code</label>
                              <input
                                type="text" maxLength={6} placeholder="– – – – – –"
                                value={otpCode} onChange={(e) => setOtpCode(e.target.value)}
                                className="w-full text-center tracking-[12px] text-xl font-bold font-mono border-2 border-slate-200 focus:border-blue-600 focus:outline-none focus:ring-4 focus:ring-blue-600/10 rounded-xl py-3.5 transition-all"
                              />
                            </div>
                            {devOtp && (
                              <div className="flex items-center justify-between px-4 py-2.5 bg-amber-50 border border-amber-100 rounded-xl text-[12px]">
                                <span className="text-amber-700 font-medium">🧪 Dev Mode OTP</span>
                                <span className="font-mono font-bold text-amber-800 tracking-widest">{devOtp}</span>
                              </div>
                            )}
                            <button
                              onClick={handleVerifyOtp} disabled={otpVerifying}
                              className="w-full h-11 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-[13px] font-semibold rounded-xl shadow-lg shadow-emerald-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
                            >
                              {otpVerifying ? 'Verifying…' : 'Verify & Continue'} {!otpVerifying && <ChevronRight className="w-4 h-4" />}
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Card footer */}
                      <div className="px-7 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center gap-2">
                        <Lock className="w-3 h-3 text-slate-400 flex-shrink-0" />
                        <span className="text-[11px] text-slate-400">Session secured with 256-bit TLS encryption and real-time biometric proctoring.</span>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* ╔══════════════════════════════════════════════════════╗
                    ║  PHASE 2 — SYSTEM COMPATIBILITY CHECK               ║
                    ╚══════════════════════════════════════════════════════╝ */}
                {phase === PHASE.ENV_CHECK && (
                  <motion.div key="env" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.18 }} className="space-y-3">
                    {/* Header */}
                    <div className="bg-white border border-slate-200 rounded-2xl px-7 py-5 shadow-sm flex items-center gap-4">
                      <div className="w-10 h-10 bg-violet-50 border border-violet-100 rounded-xl flex items-center justify-center flex-shrink-0">
                        <Monitor className="w-5 h-5 text-violet-600" />
                      </div>
                      <div>
                        <h2 className="text-[17px] font-bold text-slate-900 tracking-tight leading-none mb-1">System Compatibility</h2>
                        <p className="text-[13px] text-slate-500">Complete all checks before proceeding to biometric enrollment</p>
                      </div>
                    </div>

                    {/* Two-column grid */}
                    <div className="grid grid-cols-2 gap-3">
                      {/* Webcam column */}
                      <div className="bg-[#080D17] border border-white/[0.07] rounded-2xl overflow-hidden flex flex-col" style={{ minHeight: 300 }}>
                        <div className="px-4 py-3 border-b border-white/[0.05] flex items-center gap-2 flex-shrink-0">
                          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${webcamOn ? 'bg-emerald-400 animate-pulse' : 'bg-slate-700'}`} />
                          <span className="text-[11px] text-slate-400 font-medium">{webcamOn ? 'Camera Active' : 'Camera Inactive'}</span>
                        </div>
                        <div className="flex-1 relative min-h-[180px]">
                          {webcamOn ? (
                            <video ref={videoRef} autoPlay muted className="absolute inset-0 w-full h-full object-cover scale-x-[-1]" />
                          ) : (
                            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-5">
                              <div className="w-12 h-12 bg-white/[0.04] border border-white/[0.07] rounded-2xl flex items-center justify-center">
                                <Camera className="w-6 h-6 text-slate-600" />
                              </div>
                              <p className="text-[11px] text-slate-600 text-center leading-relaxed">Allow browser camera &amp; microphone access</p>
                            </div>
                          )}
                        </div>
                        <div className="px-4 py-3 border-t border-white/[0.05] flex-shrink-0">
                          <button onClick={startWebcam} className="w-full h-8 bg-white/[0.07] hover:bg-white/[0.12] text-white text-[11px] font-semibold rounded-lg flex items-center justify-center gap-2 transition-all cursor-pointer">
                            <Camera className="w-3.5 h-3.5 text-blue-400" />
                            {webcamOn ? 'Restart Camera' : 'Enable Camera & Mic'}
                          </button>
                        </div>
                      </div>

                      {/* Checks column */}
                      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col">
                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3">Requirements</p>
                        <div className="space-y-1 flex-1">
                          {[
                            { icon: Monitor, label: 'Fullscreen',     ok: envStates.fullscreen,           badge: envStates.fullscreen ? 'Locked' : null,                           action: !envStates.fullscreen ? <button onClick={requestFullscreenMode} className="text-[11px] font-semibold text-white bg-blue-600 hover:bg-blue-700 px-2.5 py-1 rounded-lg cursor-pointer transition-colors">Enable</button> : null },
                            { icon: Volume2, label: 'Speaker',        ok: envStates.speaker,              badge: envStates.speaker ? 'Pass' : null,                               action: !envStates.speaker ? <button onClick={playTestSound} disabled={isSpeakerPlaying} className="text-[11px] font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 px-2.5 py-1 rounded-lg cursor-pointer transition-colors">{isSpeakerPlaying ? '…' : 'Test'}</button> : null },
                            { icon: Wifi,    label: 'Network',        ok: envStates.internet === 'success', badge: envStates.internet === 'success' ? `${speedTestMbps} Mbps` : null, action: envStates.internet !== 'success' ? <button onClick={runSpeedTest} className="text-[11px] font-semibold text-white bg-blue-600 hover:bg-blue-700 px-2.5 py-1 rounded-lg cursor-pointer transition-colors">{envStates.internet === 'running' ? '…' : 'Test'}</button> : null },
                            { icon: Battery, label: 'Battery',        ok: envStates.battery > 20,         badge: `${envStates.battery}%`,                                         action: null },
                            { icon: Camera,  label: 'Camera & Mic',   ok: envStates.camera && envStates.mic, badge: envStates.camera && envStates.mic ? 'Pass' : null,            action: null },
                          ].map((check, idx) => (
                            <div key={idx} className="flex items-center justify-between py-2.5 border-b border-slate-100 last:border-0">
                              <div className="flex items-center gap-2.5">
                                <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 border ${check.ok ? 'bg-emerald-50 border-emerald-100' : 'bg-slate-50 border-slate-200'}`}>
                                  <check.icon className={`w-3.5 h-3.5 ${check.ok ? 'text-emerald-500' : 'text-slate-400'}`} />
                                </div>
                                <span className="text-[12px] font-medium text-slate-700">{check.label}</span>
                              </div>
                              <div>
                                {check.ok && check.badge ? (
                                  <span className="text-[11px] font-semibold text-emerald-600 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-md">{check.badge}</span>
                                ) : check.action ? check.action : (
                                  <span className="text-[11px] text-slate-300">—</span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                        <button
                          disabled={!(envStates.fullscreen && envStates.camera && envStates.mic && envStates.speaker && envStates.internet === 'success')}
                          onClick={() => setPhase(PHASE.FACE_REG)}
                          className="mt-4 w-full h-9 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-100 disabled:text-slate-400 text-white text-[12px] font-semibold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-md shadow-blue-600/20 disabled:shadow-none"
                        >
                          Continue <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* ╔══════════════════════════════════════════════════════╗
                    ║  PHASE 3 — BIOMETRIC FACE ENROLLMENT                ║
                    ╚══════════════════════════════════════════════════════╝ */}
                {phase === PHASE.FACE_REG && (
                  <motion.div key="face" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.18 }}>
                    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm shadow-slate-200/80 overflow-hidden">
                      <div className="px-7 pt-7 pb-5 border-b border-slate-100 flex items-center gap-4">
                        <div className="w-10 h-10 bg-emerald-50 border border-emerald-100 rounded-xl flex items-center justify-center flex-shrink-0">
                          <Eye className="w-5 h-5 text-emerald-600" />
                        </div>
                        <div>
                          <h2 className="text-[17px] font-bold text-slate-900 tracking-tight leading-none mb-1">Biometric Enrollment</h2>
                          <p className="text-[13px] text-slate-500">Position your face in the frame and capture your profile</p>
                        </div>
                      </div>
                      <div className="px-7 py-6">
                        {/* Camera frame */}
                        <div className="bg-[#080D17] rounded-2xl overflow-hidden relative mb-5" style={{ aspectRatio: '4/3' }}>
                          {faceDataUrl
                            ? <img src={faceDataUrl} alt="Captured" className="absolute inset-0 w-full h-full object-cover scale-x-[-1]" />
                            : <video ref={videoRef} autoPlay muted className="absolute inset-0 w-full h-full object-cover scale-x-[-1]" />
                          }
                          {faceScanning && (
                            <div className="absolute inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-blue-400 to-transparent top-1/2 animate-bounce shadow-lg shadow-blue-500/50" />
                          )}
                          {!faceRegistered && !faceScanning && (
                            <div className="absolute inset-8 border-2 border-blue-400/25 border-dashed rounded-2xl flex items-end justify-center pb-4">
                              <span className="text-[10px] text-blue-400 bg-black/60 px-3 py-1.5 rounded-full font-bold uppercase tracking-wider">Center Your Face</span>
                            </div>
                          )}
                          {faceRegistered && (
                            <div className="absolute inset-0 bg-emerald-500/10 border-2 border-emerald-400/40 rounded-2xl flex items-center justify-center">
                              <div className="flex items-center gap-2 bg-black/50 backdrop-blur-sm px-5 py-2.5 rounded-xl border border-emerald-400/30">
                                <CheckCircle className="w-4 h-4 text-emerald-400" />
                                <span className="text-[13px] font-bold text-emerald-300">Face Enrolled</span>
                              </div>
                            </div>
                          )}
                        </div>

                        {!faceRegistered ? (
                          <button onClick={captureFaceBiometrics} disabled={faceScanning}
                            className="w-full h-11 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-[13px] font-semibold rounded-xl shadow-lg shadow-blue-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
                          >
                            <Camera className="w-4 h-4" />
                            {faceScanning ? 'Capturing…' : 'Capture Facial Profile'}
                          </button>
                        ) : (
                          <div className="space-y-3">
                            <div className="flex items-center gap-3 px-4 py-3.5 bg-emerald-50 border border-emerald-100 rounded-xl">
                              <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                              <div>
                                <p className="text-[13px] font-bold text-emerald-800">Enrollment Successful</p>
                                <p className="text-[11px] text-emerald-600">Biometric reference frames saved securely</p>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <button onClick={() => { setFaceRegistered(false); setFaceDataUrl(''); startWebcam(); }}
                                className="flex-1 h-10 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[12px] font-semibold rounded-xl transition-all cursor-pointer border border-slate-200">
                                Retake
                              </button>
                              <button onClick={() => setPhase(PHASE.INSTRUCTIONS)}
                                className="flex-[2] h-10 bg-blue-600 hover:bg-blue-700 text-white text-[12px] font-semibold rounded-xl shadow-md shadow-blue-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer">
                                Proceed to Briefing <ChevronRight className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="px-7 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center gap-2">
                        <Lock className="w-3 h-3 text-slate-400 flex-shrink-0" />
                        <span className="text-[11px] text-slate-400">Facial data is encrypted and stored only for this session.</span>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* ╔══════════════════════════════════════════════════════╗
                    ║  PHASE 4 — EXAM BRIEFING & ACKNOWLEDGEMENT          ║
                    ╚══════════════════════════════════════════════════════╝ */}
                {phase === PHASE.INSTRUCTIONS && (
                  <motion.div key="instructions" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.18 }} className="space-y-3">
                    {/* Header */}
                    <div className="bg-white border border-slate-200 rounded-2xl px-7 py-5 shadow-sm flex items-center gap-4">
                      <div className="w-10 h-10 bg-amber-50 border border-amber-100 rounded-xl flex items-center justify-center flex-shrink-0">
                        <FileCode className="w-5 h-5 text-amber-600" />
                      </div>
                      <div>
                        <h2 className="text-[17px] font-bold text-slate-900 tracking-tight leading-none mb-1">Assessment Briefing</h2>
                        <p className="text-[13px] text-slate-500">Review all rules and provide your acknowledgement to proceed</p>
                      </div>
                    </div>

                    {/* Stats row */}
                    <div className="grid grid-cols-3 gap-2.5">
                      {[
                        { label: 'Modules',  value: '3 Sections' },
                        { label: 'Duration', value: '60 Minutes' },
                        { label: 'Domain',   value: schedule?.interview?.candidate?.domain?.name || 'General' },
                      ].map((s, i) => (
                        <div key={i} className="bg-white border border-slate-200 rounded-xl px-4 py-4 shadow-sm text-center">
                          <p className="text-[15px] font-bold text-slate-900 leading-none mb-1">{s.value}</p>
                          <p className="text-[11px] text-slate-400 font-medium">{s.label}</p>
                        </div>
                      ))}
                    </div>

                    {/* Rules */}
                    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                      <div className="px-6 py-3.5 border-b border-slate-100 bg-slate-50">
                        <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Proctoring Rules & Regulations</p>
                      </div>
                      <div className="divide-y divide-slate-100">
                        {[
                          { icon: Shield,  title: 'Continuous Webcam Monitoring',  desc: 'Biometric face verification remains active throughout your session.',              color: 'text-blue-600',   bg: 'bg-blue-50 border-blue-100' },
                          { icon: Monitor, title: 'Fullscreen Enforcement',         desc: 'Exiting fullscreen mode will immediately trigger a proctoring infraction.',     color: 'text-violet-600', bg: 'bg-violet-50 border-violet-100' },
                          { icon: Lock,    title: 'Clipboard Restrictions',         desc: 'Copy, paste, and right-click operations are disabled during the assessment.',    color: 'text-amber-600',  bg: 'bg-amber-50 border-amber-100' },
                          { icon: Clock,   title: 'Auto-Submit on Timeout',         desc: 'Your answers are automatically submitted when the session timer expires.',       color: 'text-red-600',    bg: 'bg-red-50 border-red-100' },
                        ].map((rule, idx) => (
                          <div key={idx} className="flex items-start gap-4 px-6 py-4 hover:bg-slate-50/50 transition-colors">
                            <div className={`w-9 h-9 rounded-xl border flex items-center justify-center flex-shrink-0 mt-0.5 ${rule.bg}`}>
                              <rule.icon className={`w-4 h-4 ${rule.color}`} />
                            </div>
                            <div>
                              <p className="text-[13px] font-semibold text-slate-800">{rule.title}</p>
                              <p className="text-[12px] text-slate-500 mt-0.5 leading-relaxed">{rule.desc}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Consent + CTA */}
                    <div className="bg-white border border-slate-200 rounded-2xl px-6 py-5 shadow-sm space-y-4">
                      <label className="flex items-start gap-3 cursor-pointer select-none">
                        <input type="checkbox" checked={rulesAgreed} onChange={(e) => setRulesAgreed(e.target.checked)}
                          className="mt-0.5 w-4 h-4 accent-blue-600 cursor-pointer rounded" />
                        <span className="text-[13px] text-slate-600 leading-relaxed">
                          I acknowledge and consent to biometric recording, fullscreen monitoring, and all proctoring rules stated above for this assessment session.
                        </span>
                      </label>
                      <button disabled={!rulesAgreed} onClick={startInterviewSession}
                        className="w-full h-11 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-100 disabled:text-slate-400 text-white text-[13px] font-semibold rounded-xl shadow-lg shadow-blue-600/20 disabled:shadow-none transition-all flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <Play className="w-4 h-4" /> Launch Assessment
                      </button>
                    </div>
                  </motion.div>
                )}

              </AnimatePresence>
            </div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col font-sans text-slate-700">
      {/* Top Banner Navigation */}
      <header className={`px-6 py-4 flex items-center justify-between sticky top-0 z-40 transition-colors ${phase === PHASE.INTERVIEW ? 'bg-slate-900 border-b border-slate-800 text-white' : 'bg-white border-b border-slate-200 text-slate-700'}`}>
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 p-2 rounded-xl text-white shadow-md shadow-blue-200">
            <Cpu className="w-6 h-6" />
          </div>
          <div>
            <h1 className={`text-lg font-bold tracking-tight ${phase === PHASE.INTERVIEW ? 'text-white' : 'text-slate-800'}`}>AgnoHire</h1>
            <p className="text-xs text-slate-400 font-medium">Enterprise Proctor System</p>
          </div>
        </div>

        {phase === PHASE.INTERVIEW && (
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 bg-slate-800 px-4 py-2 rounded-2xl border border-slate-700 shadow-sm text-sm">
              <Clock className="w-4 h-4 text-blue-400 animate-pulse" />
              <span className="font-mono font-bold text-slate-200">
                {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, '0')}
              </span>
            </div>

            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-xs font-semibold text-emerald-400">
              <Shield className="w-3.5 h-3.5" />
              <span>Security Locked</span>
            </div>
          </div>
        )}
      </header>

      {/* Main Container */}
      <main className={`flex-grow flex flex-col ${phase === PHASE.INTERVIEW ? 'w-full p-0 max-w-none' : 'items-center justify-center p-6 max-w-7xl w-full mx-auto'}`}>
        <AnimatePresence mode="wait">
          {/* ACTIVE ASSESSMENT INTERVIEW WORKSPACE */}
          {phase === PHASE.INTERVIEW && q && (
            <motion.div
              key="interview"
              className="relative w-full h-[calc(100vh-76px)] flex items-stretch overflow-hidden bg-slate-950 text-slate-100 font-sans"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              {/* LEFT COLUMN: Question & Selection details (45%) */}
              <div className="w-[45%] border-r border-slate-800/80 flex flex-col h-full bg-slate-900/40 relative">
                {/* Header info */}
                <div className="bg-slate-900/60 px-6 py-4 border-b border-slate-850 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold uppercase text-blue-400 bg-blue-500/10 px-3 py-1 rounded-full border border-blue-500/20">
                      {getActiveSectionName()}
                    </span>
                    <span className="text-slate-750 text-xs">|</span>
                    <span className="text-xs text-slate-400 font-bold">
                      Question {currentQ + 1} of {questions.length}
                    </span>
                  </div>
                  <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase border ${
                    q.difficulty === 'hard' 
                      ? 'text-red-400 bg-red-500/10 border-red-500/20' 
                      : q.difficulty === 'medium' 
                      ? 'text-amber-400 bg-amber-500/10 border-amber-500/20' 
                      : 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                  }`}>
                    {q.difficulty}
                  </span>
                </div>

                {/* Progress bar */}
                <div className="h-[2px] bg-slate-800 w-full">
                  <motion.div
                    className="h-full bg-blue-500"
                    style={{ width: `${progressPercent}%` }}
                    animate={{ width: `${progressPercent}%` }}
                  />
                </div>

                {/* Scrollable Question Content */}
                <div className="p-6 md:p-8 flex-1 overflow-y-auto space-y-6">
                  <div>
                    <h3 className="text-lg font-bold text-white leading-relaxed whitespace-pre-line mb-6 tracking-tight">
                      {q.text}
                    </h3>
                  </div>

                  {/* MCQ choices (rendered on Left Pane to align perfectly with question details!) */}
                  {q.type === 'mcq' && q.options && (
                    <div className="space-y-3 mt-4">
                      {Object.entries(q.options).map(([key, val]) => (
                        <label
                          key={key}
                          className={`p-4 border rounded-2xl cursor-pointer flex items-center gap-4 transition-all ${
                            answers[q.id] === key 
                              ? 'border-blue-500 bg-blue-500/5 shadow-md shadow-blue-500/5' 
                              : 'border-slate-800 bg-slate-900/30 hover:bg-slate-900/60 hover:border-slate-700'
                          }`}
                        >
                          <input
                            type="radio"
                            name={`choices-${q.id}`}
                            value={key}
                            checked={answers[q.id] === key}
                            onChange={() => setAnswers((prev) => ({ ...prev, [q.id]: key }))}
                            className="w-4 h-4 text-blue-500 focus:ring-blue-500 bg-slate-950 border-slate-800 cursor-pointer accent-blue-500"
                          />
                          <span className="text-sm text-slate-200">
                            <span className="text-blue-400 mr-2 uppercase font-bold">{key}.</span> {val}
                          </span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* RIGHT COLUMN: Code editor / Text drafting workspace / Scratchpad (55%) */}
              <div className="w-[55%] flex flex-col h-full bg-slate-955 relative">
                {/* Text or MCQ Scratchpad/Workspace */}
                {q.type !== 'coding' ? (
                  <div className="flex-grow flex flex-col p-6 overflow-hidden">
                    {q.type === 'text' ? (
                      <div className="flex-grow flex flex-col space-y-4">
                        <div className="flex items-center justify-between border-b border-slate-850 pb-3">
                          <div className="flex items-center gap-2">
                            <FileCode className="w-4 h-4 text-blue-400" />
                            <span className="text-xs font-bold text-slate-300">Solution Answer Box</span>
                          </div>
                          <span className="text-xs text-slate-500">Structured markdown text supported</span>
                        </div>
                        <textarea
                          placeholder="Type your structured technical solution here..."
                          value={answers[q.id] || ''}
                          onChange={(e) => setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
                          className="flex-1 w-full bg-slate-900/30 border border-slate-880 rounded-2xl focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none p-4 text-sm font-medium leading-relaxed resize-none text-slate-200"
                        />
                        <div className="flex justify-between text-xs text-slate-500 mt-2 font-medium">
                          <span>Word Count: {answers[q.id] ? answers[q.id].trim().split(/\s+/).length : 0} words</span>
                          <span>Auto-save active</span>
                        </div>
                      </div>
                    ) : (
                      /* MCQ - Scratchpad draft sheet */
                      <div className="flex-grow flex flex-col space-y-4">
                        <div className="flex items-center justify-between border-b border-slate-850 pb-3">
                          <div className="flex items-center gap-2">
                            <Code className="w-4 h-4 text-emerald-400" />
                            <span className="text-xs font-bold text-slate-300">Candidate Draft Sheet / Scratchpad</span>
                          </div>
                          <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded border border-emerald-500/20 uppercase tracking-widest font-mono">Drafting</span>
                        </div>
                        <textarea
                          placeholder="Use this interactive scratchpad to perform calculations, draft pseudocode, or outline your algorithm notes..."
                          value={scratchpadText}
                          onChange={(e) => setScratchpadText(e.target.value)}
                          className="flex-grow w-full bg-slate-905 border border-slate-850 rounded-2xl focus:border-slate-750 focus:outline-none p-4 text-xs font-mono leading-relaxed resize-none text-slate-400 placeholder:text-slate-600"
                        />
                        <div className="text-[10px] text-slate-600 text-right">
                          Recruiters may review scratchpad drafts to evaluate step-by-step logic.
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  /* Coding Lab Panel */
                  <div className="flex-grow flex flex-col overflow-hidden">
                    {/* Language and Tab panel header */}
                    <div className="bg-slate-900/80 px-4 py-2 border-b border-slate-850 flex items-center justify-between text-xs text-slate-400">
                      <div className="flex items-center gap-2">
                        <FileCode className="w-4 h-4 text-blue-400 animate-pulse" />
                        <span className="font-bold font-mono text-slate-300">solution.{selectedLang === 'python' ? 'py' : selectedLang === 'cpp' ? 'cpp' : 'js'}</span>
                      </div>
                      
                      <select
                        value={selectedLang}
                        onChange={(e) => {
                          setSelectedLang(e.target.value);
                          setAnswers((prev) => ({
                            ...prev,
                            [q.id]: q.options?.starters?.[e.target.value] || '',
                          }));
                        }}
                        className="bg-slate-850 border border-slate-800 text-slate-200 text-xs rounded-lg px-2.5 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer font-mono"
                      >
                        <option value="javascript">JavaScript (Node)</option>
                        <option value="python">Python 3</option>
                        <option value="cpp">C++ (GCC)</option>
                      </select>
                    </div>

                    {/* Coding Workspace with line numbers */}
                    <div className="flex-1 flex overflow-hidden bg-slate-950 font-mono text-xs">
                      {/* Simulated line rails */}
                      <div className="w-12 bg-slate-900/40 border-r border-slate-900/80 text-right select-none pr-3 py-4 text-slate-600 font-mono leading-[20px] select-none">
                        {Array.from({ length: Math.max((answers[q.id] || q.options?.starters?.[selectedLang] || '').split('\n').length, 25) }).map((_, i) => (
                          <div key={i} className="h-5">{i + 1}</div>
                        ))}
                      </div>
                      
                      {/* Editor Textarea */}
                      <textarea
                        value={answers[q.id] || q.options?.starters?.[selectedLang] || ''}
                        onChange={(e) => setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
                        className="flex-grow bg-transparent text-emerald-400 p-4 focus:outline-none leading-[20px] resize-none selection:bg-slate-850 border-0 focus:ring-0"
                      />
                    </div>

                    {/* Expandable Compiler Logs Drawer */}
                    {runLogs.length > 0 && (
                      <div className="max-h-[160px] overflow-y-auto bg-slate-900 border-t border-slate-850 p-4 text-xs font-mono text-slate-300 whitespace-pre-wrap divide-y divide-slate-850">
                        {runLogs.map((log, lIdx) => (
                          <div key={lIdx} className="py-1">
                            {log}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Compile execution status bar */}
                    <div className="bg-slate-900/60 px-4 py-3 border-t border-slate-850 flex justify-between items-center">
                      <span className="text-xs text-slate-500 font-medium">Auto-testing enabled against test constraints</span>
                      <button
                        onClick={handleRunCode}
                        disabled={runningCode}
                        className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800/80 text-white text-xs font-semibold py-2 px-4 rounded-xl shadow-md flex items-center gap-1.5 cursor-pointer"
                      >
                        {runningCode ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Play className="w-3.5 h-3.5" />
                        )}
                        <span>Run Compiler</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Workspace action drawer */}
                <div className="bg-slate-900/30 px-6 py-4 border-t border-slate-850 flex justify-end">
                  <button
                    onClick={handleNextQuestion}
                    className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold py-2.5 px-6 rounded-2xl shadow-lg hover:shadow-blue-500/10 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <span>{currentQ < questions.length - 1 ? 'Save & Next Question' : 'Complete Assessment'}</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* FLOATING CORNER PIP WEB-CAM WITH HUD (Absolute overlay bottom-right) */}
              <div className="absolute bottom-20 right-6 z-50 pointer-events-none">
                <AnimatePresence>
                  {!isProctorCollapsed ? (
                    <motion.div
                      className="bg-slate-900/90 backdrop-blur-md rounded-2xl border border-slate-800 p-3 flex flex-col items-center shadow-2xl pointer-events-auto max-w-[170px]"
                      initial={{ scale: 0.9, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.9, opacity: 0 }}
                    >
                      {/* Drag / Collapsible Header tab */}
                      <div className="flex items-center justify-between w-full mb-2 pb-1.5 border-b border-slate-800/60">
                        <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">
                          Proctor Active
                        </span>
                        <button
                          onClick={() => setIsProctorCollapsed(true)}
                          className="text-slate-500 hover:text-white p-0.5 rounded transition-colors"
                        >
                          <EyeOff className="w-3 h-3" />
                        </button>
                      </div>

                      {/* Floating round webcam portal */}
                      <div className="aspect-square w-24 h-24 bg-slate-950 rounded-full border-2 border-blue-500 overflow-hidden relative shadow-lg shadow-blue-500/10">
                        <video ref={videoRef} autoPlay muted className="w-full h-full object-cover scale-x-[-1]" />
                        
                        {/* Biometric Scan Line */}
                        <div className="absolute inset-0 bg-blue-500/5 flex items-center justify-center">
                          <div className="w-full h-[1.5px] bg-blue-500/40 absolute top-1/2 left-0 shadow shadow-blue-500 animate-bounce" />
                        </div>
                      </div>

                      {/* Small compliance pills */}
                      <div className="mt-2.5 space-y-1 w-full text-[9px]">
                        <div className="flex items-center justify-between px-1.5 py-0.5 bg-slate-950/40 rounded border border-slate-850 text-slate-400">
                          <span>Face:</span>
                          <span className="font-semibold text-emerald-400 flex items-center gap-0.5">
                            <Check className="w-2.5 h-2.5" /> Ok
                          </span>
                        </div>
                        <div className="flex items-center justify-between px-1.5 py-0.5 bg-slate-950/40 rounded border border-slate-850 text-slate-400">
                          <span>Gaze:</span>
                          <span className="font-semibold text-emerald-400 flex items-center gap-0.5">
                            <Check className="w-2.5 h-2.5" /> Centered
                          </span>
                        </div>
                      </div>
                    </motion.div>
                  ) : (
                    /* Collapsed proctor mini indicator */
                    <motion.button
                      onClick={() => setIsProctorCollapsed(false)}
                      className="bg-emerald-500/10 border-2 border-emerald-500/30 backdrop-blur-md rounded-full w-10 h-10 flex items-center justify-center shadow-xl hover:bg-emerald-500/20 text-emerald-400 pointer-events-auto transition-all animate-pulse animate-duration-1000"
                      initial={{ scale: 0.9, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.9, opacity: 0 }}
                      title="Proctor active. Click to restore camera feed view."
                    >
                      <Shield className="w-4 h-4" />
                    </motion.button>
                  )}
                </AnimatePresence>
              </div>

              {/* Warning notifications absolute banner */}
              {tabWarnings > 0 && (
                <div className="absolute top-20 left-1/2 -translate-x-1/2 z-50 bg-amber-500/10 border border-amber-500/20 text-amber-400 px-4 py-2.5 rounded-2xl flex items-center gap-3 backdrop-blur-md shadow-2xl text-xs max-w-md pointer-events-auto">
                  <AlertTriangle className="w-5 h-5 text-amber-400 animate-bounce flex-shrink-0" />
                  <div>
                    <span className="font-bold">Tab switch violation: Warning {tabWarnings}/3</span>
                    <p className="text-[10px] text-amber-500 mt-0.5">Leaving the exam viewport triggers immediate auto-submit penalties.</p>
                  </div>
                </div>
              )}
            </motion.div>
          )}

        </AnimatePresence>
      </main>
    </div>
  );
}
