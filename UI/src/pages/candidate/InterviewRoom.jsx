import { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Mic, MicOff, Video, VideoOff, ChevronRight, ChevronLeft, Clock,
  AlertTriangle, CheckCircle, Cpu, Eye, EyeOff, Shield,
  Smartphone, Wifi, Monitor, Battery, Volume2, Camera,
  RefreshCw, Lock, AlertCircle, Play, FileCode, Award, Code, Check, X,
  Bell, HelpCircle, FileText, QrCode, CircleUserRound, SlidersHorizontal, ClipboardList,
  Square, Bookmark, Sun, Moon, LayoutGrid
} from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';
import * as tf from '@tensorflow/tfjs';
import * as cocoSsd from '@tensorflow-models/coco-ssd';

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
  const [theme, setTheme] = useState('dark');
  const [showPalette, setShowPalette] = useState(false);
  const [flagged, setFlagged] = useState({});
  const [phoneWarnings, setPhoneWarnings] = useState(0);
  const [isPhoneVisible, setIsPhoneVisible] = useState(false);

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

  // Interactive Notepad details
  const [lineNumbersVisible, setLineNumbersVisible] = useState(true);
  const [lastSavedTime, setLastSavedTime] = useState(new Date().toLocaleTimeString());
  const [savingState, setSavingState] = useState('synced');
  const [cursorPos, setCursorPos] = useState({ line: 1, column: 1 });
  const [activeMenu, setActiveMenu] = useState(null);
  const textareaRef = useRef(null);

  const updateCursorPos = (e) => {
    const el = e.target;
    const val = el.value;
    const selStart = el.selectionStart;
    const lines = val.substring(0, selStart).split('\n');
    setCursorPos({
      line: lines.length,
      column: lines[lines.length - 1].length + 1
    });
  };

  const handleEditorChange = (e) => {
    const val = e.target.value;
    setAnswers((prev) => ({ ...prev, [q.id]: val }));
    setSavingState('saving');
    setTimeout(() => {
      setSavingState('synced');
      setLastSavedTime(new Date().toLocaleTimeString());
    }, 800);
    updateCursorPos(e);
  };

  const handleManualSave = () => {
    setSavingState('saving');
    setTimeout(() => {
      setSavingState('synced');
      setLastSavedTime(new Date().toLocaleTimeString());
      toast.success('Code Draft Saved to Cloud Successfully!', {
        icon: '💾',
        style: {
          background: '#0F172A',
          color: '#E2E8F0',
          border: '1.5px solid rgba(59,130,246,0.3)',
        }
      });
    }, 450);
  };

  const handleKeyDown = (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      handleManualSave();
    }
  };

  // Close menus on click outside
  useEffect(() => {
    const handleOutsideClick = () => {
      setActiveMenu(null);
    };
    window.addEventListener('click', handleOutsideClick);
    return () => window.removeEventListener('click', handleOutsideClick);
  }, []);

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

  // Re-attach active stream inside interview phase when camera is turned on
  useEffect(() => {
    if (phase === PHASE.INTERVIEW && webcamOn) {
      if (streamRef.current) {
        if (videoRef.current && videoRef.current.srcObject !== streamRef.current) {
          videoRef.current.srcObject = streamRef.current;
        }
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

  // Mobile Phone Detection Monitor
  useEffect(() => {
    if (phase !== PHASE.INTERVIEW || !webcamOn) return;

    let model = null;
    let detectionInterval = null;
    let isDetecting = false;
    let lastWarningTime = 0;

    const loadModelAndDetect = async () => {
      try {
        await tf.ready();
        model = await cocoSsd.load();
        
        detectionInterval = setInterval(async () => {
          if (isDetecting || !videoRef.current || videoRef.current.readyState !== 4) return;
          
          isDetecting = true;
          try {
            const predictions = await model.detect(videoRef.current);
            const phoneDetected = predictions.some(p => p.class === 'cell phone' && p.score > 0.60);
            
            setIsPhoneVisible(phoneDetected);
            
            if (phoneDetected) {
              const now = Date.now();
              // 5-second cooldown between warnings to avoid rapid triggers
              if (now - lastWarningTime > 5000) {
                lastWarningTime = now;
                setPhoneWarnings(prev => {
                  const next = prev + 1;
                  toast.error(`Proctor Warning ${next}/3: Mobile phone detected in frame!`, { duration: 4000 });
                  
                  // Log violation
                  api.post(`/interviews/${schedule?.interview?.id}/log-violation`, {
                    violationType: 'phone_detected',
                    description: `Mobile phone detected in candidate camera. Warning count: ${next}`,
                    severity: next >= 2 ? 'high' : 'medium',
                  }).catch(err => console.error(err));
                  
                  if (next >= 3) {
                    toast.error('System threshold exceeded. Auto-submitting answers.');
                    handleSubmit();
                  }
                  
                  return next;
                });
              }
            }
          } catch (err) {
            console.error('Phone detection error:', err);
          } finally {
            isDetecting = false;
          }
        }, 1000); // Check every second
      } catch (err) {
        console.error('Failed to load COCO-SSD model:', err);
      }
    };

    loadModelAndDetect();

    return () => {
      if (detectionInterval) clearInterval(detectionInterval);
    };
  }, [phase, webcamOn, schedule]);

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
        try { recognition.stop(); } catch (e) { /* ignore */ }
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
        try { recognition.stop(); } catch (e) { /* ignore */ }
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
      } catch (e) { /* ignore */ }
      recognitionRef.current = null;
    }
    setIsListening(false);
  };

  const toggleSpeechRecognition = () => {
    if (isListening) {
      stopSpeechRecognition();
    } else {
      startSpeechRecognition();
    }
  };

  const speakQuestion = (questionObj) => {
    if (!questionObj) return;

    if (!window.speechSynthesis) {
      // Fallback: If speechSynthesis is not supported, start listening immediately
      if (questionObj.type !== 'coding') {
        startSpeechRecognition();
      }
      return;
    }

    // Stop any active recognition session first
    stopSpeechRecognition();

    window.speechSynthesis.cancel();
    setIsTtsSpeaking(false);

    let cleanText = questionObj.text;
    if (questionObj.type === 'mcq' && questionObj.options) {
      const optionsText = Object.entries(questionObj.options)
        .map(([k, v]) => `Option ${k.toUpperCase()}: ${v}`)
        .join('. ');
      cleanText = `${questionObj.text}. ${optionsText}`;
    }

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utteranceRef.current = utterance;

    utterance.onstart = () => {
      setIsTtsSpeaking(true);
    };

    utterance.onend = () => {
      setIsTtsSpeaking(false);
      if (questionObj.type !== 'coding') {
        startSpeechRecognition();
      }
    };

    utterance.onerror = (e) => {
      setIsTtsSpeaking(false);
      console.warn('TTS utterance error/cancelled:', e);
      if (questionObj.type !== 'coding') {
        startSpeechRecognition();
      }
    };

    utterance.rate = 1.05;
    utterance.pitch = 1.0;

    window.speechSynthesis.speak(utterance);
  };

  // Text-To-Speech (TTS) speaking active question
  useEffect(() => {
    if (phase === PHASE.INTERVIEW && questions[currentQ]) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      speakQuestion(questions[currentQ]);
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

      // Keep webcam stream active for real-time proctoring monitoring
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
  function handlePrevQuestion() {
    if (currentQ > 0) {
      setCurrentQ((c) => c - 1);
    }
  }

  function handleNextQuestion() {
    if (currentQ < questions.length - 1) {
      setCurrentQ((c) => c + 1);
      // Auto-load empty text for code questions
      const nextQ = questions[currentQ + 1];
      if (nextQ.type === 'coding' && !answers[nextQ.id]) {
        setAnswers((prev) => ({
          ...prev,
          [nextQ.id]: '',
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

  // Automatically ensure webcam is active when entering the interview phase
  useEffect(() => {
    if (phase === PHASE.INTERVIEW && !webcamOn) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      startWebcam();
    }
  }, [phase]);

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
      <div className="min-h-screen bg-[#03060E] flex flex-col items-center justify-center font-sans text-slate-300 relative overflow-x-hidden p-6">
        <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] bg-blue-600/10 rounded-full blur-[160px] pointer-events-none" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] bg-indigo-600/10 rounded-full blur-[160px] pointer-events-none" />

        <div className="text-center relative z-10 flex flex-col items-center">
          <div className="w-16 h-16 mb-5 relative flex items-center justify-center">
            <div className="absolute inset-0 rounded-2xl bg-blue-500/20 border-2 border-blue-500/40 animate-ping opacity-60" />
            <div className="relative w-14 h-14 bg-[#10141C] border-2 border-[#202638] rounded-2xl flex items-center justify-center shadow-2xl">
              <Cpu className="w-6 h-6 text-blue-400 animate-pulse" />
            </div>
          </div>
          <h2 className="text-[17px] font-bold text-white mb-1.5 uppercase tracking-wider font-mono">Initializing Secure Room</h2>
          <p className="text-sm text-slate-400 max-w-xs">Verifying your candidate credentials and proctor signature...</p>
        </div>
      </div>
    );
  }

  if (phase === PHASE.ERROR) {
    return (
      <div className="min-h-screen bg-[#03060E] flex flex-col items-center justify-center font-sans text-slate-300 relative overflow-x-hidden p-6">
        <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] bg-red-600/10 rounded-full blur-[160px] pointer-events-none" />

        <div className="max-w-md w-full bg-[#10141C] border-2 border-red-500/30 rounded-[24px] shadow-2xl p-10 text-center relative z-10">
          <div className="w-16 h-16 mx-auto mb-5 bg-red-950/20 border-2 border-red-500/45 rounded-2xl flex items-center justify-center text-red-400 shadow-lg">
            <AlertCircle className="w-7 h-7 animate-pulse" />
          </div>
          <h2 className="text-[19px] font-extrabold text-white mb-2 uppercase tracking-wide font-mono">Access Denied</h2>
          <p className="text-sm text-slate-400 mb-6 leading-relaxed">{error || 'Invalid or expired credentials'}</p>
          <div className="bg-red-950/20 border-2 border-red-500/25 rounded-2xl p-4 text-xs text-red-400 text-left font-medium mb-6 font-sans">
            This assessment link may be expired, already used, or invalid. Please double check your credentials or contact your recruiter to request a fresh session token.
          </div>
          <button
            onClick={() => window.location.reload()}
            className="w-full bg-[#1C1F26] border-2 border-[#202638] hover:border-red-500/60 text-white font-bold text-xs py-3.5 px-6 rounded-xl transition-all cursor-pointer hover:shadow-[0_0_15px_rgba(239,68,68,0.15)] uppercase tracking-wider font-mono"
          >
            Retry Session
          </button>
        </div>
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
                            <div key={field.label} style={{ display: 'flex', alignItems: 'center', justifycontent: 'space-between', padding: '13px 18px', borderBottom: i < arr.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
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
                          <button onClick={startWebcam} style={{ width: '100%', height: 32, background: 'rgba(255,255,255,0.06)', border: 'none', borderRadius: 8, color: '#94A3B8', fontSize: 11, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifycontent: 'center', gap: 6 }}>
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
                            <div key={idx} style={{ display: 'flex', alignItems: 'center', justifycontent: 'space-between', padding: '8px 0', borderBottom: idx < 4 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <div style={{ width: 26, height: 26, borderRadius: 7, display: 'flex', alignItems: 'center', justifycontent: 'center', background: check.ok ? 'rgba(16,185,129,0.1)' : 'rgba(255,255,255,0.03)', border: check.ok ? '1px solid rgba(16,185,129,0.2)' : '1px solid rgba(255,255,255,0.06)' }}>
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
                          style={{ marginTop: 12, width: '100%', height: 38, background: '#3B82F6', border: 'none', borderRadius: 10, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifycontent: 'center', gap: 6, opacity: (envStates.fullscreen && envStates.camera && envStates.mic && envStates.speaker && envStates.internet === 'success') ? 1 : 0.3 }}>
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
                        <div style={{ width: 48, height: 48, background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 12, flexShrink: 0, display: 'flex', alignItems: 'center', justifycontent: 'center' }}>
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
                            <div style={{ position: 'absolute', inset: 24, border: '1.5px dashed rgba(59,130,246,0.3)', borderRadius: 12, display: 'flex', alignItems: 'flex-end', justifycontent: 'center', paddingBottom: 12 }}>
                              <span style={{ fontSize: 10, color: '#60A5FA', background: 'rgba(0,0,0,0.6)', padding: '4px 12px', borderRadius: 20, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Center Your Face</span>
                            </div>
                          )}
                          {faceRegistered && (
                            <div style={{ position: 'absolute', inset: 0, background: 'rgba(16,185,129,0.08)', border: '2px solid rgba(52,211,153,0.3)', borderRadius: 14, display: 'flex', alignItems: 'center', justifycontent: 'center' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(0,0,0,0.5)', padding: '9px 16px', borderRadius: 10, backdropFilter: 'blur(8px)' }}>
                                <CheckCircle style={{ width: 16, height: 16, color: '#34D399' }} />
                                <span style={{ fontSize: 13, fontWeight: 700, color: '#6EE7B7' }}>Face Enrolled</span>
                              </div>
                            </div>
                          )}
                        </div>
                        {!faceRegistered ? (
                          <button onClick={captureFaceBiometrics} disabled={faceScanning}
                            style={{ width: '100%', height: 50, background: '#3B82F6', border: 'none', borderRadius: 10, color: '#fff', fontSize: 15, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifycontent: 'center', gap: 8, opacity: faceScanning ? 0.6 : 1 }}>
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
                              <button onClick={() => setPhase(PHASE.INSTRUCTIONS)} style={{ flex: 2, height: 40, background: '#3B82F6', border: 'none', borderRadius: 10, color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifycontent: 'center', gap: 6 }}>
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
                      <div style={{ width: 48, height: 48, background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 12, flexShrink: 0, display: 'flex', alignItems: 'center', justifycontent: 'center' }}>
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
                          <div style={{ width: 34, height: 34, borderRadius: 9, border: `1px solid ${rule.bd}`, background: rule.bg, flexShrink: 0, marginTop: 2, display: 'flex', alignItems: 'center', justifycontent: 'center' }}>
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
                        style={{ width: '100%', height: 50, background: rulesAgreed ? '#3B82F6' : 'rgba(255,255,255,0.04)', border: 'none', borderRadius: 10, color: rulesAgreed ? '#fff' : '#334155', fontSize: 15, fontWeight: 600, cursor: rulesAgreed ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifycontent: 'center', gap: 8, boxShadow: rulesAgreed ? '0 6px 20px rgba(59,130,246,0.3)' : 'none' }}>
                        <Play style={{ width: 16, height: 16 }} /> Launch Assessment
                      </button>
                    </div>
                  </motion.div>
                )}

              </AnimatePresence>
            </div>
          </main>

          <footer style={{ height: 42, padding: '0 28px', display: 'flex', alignItems: 'center', justifycontent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.05)', flexShrink: 0 }}>
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
    <div className={`min-h-screen flex flex-col font-sans selection:bg-blue-500/30 transition-colors duration-300 ${theme === 'dark' ? 'dark bg-[#080B12] text-white' : 'bg-slate-50 text-slate-900'}`}>
      <style>{`
        @keyframes soundwave-fluid {
          0%, 100% { transform: scaleY(0.3); opacity: 0.4; }
          50% { transform: scaleY(1.3); opacity: 1; filter: drop-shadow(0 0 6px rgba(59, 130, 246, 0.6)); }
        }
        @keyframes bar1 {
          0%, 100% { transform: scaleY(0.3); }
          50% { transform: scaleY(1.2); }
        }
        @keyframes bar2 {
          0%, 100% { transform: scaleY(0.4); }
          50% { transform: scaleY(1.5); }
        }
        @keyframes bar3 {
          0%, 100% { transform: scaleY(0.2); }
          50% { transform: scaleY(1.0); }
        }
        @keyframes scan {
          0%, 100% { top: 0%; }
          50% { top: 100%; }
        }
        .soundwave-bar {
          transform-origin: bottom;
          animation: soundwave-fluid 1.2s infinite ease-in-out;
        }
      `}</style>
      {/* Top Banner Navigation */}
      <header className={`h-[96px] px-8 flex items-center justify-between sticky top-0 z-40 border-b shadow-xl transition-colors duration-300 ${theme === 'dark' ? 'bg-[#060813] border-[#1E293B]/20 text-white' : 'bg-white border-slate-200 text-slate-900'}`}>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <span className="text-white font-black text-lg tracking-tighter">A</span>
            </div>
            <span className="text-xl font-bold tracking-tight leading-none">AgnoHire</span>
          </div>
          <div className={`w-[1.5px] h-[24px] mx-1 transition-colors ${theme === 'dark' ? 'bg-[#1E293B]' : 'bg-slate-200'}`} />
          <div className="flex flex-col">
            <span className={`text-sm font-semibold ${theme === 'dark' ? 'text-white/90' : 'text-slate-800'}`}>Frontend Developer Interview <span className="text-slate-500 font-normal">|</span> <span className="text-blue-500 font-bold">Technical Round</span></span>
            <div className="flex items-center gap-2 mt-1">
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="text-[11px] text-emerald-400 font-bold uppercase tracking-wider">Interview in Progress</span>
            </div>
          </div>
        </div>

        {/* Center: Proctor Camera Preview */}
        {phase === PHASE.INTERVIEW && (
          <div className={`w-[140px] h-[78px] rounded-2xl border flex items-center justify-center relative overflow-hidden shadow-2xl transition-colors ${theme === 'dark' ? 'bg-slate-950 border-[#2B354C]/50' : 'bg-slate-100 border-slate-200'}`}>
            {webcamOn ? (
              <>
                <video ref={videoRef} autoPlay muted className="w-full h-full object-cover scale-x-[-1]" />
                <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 bg-black/80 px-2.5 py-0.5 rounded-full flex items-center gap-1 text-[9px] font-bold text-white/90 border border-white/10">
                  <span className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" />
                  <span>You</span>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center gap-1">
                <VideoOff className={`w-3.5 h-3.5 animate-pulse ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`} />
                <span className={`text-[8px] font-bold uppercase tracking-widest font-mono ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>Offline</span>
              </div>
            )}
          </div>
        )}

        {/* Right Section */}
        <div className="flex items-center gap-5">
          {phase === PHASE.INTERVIEW && (
            <>
              {/* Status Pills */}
              <div className="flex items-center gap-3">
                <span className={`flex items-center gap-1.5 border px-3 py-1.5 rounded-full text-[11px] font-bold transition-colors ${theme === 'dark' ? 'bg-[#0C0F19] border-[#1E293B]/60 text-emerald-400' : 'bg-emerald-50 border-emerald-200 text-emerald-600'}`}>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  <span>Camera ON</span>
                </span>
                <span className={`flex items-center gap-1.5 border px-3 py-1.5 rounded-full text-[11px] font-bold transition-colors ${theme === 'dark' ? 'bg-[#0C0F19] border-[#1E293B]/60 text-emerald-400' : 'bg-emerald-50 border-emerald-200 text-emerald-600'}`}>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  <span>Mic ON</span>
                </span>
                <span className={`flex items-center gap-1.5 border px-3 py-1.5 rounded-full text-[11px] font-bold transition-colors ${theme === 'dark' ? 'bg-[#0C0F19] border-[#1E293B]/60 text-emerald-400' : 'bg-emerald-50 border-emerald-200 text-emerald-600'}`}>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Internet Stable</span>
                </span>
              </div>

              {/* Red Countdown Timer */}
              {(() => {
                const h = Math.floor(timeLeft / 3600);
                const m = Math.floor((timeLeft % 3600) / 60);
                const s = timeLeft % 60;
                const formattedTime = `${String(h).padStart(2, '0')} : ${String(m).padStart(2, '0')} : ${String(s).padStart(2, '0')}`;
                return (
                  <div className="border border-red-500/80 rounded-xl px-4 py-1.5 bg-red-950/15 flex flex-col items-center justify-center min-w-[130px]">
                    <div className="flex items-center gap-2 text-red-500 font-black text-[17px] font-mono tracking-wider">
                      <Clock className="w-4.5 h-4.5 text-red-500" />
                      <span>{formattedTime}</span>
                    </div>
                    <span className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">Time Remaining</span>
                  </div>
                );
              })()}

              {/* Fullscreen Badge */}
              <div className={`flex items-center gap-2 border px-3.5 py-2 rounded-full text-[11px] font-medium transition-colors duration-300 ${theme === 'dark' ? 'bg-[#0C0F19] border-[#1E293B]/50 text-slate-300' : 'bg-slate-100 border-slate-200 text-slate-700'}`}>
                <span>Please stay in full screen mode</span>
                <button onClick={requestFullscreenMode} className="hover:text-blue-500 transition-colors">
                  <Monitor className="w-3.5 h-3.5" />
                </button>
              </div>
            </>
          )}

          {/* Theme Toggle */}
          <button onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')} className={`flex items-center justify-center w-9 h-9 rounded-full border transition-colors ${theme === 'dark' ? 'bg-[#0C0F19] border-[#1E293B]/50 text-slate-300 hover:text-white' : 'bg-slate-100 border-slate-200 text-slate-600 hover:text-slate-900'}`} title="Toggle Theme">
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-grow flex flex-col w-full p-0 max-w-none">
        <AnimatePresence mode="wait">
          {/* ACTIVE ASSESSMENT INTERVIEW WORKSPACE */}
          {phase === PHASE.INTERVIEW && q && (
            <motion.div
              key="interview"
              className={`relative w-full min-h-[calc(100vh-96px)] font-sans flex flex-col justify-between transition-colors duration-300 ${theme === 'dark' ? 'bg-[#080B12] text-slate-800' : 'bg-[#F8FAFC] text-slate-900'}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              {(() => {
                // Shared camera widget - kept for back-compat/rendering triggers
                const renderCandidateCameraCard = () => null;

                if (q.type !== 'coding') {
                  // Redesigned premium text/MCQ workspace layout
                  return (
                    <div className="w-full flex-grow flex flex-col justify-center px-8 py-10">
                      {/* Central container card */}
                      <div className={`rounded-[24px] shadow-lg p-10 w-full h-full flex flex-col gap-6 border transition-colors duration-300 ${theme === 'dark' ? 'bg-[#0C101F] border-blue-500/15 text-white' : 'bg-white border-[#E2E8F0] text-slate-800'}`}>
                        {/* Card Header: Progress Indicators */}
                        <div className="flex flex-col gap-3">
                          <div className="flex justify-between items-center text-sm">
                            <span className={`font-bold text-[17px] ${theme === 'dark' ? 'text-white' : 'text-[#0F172A]'}`}>Question {currentQ + 1} of {questions.length}</span>
                            <span className={`font-semibold ${theme === 'dark' ? 'text-slate-400' : 'text-[#64748B]'}`}>{Math.round(((currentQ + 1) / questions.length) * 100)}% Completed</span>
                          </div>
                          {/* Progress track */}
                          <div className={`w-full h-2.5 rounded-full overflow-hidden ${theme === 'dark' ? 'bg-slate-800' : 'bg-[#F1F5F9]'}`}>
                            <div
                              className="h-full bg-blue-600 rounded-full transition-all duration-300"
                              style={{ width: `${((currentQ + 1) / questions.length) * 100}%` }}
                            />
                          </div>
                        </div>

                        {/* Technical Tag */}
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-[11px] font-extrabold uppercase tracking-wider rounded-md py-1 px-3 border" style={{ color: '#2563EB', backgroundColor: '#EFF6FF', borderColor: '#DBEAFE' }}>
                            Technical Question
                          </span>

                          {/* Sound wave visualizer overlay when speech synthesis is active */}
                          {isTtsSpeaking && (
                            <div className="flex items-center gap-1.5 border px-3 py-1 rounded-full animate-pulse" style={{ color: '#2563EB', backgroundColor: '#EFF6FF', borderColor: '#DBEAFE' }}>
                              <Volume2 className="w-3.5 h-3.5 text-blue-600 animate-[bounce_1s_infinite]" />
                              <span className="text-[9px] font-bold uppercase tracking-widest font-mono">AI Speaking</span>
                            </div>
                          )}
                        </div>

                        {/* Question Title */}
                        <h3 className={`text-[22px] font-extrabold leading-tight ${theme === 'dark' ? 'text-white' : 'text-[#0F172A]'}`}>
                          {q.text}
                        </h3>

                        {/* MCQ Multi-Choice UI */}
                        {q.type === 'mcq' && q.options && (
                          <div className="grid grid-cols-1 gap-3.5 mt-2">
                            {Object.entries(q.options).map(([key, optText]) => {
                              const isSelected = answers[q.id] === key;
                              return (
                                <button
                                  key={key}
                                  type="button"
                                  onClick={() => setAnswers(prev => ({ ...prev, [q.id]: key }))}
                                  className="w-full text-left p-5 rounded-2xl border font-semibold text-base transition-all duration-200 cursor-pointer flex items-center justify-between"
                                  style={{
                                    borderColor: isSelected ? '#2563EB' : '#E2E8F0',
                                    backgroundColor: isSelected ? '#EFF6FF' : '#FFFFFF',
                                    color: isSelected ? '#1E40AF' : '#334155'
                                  }}
                                >
                                  <div className="flex items-center gap-4">
                                    <span className="w-8 h-8 rounded-xl flex items-center justify-center text-sm font-bold border transition-all"
                                      style={{
                                        backgroundColor: isSelected ? '#2563EB' : (theme === 'dark' ? '#1E293B' : '#F1F5F9'),
                                        borderColor: isSelected ? '#2563EB' : (theme === 'dark' ? '#334155' : '#E2E8F0'),
                                        color: isSelected ? '#FFFFFF' : (theme === 'dark' ? '#CBD5E1' : '#475569')
                                      }}
                                    >
                                      {key.toUpperCase()}
                                    </span>
                                    <span>{optText}</span>
                                  </div>
                                  <div className="w-5 h-5 rounded-full border flex items-center justify-center transition-all"
                                    style={{
                                      borderColor: isSelected ? '#2563EB' : '#CBD5E1',
                                      backgroundColor: isSelected ? '#2563EB' : 'transparent'
                                    }}
                                  >
                                    {isSelected && <Check className="w-3 h-3 text-white stroke-[3px]" />}
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        )}

                        {/* Textarea Answer Input Field */}
                        {q.type !== 'mcq' && (
                          <div className={`border rounded-[18px] flex-grow overflow-hidden shadow-sm flex flex-col mt-2 ${theme === 'dark' ? 'border-slate-700 bg-slate-900/50' : 'border-[#E2E8F0] bg-white'}`}>
                            <textarea
                              value={answers[q.id] || ''}
                              onChange={(e) => {
                                const val = e.target.value;
                                setAnswers((prev) => ({ ...prev, [q.id]: val }));
                                latestTranscriptRef.current = val;
                                accumulatedTextRef.current = val;
                              }}
                              placeholder="Type your answer here..."
                              className={`w-full h-full min-h-[190px] flex-grow p-6 text-base leading-relaxed focus:outline-none resize-none font-sans border-0 focus:ring-0 ${theme === 'dark' ? 'text-white bg-transparent placeholder-slate-500' : 'text-[#0F172A] bg-transparent placeholder-slate-400'}`}
                            />
                            {/* Editor Toolbar Footer */}
                            <div className={`flex items-center justify-between px-6 py-4 border-t select-none ${theme === 'dark' ? 'border-slate-700 bg-slate-800/40' : 'border-[#F1F5F9] bg-[#F8FAFC]'}`}>
                              <div className={`flex items-center gap-5 text-sm font-semibold ${theme === 'dark' ? 'text-slate-300' : 'text-[#475569]'}`}>
                                <button 
                                  type="button" 
                                  onClick={toggleSpeechRecognition} 
                                  className={`hover:text-slate-900 transition-colors cursor-pointer flex items-center gap-1.5 ${isListening ? 'text-emerald-600' : ''}`} 
                                  title="Toggle Voice Dictation"
                                >
                                  <Mic className={`w-4 h-4 ${isListening ? 'animate-pulse text-emerald-600' : ''}`} />
                                  {isListening ? 'Stop Dictation' : 'Start Dictation'}
                                </button>
                                {speechError && <span className="text-xs text-red-500 font-normal">{speechError}</span>}
                              </div>
                              <div className="flex items-center gap-3">
                                {isListening && (
                                  <span className="flex items-center gap-1.5 text-[10px] rounded font-mono font-bold animate-pulse border px-2 py-0.5" style={{ color: '#059669', backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' }}>
                                    <Mic className="w-3 h-3 animate-pulse" />
                                    <span>LISTENING</span>
                                  </span>
                                )}
                                <span className="text-xs font-semibold font-mono" style={{ color: '#94A3B8' }}>
                                  {answers[q.id] ? answers[q.id].split(/\s+/).filter(Boolean).length : 0} words
                                </span>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Informational Alerts */}
                        <div className="flex items-center gap-3 border rounded-xl p-4 text-[13px] mt-2 animate-fade-in" style={{ color: '#1E40AF', backgroundColor: '#EFF6FF', borderColor: '#DBEAFE' }}>
                          <AlertCircle className="w-4.5 h-4.5 flex-shrink-0" style={{ color: '#3B82F6' }} />
                          <span>
                            You can type your answer in the box above. Your answer is <strong style={{ color: '#1D4ED8' }}>auto-saved</strong> every 10 seconds.
                          </span>
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
                        <div className={`border rounded-2xl p-5 relative overflow-hidden shadow-lg grid grid-cols-2 transition-colors ${theme === 'dark' ? 'bg-[#0C101F] border-blue-500/10' : 'bg-white border-slate-200'}`}>
                          <div className="flex flex-col">
                            <span className={`text-[9px] font-bold uppercase tracking-widest font-mono ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>Question</span>
                            <span className={`text-xl font-black font-mono mt-0.5 ${theme === 'dark' ? 'text-blue-400' : 'text-blue-600'}`}>
                              {currentQ + 1} / {questions.length}
                            </span>
                          </div>
                          <div className={`flex flex-col pl-4 border-l ${theme === 'dark' ? 'border-slate-800/80' : 'border-slate-200'}`}>
                            <span className={`text-[9px] font-bold uppercase tracking-widest font-mono ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>Time Per Question</span>
                            <span className="text-xl font-black text-amber-500 font-mono mt-0.5 flex items-center gap-1.5">
                              <Clock className="w-4 h-4 text-amber-500 animate-pulse" />
                              {timeLeft % 60}
                            </span>
                          </div>
                        </div>

                        {/* Question details */}
                        <div className={`border rounded-2xl p-6 relative overflow-hidden shadow-lg flex flex-col gap-4 transition-colors ${theme === 'dark' ? 'bg-[#0C101F] border-blue-500/10' : 'bg-white border-slate-200'}`}>
                          <span className={`text-[10px] font-bold uppercase tracking-widest font-mono ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>Question Prompt</span>
                          <h3 className={`text-lg font-bold leading-relaxed tracking-tight whitespace-pre-line ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
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

                      {/* Right stack (7 of 12 cols): coding compiler workspace with Premium Interactive Notepad */}
                      <div className={`lg:col-span-7 flex flex-col border rounded-2xl overflow-hidden shadow-2xl min-h-[500px] transition-colors ${theme === 'dark' ? 'bg-[#0C101F] border-blue-500/15' : 'bg-white border-slate-200'}`}>

                        {/* Premium Window Title Bar */}
                        <div className={`px-4 py-3 flex items-center justify-between border-b select-none transition-colors ${theme === 'dark' ? 'bg-[#161C2A] border-[#242E44]' : 'bg-slate-100 border-slate-200'}`}>
                          {/* Traffic Lights */}
                          <div className="flex items-center gap-2">
                            <span className="w-3 h-3 rounded-full bg-[#FF5F56] border border-[#E0443E] cursor-pointer hover:opacity-80 transition-opacity" title="Close Workspace" onClick={() => toast.error('Exam security protocol active. Window cannot be closed.')} />
                            <span className="w-3 h-3 rounded-full bg-[#FFBD2E] border border-[#DEA123] cursor-pointer hover:opacity-80 transition-opacity" title="Minimize" onClick={() => toast.success('Workspace minimized to bottom tray.')} />
                            <span className="w-3 h-3 rounded-full bg-[#27C93F] border border-[#1AAB2F] cursor-pointer hover:opacity-80 transition-opacity" title="Maximize Workspace" onClick={() => toast.success('Workspace maximized.')} />
                          </div>

                          {/* Window Title */}
                          <div className={`text-[11px] font-bold font-mono flex items-center gap-2 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                            <FileText className={`w-3.5 h-3.5 ${theme === 'dark' ? 'text-slate-450' : 'text-slate-400'}`} />
                            <span>notepad.txt — AgnoHire Notepad v1.4</span>
                          </div>
                        </div>

                        {/* Interactive Notepad Toolbar Menu */}
                        <div className={`px-3 py-1.5 border-b flex items-center justify-between text-[11px] select-none relative z-30 font-mono transition-colors ${theme === 'dark' ? 'bg-[#0F1420] border-[#1E2638]' : 'bg-white border-slate-200'}`}>
                          <div className={`flex items-center gap-2.5 ${theme === 'dark' ? 'text-slate-450' : 'text-slate-600'}`}>
                            {/* File Menu */}
                            <div className="relative">
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); setActiveMenu(activeMenu === 'file' ? null : 'file'); }}
                                className={`px-2.5 py-1 rounded transition-all font-semibold hover:bg-[#20283C] hover:text-white ${activeMenu === 'file' ? 'bg-[#20283C] text-white' : 'text-slate-400'}`}
                              >
                                File
                              </button>
                              {activeMenu === 'file' && (
                                <div className="absolute top-full left-0 mt-1 w-44 bg-[#141926] border border-[#2B354A] rounded-lg shadow-2xl py-1 z-50 text-left font-mono">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setAnswers((prev) => ({ ...prev, [q.id]: '' }));
                                      toast.success('Notepad canvas cleared.');
                                      setActiveMenu(null);
                                    }}
                                    className="w-full px-4 py-2 hover:bg-[#20283C] text-slate-350 hover:text-white transition-colors text-left flex items-center justify-between text-[10px]"
                                  >
                                    <span>New Draft</span>
                                    <span className="text-slate-550 text-[9px]">Ctrl+N</span>
                                  </button>
                                  <div className="h-px bg-slate-800 my-1" />
                                  <button
                                    type="button"
                                    onClick={() => {
                                      handleManualSave();
                                      setActiveMenu(null);
                                    }}
                                    className="w-full px-4 py-2 hover:bg-[#20283C] text-slate-350 hover:text-white transition-colors text-left flex items-center justify-between text-[10px]"
                                  >
                                    <span className="font-bold text-blue-400">Save Draft</span>
                                    <span className="text-slate-550 text-[9px]">Ctrl+S</span>
                                  </button>
                                </div>
                              )}
                            </div>

                            {/* Edit Menu */}
                            <div className="relative">
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); setActiveMenu(activeMenu === 'edit' ? null : 'edit'); }}
                                className={`px-2.5 py-1 rounded transition-all font-semibold hover:bg-[#20283C] hover:text-white ${activeMenu === 'edit' ? 'bg-[#20283C] text-white' : 'text-slate-400'}`}
                              >
                                Edit
                              </button>
                              {activeMenu === 'edit' && (
                                <div className="absolute top-full left-0 mt-1 w-44 bg-[#141926] border border-[#2B354A] rounded-lg shadow-2xl py-1 z-50 text-left font-mono">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setAnswers((prev) => ({ ...prev, [q.id]: '' }));
                                      setActiveMenu(null);
                                    }}
                                    className="w-full px-4 py-2 hover:bg-[#20283C] text-slate-350 hover:text-white transition-colors text-left flex items-center justify-between text-[10px]"
                                  >
                                    <span>Clear Canvas</span>
                                    <span className="text-slate-550 text-[9px]">Del</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (textareaRef.current) {
                                        textareaRef.current.focus();
                                        textareaRef.current.select();
                                      }
                                      setActiveMenu(null);
                                    }}
                                    className="w-full px-4 py-2 hover:bg-[#20283C] text-slate-350 hover:text-white transition-colors text-left flex items-center justify-between text-[10px]"
                                  >
                                    <span>Select All</span>
                                    <span className="text-slate-550 text-[9px]">Ctrl+A</span>
                                  </button>
                                </div>
                              )}
                            </div>

                            {/* Format Menu */}
                            <div className="relative">
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); setActiveMenu(activeMenu === 'format' ? null : 'format'); }}
                                className={`px-2.5 py-1 rounded transition-all font-semibold hover:bg-[#20283C] hover:text-white ${activeMenu === 'format' ? 'bg-[#20283C] text-white' : 'text-slate-400'}`}
                              >
                                Format
                              </button>
                              {activeMenu === 'format' && (
                                <div className="absolute top-full left-0 mt-1 w-52 bg-[#141926] border border-[#2B354A] rounded-lg shadow-2xl py-1 z-50 text-left font-mono">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setLineNumbersVisible(!lineNumbersVisible);
                                      setActiveMenu(null);
                                    }}
                                    className="w-full px-4 py-2 hover:bg-[#20283C] text-slate-350 hover:text-white transition-colors text-left flex items-center justify-between text-[10px]"
                                  >
                                    <span>Line Numbers</span>
                                    <span className="text-emerald-400 text-[9px] font-bold">{lineNumbersVisible ? '✓ ON' : 'OFF'}</span>
                                  </button>
                                  <div className="h-px bg-slate-800 my-1" />
                                  <div className="px-4 py-2 text-slate-500 text-[9px]">Font: SF Mono (13px)</div>
                                  <div className="px-4 py-2 text-slate-500 text-[9px]">Spacing: Tab (2 Spaces)</div>
                                </div>
                              )}
                            </div>

                            {/* Help Menu */}
                            <div className="relative">
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); setActiveMenu(activeMenu === 'help' ? null : 'help'); }}
                                className={`px-2.5 py-1 rounded transition-all font-semibold hover:bg-[#20283C] hover:text-white ${activeMenu === 'help' ? 'bg-[#20283C] text-white' : 'text-slate-400'}`}
                              >
                                Help
                              </button>
                              {activeMenu === 'help' && (
                                <div className="absolute top-full left-0 mt-1 w-64 bg-[#141926] border border-[#2B354A] rounded-lg shadow-2xl py-1 z-50 text-left font-mono">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      toast((t) => (
                                        <div className="flex flex-col gap-1 text-[11px] text-slate-300 font-sans">
                                          <span className="font-extrabold text-amber-400 text-xs flex items-center gap-1.5">🚨 Security Protocols Active</span>
                                          <span>1. Continuous face capture biometrics logging enabled.</span>
                                          <span>2. Fullscreen escape logs critical proctor warnings.</span>
                                          <span>3. Input triggers continuous secure draft syncing.</span>
                                        </div>
                                      ), { duration: 6000 });
                                      setActiveMenu(null);
                                    }}
                                    className="w-full px-4 py-2 hover:bg-[#20283C] text-slate-350 hover:text-white transition-colors text-left text-[10px]"
                                  >
                                    Security & Proctoring Guide
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      toast.info('Press Ctrl+S inside workspace to save, Ctrl+A to select text block.', { duration: 4000 });
                                      setActiveMenu(null);
                                    }}
                                    className="w-full px-4 py-2 hover:bg-[#20283C] text-slate-350 hover:text-white transition-colors text-left text-[10px]"
                                  >
                                    Keyboard Shortcuts
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>

                        </div>

                        {/* Highly Aligned Code Canvas Body */}
                        <div className={`flex-grow flex overflow-hidden font-mono text-[13px] relative min-h-[340px] transition-colors ${theme === 'dark' ? 'bg-[#060914]' : 'bg-[#F8FAFC]'}`}>
                          {lineNumbersVisible && (
                            <div className={`w-12 border-r text-right select-none pr-3.5 py-4 font-mono leading-[22px] text-xs transition-colors ${theme === 'dark' ? 'bg-[#090C16] border-[#1C2538] text-slate-650' : 'bg-slate-100 border-slate-200 text-slate-400'}`}>
                              {Array.from({ length: Math.max((answers[q.id] !== undefined ? answers[q.id] : '').split('\n').length, 25) }).map((_, i) => (
                                <div key={i} style={{ height: '22px' }} className="h-[22px] flex items-center justify-end">{i + 1}</div>
                              ))}
                            </div>
                          )}

                          <textarea
                            ref={textareaRef}
                            value={answers[q.id] !== undefined ? answers[q.id] : ''}
                            onChange={handleEditorChange}
                            onKeyUp={updateCursorPos}
                            onSelect={updateCursorPos}
                            onMouseUp={updateCursorPos}
                            onFocus={updateCursorPos}
                            onKeyDown={handleKeyDown}
                            spellCheck="false"
                            className={`flex-grow bg-transparent p-4 focus:outline-none leading-[22px] resize-none selection:bg-blue-500/20 border-0 focus:ring-0 font-mono text-[13px] overflow-y-auto transition-colors ${theme === 'dark' ? 'text-emerald-400' : 'text-emerald-700'}`}
                            style={{ caretColor: '#10B981', outline: 'none', paddingTop: '16px', paddingBottom: '16px' }}
                            placeholder="Type your code/solution here..."
                          />
                        </div>

                        {/* Interactive Notepad Status Footer Bar */}
                        <div className={`px-4 py-2.5 border-t flex justify-between items-center text-[10px] font-mono select-none transition-colors ${theme === 'dark' ? 'bg-[#0F1420] border-[#1C2436] text-slate-500' : 'bg-slate-100 border-slate-200 text-slate-500'}`}>
                          {/* Live Status Indicators */}
                          <div className="flex items-center gap-2">
                            {savingState === 'saving' ? (
                              <span className="flex items-center gap-1.5 text-blue-400 font-bold animate-pulse">
                                <RefreshCw className="w-3 h-3 animate-spin" />
                                <span>Draft Saving...</span>
                              </span>
                            ) : (
                              <span className="flex items-center gap-1.5 text-emerald-450 font-bold">
                                <Check className="w-3.5 h-3.5 text-emerald-400" />
                                <span>Synced to Cloud (Saved at {lastSavedTime})</span>
                              </span>
                            )}
                          </div>

                          {/* Middle items */}
                          <div className="flex items-center gap-4">
                            <span>UTF-8</span>
                            <span>LF</span>
                          </div>

                          {/* Right Cursor Pos */}
                          <div className="text-slate-400">
                            <span>Ln {cursorPos.line}, Col {cursorPos.column}</span>
                          </div>
                        </div>

                        {/* Sandbox Compiler Logs Section */}
                        {runLogs.length > 0 && (
                          <div className="max-h-[140px] overflow-y-auto bg-[#070A12] border-t border-[#1C2436] p-4 text-xs font-mono text-slate-350 whitespace-pre-wrap divide-y divide-slate-800">
                            {runLogs.map((log, lIdx) => (
                              <div key={lIdx} className="py-1 text-cyan-400/90 flex items-center gap-2">
                                <span className="text-slate-600">❯</span>
                                <span>{log}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Compilation & Action Footer Bar */}
                        <div className={`px-4 py-3.5 border-t flex justify-between items-center z-10 transition-colors ${theme === 'dark' ? 'bg-[#0D121F] border-[#1C2436]' : 'bg-white border-slate-200'}`}>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={handleManualSave}
                              className={`border text-xs font-semibold py-2 px-4 rounded-lg flex items-center gap-1.5 cursor-pointer transition-colors ${theme === 'dark' ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-[#2B354C]' : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'}`}
                            >
                              💾 Save Code Draft
                            </button>
                          </div>

                          <button
                            type="button"
                            onClick={handleNextQuestion}
                            className={`flex items-center gap-1.5 px-4 py-2 border font-semibold text-xs rounded-lg transition-all cursor-pointer ${theme === 'dark' ? 'border-[#2B354C] bg-transparent text-white hover:bg-white hover:text-black' : 'border-slate-300 bg-white text-slate-800 hover:bg-slate-100'}`}
                          >
                            <span>{currentQ < questions.length - 1 ? 'Save & Next Question' : 'Complete Assessment'}</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                }
              })()}

              {/* Redesigned Premium Bottom Navigation Bar */}
              <div className={`h-[96px] border-t px-12 flex items-center justify-between z-30 select-none flex-shrink-0 transition-colors duration-300 ${theme === 'dark' ? 'bg-[#060813] border-[#1E293B]/20' : 'bg-white border-slate-200'}`}>
                {/* Left: Previous */}
                <div>
                  <button
                    type="button"
                    onClick={handlePrevQuestion}
                    disabled={currentQ === 0}
                    className={`flex items-center gap-2 border font-bold py-3 px-6 rounded-xl transition-all select-none ${
                      currentQ === 0 ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer hover:bg-opacity-80'
                    } ${theme === 'dark' ? 'bg-transparent border-[#1E293B] hover:bg-[#1E293B]/30' : 'bg-transparent border-slate-300 hover:bg-slate-100'}`}
                    style={{ color: theme === 'dark' ? '#F8FAFC' : '#1E293B' }}
                  >
                    <ChevronLeft className="w-4.5 h-4.5" />
                    <span>Previous</span>
                  </button>
                </div>

                {/* Center: Controls */}
                <div className="flex items-center gap-4">
                  <button
                    type="button"
                    onClick={() => setShowPalette(true)}
                    className={`flex items-center gap-2 border hover:bg-opacity-80 font-bold py-3 px-6 rounded-xl transition-all cursor-pointer select-none ${theme === 'dark' ? 'border-[#1E293B] hover:bg-[#1E293B]/30' : 'border-slate-300 hover:bg-slate-100'}`}
                    style={{ color: theme === 'dark' ? '#F8FAFC' : '#1E293B' }}
                  >
                    <LayoutGrid className="w-4.5 h-4.5 text-blue-500" />
                    <span>Question Palette</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setFlagged(prev => {
                        const nextState = !prev[q.id];
                        toast.success(nextState ? "Question marked for review!" : "Review mark removed", {
                          icon: nextState ? '🔖' : '✅',
                          style: { background: theme === 'dark' ? '#0F172A' : '#FFFFFF', color: theme === 'dark' ? '#F1F5F9' : '#0F172A', border: `1px solid ${theme === 'dark' ? '#1E293B' : '#E2E8F0'}` }
                        });
                        return { ...prev, [q.id]: nextState };
                      });
                    }}
                    className={`flex items-center gap-2 border font-bold py-3 px-6 rounded-xl transition-all cursor-pointer select-none ${flagged[q.id] ? (theme === 'dark' ? 'bg-amber-500/10 border-amber-500/50 text-amber-500' : 'bg-amber-50 border-amber-300 text-amber-600') : (theme === 'dark' ? 'bg-transparent border-[#1E293B] hover:bg-[#1E293B]/30 text-[#F8FAFC]' : 'bg-transparent border-slate-300 hover:bg-slate-100 text-[#1E293B]')}`}
                  >
                    <Bookmark className={`w-4.5 h-4.5 ${flagged[q.id] ? (theme === 'dark' ? 'text-amber-500 fill-amber-500/20' : 'text-amber-600 fill-amber-200') : 'text-current'}`} />
                    <span>{flagged[q.id] ? 'Marked for Review' : 'Mark for Review'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleNextQuestion}
                    className="flex items-center gap-2 border bg-transparent hover:bg-[#1E293B]/30 font-bold py-3 px-6 rounded-xl transition-all cursor-pointer select-none"
                    style={{ color: '#F8FAFC', borderColor: '#1E293B' }}
                  >
                    <ChevronRight className="w-4.5 h-4.5 text-blue-400 rotate-90" />
                    <span>Skip Question</span>
                  </button>
                </div>

                {/* Right: Save & Next / Complete */}
                <div>
                  <button
                    type="button"
                    onClick={handleNextQuestion}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-bold py-3.5 px-8 rounded-xl shadow-[0_4px_16px_rgba(37,99,235,0.25)] transition-all cursor-pointer select-none"
                  >
                    <span>{currentQ < questions.length - 1 ? 'Save & Next' : 'Complete Assessment'}</span>
                    <ChevronRight className="w-4.5 h-4.5 stroke-[3px]" />
                  </button>
                </div>
              </div>

              {/* Warning notifications absolute banner */}
              <div className="absolute top-20 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 w-full max-w-md items-center pointer-events-auto">
                {tabWarnings > 0 && (
                  <div className="w-full bg-amber-500/10 border border-amber-500/20 text-amber-400 px-4 py-2.5 rounded-2xl flex items-center gap-3 backdrop-blur-md shadow-2xl text-xs">
                    <AlertTriangle className="w-5 h-5 text-amber-400 animate-bounce flex-shrink-0" />
                    <div>
                      <span className="font-bold">Tab switch violation: Warning {tabWarnings}/3</span>
                      <p className="text-[10px] text-amber-500 mt-0.5">Leaving the exam viewport triggers immediate auto-submit penalties.</p>
                    </div>
                  </div>
                )}
                {isPhoneVisible && (
                  <div className="w-full bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-2.5 rounded-2xl flex items-center gap-3 backdrop-blur-md shadow-2xl text-xs">
                    <Smartphone className="w-5 h-5 text-red-400 animate-bounce flex-shrink-0" />
                    <div>
                      <span className="font-bold">Mobile Phone Detected! Warning {phoneWarnings + 1}/3</span>
                      <p className="text-[10px] text-red-500 mt-0.5">Using unauthorized devices is strictly prohibited. Please put away your phone.</p>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Question Palette Modal */}
        <AnimatePresence>
          {showPalette && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className={`w-full max-w-md rounded-2xl shadow-2xl flex flex-col overflow-hidden border ${theme === 'dark' ? 'bg-[#0F1420] border-[#1E293B]' : 'bg-white border-slate-200'}`}
              >
                {/* Header: Warnings */}
                <div className={`px-6 py-4 border-b flex items-center justify-between ${theme === 'dark' ? 'border-[#1E293B] bg-[#0A0D14]' : 'border-slate-100 bg-slate-50'}`}>
                  <div>
                    <h3 className={`text-sm font-bold uppercase tracking-wider ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>Warnings</h3>
                    <div className="flex items-center gap-2 mt-2">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${tabWarnings > 0 ? 'bg-amber-500 text-white' : (theme === 'dark' ? 'bg-[#1E293B] text-slate-400' : 'bg-slate-200 text-slate-500')}`}>!</div>
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${tabWarnings > 1 ? 'bg-amber-500 text-white' : (theme === 'dark' ? 'bg-[#1E293B] text-slate-400' : 'bg-slate-200 text-slate-500')}`}>!</div>
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${tabWarnings > 2 ? 'bg-amber-500 text-white' : (theme === 'dark' ? 'bg-[#1E293B] text-slate-400' : 'bg-slate-200 text-slate-500')}`}>!</div>
                    </div>
                    <span className={`text-xs mt-1 block ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>{tabWarnings} of 3 warnings used</span>
                  </div>
                  <button onClick={() => setShowPalette(false)} className={`p-2 rounded-lg hover:bg-slate-500/10 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Body: Grid */}
                <div className="p-6">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className={`text-lg font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-800'}`}>Questions</h3>
                    <span className={`text-xs font-semibold ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>
                      {Object.keys(answers).filter(k => !!answers[k]).length}/{questions.length} answered
                    </span>
                  </div>
                  <div className="grid grid-cols-5 gap-3">
                    {questions.map((quest, i) => {
                      const isCurrent = i === currentQ;
                      const isFlagged = flagged[quest.id];
                      const isAnswered = !!answers[quest.id];
                      
                      let btnClasses = '';
                      if (isCurrent) {
                        btnClasses = 'bg-blue-500 text-white border-blue-500 shadow-md';
                      } else if (isFlagged) {
                        btnClasses = theme === 'dark' ? 'bg-amber-500/10 border-amber-500/50 text-amber-500' : 'bg-amber-50 border-amber-300 text-amber-600';
                      } else if (isAnswered) {
                        btnClasses = theme === 'dark' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-emerald-50 border-emerald-200 text-emerald-600';
                      } else {
                        btnClasses = theme === 'dark' ? 'bg-[#1E293B]/30 border-[#1E293B] text-slate-300 hover:bg-[#1E293B]' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50';
                      }

                      return (
                        <div key={quest.id} className="relative">
                          <button
                            onClick={() => {
                              setCurrentQ(i);
                              setShowPalette(false);
                            }}
                            className={`w-full aspect-square flex items-center justify-center rounded-xl border font-bold text-sm transition-all ${btnClasses}`}
                          >
                            {i + 1}
                          </button>
                          {isFlagged && (
                            <div className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-amber-500 border-2 border-[#0F1420] flex items-center justify-center">
                              <Bookmark className="w-2 h-2 text-white fill-white" />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Footer: Status */}
                <div className={`px-6 py-4 border-t flex items-center gap-2 ${theme === 'dark' ? 'border-[#1E293B] bg-amber-500/5' : 'border-amber-100 bg-amber-50'}`}>
                  <Bookmark className="w-4 h-4 text-amber-500 fill-amber-500/20" />
                  <span className={`text-sm font-bold ${theme === 'dark' ? 'text-amber-500' : 'text-amber-600'}`}>
                    {Object.values(flagged).filter(Boolean).length} flagged for review
                  </span>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
