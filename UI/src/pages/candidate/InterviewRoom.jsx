import { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Mic, MicOff, Video, VideoOff, ChevronRight, Clock,
  AlertTriangle, CheckCircle, Cpu, Eye, EyeOff, Shield,
  Smartphone, Wifi, Monitor, Battery, Volume2, Camera,
  RefreshCw, Lock, AlertCircle, Play, FileCode, Award, Code, Check, X,
  Bell, HelpCircle, FileText, QrCode, CircleUserRound, SlidersHorizontal, ClipboardList,
  Square
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

  // Voice recognition & TTS states
  const [isListening, setIsListening] = useState(false);
  const [speechError, setSpeechError] = useState('');
  const [micVolume, setMicVolume] = useState(0);
  const recognitionRef = useRef(null);
  const shouldListenRef = useRef(false);
  const accumulatedTextRef = useRef('');
  const latestTranscriptRef = useRef('');
  const lastQRef = useRef(null);

  const [isTtsSpeaking, setIsTtsSpeaking] = useState(false);

  const questionsRef = useRef([]);
  const currentQRef = useRef(0);
  const activeQIdRef = useRef(null);
  const answersRef = useRef({});
  const utteranceRef = useRef(null);
  const isListeningRef = useRef(false);

  // Sync state to refs on every render
  useEffect(() => {
    questionsRef.current = questions;
    currentQRef.current = currentQ;
    if (questions[currentQ]) {
      activeQIdRef.current = questions[currentQ].id;
    } else {
      activeQIdRef.current = null;
    }
  }, [questions, currentQ]);

  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);

  useEffect(() => {
    isListeningRef.current = isListening;
  }, [isListening]);

  // Mobile Device check, collapsible proctor, and draft scratchpad states
  const [isMobileDevice, setIsMobileDevice] = useState(false);
  const [isProctorCollapsed, setIsProctorCollapsed] = useState(false);
  const [scratchpadText, setScratchpadText] = useState('');
  const [showManualInput, setShowManualInput] = useState(false);

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

  // Re-attach active stream or auto-mount hardware stream inside interview phase
  useEffect(() => {
    if (phase === PHASE.INTERVIEW) {
      if (streamRef.current) {
        if (videoRef.current && videoRef.current.srcObject !== streamRef.current) {
          videoRef.current.srcObject = streamRef.current;
        }
      } else {
        navigator.mediaDevices.getUserMedia({ video: true, audio: true })
          .then((stream) => {
            streamRef.current = stream;
            setWebcamOn(true);
            setMicOn(true);
            if (videoRef.current) {
              videoRef.current.srcObject = stream;
            }
          })
          .catch((err) => {
            console.error('Failed to auto-mount hardware streams:', err);
          });
      }
    }
  }, [phase, webcamOn]);

  // Real-time microphone volume analysis for visualization
  useEffect(() => {
    if (!micOn || !streamRef.current || phase !== PHASE.INTERVIEW) {
      setMicVolume(0);
      return;
    }

    let audioContext = null;
    let source = null;
    let analyser = null;
    let animationFrameId = null;

    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      audioContext = new AudioContextClass();
      
      source = audioContext.createMediaStreamSource(streamRef.current);
      analyser = audioContext.createAnalyser();
      analyser.fftSize = 64;
      
      source.connect(analyser);
      
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      
      const updateVolume = () => {
        if (!analyser) return;
        analyser.getByteFrequencyData(dataArray);
        
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const average = sum / bufferLength;
        setMicVolume(Math.min(100, average * 1.5));
        
        animationFrameId = requestAnimationFrame(updateVolume);
      };
      
      updateVolume();
    } catch (err) {
      console.warn('Failed to initialize real-time audio monitor:', err);
    }

    return () => {
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
      if (source) source.disconnect();
      if (audioContext && audioContext.state !== 'closed') audioContext.close().catch(() => {});
    };
  }, [phase, micOn]);

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

  // Voice control helpers and Web Speech effects
  const startSpeechRecognition = () => {
    const activeQ = questionsRef.current[currentQRef.current];
    if (!activeQ || activeQ.type === 'coding') {
      stopSpeechRecognition();
      return;
    }

    const activeQId = activeQ.id;

    if (isListeningRef.current || recognitionRef.current) {
      console.log('[Speech] Recognition already active or starting. Guarded.');
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setSpeechError('Speech recognition is not supported in this browser.');
      return;
    }

    shouldListenRef.current = true;

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      if (activeQIdRef.current !== activeQId) {
        try { recognition.stop(); } catch (e) {}
        return;
      }
      setIsListening(true);
      setSpeechError('');
    };

    recognition.onerror = (e) => {
      if (activeQIdRef.current !== activeQId) return;
      console.error('[SpeechRecognition Error]', e);
      if (e.error === 'not-allowed') {
        setSpeechError('Microphone access blocked. Enable microphone permissions.');
        shouldListenRef.current = false;
      } else if (e.error === 'no-speech') {
        // Keep listening, do not abort
      } else if (e.error === 'aborted') {
        // Aborted systematically or manually
      } else {
        setSpeechError(`Voice input paused (${e.error}).`);
      }
      setIsListening(false);
    };

    recognition.onend = () => {
      if (activeQIdRef.current !== activeQId) {
        setIsListening(false);
        return;
      }

      setIsListening(false);
      
      // Save what we have transcribed so far from this session
      accumulatedTextRef.current = latestTranscriptRef.current;

      // Auto-restart if we are still supposed to be listening!
      if (shouldListenRef.current) {
        setTimeout(() => {
          if (shouldListenRef.current && activeQIdRef.current === activeQId) {
            startSpeechRecognition();
          }
        }, 100);
      }
    };

    recognition.onresult = (event) => {
      if (activeQIdRef.current !== activeQId) {
        try { recognition.stop(); } catch (e) {}
        return;
      }

      let segments = [];
      for (let i = 0; i < event.results.length; ++i) {
        segments.push(event.results[i][0].transcript.trim());
      }
      const currentSessionTranscript = segments.filter(Boolean).join(' ');
      
      const previousText = accumulatedTextRef.current || '';
      const fullText = previousText 
        ? `${previousText.trim()} ${currentSessionTranscript.trim()}`
        : currentSessionTranscript.trim();

      latestTranscriptRef.current = fullText;

      setAnswers((prev) => ({
        ...prev,
        [activeQId]: fullText,
      }));

      // MCQ auto-selection by voice
      if (activeQ.type === 'mcq' && activeQ.options) {
        const cleanedText = fullText.toLowerCase();
        Object.keys(activeQ.options).forEach((key) => {
          if (
            cleanedText === key ||
            cleanedText.includes(`option ${key}`) ||
            cleanedText.includes(`select ${key}`) ||
            cleanedText.includes(`choose ${key}`)
          ) {
            setAnswers((prev) => ({
              ...prev,
              [activeQId]: key,
            }));
            toast.success(`Selected Option ${key.toUpperCase()} via Voice!`, { id: 'voice-select' });
          }
        });
      }
    };

    recognitionRef.current = recognition;

    try {
      recognition.start();
    } catch (e) {
      console.error('Failed to start speech recognition:', e);
    }
  };

  const stopSpeechRecognition = () => {
    shouldListenRef.current = false;
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {}
      recognitionRef.current = null;
    }
    setIsListening(false);
  };


  // Text-To-Speech (TTS) speaking active question
  useEffect(() => {
    if (phase === PHASE.INTERVIEW && questions[currentQ]) {
      const activeQ = questions[currentQ];
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
        setIsTtsSpeaking(false);
        
        // Clean text for cleaner speaking
        let cleanText = activeQ.text;
        if (activeQ.type === 'mcq' && activeQ.options) {
          const optionsText = Object.entries(activeQ.options)
            .map(([k, v]) => `Option ${k.toUpperCase()}: ${v}`)
            .join('. ');
          cleanText = `${activeQ.text}. ${optionsText}`;
        }
        
        const utterance = new SpeechSynthesisUtterance(cleanText);
        utteranceRef.current = utterance;
        
        utterance.onstart = () => {
          setIsTtsSpeaking(true);
        };

        utterance.onend = () => {
          setIsTtsSpeaking(false);
          // TTS finished speaking! Now start listening.
          if (activeQ.type !== 'coding') {
            startSpeechRecognition();
          }
        };

        utterance.onerror = (e) => {
          setIsTtsSpeaking(false);
          console.warn('TTS utterance error/cancelled:', e);
          // If cancelled or failed, still start listening as a fallback!
          if (activeQ.type !== 'coding' && shouldListenRef.current) {
            startSpeechRecognition();
          }
        };

        utterance.rate = 1.05;
        utterance.pitch = 1.0;

        window.speechSynthesis.speak(utterance);
      } else {
        // Fallback if speechSynthesis is not supported
        if (activeQ.type !== 'coding') {
          startSpeechRecognition();
        }
      }
    }
    return () => {
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      setIsTtsSpeaking(false);
    };
  }, [currentQ, phase]);

  // Clean up SpeechRecognition on phase transitions
  useEffect(() => {
    return () => {
      stopSpeechRecognition();
    };
  }, [phase]);

  // Sync transcription history refs when active question index changes
  useEffect(() => {
    if (questions[currentQ]) {
      if (lastQRef.current !== currentQ) {
        const existingAnswer = answers[questions[currentQ].id] || '';
        accumulatedTextRef.current = existingAnswer;
        latestTranscriptRef.current = existingAnswer;
        lastQRef.current = currentQ;
        setShowManualInput(false);
      }
    }
  }, [currentQ, questions]);

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
      { phaseKey: PHASE.FACE_REG,     num: '03', title: 'Biometric Enrollment',  desc: 'Facial profile capture'  },
      { phaseKey: PHASE.INSTRUCTIONS, num: '04', title: 'Exam Briefing',          desc: 'Rules & acknowledgement' },
    ];
    const stepPhaseOrder = [PHASE.VERIFY, PHASE.ENV_CHECK, PHASE.FACE_REG, PHASE.INSTRUCTIONS];
    const currentStepIdx = stepPhaseOrder.indexOf(phase);

    return (
      <div style={{ fontFamily: "'Inter', system-ui, sans-serif" }} className="h-screen w-screen flex overflow-hidden">

        {/* LEFT SIDEBAR */}
        <aside className="w-[220px] shrink-0 flex flex-col h-screen select-none" style={{ background: '#0F172A', borderRight: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ padding: '28px 22px 20px' }} className="flex items-center gap-3">
            <div style={{ width: 40, height: 40, background: '#3B82F6', borderRadius: 10, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 14px rgba(59,130,246,0.35)' }}>
              <QrCode style={{ width: 20, height: 20, color: '#fff' }} />
            </div>
            <div>
              <p style={{ fontSize: 16, fontWeight: 700, color: '#F1F5F9', letterSpacing: '-0.3px', lineHeight: 1 }}>AgnoHire</p>
              <p style={{ fontSize: 9, color: '#475569', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.18em', marginTop: 5 }}>Interview Platform</p>
            </div>
          </div>

          <nav style={{ flex: 1, padding: '4px 10px', overflowY: 'auto' }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 10, paddingLeft: 8 }}>Setup Checklist</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {setupSteps.map((step, idx) => {
                const isActive    = phase === step.phaseKey;
                const isCompleted = currentStepIdx > idx;
                const StepIcon = idx === 0 ? Shield : idx === 1 ? SlidersHorizontal : idx === 2 ? Eye : ClipboardList;
                return (
                  <div key={step.phaseKey} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 10px', borderRadius: 10, background: isActive ? 'rgba(59,130,246,0.12)' : 'transparent', border: isActive ? '1px solid rgba(59,130,246,0.22)' : '1px solid transparent' }}>
                    <div style={{ width: 32, height: 32, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, fontFamily: 'monospace', background: isCompleted ? '#10B981' : isActive ? 'rgba(148,163,184,0.2)' : 'transparent', border: isCompleted ? 'none' : isActive ? 'none' : '1.5px solid rgba(255,255,255,0.16)', color: isCompleted ? '#fff' : isActive ? '#CBD5E1' : '#475569' }}>
                      {isCompleted ? <Check style={{ width: 13, height: 13 }} /> : step.num}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 12, fontWeight: 600, color: isActive ? '#F1F5F9' : isCompleted ? '#94A3B8' : '#475569', lineHeight: 1.3, marginBottom: 2 }}>{step.title}</p>
                      <p style={{ fontSize: 10, color: isActive ? '#60A5FA' : isCompleted ? 'rgba(52,211,153,0.5)' : '#334155' }}>{step.desc}</p>
                    </div>
                    <StepIcon style={{ width: 15, height: 15, flexShrink: 0, color: isActive ? '#60A5FA' : '#1E293B' }} />
                  </div>
                );
              })}
            </div>
          </nav>

          <div style={{ padding: '14px 18px 18px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.16)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <CircleUserRound style={{ width: 20, height: 20, color: '#94A3B8' }} />
              </div>
              <div style={{ minWidth: 0 }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: '#F1F5F9', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1 }}>{schedule?.interview?.candidate?.name || '—'}</p>
                <p style={{ fontSize: 10, color: '#475569', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 4 }}>{schedule?.interview?.candidate?.email || '—'}</p>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {[
                { label: 'Recruiter ID',  value: recruiterId ? `${recruiterId.slice(0, 10)}...` : 'N/A' },
                { label: 'Session Token', value: token       ? `${token.slice(0, 10)}...`        : 'N/A' },
              ].map(item => (
                <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#334155' }}>{item.label}</span>
                  <span style={{ fontFamily: 'monospace', fontSize: 10, color: '#60A5FA' }}>{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </aside>

        {/* RIGHT PANEL */}
        <div className="flex-1 flex flex-col h-screen overflow-hidden" style={{ background: '#0D1117' }}>

          <header style={{ height: 56, padding: '0 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.07)', flexShrink: 0 }}>
            <div>
              <p style={{ fontSize: 10, fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.18em', lineHeight: 1, marginBottom: 5 }}>{setupSteps[currentStepIdx]?.desc}</p>
              <p style={{ fontSize: 17, fontWeight: 700, color: '#F1F5F9', lineHeight: 1 }}>{setupSteps[currentStepIdx]?.title}</p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ display: 'flex', gap: 5 }}>
                  {setupSteps.map((_, idx) => (
                    <div key={idx} style={{ height: 3, width: idx === currentStepIdx ? 28 : 20, borderRadius: 99, background: idx < currentStepIdx ? '#10B981' : idx === currentStepIdx ? '#3B82F6' : 'rgba(255,255,255,0.1)', transition: 'all 0.3s' }} />
                  ))}
                </div>
                <span style={{ fontSize: 12, color: '#64748B', fontWeight: 500 }}>{currentStepIdx + 1} / 4</span>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid rgba(255,255,255,0.09)', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#64748B' }}><Bell style={{ width: 16, height: 16 }} /></button>
                <button style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid rgba(255,255,255,0.09)', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#64748B' }}><HelpCircle style={{ width: 16, height: 16 }} /></button>
              </div>
            </div>
          </header>

          <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', overflowY: 'auto', padding: '24px' }}>
            <div style={{ width: '100%', maxWidth: 560 }}>
              <AnimatePresence mode="wait">

                {phase === PHASE.VERIFY && (
                  <motion.div key="verify" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.18 }}>
                    <div style={{ background: '#131D2E', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }}>
                      <div style={{ padding: '26px 26px 18px' }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, marginBottom: 18 }}>
                          <div style={{ width: 48, height: 48, background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 12, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Shield style={{ width: 24, height: 24, color: '#93C5FD' }} />
                          </div>
                          <div>
                            <h2 style={{ fontSize: 21, fontWeight: 700, color: '#F1F5F9', lineHeight: 1.2, marginBottom: 6 }}>Identity Verification</h2>
                            <p style={{ fontSize: 13, color: '#64748B', lineHeight: 1.5 }}>Confirm your profile and request your one-time passcode to begin the interview process.</p>
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10 }}>
                          <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#3B82F6', flexShrink: 0 }} />
                          <span style={{ fontSize: 13, color: '#94A3B8' }}>Applied for: <strong style={{ color: '#60A5FA' }}>{schedule?.interview?.candidate?.domain?.name || 'Software Engineer'}</strong></span>
                          <span style={{ color: 'rgba(255,255,255,0.14)', fontSize: 16 }}>|</span>
                          <span style={{ fontSize: 13, color: '#64748B' }}>Recruiter: {schedule?.interview?.recruiter?.name || 'Frontend Team'}</span>
                        </div>
                      </div>
                      <div style={{ padding: '0 26px 26px' }}>
                        <p style={{ fontSize: 10, fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.16em', marginBottom: 10 }}>Registered Profile Data</p>
                        <div style={{ background: '#0A1520', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, overflow: 'hidden', marginBottom: 16 }}>
                          {[
                            { label: 'Full Name',     value: schedule?.interview?.candidate?.name, mono: false },
                            { label: 'Email Address', value: schedule?.interview?.candidate?.email, mono: false },
                            { label: 'Candidate ID',  value: schedule?.interview?.candidateId,      mono: true  },
                          ].map((field, i, arr) => (
                            <div key={field.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 18px', borderBottom: i < arr.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
                              <span style={{ fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{field.label}</span>
                              <span style={{ fontSize: field.mono ? 11 : 13, fontWeight: 600, color: '#E2E8F0', fontFamily: field.mono ? 'monospace' : 'inherit' }}>{field.value || '—'}</span>
                            </div>
                          ))}
                        </div>
                        {!otpSent ? (
                          <button onClick={handleSendOtp} style={{ width: '100%', height: 50, background: '#3B82F6', border: 'none', borderRadius: 10, color: '#fff', fontSize: 15, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: '0 6px 20px rgba(59,130,246,0.3)' }}>
                            Send Verification Code <ChevronRight style={{ width: 18, height: 18 }} />
                          </button>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            <div>
                              <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 8 }}>6-Digit Verification Code</label>
                              <input type="text" maxLength={6} placeholder="• • • • • •" value={otpCode} onChange={e => setOtpCode(e.target.value)} style={{ width: '100%', textAlign: 'center', letterSpacing: '14px', fontSize: 22, fontWeight: 700, fontFamily: 'monospace', background: '#0A1520', border: '2px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '14px 0', color: '#F1F5F9', outline: 'none', boxSizing: 'border-box' }} />
                            </div>
                            {devOtp && (
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 10 }}>
                                <span style={{ fontSize: 12, color: '#FCD34D' }}>🧪 Dev Mode OTP</span>
                                <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#FDE68A', letterSpacing: '4px' }}>{devOtp}</span>
                              </div>
                            )}
                            <button onClick={handleVerifyOtp} disabled={otpVerifying} style={{ width: '100%', height: 50, background: '#059669', border: 'none', borderRadius: 10, color: '#fff', fontSize: 15, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: otpVerifying ? 0.6 : 1 }}>
                              {otpVerifying ? 'Verifying…' : 'Verify & Continue'} {!otpVerifying && <ChevronRight style={{ width: 16, height: 16 }} />}
                            </button>
                          </div>
                        )}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 14 }}>
                          <Lock style={{ width: 12, height: 12, color: '#334155', flexShrink: 0 }} />
                          <span style={{ fontSize: 11, color: '#334155' }}>Session secured with 256-bit TLS encryption and real-time biometric proctoring.</span>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}

                {phase === PHASE.ENV_CHECK && (
                  <motion.div key="env" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.18 }} className="space-y-3">
                    <div style={{ background: '#131D2E', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: '22px 26px', display: 'flex', alignItems: 'center', gap: 14 }}>
                      <div style={{ width: 48, height: 48, background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.2)', borderRadius: 12, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Monitor style={{ width: 24, height: 24, color: '#A78BFA' }} />
                      </div>
                      <div>
                        <h2 style={{ fontSize: 20, fontWeight: 700, color: '#F1F5F9', lineHeight: 1, marginBottom: 5 }}>System Compatibility</h2>
                        <p style={{ fontSize: 13, color: '#64748B' }}>Complete all checks before proceeding to biometric enrollment</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div style={{ background: '#080D17', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 14, overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 260 }}>
                        <div style={{ padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ width: 7, height: 7, borderRadius: '50%', background: webcamOn ? '#34D399' : '#334155' }} />
                          <span style={{ fontSize: 11, color: '#64748B', fontWeight: 500 }}>{webcamOn ? 'Camera Active' : 'Camera Inactive'}</span>
                        </div>
                        <div style={{ flex: 1, position: 'relative', minHeight: 130 }}>
                          {webcamOn
                            ? <video ref={videoRef} autoPlay muted style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }} />
                            : <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                                <Camera style={{ width: 26, height: 26, color: '#334155' }} />
                                <p style={{ fontSize: 11, color: '#334155', textAlign: 'center', padding: '0 16px' }}>Allow camera and microphone access</p>
                              </div>
                          }
                        </div>
                        <div style={{ padding: '10px 12px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                          <button onClick={startWebcam} style={{ width: '100%', height: 32, background: 'rgba(255,255,255,0.06)', border: 'none', borderRadius: 8, color: '#94A3B8', fontSize: 11, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                            <Camera style={{ width: 13, height: 13, color: '#60A5FA' }} />
                            {webcamOn ? 'Restart Camera' : 'Enable Camera & Mic'}
                          </button>
                        </div>
                      </div>
                      <div style={{ background: '#131D2E', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: 16, display: 'flex', flexDirection: 'column' }}>
                        <p style={{ fontSize: 10, fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 10 }}>Requirements</p>
                        <div style={{ flex: 1 }}>
                          {[
                            { icon: Monitor, label: 'Fullscreen',   ok: envStates.fullscreen,             action: !envStates.fullscreen ? <button onClick={requestFullscreenMode} style={{ fontSize: 11, fontWeight: 600, color: '#fff', background: '#3B82F6', border: 'none', borderRadius: 6, padding: '3px 8px', cursor: 'pointer' }}>Enable</button> : null },
                            { icon: Volume2, label: 'Speaker',      ok: envStates.speaker,                action: !envStates.speaker ? <button onClick={playTestSound} disabled={isSpeakerPlaying} style={{ fontSize: 11, fontWeight: 600, color: '#fff', background: '#3B82F6', border: 'none', borderRadius: 6, padding: '3px 8px', cursor: 'pointer', opacity: isSpeakerPlaying ? 0.5 : 1 }}>{isSpeakerPlaying ? '…' : 'Test'}</button> : null },
                            { icon: Wifi,    label: 'Network',      ok: envStates.internet === 'success', action: envStates.internet !== 'success' ? <button onClick={runSpeedTest} style={{ fontSize: 11, fontWeight: 600, color: '#fff', background: '#3B82F6', border: 'none', borderRadius: 6, padding: '3px 8px', cursor: 'pointer' }}>{envStates.internet === 'running' ? '…' : 'Test'}</button> : null },
                            { icon: Battery, label: 'Battery',      ok: envStates.battery > 20,           badge: `${envStates.battery}%`, action: null },
                            { icon: Camera,  label: 'Camera & Mic', ok: envStates.camera && envStates.mic, action: null },
                          ].map((check, idx) => (
                            <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: idx < 4 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <div style={{ width: 26, height: 26, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', background: check.ok ? 'rgba(16,185,129,0.1)' : 'rgba(255,255,255,0.03)', border: check.ok ? '1px solid rgba(16,185,129,0.2)' : '1px solid rgba(255,255,255,0.06)' }}>
                                  <check.icon style={{ width: 12, height: 12, color: check.ok ? '#34D399' : '#475569' }} />
                                </div>
                                <span style={{ fontSize: 12, color: '#94A3B8' }}>{check.label}</span>
                              </div>
                              {check.ok
                                ? <span style={{ fontSize: 11, fontWeight: 600, color: '#34D399', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 5, padding: '2px 7px' }}>{check.badge || 'Pass'}</span>
                                : check.action ? check.action : <span style={{ fontSize: 11, color: '#334155' }}>—</span>}
                            </div>
                          ))}
                        </div>
                        <button disabled={!(envStates.fullscreen && envStates.camera && envStates.mic && envStates.speaker && envStates.internet === 'success')} onClick={() => setPhase(PHASE.FACE_REG)}
                          style={{ marginTop: 12, width: '100%', height: 38, background: '#3B82F6', border: 'none', borderRadius: 10, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, opacity: (envStates.fullscreen && envStates.camera && envStates.mic && envStates.speaker && envStates.internet === 'success') ? 1 : 0.3 }}>
                          Continue <ChevronRight style={{ width: 14, height: 14 }} />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}

                {phase === PHASE.FACE_REG && (
                  <motion.div key="face" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.18 }}>
                    <div style={{ background: '#131D2E', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, overflow: 'hidden' }}>
                      <div style={{ padding: '22px 26px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: 14 }}>
                        <div style={{ width: 48, height: 48, background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 12, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Eye style={{ width: 24, height: 24, color: '#34D399' }} />
                        </div>
                        <div>
                          <h2 style={{ fontSize: 20, fontWeight: 700, color: '#F1F5F9', lineHeight: 1, marginBottom: 5 }}>Biometric Enrollment</h2>
                          <p style={{ fontSize: 13, color: '#64748B' }}>Position your face in the frame and capture your profile</p>
                        </div>
                      </div>
                      <div style={{ padding: '22px 26px' }}>
                        <div style={{ background: '#080D17', borderRadius: 14, overflow: 'hidden', position: 'relative', aspectRatio: '16/9', marginBottom: 16 }}>
                          {faceDataUrl
                            ? <img src={faceDataUrl} alt="Captured" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }} />
                            : <video ref={videoRef} autoPlay muted style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }} />}
                          {!faceRegistered && !faceScanning && (
                            <div style={{ position: 'absolute', inset: 24, border: '1.5px dashed rgba(59,130,246,0.3)', borderRadius: 12, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', paddingBottom: 12 }}>
                              <span style={{ fontSize: 10, color: '#60A5FA', background: 'rgba(0,0,0,0.6)', padding: '4px 12px', borderRadius: 20, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Center Your Face</span>
                            </div>
                          )}
                          {faceRegistered && (
                            <div style={{ position: 'absolute', inset: 0, background: 'rgba(16,185,129,0.08)', border: '2px solid rgba(52,211,153,0.3)', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(0,0,0,0.5)', padding: '9px 16px', borderRadius: 10, backdropFilter: 'blur(8px)' }}>
                                <CheckCircle style={{ width: 16, height: 16, color: '#34D399' }} />
                                <span style={{ fontSize: 13, fontWeight: 700, color: '#6EE7B7' }}>Face Enrolled</span>
                              </div>
                            </div>
                          )}
                        </div>
                        {!faceRegistered ? (
                          <button onClick={captureFaceBiometrics} disabled={faceScanning}
                            style={{ width: '100%', height: 50, background: '#3B82F6', border: 'none', borderRadius: 10, color: '#fff', fontSize: 15, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: faceScanning ? 0.6 : 1 }}>
                            <Camera style={{ width: 18, height: 18 }} />
                            {faceScanning ? 'Capturing…' : 'Capture Facial Profile'}
                          </button>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.18)', borderRadius: 10 }}>
                              <CheckCircle style={{ width: 18, height: 18, color: '#34D399', flexShrink: 0 }} />
                              <div>
                                <p style={{ fontSize: 13, fontWeight: 700, color: '#6EE7B7' }}>Enrollment Successful</p>
                                <p style={{ fontSize: 11, color: 'rgba(52,211,153,0.6)' }}>Biometric reference frames saved securely</p>
                              </div>
                            </div>
                            <div style={{ display: 'flex', gap: 8 }}>
                              <button onClick={() => { setFaceRegistered(false); setFaceDataUrl(''); startWebcam(); }} style={{ flex: 1, height: 40, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, color: '#94A3B8', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Retake</button>
                              <button onClick={() => setPhase(PHASE.INSTRUCTIONS)} style={{ flex: 2, height: 40, background: '#3B82F6', border: 'none', borderRadius: 10, color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                                Proceed to Briefing <ChevronRight style={{ width: 13, height: 13 }} />
                              </button>
                            </div>
                          </div>
                        )}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 14 }}>
                          <Lock style={{ width: 12, height: 12, color: '#334155', flexShrink: 0 }} />
                          <span style={{ fontSize: 11, color: '#334155' }}>Facial data is encrypted and stored only for this session.</span>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}

                {phase === PHASE.INSTRUCTIONS && (
                  <motion.div key="instructions" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.18 }} className="space-y-3">
                    <div style={{ background: '#131D2E', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: '22px 26px', display: 'flex', alignItems: 'center', gap: 14 }}>
                      <div style={{ width: 48, height: 48, background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 12, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <FileCode style={{ width: 24, height: 24, color: '#FCD34D' }} />
                      </div>
                      <div>
                        <h2 style={{ fontSize: 20, fontWeight: 700, color: '#F1F5F9', lineHeight: 1, marginBottom: 5 }}>Assessment Briefing</h2>
                        <p style={{ fontSize: 13, color: '#64748B' }}>Review all rules and provide your acknowledgement to proceed</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      {[{ label: 'Modules', value: '3 Sections' }, { label: 'Duration', value: '60 Minutes' }, { label: 'Domain', value: schedule?.interview?.candidate?.domain?.name || 'General' }].map((s, i) => (
                        <div key={i} style={{ background: '#131D2E', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '14px', textAlign: 'center' }}>
                          <p style={{ fontSize: 15, fontWeight: 700, color: '#F1F5F9', lineHeight: 1, marginBottom: 5 }}>{s.value}</p>
                          <p style={{ fontSize: 11, color: '#475569' }}>{s.label}</p>
                        </div>
                      ))}
                    </div>
                    <div style={{ background: '#131D2E', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, overflow: 'hidden' }}>
                      <div style={{ padding: '12px 20px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <p style={{ fontSize: 10, fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.12em' }}>Proctoring Rules & Regulations</p>
                      </div>
                      {[
                        { icon: Shield,  title: 'Continuous Webcam Monitoring', desc: 'Biometric face verification remains active throughout your session.',          color: '#60A5FA', bg: 'rgba(59,130,246,0.1)',  bd: 'rgba(59,130,246,0.2)'  },
                        { icon: Monitor, title: 'Fullscreen Enforcement',        desc: 'Exiting fullscreen mode will immediately trigger a proctoring infraction.',  color: '#A78BFA', bg: 'rgba(139,92,246,0.1)',  bd: 'rgba(139,92,246,0.2)'  },
                        { icon: Lock,    title: 'Clipboard Restrictions',        desc: 'Copy, paste, and right-click operations are disabled during the assessment.', color: '#FCD34D', bg: 'rgba(245,158,11,0.1)',  bd: 'rgba(245,158,11,0.2)'  },
                        { icon: Clock,   title: 'Auto-Submit on Timeout',        desc: 'Your answers are automatically submitted when the session timer expires.',    color: '#F87171', bg: 'rgba(239,68,68,0.1)',   bd: 'rgba(239,68,68,0.2)'   },
                      ].map((rule, idx, arr) => (
                        <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: 14, padding: '13px 20px', borderBottom: idx < arr.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                          <div style={{ width: 34, height: 34, borderRadius: 9, border: `1px solid ${rule.bd}`, background: rule.bg, flexShrink: 0, marginTop: 2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <rule.icon style={{ width: 15, height: 15, color: rule.color }} />
                          </div>
                          <div>
                            <p style={{ fontSize: 13, fontWeight: 600, color: '#CBD5E1', marginBottom: 3 }}>{rule.title}</p>
                            <p style={{ fontSize: 11, color: '#475569', lineHeight: 1.5 }}>{rule.desc}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div style={{ background: '#131D2E', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                      <label style={{ display: 'flex', alignItems: 'flex-start', gap: 12, cursor: 'pointer' }}>
                        <input type="checkbox" checked={rulesAgreed} onChange={e => setRulesAgreed(e.target.checked)} style={{ marginTop: 2, width: 15, height: 15, accentColor: '#3B82F6', cursor: 'pointer' }} />
                        <span style={{ fontSize: 13, color: '#64748B', lineHeight: 1.6 }}>I acknowledge and consent to biometric recording, fullscreen monitoring, and all proctoring rules stated above for this assessment session.</span>
                      </label>
                      <button disabled={!rulesAgreed} onClick={startInterviewSession}
                        style={{ width: '100%', height: 50, background: rulesAgreed ? '#3B82F6' : 'rgba(255,255,255,0.04)', border: 'none', borderRadius: 10, color: rulesAgreed ? '#fff' : '#334155', fontSize: 15, fontWeight: 600, cursor: rulesAgreed ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: rulesAgreed ? '0 6px 20px rgba(59,130,246,0.3)' : 'none' }}>
                        <Play style={{ width: 16, height: 16 }} /> Launch Assessment
                      </button>
                    </div>
                  </motion.div>
                )}

              </AnimatePresence>
            </div>
          </main>

          <footer style={{ height: 42, padding: '0 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.05)', flexShrink: 0 }}>
            <p style={{ fontSize: 11, color: '#1E293B' }}>© 2024 AgnoHire Secure Interview Systems. All data encrypted via 256-bit TLS.</p>
            <div style={{ display: 'flex', gap: 18 }}>
              {['Privacy Policy', 'Security Standards', 'Support'].map(link => (
                <button key={link} style={{ fontSize: 11, color: '#334155', background: 'none', border: 'none', cursor: 'pointer' }}>{link}</button>
              ))}
            </div>
          </footer>

        </div>
      </div>
    );
  }

  return (
    <div className="dark min-h-screen bg-[#080B12] text-white flex flex-col font-sans selection:bg-blue-500/30 selection:text-white">
      {/* Top Banner Navigation */}
      <header className="h-[106px] px-10 flex items-center justify-between sticky top-0 z-40 bg-[#11141A] border-b border-[#252A35] text-white">
        <div className="flex items-center gap-6">
          <div className="w-16 h-[62px] rounded-[18px] bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
            <span className="text-white font-extrabold text-3xl tracking-tighter">A</span>
          </div>
          <div>
            <h1 className="text-[32px] font-extrabold tracking-tight text-white leading-none">AgnoHire</h1>
          </div>
        </div>

        {phase === PHASE.INTERVIEW && (
          <div className="flex items-center gap-6">
            <div className="h-[61px] min-w-[348px] border-2 border-blue-600/55 bg-[#111827]/50 px-8 rounded-full flex items-center justify-center gap-4 text-blue-400 font-bold tracking-wider shadow-inner">
              <span className="text-[#6C86BA] text-lg font-mono uppercase tracking-[0.22em]">Time Remaining</span>
              <span className="font-mono text-[28px] font-black tracking-normal">
                {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, '0')}
              </span>
            </div>

            <button className="w-[63px] h-[61px] border-2 border-[#252A35] bg-[#0E121B] rounded-[16px] flex items-center justify-center hover:bg-slate-800 transition-colors cursor-pointer text-blue-300/80 hover:text-white">
              <Square className="w-5 h-5" />
            </button>
          </div>
        )}
      </header>

      {/* Main Container */}
      <main className="flex-grow flex flex-col w-full p-0 max-w-none">
        <AnimatePresence mode="wait">
          {/* ACTIVE ASSESSMENT INTERVIEW WORKSPACE */}
          {phase === PHASE.INTERVIEW && q && (
            <motion.div
              key="interview"
              className="relative w-full min-h-[calc(100vh-106px)] bg-[#080B12] text-slate-200 font-sans"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              {(() => {
                // Shared camera widget
                const renderCandidateCameraCard = () => (
                  <div className="bg-[#10141C] border-2 border-[#202638] rounded-[24px] shadow-lg flex flex-col overflow-hidden">
                    {/* Header */}
                    <div className="h-[78px] px-8 flex items-center justify-between border-b border-[#202638]">
                      <span className="text-lg font-semibold text-[#6B8BC5] tracking-[0.18em] font-mono flex items-center gap-5">
                        <Square className="w-3.5 h-3.5 text-blue-300/80" /> Camera (live)
                      </span>
                      <span className="text-emerald-400 border-2 border-emerald-500/60 bg-emerald-950/30 px-5 py-2 rounded-lg text-lg font-semibold font-mono">
                        Active
                      </span>
                    </div>

                    {/* Camera view inside card */}
                    <div className="bg-[#02070A] overflow-hidden aspect-[4/3] relative flex items-center justify-center shadow-inner">
                      {webcamOn ? (
                        <video ref={videoRef} autoPlay muted className="w-full h-full object-cover scale-x-[-1]" />
                      ) : (
                        <div className="flex flex-col items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-slate-600">
                            <Camera className="w-5 h-5 animate-pulse" />
                          </div>
                          <p className="text-xs text-slate-500 font-medium text-center px-4">Checking hardware camera permissions...</p>
                        </div>
                      )}

                      {/* HUD Overlay elements */}
                      <div className="absolute inset-0 pointer-events-none" />
                      
                      {/* Laser scanner scanning effect */}
                      {webcamOn && (
                        <div className="absolute left-0 w-full h-[1.5px] bg-gradient-to-r from-transparent via-cyan-400/70 to-transparent shadow-[0_0_8px_rgba(34,211,238,0.6)] pointer-events-none animate-[scan_4s_infinite_ease-in-out]" />
                      )}

                      {/* Cyber dotted mesh scanner grid overlay */}
                      <div 
                        className="absolute inset-0 pointer-events-none opacity-20"
                        style={{
                          backgroundImage: `
                            linear-gradient(rgba(59, 130, 246, 0.1) 1px, transparent 1px),
                            linear-gradient(90deg, rgba(59, 130, 246, 0.1) 1px, transparent 1px)
                          `,
                          backgroundSize: '36px 36px'
                        }}
                      />

                      {/* Cyan L-shaped anchors */}
                      <div className="absolute top-4 left-4 w-5 h-5 border-t-2 border-l-2 border-blue-400 pointer-events-none" />
                      <div className="absolute top-4 right-4 w-5 h-5 border-t-2 border-r-2 border-blue-400 pointer-events-none" />
                      <div className="absolute bottom-4 left-4 w-5 h-5 border-b-2 border-l-2 border-blue-400 pointer-events-none" />
                      <div className="absolute bottom-4 right-4 w-5 h-5 border-b-2 border-r-2 border-blue-400 pointer-events-none" />

                      {/* Centered face detection oval template */}
                      <div className="absolute w-[120px] h-[144px] border-2 border-blue-500/35 rounded-[50%] pointer-events-none shadow-[0_0_15px_rgba(59,130,246,0.05)]" />

                      {/* Recording badge */}
                      <div className="absolute top-4 left-5 bg-red-950/35 text-red-300 border border-red-500/45 px-3 py-2 rounded-md text-sm font-mono tracking-wider flex items-center gap-2 shadow-md">
                        <span className="w-2.5 h-2.5 rounded-full bg-red-400 animate-pulse" />
                        <span>REC</span>
                      </div>
                    </div>

                    <div className="h-[58px] px-7 flex items-center justify-between text-base font-mono text-[#6B7896]">
                      <span className="flex items-center gap-3"><Square className="w-3.5 h-3.5 text-emerald-300" /> Validated</span>
                      <span className="text-[#5B6280] flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" /> Live
                      </span>
                    </div>
                  </div>
                );

                if (q.type !== 'coding') {
                  // Standard Speech/MCQ environment overhual
                  return (
                    <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-6 px-6 py-[26px] items-start">
                      
                      {/* Left Column */}
                      <div className="lg:col-span-7 flex flex-col gap-5 w-full">
                        
                        {/* Metrics Bar */}
                        <div className="h-[88px] bg-[#10141C] border-2 border-[#202638] rounded-[22px] relative overflow-hidden shadow-lg grid grid-cols-[20%_80%]">
                          {/* Segment 1: Question indicator */}
                          <div className="flex flex-col justify-center px-8">
                            <span className="text-base font-mono text-[#667293] uppercase tracking-[0.24em] leading-none">Question</span>
                            <span className="text-[28px] font-black text-blue-400 mt-1 font-mono leading-none">
                              {currentQ + 1} <span className="text-slate-700 text-lg">/</span> {questions.length}
                            </span>
                          </div>

                          {/* Middle border separator */}
                          <div className="absolute left-[20%] top-0 bottom-0 w-[2px] bg-[#202638]" />

                          {/* Segment 2: Time limit per question */}
                          <div className="flex flex-col justify-center pl-9">
                            <div className="flex items-center gap-6">
                              <Square className="w-3.5 h-3.5 text-blue-300/80" />
                              <span className="text-base font-mono text-[#667293] uppercase tracking-[0.24em] leading-none">Time Per Question</span>
                            </div>
                            <span className="text-[28px] font-black text-amber-500 mt-2 font-mono leading-none pl-10">
                              {timeLeft % 60}
                            </span>
                          </div>
                        </div>

                        {/* Question display card */}
                        <div className="min-h-[424px] bg-[#10141C] border-2 border-[#202638] rounded-[24px] px-[50px] py-[48px] relative overflow-hidden shadow-lg">
                          <span className="text-base text-[#667293] uppercase tracking-[0.28em] font-mono mb-7 block">Question Display</span>
                          <h3 className="text-[40px] font-extrabold text-white leading-tight tracking-tight mb-8 whitespace-pre-line">
                            {q.text}
                          </h3>

                          <div className="flex flex-wrap gap-4">
                            <span className={`text-sm px-5 py-2 rounded-lg font-bold font-mono tracking-wide uppercase border-2 ${
                              q.difficulty === 'hard' 
                                ? 'text-red-400 border-red-500/20 bg-red-950/20' 
                                : q.difficulty === 'medium' 
                                ? 'text-amber-400 border-amber-500/20 bg-amber-950/20' 
                                : 'text-emerald-400 border-emerald-500/20 bg-emerald-950/20'
                            }`}>
                              {q.difficulty}
                            </span>
                            <span className="text-sm px-5 py-2 rounded-lg font-bold font-mono tracking-wide uppercase text-blue-300 border-2 border-blue-600/60 bg-blue-950/20">
                              AI Interviewer
                            </span>
                            {q.type !== 'mcq' && (
                              <button
                                onClick={() => setShowManualInput(!showManualInput)}
                                className={`text-[10px] px-3 py-1 rounded-lg font-bold font-mono tracking-wider uppercase border cursor-pointer transition-all duration-200 ${
                                  showManualInput
                                    ? 'text-emerald-450 border-emerald-500/30 bg-emerald-950/20'
                                    : 'text-slate-400 border-slate-700 bg-slate-800/30 hover:border-slate-600 hover:text-white'
                                }`}
                              >
                                <span className="flex items-center gap-1.5">
                                  <FileText className="w-3.5 h-3.5" />
                                  {showManualInput ? 'Hide Typing Panel' : 'Type Answer Manually'}
                                </span>
                              </button>
                            )}
                          </div>
                        </div>

                        {/* MCQ options selection grid */}
                        {q.type === 'mcq' && q.options && (
                          <div className="bg-[#0C101F] border border-blue-500/10 rounded-2xl p-6 shadow-lg flex flex-col gap-4">
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest font-mono">Select Response Option</span>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {Object.entries(q.options).map(([key, val]) => {
                                const isSelected = answers[q.id] === key;
                                return (
                                  <label
                                    key={key}
                                    className={`p-4 border rounded-2xl cursor-pointer flex items-center gap-4 transition-all relative overflow-hidden group ${
                                      isSelected 
                                        ? 'border-blue-500/80 bg-blue-950/20 shadow-md' 
                                        : 'border-slate-800 bg-[#060814] hover:bg-slate-800/40 hover:border-slate-700'
                                    }`}
                                  >
                                    <div className={`w-5 h-5 rounded-full flex items-center justify-center border transition-all ${
                                      isSelected
                                        ? 'border-blue-500 bg-blue-500 text-white shadow-sm'
                                        : 'border-slate-700 bg-slate-800 group-hover:border-slate-600'
                                    }`}>
                                      <input
                                        type="radio"
                                        name={`choices-${q.id}`}
                                        value={key}
                                        checked={isSelected}
                                        onChange={() => {
                                          setAnswers((prev) => ({ ...prev, [q.id]: key }));
                                          latestTranscriptRef.current = key;
                                        }}
                                        className="sr-only"
                                      />
                                      {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                                    </div>
                                    <span className="text-sm font-semibold transition-colors text-slate-300 group-hover:text-white">
                                      <span className={`mr-2 uppercase font-black transition-colors ${isSelected ? 'text-blue-400' : 'text-slate-500 group-hover:text-slate-400'}`}>{key}</span>
                                      {val}
                                    </span>
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Speech transcription editor (Voice mode essay questions) */}
                        {q.type !== 'mcq' && showManualInput && (
                          <div className="bg-[#0C101F] border border-blue-500/10 rounded-2xl p-6 shadow-lg flex flex-col gap-4 animate-[fadeIn_0.2s_ease-out]">
                            <div className="flex items-center justify-between border-b border-slate-900 pb-3">
                              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2 font-mono">
                                <Volume2 className="w-4 h-4 text-blue-400 animate-pulse" /> Speech Transcription Monitor
                              </span>
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => {
                                    if (isTtsSpeaking) {
                                      if (window.speechSynthesis) window.speechSynthesis.cancel();
                                      setIsTtsSpeaking(false);
                                      startSpeechRecognition();
                                    } else if (isListening) {
                                      stopSpeechRecognition();
                                    } else {
                                      startSpeechRecognition();
                                    }
                                  }}
                                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[10px] font-bold transition-all cursor-pointer uppercase font-mono ${
                                    isListening 
                                      ? 'bg-emerald-950/20 text-emerald-400 border-emerald-500/20 animate-pulse' 
                                      : 'bg-blue-950/20 text-blue-400 border-blue-500/20'
                                  }`}
                                >
                                  <Mic className={`w-3.5 h-3.5 ${isListening ? 'text-emerald-400' : 'text-blue-400'}`} />
                                  <span>{isListening ? 'Listening' : 'Mic Paused'}</span>
                                </button>
                                {answers[q.id] && (
                                  <span className="text-[10px] text-emerald-400 bg-emerald-950/20 px-2.5 py-1 rounded-lg border border-emerald-500/20 font-bold uppercase tracking-wider font-mono">
                                    Saved Live
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className={`min-h-[140px] rounded-xl border transition-all duration-300 flex flex-col justify-center overflow-hidden bg-[#060814] ${
                              isListening ? 'border-emerald-500/40 shadow-[0_0_15px_rgba(16,185,129,0.02)]' : 'border-slate-800 focus-within:border-blue-500/60'
                            }`}>
                              {answers[q.id] ? (
                                <textarea
                                  value={answers[q.id]}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setAnswers((prev) => ({ ...prev, [q.id]: val }));
                                    latestTranscriptRef.current = val;
                                    accumulatedTextRef.current = val;
                                  }}
                                  placeholder="Spoken answers will be transcribed here automatically."
                                  className="w-full min-h-[140px] bg-transparent text-sm leading-relaxed text-slate-200 p-5 focus:outline-none resize-none placeholder-slate-650 font-sans border-0 focus:ring-0"
                                />
                              ) : (
                                <div className="flex flex-col items-center justify-center max-w-sm mx-auto text-center p-6 space-y-3">
                                  <div className="w-10 h-10 rounded-full bg-[#0C101F] border border-slate-800 flex items-center justify-center text-slate-500">
                                    <Mic className="w-5 h-5 animate-pulse" />
                                  </div>
                                  <div>
                                    <p className="text-xs font-bold text-slate-400">Waiting for candidate voice response...</p>
                                    <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                                      Speak clearly to allow the AI model to capture your answer, or click below to type your essay response manually.
                                    </p>
                                  </div>
                                  <button
                                    onClick={() => setAnswers((prev) => ({ ...prev, [q.id]: ' ' }))}
                                    className="mt-2 text-[10px] font-bold text-blue-400 flex items-center gap-1.5 bg-blue-950/20 px-3 py-2 rounded-lg border border-blue-500/20 hover:bg-blue-950/40 hover:text-white transition-all cursor-pointer"
                                  >
                                    <FileText className="w-3.5 h-3.5" /> Type Answer Manually
                                  </button>
                                </div>
                              )}
                            </div>
                            <div className="flex justify-between items-center text-[10px] text-slate-500 mt-1 font-mono">
                              <span>Characters: {answers[q.id] ? answers[q.id].length : 0}</span>
                              <span>Auto-Save Active</span>
                            </div>
                          </div>
                        )}

                        {/* Action buttons */}
                        <div className="min-h-[127px] bg-[#10141C] border-2 border-[#202638] rounded-[24px] px-8 py-7 flex items-center gap-5 shadow-lg">
                          <button
                            onClick={() => {
                              if (isListening) {
                                stopSpeechRecognition();
                              } else {
                                startSpeechRecognition();
                              }
                            }}
                            className={`h-[68px] max-w-[280px] flex items-center justify-center gap-5 px-8 border-2 rounded-[14px] font-extrabold text-[28px] transition-all duration-200 cursor-pointer flex-1 ${
                              isListening 
                                ? 'border-red-500/30 bg-red-950/20 text-red-400 hover:bg-red-950/40' 
                                : 'border-white/35 bg-transparent text-white hover:bg-slate-800/40 hover:border-slate-500'
                            }`}
                          >
                            <Square className={`w-4 h-4 ${isListening ? 'text-red-400 fill-red-400' : 'text-slate-500'}`} />
                            <span>{isListening ? 'Stop Record' : 'Start Record'}</span>
                          </button>

                          <button
                            onClick={handleNextQuestion}
                            className="h-[68px] max-w-[296px] flex items-center justify-center gap-5 px-8 border-2 border-white/35 bg-transparent text-white font-extrabold text-[28px] rounded-[14px] hover:bg-slate-800/40 hover:border-slate-500 transition-all duration-200 cursor-pointer flex-1"
                          >
                            <span>{currentQ < questions.length - 1 ? 'Next Question' : 'Complete Assessment'}</span>
                            <Square className="w-4 h-4 text-slate-500" />
                          </button>
                        </div>
                      </div>

                      {/* Right Column */}
                      <div className="lg:col-span-5 flex flex-col gap-5 w-full">
                        {renderCandidateCameraCard()}

                        {/* Network Speed Widget */}
                        <div className="h-[102px] bg-[#10141C] border-2 border-[#202638] rounded-[18px] px-8 shadow-lg flex items-center justify-between relative overflow-hidden">
                          <div className="flex items-center gap-5">
                            <div className="w-5 h-5 flex items-center justify-center text-blue-400">
                              <Square className="w-5 h-5" />
                            </div>
                            <div>
                              <span className="text-sm text-[#667293] uppercase tracking-[0.28em] font-mono block">Network Speed</span>
                              <span className="text-xl font-extrabold text-emerald-400 mt-1 block leading-none">Good</span>
                            </div>
                          </div>

                          {/* Graphical signal strength bars */}
                          <div className="flex items-end gap-2 h-10">
                            <div className="w-2 h-3 bg-blue-500 rounded-full" />
                            <div className="w-2 h-5 bg-blue-500 rounded-full" />
                            <div className="w-2 h-7 bg-blue-500 rounded-full" />
                            <div className="w-2 h-9 bg-blue-500 rounded-full" />
                            <div className="w-2 h-10 bg-slate-700/60 rounded-full" />
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                } else {
                  // Coding environment overhaul under cyber dark theme
                  return (
                    <div className="max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-12 gap-6 p-6 items-stretch">
                      
                      {/* Left stack (5 of 12 cols): prompt card & camera */}
                      <div className="lg:col-span-5 flex flex-col gap-6 overflow-y-auto max-h-[calc(100vh-140px)] pr-1">
                        
                        {/* Metrics bar */}
                        <div className="bg-[#0C101F] border border-blue-500/10 rounded-2xl p-5 relative overflow-hidden shadow-lg grid grid-cols-2">
                          <div className="flex flex-col">
                            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest font-mono">Question</span>
                            <span className="text-xl font-black text-blue-400 font-mono mt-0.5">
                              {currentQ + 1} / {questions.length}
                            </span>
                          </div>
                          <div className="flex flex-col pl-4 border-l border-slate-800/80">
                            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest font-mono">Time Per Question</span>
                            <span className="text-xl font-black text-amber-500 font-mono mt-0.5 flex items-center gap-1.5">
                              <Clock className="w-4 h-4 text-amber-500 animate-pulse" />
                              {timeLeft % 60}
                            </span>
                          </div>
                        </div>

                        {/* Question details */}
                        <div className="bg-[#0C101F] border border-blue-500/10 rounded-2xl p-6 relative overflow-hidden shadow-lg flex flex-col gap-4">
                          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest font-mono">Question Prompt</span>
                          <h3 className="text-lg font-bold text-white leading-relaxed tracking-tight whitespace-pre-line">
                            {q.text}
                          </h3>
                          <div className="flex gap-2">
                            <span className="text-[9px] px-2.5 py-0.5 rounded bg-amber-950/20 text-amber-400 border border-amber-500/20 font-bold uppercase tracking-wider font-mono">
                              {q.difficulty}
                            </span>
                            <span className="text-[9px] px-2.5 py-0.5 rounded bg-blue-950/20 text-blue-400 border border-blue-500/20 font-bold uppercase tracking-wider font-mono">
                              Coding Lab
                            </span>
                          </div>
                        </div>

                        {renderCandidateCameraCard()}
                      </div>

                      {/* Right stack (7 of 12 cols): coding compiler workspace */}
                      <div className="lg:col-span-7 flex flex-col bg-[#0C101F] border border-blue-500/10 rounded-2xl overflow-hidden shadow-xl min-h-[500px]">
                        {/* Header toolbar */}
                        <div className="bg-[#0A0D14] px-4 py-3.5 border-b border-slate-850 flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2 text-slate-300">
                            <FileCode className="w-4 h-4 text-blue-400" />
                            <span className="font-bold font-mono">solution.{selectedLang === 'python' ? 'py' : selectedLang === 'cpp' ? 'cpp' : 'js'}</span>
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
                            className="bg-[#060814] border border-slate-800 text-slate-200 text-xs rounded-lg px-2.5 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer font-mono"
                          >
                            <option value="javascript">JavaScript (Node)</option>
                            <option value="python">Python 3</option>
                            <option value="cpp">C++ (GCC)</option>
                          </select>
                        </div>

                        {/* Editor body */}
                        <div className="flex-grow flex overflow-hidden bg-[#060814] font-mono text-xs">
                          <div className="w-12 bg-[#0A0D14]/60 border-r border-slate-900 text-right select-none pr-3 py-4 text-slate-700 font-mono leading-[20px]">
                            {Array.from({ length: Math.max((answers[q.id] || q.options?.starters?.[selectedLang] || '').split('\n').length, 25) }).map((_, i) => (
                              <div key={i} className="h-5">{i + 1}</div>
                            ))}
                          </div>
                          
                          <textarea
                            value={answers[q.id] || q.options?.starters?.[selectedLang] || ''}
                            onChange={(e) => setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
                            className="flex-grow bg-transparent text-emerald-450 p-4 focus:outline-none leading-[20px] resize-none selection:bg-slate-800 border-0 focus:ring-0 font-mono"
                          />
                        </div>

                        {/* Logs section */}
                        {runLogs.length > 0 && (
                          <div className="max-h-[140px] overflow-y-auto bg-[#0A0D14] border-t border-slate-850 p-4 text-xs font-mono text-slate-300 whitespace-pre-wrap divide-y divide-slate-800">
                            {runLogs.map((log, lIdx) => (
                              <div key={lIdx} className="py-1 text-cyan-400/90">{log}</div>
                            ))}
                          </div>
                        )}

                        {/* Compilation footer action bar */}
                        <div className="bg-[#0A0D14] px-4 py-3 border-t border-slate-850 flex justify-between items-center">
                          <button
                            onClick={handleRunCode}
                            disabled={runningCode}
                            className="bg-blue-600 hover:bg-blue-500 disabled:bg-blue-700 text-white text-xs font-semibold py-2 px-4 rounded-lg shadow-md flex items-center gap-1.5 cursor-pointer transition-colors"
                          >
                            {runningCode ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                            <span>Run Sandbox Compiler</span>
                          </button>

                          <button
                            onClick={handleNextQuestion}
                            className="flex items-center gap-1.5 px-4 py-2 border border-slate-800 bg-transparent text-white font-semibold text-xs rounded-lg hover:bg-white hover:text-black transition-all cursor-pointer"
                          >
                            <span>{currentQ < questions.length - 1 ? 'Save & Next' : 'Complete Assessment'}</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                }
              })()}

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
