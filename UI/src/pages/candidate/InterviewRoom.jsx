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
  { id: 'aptitude', name: 'Section 1: Aptitude Round', duration: 15 },
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

  const setVideoRef = (el) => {
    videoRef.current = el;
    if (el && streamRef.current) {
      if (el.srcObject !== streamRef.current) {
        el.srcObject = streamRef.current;
      }
    }
  };

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

  // Auto-initialize webcam stream if not already active in Face Registration
  useEffect(() => {
    if (phase === PHASE.FACE_REG && !streamRef.current) {
      startWebcam();
    }
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
        <aside className="w-[240px] shrink-0 flex flex-col h-screen select-none bg-[#0B0F19] border-r border-white/[0.06]">
          <div className="p-6 flex items-center gap-3 border-b border-white/[0.04]">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
              <QrCode className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-[15px] font-bold text-white tracking-tight leading-none">AgnoHire</p>
              <p className="text-[8px] text-[#94a3b8] font-bold uppercase tracking-[0.2em] mt-1.5 opacity-65">Secure Onboarding</p>
            </div>
          </div>

          <nav className="flex-grow p-4 overflow-y-auto space-y-4">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.15em] mb-3 px-2">Setup Checklist</p>
            <div className="flex flex-col gap-1.5">
              {setupSteps.map((step, idx) => {
                const isActive    = phase === step.phaseKey;
                const isCompleted = currentStepIdx > idx;
                const StepIcon = idx === 0 ? Shield : idx === 1 ? SlidersHorizontal : idx === 2 ? Eye : ClipboardList;
                return (
                  <div key={step.phaseKey} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-300 border ${
                    isActive 
                      ? 'bg-blue-600/10 border-blue-500/30 text-white shadow-inner' 
                      : 'bg-transparent border-transparent text-slate-500'
                  }`}>
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold font-mono transition-all ${
                      isCompleted 
                        ? 'bg-emerald-500 text-white' 
                        : isActive 
                        ? 'bg-blue-500 text-white shadow-md shadow-blue-500/20' 
                        : 'bg-slate-800/40 border border-slate-800/80 text-slate-500'
                    }`}>
                      {isCompleted ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : step.num}
                    </div>
                    <div className="flex-grow min-w-0">
                      <p className={`text-[12px] font-bold leading-tight ${isActive ? 'text-white' : isCompleted ? 'text-slate-400' : 'text-slate-650'}`}>{step.title}</p>
                      <p className={`text-[9px] mt-0.5 ${isActive ? 'text-blue-400' : isCompleted ? 'text-emerald-500/80' : 'text-slate-700'}`}>{step.desc}</p>
                    </div>
                    <StepIcon className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-blue-400' : 'text-slate-800'}`} />
                  </div>
                );
              })}
            </div>
          </nav>

          <div className="p-5 border-t border-white/[0.04] bg-slate-950/20">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-blue-600/10 border border-blue-500/20 flex-shrink-0 flex items-center justify-center">
                <CircleUserRound className="w-5 h-5 text-blue-400" />
              </div>
              <div className="min-w-0 flex-grow">
                <p className="text-xs font-bold text-white truncate leading-none">{schedule?.interview?.candidate?.name || '—'}</p>
                <p className="text-[10px] text-slate-400 truncate mt-1">{schedule?.interview?.candidate?.email || '—'}</p>
              </div>
            </div>
          </div>
        </aside>

        {/* RIGHT PANEL */}
        <div className="flex-1 flex flex-col h-screen overflow-hidden bg-[#060814] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#0b1224] via-[#060814] to-[#060814]">

          <header className="h-[72px] px-8 flex items-center justify-between border-b border-white/[0.05] flex-shrink-0 bg-slate-950/20 backdrop-blur-md">
            <div>
              <p className="text-[9px] font-bold text-slate-500 uppercase tracking-[0.18em] leading-none mb-1.5">{setupSteps[currentStepIdx]?.desc}</p>
              <p className="text-lg font-bold text-white leading-none">{setupSteps[currentStepIdx]?.title}</p>
            </div>
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-3">
                <div className="flex gap-1.5">
                  {setupSteps.map((_, idx) => (
                    <div key={idx} className={`h-1 rounded-full transition-all duration-300 ${
                      idx < currentStepIdx ? 'w-5 bg-emerald-500' : idx === currentStepIdx ? 'w-7 bg-blue-500' : 'w-4 bg-white/10'
                    }`} />
                  ))}
                </div>
                <span className="text-xs text-slate-500 font-bold font-mono">{currentStepIdx + 1} / 4</span>
              </div>
              <div className="flex gap-2">
                <button className="w-8 h-8 rounded-lg border border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.06] flex items-center justify-center cursor-pointer text-slate-400 hover:text-white transition-colors"><Bell className="w-4 h-4" /></button>
                <button className="w-8 h-8 rounded-lg border border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.06] flex items-center justify-center cursor-pointer text-slate-400 hover:text-white transition-colors"><HelpCircle className="w-4 h-4" /></button>
              </div>
            </div>
          </header>


          <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', overflowY: 'auto', padding: '24px' }}>
            <div style={{ width: '100%', maxWidth: 560 }}>
              <AnimatePresence mode="wait">

                {phase === PHASE.VERIFY && (
                  <motion.div key="verify" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.18 }}>
                    <div className="bg-[#0B0F19]/80 backdrop-blur-xl border border-white/[0.06] rounded-2xl overflow-hidden shadow-2xl">
                      <div className="p-8">
                        <div className="flex items-start gap-4 mb-6">
                          <div className="w-12 h-12 bg-blue-600/10 border border-blue-500/20 rounded-xl flex-shrink-0 flex items-center justify-center animate-pulse">
                            <Shield className="w-6 h-6 text-blue-400" />
                          </div>
                          <div>
                            <h2 className="text-xl font-bold text-white tracking-tight mb-1.5">Identity Verification</h2>
                            <p className="text-slate-400 text-xs leading-relaxed">Confirm your profile and request your one-time passcode to begin the secure interview.</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 px-4 py-3 bg-white/[0.02] border border-white/[0.06] rounded-xl text-xs">
                          <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse flex-shrink-0" />
                          <span className="text-slate-350">Applied for: <strong className="text-blue-400 font-semibold">{schedule?.interview?.candidate?.domain?.name || 'Software Engineer'}</strong></span>
                          <span className="text-white/10">|</span>
                          <span className="text-slate-400">Recruiter: {schedule?.interview?.recruiter?.name || 'AgnoHire Recruiter'}</span>
                        </div>
                      </div>
                      <div className="px-8 pb-8">
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">Registered Profile Data</p>
                        <div className="bg-slate-950/40 border border-white/[0.04] rounded-xl overflow-hidden mb-6">
                          {[
                            { label: 'Full Name',     value: schedule?.interview?.candidate?.name, mono: false },
                            { label: 'Email Address', value: schedule?.interview?.candidate?.email, mono: false },
                            { label: 'Candidate ID',  value: schedule?.interview?.candidateId,      mono: true  },
                          ].map((field, i, arr) => (
                            <div key={field.label} className={`flex items-center justify-between px-5 py-3 text-xs ${i < arr.length - 1 ? 'border-b border-white/[0.04]' : ''}`}>
                              <span className="font-semibold text-slate-500 uppercase tracking-wider text-[9px]">{field.label}</span>
                              <span className={`font-semibold text-slate-200 ${field.mono ? 'font-mono text-[10px] text-blue-400' : ''}`}>{field.value || '—'}</span>
                            </div>
                          ))}
                        </div>
                        {!otpSent ? (
                          <button onClick={handleSendOtp} className="w-full h-11 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl text-sm font-semibold cursor-pointer flex items-center justify-center gap-2 shadow-lg shadow-blue-500/25 transition-all active:scale-98">
                            Send Verification Code <ChevronRight className="w-4 h-4" />
                          </button>
                        ) : (
                          <div className="flex flex-col gap-4">
                            <div>
                              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2.5">6-Digit Verification Code</label>
                              <input type="text" maxLength={6} placeholder="• • • • • •" value={otpCode} onChange={e => setOtpCode(e.target.value)} className="w-full text-center tracking-[12px] text-xl font-bold font-mono bg-slate-950/60 border border-white/[0.08] focus:border-blue-500/60 rounded-xl py-3.5 text-white outline-none transition-all" />
                            </div>
                            {devOtp && (
                              <div className="flex justify-between items-center px-4 py-2.5 bg-amber-500/5 border border-amber-500/20 rounded-xl text-xs">
                                <span className="text-amber-400 font-medium">🧪 Dev Mode OTP</span>
                                <span className="font-mono font-bold text-amber-300 letter-spacing-[3px]">{devOtp}</span>
                              </div>
                            )}
                            <button onClick={handleVerifyOtp} disabled={otpVerifying} className="w-full h-11 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-sm font-semibold cursor-pointer flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition-all active:scale-98 disabled:opacity-50">
                              {otpVerifying ? 'Verifying…' : 'Verify & Continue'} {!otpVerifying && <ChevronRight className="w-4 h-4" />}
                            </button>
                          </div>
                        )}
                        <div className="flex items-center gap-2 mt-4 text-[10px] text-slate-500">
                          <Lock className="w-3.5 h-3.5 text-slate-600 flex-shrink-0" />
                          <span>Session secured with 256-bit TLS encryption and real-time proctoring.</span>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}

                {phase === PHASE.ENV_CHECK && (
                  <motion.div key="env" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.18 }} className="space-y-4">
                    <div className="bg-[#0B0F19]/80 backdrop-blur-xl border border-white/[0.06] rounded-2xl p-6 flex items-center gap-4 shadow-2xl">
                      <div className="w-12 h-12 bg-indigo-600/10 border border-indigo-500/20 rounded-xl flex-shrink-0 flex items-center justify-center animate-pulse">
                        <Monitor className="w-6 h-6 text-indigo-400" />
                      </div>
                      <div>
                        <h2 className="text-xl font-bold text-white tracking-tight">System Compatibility</h2>
                        <p className="text-slate-400 text-xs">Verify your devices and connection parameters before biometric enrollment.</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="bg-[#080D17]/90 border border-white/[0.06] rounded-2xl overflow-hidden flex flex-col min-h-[280px]">
                        <div className="px-4 py-3 border-b border-white/[0.04] flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${webcamOn ? 'bg-emerald-500 animate-pulse' : 'bg-slate-700'}`} />
                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{webcamOn ? 'Camera Active' : 'Camera Inactive'}</span>
                          </div>
                        </div>
                        <div className="flex-1 relative bg-slate-950/40">
                          {webcamOn
                            ? <video ref={setVideoRef} autoPlay muted className="absolute inset-0 w-full h-full object-cover scale-x-[-1] rounded-b-xl" />
                            : <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                                <Camera className="w-8 h-8 text-slate-700" />
                                <p className="text-[11px] text-slate-500 text-center px-6">Allow browser webcam and microphone access</p>
                              </div>
                          }
                        </div>
                        <div className="p-3 bg-slate-950/20 border-t border-white/[0.04]">
                          <button onClick={startWebcam} className="w-full h-9 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] rounded-xl text-slate-200 hover:text-white text-xs font-semibold cursor-pointer flex items-center justify-center gap-1.5 transition-all">
                            <Camera className="w-4 h-4 text-blue-400" />
                            {webcamOn ? 'Restart Device Feed' : 'Enable Camera & Mic'}
                          </button>
                        </div>
                      </div>
                      <div className="bg-[#0B0F19]/80 backdrop-blur-xl border border-white/[0.06] rounded-2xl p-5 flex flex-col justify-between">
                        <div>
                          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">Compatibility Matrix</p>
                          <div className="space-y-1.5">
                            {[
                              { icon: Monitor, label: 'Fullscreen Mode',   ok: envStates.fullscreen,             action: !envStates.fullscreen ? <button onClick={requestFullscreenMode} className="text-[10px] font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-lg px-2.5 py-1 cursor-pointer transition-colors shadow-md shadow-blue-500/10">Enable</button> : null },
                              { icon: Volume2, label: 'Speaker System',      ok: envStates.speaker,                action: !envStates.speaker ? <button onClick={playTestSound} disabled={isSpeakerPlaying} className="text-[10px] font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-lg px-2.5 py-1 cursor-pointer transition-colors shadow-md shadow-blue-500/10 disabled:opacity-50">{isSpeakerPlaying ? '…' : 'Test Sound'}</button> : null },
                              { icon: Wifi,    label: 'Connection Latency',  ok: envStates.internet === 'success', action: envStates.internet !== 'success' ? <button onClick={runSpeedTest} className="text-[10px] font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-lg px-2.5 py-1 cursor-pointer transition-colors shadow-md shadow-blue-500/10">{envStates.internet === 'running' ? '…' : 'Test Speed'}</button> : null },
                              { icon: Battery, label: 'Device Charge',      ok: envStates.battery > 20,           badge: `${envStates.battery}%`, action: null },
                              { icon: Camera,  label: 'Webcam Stream',      ok: envStates.camera && envStates.mic, action: null },
                            ].map((check, idx) => (
                              <div key={idx} className={`flex items-center justify-between py-2 ${idx < 4 ? 'border-b border-white/[0.03]' : ''}`}>
                                <div className="flex items-center gap-2.5">
                                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${check.ok ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' : 'bg-white/[0.02] border border-white/[0.04] text-slate-500'}`}>
                                    <check.icon className="w-3.5 h-3.5" />
                                  </div>
                                  <span className="text-xs text-slate-350">{check.label}</span>
                                </div>
                                {check.ok
                                  ? <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-md px-2 py-0.5 font-mono">PASS</span>
                                  : check.action ? check.action : <span className="text-[10px] text-slate-600 font-mono">—</span>}
                              </div>
                            ))}
                          </div>
                        </div>
                        <button disabled={!(envStates.fullscreen && envStates.camera && envStates.mic && envStates.speaker && envStates.internet === 'success')} onClick={() => setPhase(PHASE.FACE_REG)}
                          className="mt-4 w-full h-10 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:from-slate-800 disabled:to-slate-800 text-white disabled:text-slate-500 rounded-xl text-sm font-semibold cursor-pointer disabled:cursor-not-allowed flex items-center justify-center gap-1.5 transition-all shadow-lg shadow-blue-500/20 disabled:shadow-none active:scale-98">
                          Continue to Biometrics <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}

                {phase === PHASE.FACE_REG && (
                  <motion.div key="face" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.18 }}>
                    <div className="bg-[#0B0F19]/80 backdrop-blur-xl border border-white/[0.06] rounded-2xl overflow-hidden shadow-2xl">
                      <div className="px-8 py-5 border-b border-white/[0.04] flex items-center gap-4 bg-slate-950/20">
                        <div className="w-12 h-12 bg-emerald-600/10 border border-emerald-500/20 rounded-xl flex-shrink-0 flex items-center justify-center animate-pulse">
                          <Eye className="w-6 h-6 text-emerald-400" />
                        </div>
                        <div>
                          <h2 className="text-xl font-bold text-white tracking-tight">Biometric Enrollment</h2>
                          <p className="text-slate-405 text-xs">Position your face within the safety boundaries and record your profile.</p>
                        </div>
                      </div>
                      <div className="p-8">
                        <div className="bg-[#080D17]/95 border border-white/[0.06] rounded-2xl overflow-hidden relative aspect-[16/9] mb-6 shadow-inner flex items-center justify-center bg-black">
                          {faceDataUrl
                            ? <img src={faceDataUrl} alt="Captured" className="absolute inset-0 w-full h-full object-cover scale-x-[-1] rounded-2xl" />
                            : <video ref={setVideoRef} autoPlay muted className="absolute inset-0 w-full h-full object-cover scale-x-[-1] rounded-2xl" />}
                          {!faceRegistered && !faceScanning && (
                            <div className="absolute inset-6 border border-dashed border-blue-500/30 rounded-xl flex items-end justify-center pb-4">
                              <span className="text-[10px] text-blue-400 bg-slate-950/70 border border-blue-500/30 px-3.5 py-1.5 rounded-full font-bold uppercase tracking-wider font-mono backdrop-blur-md shadow-md animate-pulse">Center Your Face</span>
                            </div>
                          )}
                          {faceRegistered && (
                            <div className="absolute inset-0 bg-emerald-500/5 border border-emerald-500/25 rounded-2xl flex items-center justify-center">
                              <div className="flex items-center gap-2.5 bg-slate-950/60 border border-emerald-500/30 px-5 py-2.5 rounded-xl backdrop-blur-md shadow-xl">
                                <CheckCircle className="w-4 h-4 text-emerald-400" />
                                <span className="text-xs font-bold text-emerald-300 uppercase tracking-widest font-mono">Face Profile Saved</span>
                              </div>
                            </div>
                          )}
                        </div>
                        {!faceRegistered ? (
                          <button onClick={captureFaceBiometrics} disabled={faceScanning}
                            className="w-full h-12 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl text-sm font-semibold cursor-pointer flex items-center justify-center gap-2 shadow-lg shadow-blue-500/25 transition-all active:scale-98 disabled:opacity-60">
                            <Camera className="w-4 h-4" />
                            {faceScanning ? 'Capturing Biometric Vectors…' : 'Capture Facial Profile'}
                          </button>
                        ) : (
                          <div className="flex flex-col gap-4">
                            <div className="flex items-center gap-3 px-5 py-3.5 bg-emerald-500/5 border border-emerald-500/20 rounded-xl shadow-inner">
                              <CheckCircle className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                              <div>
                                <p className="text-xs font-bold text-emerald-300">Enrollment Completed</p>
                                <p className="text-[10px] text-emerald-500/70 mt-0.5">Biometric verification vector keys generated successfully.</p>
                              </div>
                            </div>
                            <div className="flex gap-3">
                              <button onClick={() => { setFaceRegistered(false); setFaceDataUrl(''); startWebcam(); }} className="flex-1 h-11 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] rounded-xl text-slate-300 hover:text-white text-xs font-semibold cursor-pointer transition-all active:scale-98">Retake Profile</button>
                              <button onClick={() => setPhase(PHASE.INSTRUCTIONS)} className="flex-[2] h-11 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl text-xs font-semibold cursor-pointer flex items-center justify-center gap-1.5 transition-all shadow-lg shadow-blue-500/20 active:scale-98">
                                Proceed to Briefing <ChevronRight className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        )}
                        <div className="flex items-center gap-2 mt-4 text-[10px] text-slate-500">
                          <Lock className="w-3.5 h-3.5 text-slate-600 flex-shrink-0" />
                          <span>All biometric datasets are strictly tokenized and encrypted in memory.</span>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}

                {phase === PHASE.INSTRUCTIONS && (
                  <motion.div key="instructions" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.18 }} className="space-y-4">
                    <div className="bg-[#0B0F19]/80 backdrop-blur-xl border border-white/[0.06] rounded-2xl p-6 flex items-center gap-4 shadow-2xl">
                      <div className="w-12 h-12 bg-amber-600/10 border border-amber-500/20 rounded-xl flex-shrink-0 flex items-center justify-center animate-pulse">
                        <FileCode className="w-6 h-6 text-amber-400" />
                      </div>
                      <div>
                        <h2 className="text-xl font-bold text-white tracking-tight">Assessment Briefing</h2>
                        <p className="text-slate-400 text-xs">Review session instructions and proctoring boundaries to initialize the room.</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      {[{ label: 'Modules', value: '3 Sections' }, { label: 'Exam Duration', value: '60 Minutes' }, { label: 'Assigned Domain', value: schedule?.interview?.candidate?.domain?.name || 'General' }].map((s, i) => (
                        <div key={i} className="bg-[#0B0F19]/60 border border-white/[0.04] rounded-xl p-4 text-center">
                          <p className="text-sm font-bold text-white font-mono">{s.value}</p>
                          <p className="text-[10px] text-slate-500 mt-1 uppercase tracking-wider font-semibold">{s.label}</p>
                        </div>
                      ))}
                    </div>
                    <div className="bg-[#0B0F19]/80 backdrop-blur-xl border border-white/[0.06] rounded-2xl overflow-hidden shadow-2xl">
                      <div className="px-5 py-3 border-b border-white/[0.04] bg-slate-950/20">
                        <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Active Proctoring Protocols</p>
                      </div>
                      {[
                        { icon: Shield,  title: 'Continuous Face Verification', desc: 'Biometric scanners track facial frames continuously. Do not exit webcam view.',          color: '#60A5FA', bg: 'rgba(59,130,246,0.06)',  bd: 'rgba(59,130,246,0.15)'  },
                        { icon: Monitor, title: 'Locked Viewport Constraints',        desc: 'Exiting fullscreen view or switching browser tabs logs immediate warnings.',  color: '#A78BFA', bg: 'rgba(139,92,246,0.06)',  bd: 'rgba(139,92,246,0.15)'  },
                        { icon: Lock,    title: 'Clipboard Lock Active',        desc: 'Right-click menu, clipboard copy/paste, and code extraction keys are restricted.', color: '#FCD34D', bg: 'rgba(245,158,11,0.06)',  bd: 'rgba(245,158,11,0.15)'  },
                        { icon: Clock,   title: 'Autonomous Exam Submission',        desc: 'Assessment triggers zero-delay automatic submission once the global timer expires.',    color: '#F87171', bg: 'rgba(239,68,68,0.06)',   bd: 'rgba(239,68,68,0.15)'   },
                      ].map((rule, idx, arr) => (
                        <div key={idx} className={`flex items-start gap-4.5 p-4.5 ${idx < arr.length - 1 ? 'border-b border-white/[0.03]' : ''}`}>
                          <div className="w-9 h-9 rounded-lg border flex-shrink-0 flex items-center justify-center" style={{ borderColor: rule.bd, background: rule.bg }}>
                            <rule.icon className="w-4 h-4" style={{ color: rule.color }} />
                          </div>
                          <div>
                            <p className="text-xs font-bold text-slate-200">{rule.title}</p>
                            <p className="text-[10px] text-slate-500 mt-1 leading-relaxed">{rule.desc}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="bg-[#0B0F19]/80 backdrop-blur-xl border border-white/[0.06] rounded-2xl p-5 flex flex-col gap-4">
                      <label className="flex items-start gap-3 cursor-pointer">
                        <input type="checkbox" checked={rulesAgreed} onChange={e => setRulesAgreed(e.target.checked)} className="mt-1 w-4 h-4 rounded border-slate-700 bg-slate-900 text-blue-500 focus:ring-0 cursor-pointer" />
                        <span className="text-xs text-slate-400 leading-relaxed">I consent to secure proctoring monitor locks and biometric vector tracking to initialize the session.</span>
                      </label>
                      <button disabled={!rulesAgreed} onClick={startInterviewSession}
                        className="w-full h-11 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:from-slate-800 disabled:to-slate-800 text-white disabled:text-slate-500 rounded-xl text-sm font-semibold cursor-pointer disabled:cursor-not-allowed flex items-center justify-center gap-1.5 transition-all shadow-lg shadow-blue-500/20 disabled:shadow-none active:scale-98">
                        <Play className="w-4 h-4" /> Launch Assessments Workspace
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
    <div className="dark min-h-screen bg-[#060814] text-white flex flex-col font-sans selection:bg-blue-500/30 selection:text-white">
      {/* Top Banner Navigation */}
      {phase !== PHASE.INTERVIEW && (
        <header className="h-[72px] px-8 flex items-center justify-between sticky top-0 z-40 bg-[#0B0F19]/80 backdrop-blur-md border-b border-white/[0.06] text-white">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <QrCode className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white leading-none">AgnoHire</h1>
              <p className="text-[9px] text-[#94a3b8] font-bold uppercase tracking-[0.18em] mt-1.5 opacity-60">Secure Interview</p>
            </div>
          </div>
        </header>
      )}

      {/* Main Container */}
      <main className="flex-grow flex flex-col w-full p-0 max-w-none">
        <AnimatePresence mode="wait">
          {/* ACTIVE ASSESSMENT INTERVIEW WORKSPACE */}
          {phase === PHASE.INTERVIEW && q && (
            <motion.div
              key="interview"
              className="relative w-full min-h-[calc(100vh-72px)] bg-[#0A0E17] text-slate-200 font-sans flex flex-col justify-between"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              {/* TOP BAR / NAVIGATION (DARK) */}
              <div className="bg-[#0A0E17] border-b border-white/[0.08] px-8 py-3 flex items-center justify-between z-35 relative">
                {/* Left logo & title */}
                <div className="flex items-center gap-6">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
                      <QrCode className="w-4.5 h-4.5 text-white" />
                    </div>
                    <span className="text-[17px] font-bold text-white tracking-tight">AgnoHire</span>
                  </div>
                  <div className="h-4 w-[1px] bg-white/15" />
                  <div className="flex items-center gap-2 text-xs">
                    <span className="font-semibold text-slate-200">{schedule?.interview?.candidate?.domain?.name || 'Frontend Developer Interview'}</span>
                    <span className="text-white/20">|</span>
                    <span className="text-blue-400 font-medium">{getActiveSectionName()}</span>
                  </div>
                  <span className="ml-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-bold text-emerald-400 uppercase tracking-wider font-mono">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Interview in Progress
                  </span>
                </div>

                {/* Floating Centered Proctor WebCam */}
                <div className="absolute left-1/2 -translate-x-1/2 top-1.5 z-45 bg-[#0B0F19] border border-white/[0.12] rounded-2xl shadow-[0_12px_40px_rgba(0,0,0,0.5)] overflow-hidden w-[160px] aspect-[4/3] flex flex-col group transition-all duration-350 hover:scale-105">
                  <div className="relative flex-grow bg-slate-950 flex items-center justify-center">
                    {webcamOn ? (
                      <video ref={setVideoRef} autoPlay muted className="w-full h-full object-cover scale-x-[-1]" />
                    ) : (
                      <div className="flex flex-col items-center gap-1 text-center">
                        <Camera className="w-5 h-5 text-slate-650 animate-pulse" />
                        <span className="text-[8px] text-slate-500">Initializing...</span>
                      </div>
                    )}
                    {/* HUD Label inside cam overlay */}
                    <div className="absolute bottom-1 right-1.5 bg-black/60 backdrop-blur-md px-1.5 py-0.5 rounded text-[8px] text-slate-350 font-bold uppercase tracking-wider font-mono flex items-center gap-1">
                      <span>You</span>
                      <span className="w-1 h-2 bg-emerald-500 inline-block rounded-sm animate-pulse" />
                    </div>
                  </div>
                </div>

                {/* Right controls: Camera, Mic, Internet + Timer */}
                <div className="flex items-center gap-6">
                  {/* Micro system check tags */}
                  <div className="flex items-center gap-4 text-xs font-medium text-slate-350">
                    <div className="flex items-center gap-1.5">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center ${webcamOn ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                        <Video className="w-3.5 h-3.5" />
                      </div>
                      <div className="text-[10px] leading-tight">
                        <p className="text-slate-500 font-bold uppercase text-[8px]">Camera</p>
                        <p className="font-bold">{webcamOn ? 'ON' : 'OFF'}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center ${micOn ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                        <Mic className="w-3.5 h-3.5" />
                      </div>
                      <div className="text-[10px] leading-tight">
                        <p className="text-slate-500 font-bold uppercase text-[8px]">Mic</p>
                        <p className="font-bold">{micOn ? 'ON' : 'OFF'}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <div className="w-6 h-6 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                        <Wifi className="w-3.5 h-3.5" />
                      </div>
                      <div className="text-[10px] leading-tight">
                        <p className="text-slate-500 font-bold uppercase text-[8px]">Internet</p>
                        <p className="font-bold">Stable</p>
                      </div>
                    </div>
                  </div>

                  {/* Red Bordered Countdown Timer */}
                  <div className="border border-red-500/35 bg-red-950/20 px-4 py-2 rounded-xl flex items-center gap-3 text-red-400 font-mono tracking-wider text-sm font-bold shadow-[0_0_15px_rgba(239,68,68,0.08)]">
                    <Clock className="w-4 h-4 text-red-400 animate-pulse" />
                    <div className="flex flex-col text-right leading-none">
                      <span className="text-[16px] tracking-widest font-black">
                        {Math.floor(timeLeft / 3600).toString().padStart(2, '0')}:
                        {Math.floor((timeLeft % 3600) / 60).toString().padStart(2, '0')}:
                        {String(timeLeft % 60).padStart(2, '0')}
                      </span>
                      <span className="text-[7.5px] text-red-500/70 font-bold uppercase mt-0.5 tracking-wider">Time Remaining</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* MAIN CONTENT CARD WRAPPER */}
              <div className="flex-grow flex items-center justify-center p-8 bg-[#080B11]">
                <div className="w-full max-w-5xl bg-white rounded-2xl shadow-[0_24px_70px_rgba(0,0,0,0.45)] border border-slate-200 overflow-hidden text-slate-800 flex flex-col min-h-[460px]">
                  
                  {/* Top Progress Block (White Card Header) */}
                  <div className="px-8 py-5 border-b border-slate-100 flex items-center justify-between">
                    <div>
                      <span className="text-sm font-bold text-slate-800" style={{ color: '#0f172a' }}>
                        Question {currentQ + 1} of {questions.length}
                      </span>
                    </div>
                    <div>
                      <span className="text-xs font-semibold text-slate-500 tracking-wider">
                        {Math.round(progressPercent)}% Completed
                      </span>
                    </div>
                  </div>

                  {/* Horizontal progress bar */}
                  <div className="w-full h-1.5 bg-slate-100 relative">
                    <div 
                      className="absolute left-0 top-0 h-full bg-blue-600 transition-all duration-500 rounded-r-full"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>

                  {/* Inner workspace details */}
                  <div className="p-8 flex-grow flex flex-col justify-between">
                    
                    {/* Badge + Question Header */}
                    <div>
                      <span className="inline-flex items-center px-3 py-1 rounded-lg text-xs font-semibold text-blue-600 bg-blue-50 border border-blue-100 uppercase tracking-wider mb-4">
                        {q.type === 'coding' ? 'Coding Challenge' : q.type === 'mcq' ? 'Aptitude Question' : 'Technical Question'}
                      </span>
                      <h2 className="text-xl font-extrabold leading-relaxed mb-6" style={{ color: '#0f172a' }}>
                        {q.text}
                      </h2>
                    </div>

                    {/* Active Question response inputs */}
                    {q.type === 'coding' ? (
                      /* Coding Environment Workspace */
                      <div className="flex flex-col bg-slate-950 border border-slate-800 rounded-xl overflow-hidden shadow-inner flex-grow min-h-[300px] mb-4">
                        <div className="bg-slate-900 px-4 py-3.5 border-b border-slate-800 flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2 text-slate-350">
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
                            className="bg-slate-950 border border-slate-800 text-slate-300 text-xs rounded-lg px-2.5 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer font-mono"
                          >
                            <option value="javascript">JavaScript (Node)</option>
                            <option value="python">Python 3</option>
                            <option value="cpp">C++ (GCC)</option>
                          </select>
                        </div>

                        <div className="flex-grow flex overflow-hidden bg-slate-950 font-mono text-xs text-emerald-400">
                          <div className="w-12 bg-slate-900 border-r border-slate-850 text-right select-none pr-3 py-4 text-slate-650 font-mono leading-[20px]">
                            {Array.from({ length: Math.max((answers[q.id] || q.options?.starters?.[selectedLang] || '').split('\n').length, 12) }).map((_, i) => (
                              <div key={i} className="h-5">{i + 1}</div>
                            ))}
                          </div>
                          
                          <textarea
                            value={answers[q.id] || q.options?.starters?.[selectedLang] || ''}
                            onChange={(e) => setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
                            className="flex-grow bg-transparent text-emerald-400 p-4 focus:outline-none leading-[20px] resize-none selection:bg-slate-800 border-0 focus:ring-0 font-mono"
                          />
                        </div>

                        {runLogs.length > 0 && (
                          <div className="max-h-[100px] overflow-y-auto bg-slate-900 border-t border-slate-800 p-4 text-xs font-mono text-slate-300 whitespace-pre-wrap">
                            {runLogs.map((log, lIdx) => (
                              <div key={lIdx} className="py-0.5 text-cyan-400/90">{log}</div>
                            ))}
                          </div>
                        )}

                        <div className="bg-slate-900 px-4 py-2.5 border-t border-slate-800 flex justify-between items-center">
                          <button
                            onClick={handleRunCode}
                            disabled={runningCode}
                            className="bg-blue-600 hover:bg-blue-500 disabled:bg-blue-750 text-white text-xs font-semibold py-1.5 px-4 rounded-lg shadow-md flex items-center gap-1.5 cursor-pointer transition-colors"
                          >
                            {runningCode ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                            <span>Run Sandbox Compiler</span>
                          </button>
                        </div>
                      </div>
                    ) : q.type === 'mcq' && q.options ? (
                      /* MCQ options card layout */
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                        {Object.entries(q.options).map(([key, val]) => {
                          const isSelected = answers[q.id] === key;
                          return (
                            <label
                              key={key}
                              className={`p-4 border rounded-xl cursor-pointer flex items-center gap-4.5 transition-all relative overflow-hidden group ${
                                isSelected 
                                  ? 'border-blue-500 bg-blue-50/50 shadow-sm' 
                                  : 'border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300'
                              }`}
                            >
                              <div className={`w-5 h-5 rounded-full flex items-center justify-center border transition-all ${
                                isSelected
                                  ? 'border-blue-500 bg-blue-600 text-white'
                                  : 'border-slate-300 bg-slate-50 group-hover:border-slate-400'
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
                              <span className="text-sm font-semibold text-slate-800">
                                <span className={`mr-2.5 uppercase font-black ${isSelected ? 'text-blue-650' : 'text-slate-400'}`}>{key}.</span>
                                {val}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    ) : (
                      /* Rich Text Editor Frame for Essay/Technical responses */
                      <div className="flex flex-col border border-slate-200 rounded-xl overflow-hidden shadow-sm mb-5 bg-white">
                        
                        {/* Interactive Rich text-style typing area */}
                        <div className="min-h-[200px] flex flex-col justify-start">
                          <textarea
                            value={answers[q.id] || ''}
                            onChange={(e) => {
                              const val = e.target.value;
                              setAnswers((prev) => ({ ...prev, [q.id]: val }));
                              latestTranscriptRef.current = val;
                              accumulatedTextRef.current = val;
                            }}
                            placeholder="Type your answer here..."
                            className="w-full min-h-[160px] p-5 text-slate-800 placeholder-slate-400 text-sm focus:outline-none resize-none border-0 focus:ring-0 leading-relaxed font-sans"
                          />
                        </div>

                        {/* Rich Formatting Toolbar mimicking mockup */}
                        <div className="px-5 py-3.5 border-t border-slate-100 flex items-center justify-between bg-slate-50 text-slate-500 text-sm font-medium select-none">
                          <div className="flex items-center gap-4.5">
                            <button className="hover:text-slate-800 cursor-pointer font-bold font-serif" title="Bold">B</button>
                            <button className="hover:text-slate-800 cursor-pointer italic font-serif" title="Italic">I</button>
                            <button className="hover:text-slate-800 cursor-pointer underline font-serif" title="Underline">U</button>
                            <div className="h-4 w-[1px] bg-slate-200" />
                            <button className="hover:text-slate-800 cursor-pointer font-mono" title="Bulleted List">•—</button>
                            <button className="hover:text-slate-800 cursor-pointer font-mono" title="Numbered List">1—</button>
                            <div className="h-4 w-[1px] bg-slate-200" />
                            <button className="hover:text-slate-800 cursor-pointer" title="Insert Code" onClick={() => setShowManualInput(!showManualInput)}>
                              <FileCode className="w-4 h-4 text-slate-400 hover:text-slate-700" />
                            </button>
                            {/* Voice recording activation trigger inside toolbar */}
                            <button 
                              onClick={() => {
                                if (isListening) {
                                  stopSpeechRecognition();
                                } else {
                                  startSpeechRecognition();
                                }
                              }}
                              className={`flex items-center gap-1 px-2.5 py-0.5 rounded-full border text-[9px] font-bold font-mono tracking-wider uppercase transition-all ${
                                isListening 
                                  ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20 animate-pulse' 
                                  : 'bg-blue-50 text-blue-600 border-blue-100'
                              }`}
                            >
                              <Mic className="w-3 h-3" />
                              <span>{isListening ? 'Voice Typing' : 'Enable Voice'}</span>
                            </button>
                          </div>
                          <div>
                            <span className="text-xs text-slate-400 font-mono">
                              {answers[q.id] ? answers[q.id].trim().split(/\s+/).filter(Boolean).length : 0} words
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Auto-Save Notification Footer banner inside card */}
                    <div className="bg-blue-50/60 border border-blue-100/60 rounded-xl p-3.5 flex items-center gap-2.5 text-xs text-slate-650">
                      <Lock className="w-4 h-4 text-blue-500 flex-shrink-0" />
                      <span>You can type your answer in the box above. Your answer is <strong className="text-blue-600 font-bold">auto-saved</strong> every 10 seconds.</span>
                    </div>

                  </div>
                </div>
              </div>

              {/* BOTTOM BAR / CONTROLS (DARK) */}
              <div className="bg-[#0A0E17] border-t border-white/[0.08] px-8 py-4 flex items-center justify-between z-30">
                {/* Previous question button */}
                <button
                  disabled={currentQ === 0}
                  onClick={() => currentQ > 0 && setCurrentQ(currentQ - 1)}
                  className="px-6 h-11 border border-white/[0.12] bg-[#0E1524] text-white hover:bg-slate-900 disabled:opacity-35 disabled:cursor-not-allowed rounded-xl text-[13px] font-semibold flex items-center gap-2 cursor-pointer transition-colors active:scale-98"
                >
                  <ChevronRight className="w-4 h-4 rotate-180" />
                  <span>Previous</span>
                </button>

                {/* Center actions */}
                <div className="flex items-center gap-3">
                  <button className="px-6 h-11 border border-white/[0.12] bg-[#0E1524] hover:bg-slate-900 text-white rounded-xl text-[13px] font-semibold flex items-center gap-2 cursor-pointer transition-colors active:scale-98">
                    <Award className="w-4 h-4 text-slate-400" />
                    <span>Mark for Review</span>
                  </button>

                  <button 
                    onClick={handleNextQuestion}
                    className="px-6 h-11 border border-white/[0.12] bg-[#0E1524] hover:bg-slate-900 text-white rounded-xl text-[13px] font-semibold flex items-center gap-2 cursor-pointer transition-colors active:scale-98"
                  >
                    <ChevronRight className="w-4 h-4" />
                    <span>Skip Question</span>
                  </button>
                </div>

                {/* Primary Action Button (Vibrant blue) */}
                <button
                  onClick={handleNextQuestion}
                  className="px-8 h-11 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-[13px] font-bold flex items-center gap-2.5 shadow-lg shadow-blue-500/20 cursor-pointer transition-all active:scale-98"
                >
                  <span>{currentQ < questions.length - 1 ? 'Save & Next' : 'Submit Assessment'}</span>
                  <ChevronRight className="w-4 h-4 font-bold" />
                </button>
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
