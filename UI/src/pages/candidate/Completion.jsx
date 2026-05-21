import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  Shield, 
  User, 
  Briefcase, 
  Calendar, 
  Mail, 
  Cpu, 
  Copy, 
  Check, 
  Activity, 
  Clock, 
  Download, 
  ShieldCheck, 
  Server, 
  CheckCircle2, 
  Lock, 
  Terminal, 
  ChevronRight, 
  Globe 
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function Completion() {
  const [searchParams] = useSearchParams();
  const [sessionHash, setSessionHash] = useState('');
  const [copied, setCopied] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [digitalTime, setDigitalTime] = useState(new Date().toLocaleTimeString());
  
  // Terminal logs state
  const [visibleLogs, setVisibleLogs] = useState([]);
  const terminalBottomRef = useRef(null);

  // Extract dynamic parameters passed from the interview room
  const candidateName = searchParams.get('name') || 'HARIKARAN G';
  const interviewId = searchParams.get('id') || 'b601df7-a40f-4c43-ab50-7d6c8207a050';
  const position = searchParams.get('role') || 'Technical Specialist';
  const email = searchParams.get('email') || 'harikiran8231@gmail.com';
  const submissionTime = searchParams.get('time') || '5/21/2026, 12:08:05 PM';

  // Generate a mock SHA-256 checksum representing the proctor compliance signature
  useEffect(() => {
    const chars = '0123456789abcdef';
    let hash = 'sha256-';
    for (let i = 0; i < 32; i++) {
      hash += chars[Math.floor(Math.random() * 16)];
    }
    setSessionHash(hash);
  }, []);

  // Update clock live
  useEffect(() => {
    const timer = setInterval(() => {
      setDigitalTime(new Date().toLocaleTimeString());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Mock server console telemetry stream
  const consoleLogs = [
    `[12:00:01] SECURE ENVIRONMENT: AgnoHire Secure Engine v2.4.0 active. Fullscreen active.`,
    `[12:00:02] COMPLIANCE BOOTSTRAP: Secure tab lock enforced. WebRTC media streams activated.`,
    `[12:00:15] FACE MATCH SUCCESSFUL: 99.8% vector similarity matching registered biometric dossier.`,
    `[12:05:14] GAZE CALIBRATION PASSED: Continuous tracking enabled. Latency deviation: 0.02s (optimal).`,
    `[12:08:32] VOICE SYNC INITIALIZED: Speech-to-Text neural model calibrated to candidate frequencies.`,
    `[12:12:30] MICROPHONE TELEMETRY STABLE: Passive acoustic environmental noise locked at -42db (clear).`,
    `[12:18:45] NOTEPAD COMPLIANCE STATUS: Code compiler buffer sealed. Syntax validated, 0 compile errors.`,
    `[12:28:05] ASSESSMENT SUBMISSION COMPLETE: Final answers successfully committed to recruitment ledger.`,
    `[12:28:05] TELEMETRY ENVELOPE SEALED: Generating SHA-256 proctor signature and cryptographic seals.`,
    `[12:28:06] SECURE COMPLIANCE LEDGER: HTTPS Port 443 handshake confirmed. local session buffers purged.`,
  ];

  useEffect(() => {
    let index = 0;
    const interval = setInterval(() => {
      if (index < consoleLogs.length) {
        setVisibleLogs((prev) => [...prev, consoleLogs[index]]);
        index++;
      } else {
        clearInterval(interval);
      }
    }, 350);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (terminalBottomRef.current) {
      terminalBottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [visibleLogs]);

  const handleCopyHash = () => {
    navigator.clipboard.writeText(sessionHash);
    setCopied(true);
    toast.success('Proctor Seal Hash copied to clipboard!', { id: 'copy-hash' });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExportReceipt = () => {
    setIsExporting(true);
    toast.loading('Assembling secure compliance receipt...', { id: 'export-ledger' });
    
    setTimeout(() => {
      const content = `=====================================================
            AGNOHIRE SECURE PROCTOR COMPLIANCE LEDGER
=====================================================
[CERTIFICATE OF INTEGRITY]
Session Reference: ${interviewId}
Candidate Name: ${candidateName}
Applied Position: ${position}
Submission Timestamp: ${submissionTime}
Proctor Integrity Index: 99.4% SECURE

-----------------------------------------------------
CRYPTOGRAPHIC SEAL:
${sessionHash}
-----------------------------------------------------

BIOMETRICS VERIFICATION REPORT:
- Face Detection Continuity: 99.8% Match (Certified)
- Gaze Calibration tracking: Calibrated & Verified
- Acoustics Environment: Clean acoustics, no auxiliary feeds
- DevTools / Environment Controls: Fully Locked

STAMPS & PROTOCOLS:
- SSL Secure Handshake: ESTABLISHED
- IP Multi-device Filter: SECURED
- Local Session Buffer: CLEARED

This receipt serves as official cryptographic verification that the 
referenced interview room was completed in compliance with all AI-enforced
proctor protocols.

AgnoHire Corporation. Powered by AgnoHire Proctor Secure Engine v2.4.0.
=====================================================`;
      
      const blob = new Blob([content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `AgnoHire_Receipt_${interviewId}.txt`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      setIsExporting(false);
      toast.success('Integrity Receipt downloaded successfully!', { id: 'export-ledger' });
    }, 1500);
  };

  const handleCloseWindow = () => {
    window.close();
    toast.success('Your session is safely terminated. You can close this tab now.', {
      duration: 6000,
      icon: '👋',
    });
  };

  return (
    <div className="min-h-screen bg-[#03060E] flex flex-col font-sans text-slate-300 selection:bg-blue-600/30 selection:text-white">
      {/* Top Header */}
      <header className="bg-[#060B17]/95 backdrop-blur-md border-b border-white/[0.04] px-6 py-4 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-br from-blue-500 to-indigo-600 p-2.5 rounded-xl text-white shadow-lg shadow-blue-500/20">
            <Shield className="w-5.5 h-5.5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-extrabold text-white tracking-tight leading-none">AgnoHire</h1>
            <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mt-1">AI PROCTOR INTEGRITY NETWORK</p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.02] border border-white/[0.04] text-slate-400 font-mono text-xs">
            <Clock className="w-3.5 h-3.5 text-blue-400" />
            <span>{digitalTime}</span>
          </div>

          <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-xs font-bold text-emerald-400 shadow-sm animate-pulse">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Compliance Record Sealed</span>
          </div>
        </div>
      </header>

      {/* Main Container - Restructured for natural window scrolling (no overflow-hidden or absolute flex centering) */}
      <main className="w-full max-w-[1560px] mx-auto px-4 md:px-8 py-6 md:py-8 z-10 flex flex-col gap-6 relative overflow-visible">
        {/* Decorative background glows */}
        <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-blue-600/5 rounded-full blur-[140px] pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-indigo-600/5 rounded-full blur-[140px] pointer-events-none" />

        {/* 1. TOP HERO WELCOME BANNER */}
        <motion.div
          className="bg-gradient-to-r from-slate-950 via-[#09101E] to-slate-950 p-6 md:p-8 rounded-[2rem] border border-white/[0.06] shadow-xl flex flex-col lg:flex-row items-center justify-between gap-6 relative overflow-hidden"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        >
          <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent via-blue-500 to-transparent" />
          
          <div className="flex flex-col md:flex-row items-center gap-6 text-center md:text-left">
            <div className="w-14 h-14 rounded-full bg-emerald-500/10 border-2 border-emerald-500/20 flex items-center justify-center shadow-lg relative">
              <CheckCircle2 className="w-7 h-7 text-emerald-400" />
            </div>
            <div className="space-y-1">
              <h2 className="text-xl md:text-2xl font-black text-white tracking-tight">Assessment Completed & Verified</h2>
              <p className="text-slate-400 text-sm leading-relaxed max-w-4xl">
                Thank you, <span className="font-bold text-blue-400">{candidateName}</span>. Your solutions, acoustic speech logs, and behavioral proctor telemetry have been cryptographically signed and uploaded to the recruitment network.
              </p>
            </div>
          </div>

          <div className="flex-shrink-0 flex items-center gap-3 bg-[#0B1222]/80 border border-white/[0.04] rounded-2xl px-4 py-3 backdrop-blur-md">
            <Shield className="w-5 h-5 text-blue-400 animate-pulse" />
            <div>
              <span className="block text-[8px] font-bold text-slate-500 uppercase tracking-widest font-mono">STATUS LOGS</span>
              <span className="font-mono text-xs font-bold text-emerald-400">100% TRANSMITTED</span>
            </div>
          </div>
        </motion.div>

        {/* 2. THREE CORE COLUMNS GRID */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          
          {/* LEFT COLUMN: CANDIDATE INFO & COMMANDS */}
          <motion.div
            className="lg:col-span-4 bg-slate-950/60 backdrop-blur-2xl rounded-[2rem] border border-white/[0.06] shadow-xl p-6 relative flex flex-col justify-between group hover:border-white/[0.1] transition-all duration-500"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, ease: 'easeOut', delay: 0.1 }}
          >
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-blue-500 to-indigo-500" />
            
            <div className="space-y-6">
              <div className="flex items-center gap-2 border-b border-white/[0.04] pb-3">
                <User className="w-4 h-4 text-blue-400" />
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono">Identity Profile Dossier</span>
              </div>

              {/* Biometric ID Avatar Card */}
              <div className="bg-[#070D18]/90 border border-white/[0.04] rounded-2xl p-4.5 flex items-center gap-4 relative overflow-hidden">
                <div className="relative w-14 h-14 flex-shrink-0 flex items-center justify-center bg-slate-900 rounded-xl border border-white/[0.08] shadow-inner overflow-hidden">
                  <div className="absolute inset-0 bg-blue-500/10 rounded-full animate-pulse" />
                  <span className="text-lg font-black text-blue-400 font-mono tracking-wider">
                    {candidateName.split(' ').map(n=>n[0]).join('').toUpperCase().substring(0, 2)}
                  </span>
                </div>

                <div className="space-y-1 overflow-hidden">
                  <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-500/10 border border-blue-500/20 text-[9px] text-blue-400 font-bold uppercase tracking-wider font-mono">
                    BIOMETRICS MATCHED
                  </div>
                  <h4 className="font-extrabold text-white text-base truncate">{candidateName}</h4>
                  <p className="text-[11px] text-slate-400 font-semibold truncate flex items-center gap-1">
                    <Briefcase className="w-3.5 h-3.5 text-slate-500" />
                    {position}
                  </p>
                </div>
              </div>

              {/* Detail Items Stacked cleanly to prevent overlap */}
              <div className="space-y-3.5">
                <div className="space-y-1">
                  <span className="block text-[8px] font-bold text-slate-500 uppercase tracking-wider font-mono">Verification Reference ID</span>
                  <div className="p-3 bg-white/[0.01] border border-white/[0.03] rounded-xl flex items-center justify-between">
                    <span className="font-mono text-xs text-blue-400 font-semibold break-all select-all">{interviewId}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3.5">
                  <div className="space-y-1">
                    <span className="block text-[8px] font-bold text-slate-500 uppercase tracking-wider font-mono">Applied Role</span>
                    <div className="p-3 bg-white/[0.01] border border-white/[0.03] rounded-xl">
                      <span className="text-xs text-slate-200 font-bold truncate block">{position}</span>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <span className="block text-[8px] font-bold text-slate-500 uppercase tracking-wider font-mono">Submission Time</span>
                    <div className="p-3 bg-white/[0.01] border border-white/[0.03] rounded-xl">
                      <span className="text-xs text-slate-200 font-bold truncate block">{submissionTime.split(',')[1]?.trim() || submissionTime}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="block text-[8px] font-bold text-slate-500 uppercase tracking-wider font-mono">Candidate Email</span>
                  <div className="p-3 bg-white/[0.01] border border-white/[0.03] rounded-xl flex items-center gap-2">
                    <Mail className="w-3.5 h-3.5 text-slate-500" />
                    <span className="text-xs text-slate-300 truncate font-medium">{email}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* CTAs */}
            <div className="space-y-2.5 pt-4 border-t border-white/[0.04] mt-4">
              <button
                onClick={handleCloseWindow}
                className="w-full bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-600 text-white font-bold text-xs py-3 px-6 rounded-2xl shadow-lg hover:scale-[1.01] hover:shadow-blue-500/20 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Lock className="w-4 h-4" />
                <span>CLOSE ASSESSMENT SESSION</span>
              </button>

              <button
                onClick={handleExportReceipt}
                disabled={isExporting}
                className="w-full bg-white/[0.03] hover:bg-white/[0.06] disabled:opacity-50 border border-white/[0.06] hover:border-white/[0.12] text-slate-200 font-bold text-xs py-3 px-6 rounded-2xl hover:scale-[1.01] active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                {isExporting ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-slate-300 border-t-transparent rounded-full animate-spin" />
                    <span>Generating Receipt...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-3.5 h-3.5 text-slate-400" />
                    <span>EXPORT INTEGRITY RECEIPT</span>
                  </>
                )}
              </button>
            </div>
          </motion.div>

          {/* MIDDLE COLUMN: RADAR METER & NON-CLIPPED TIMELINE */}
          <motion.div
            className="lg:col-span-4 bg-slate-950/60 backdrop-blur-2xl rounded-[2rem] border border-white/[0.06] shadow-xl p-6 relative flex flex-col justify-between group hover:border-white/[0.1] transition-all duration-500"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: 'easeOut', delay: 0.15 }}
          >
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-emerald-500 to-teal-500" />
            
            <div className="space-y-6">
              <div className="flex items-center gap-2 border-b border-white/[0.04] pb-3">
                <Activity className="w-4 h-4 text-emerald-400" />
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono">A.I. Telemetry Analytics</span>
              </div>

              {/* Sweeping target circle */}
              <div className="flex flex-col items-center justify-center py-2 relative">
                <div className="w-36 h-36 relative flex items-center justify-center">
                  <div className="absolute inset-[-3px] rounded-full border border-dashed border-emerald-500/10 animate-[spin_60s_linear_infinite]" />
                  <svg className="w-full h-full transform -rotate-90">
                    <circle
                      cx="72"
                      cy="72"
                      r="60"
                      className="stroke-slate-900 fill-none"
                      strokeWidth="6"
                    />
                    <motion.circle
                      cx="72"
                      cy="72"
                      r="60"
                      className="stroke-emerald-400 fill-none filter drop-shadow-[0_0_8px_rgba(52,211,153,0.4)]"
                      strokeWidth="6"
                      strokeDasharray="377"
                      initial={{ strokeDashoffset: 377 }}
                      animate={{ strokeDashoffset: 377 * (1 - 0.994) }}
                      transition={{ duration: 1.2, ease: 'easeOut' }}
                      strokeLinecap="round"
                    />
                  </svg>
                  
                  <div className="absolute flex flex-col items-center justify-center text-center">
                    <span className="text-2xl font-black text-white font-mono tracking-tight leading-none">99.4%</span>
                    <span className="text-[8px] text-emerald-400 font-bold uppercase tracking-wider mt-1 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 font-mono">
                      TRUST INDEX
                    </span>
                  </div>
                </div>
                
                <div className="text-center mt-3">
                  <span className="text-xs text-slate-300 font-bold block">Biometric Integrity Verified</span>
                </div>
              </div>

              {/* Timeline milestone tracker */}
              <div className="space-y-4 pt-4 border-t border-white/[0.04]">
                <div className="flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5 text-blue-400" />
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono">Milestone Chronology</span>
                </div>

                <div className="space-y-4 relative pl-5 before:absolute before:left-[6px] before:top-2 before:bottom-2 before:w-[1px] before:bg-white/[0.08]">
                  
                  {/* Step 1 */}
                  <div className="relative space-y-1 text-xs">
                    <div className="absolute left-[-22px] top-1 w-3 h-3 rounded-full bg-emerald-500 border-2 border-slate-950 shadow-[0_0_6px_rgba(16,185,129,0.4)]" />
                    <div className="flex items-center justify-between text-[10px] text-slate-500 font-semibold font-mono">
                      <span className="text-slate-300 font-bold">12:00:02 PM</span>
                      <span className="text-emerald-400 bg-emerald-500/10 px-1.5 py-0.2 rounded border border-emerald-500/10 text-[9px]">LAUNCHED</span>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-normal">
                      Proctor sandbox environment locked. Viewport lock initiated.
                    </p>
                  </div>

                  {/* Step 2 */}
                  <div className="relative space-y-1 text-xs">
                    <div className="absolute left-[-22px] top-1 w-3 h-3 rounded-full bg-emerald-500 border-2 border-slate-950 shadow-[0_0_6px_rgba(16,185,129,0.4)]" />
                    <div className="flex items-center justify-between text-[10px] text-slate-500 font-semibold font-mono">
                      <span className="text-slate-300 font-bold">12:05:14 PM</span>
                      <span className="text-emerald-400 bg-emerald-500/10 px-1.5 py-0.2 rounded border border-emerald-500/10 text-[9px]">CALIBRATED</span>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-normal">
                      Biometric vectors calibrated. Facial continuity established.
                    </p>
                  </div>

                  {/* Step 3 */}
                  <div className="relative space-y-1 text-xs">
                    <div className="absolute left-[-22px] top-1 w-3 h-3 rounded-full bg-blue-500 border-2 border-slate-950 animate-pulse shadow-[0_0_6px_rgba(59,130,246,0.4)]" />
                    <div className="flex items-center justify-between text-[10px] text-slate-500 font-semibold font-mono">
                      <span className="text-blue-400 font-bold">12:28:05 PM</span>
                      <span className="text-blue-400 bg-blue-500/10 px-1.5 py-0.2 rounded border border-blue-500/10 text-[9px]">SEALED</span>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-normal">
                      Submission finished. Environmental security envelope sealed.
                    </p>
                  </div>

                </div>
              </div>
            </div>
          </motion.div>

          {/* RIGHT COLUMN: LEDGER CHECKLIST & TOKEN */}
          <motion.div
            className="lg:col-span-4 bg-slate-950/60 backdrop-blur-2xl rounded-[2rem] border border-white/[0.06] shadow-xl p-6 relative flex flex-col justify-between group hover:border-white/[0.1] transition-all duration-500"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, ease: 'easeOut', delay: 0.2 }}
          >
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-indigo-500 to-blue-500" />
            
            <div className="space-y-6">
              <div className="flex items-center gap-2 border-b border-white/[0.04] pb-3">
                <ShieldCheck className="w-4 h-4 text-blue-400" />
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono">Telemetry Receipt Ledger</span>
              </div>

              {/* Compliance checklist */}
              <div className="space-y-2">
                <div className="p-3 bg-emerald-500/[0.02] border border-emerald-500/10 rounded-xl flex items-center justify-between text-xs hover:bg-[#071318]/40 hover:border-emerald-500/20 transition-all duration-300">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.5)]" />
                    <span className="text-slate-400 font-medium">Face Detection Continuity</span>
                  </div>
                  <span className="font-mono font-bold text-emerald-400 text-[11px]">99.8% Match</span>
                </div>

                <div className="p-3 bg-emerald-500/[0.02] border border-emerald-500/10 rounded-xl flex items-center justify-between text-xs hover:bg-[#071318]/40 hover:border-emerald-500/20 transition-all duration-300">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.5)]" />
                    <span className="text-slate-400 font-medium">Gaze Tracking Validation</span>
                  </div>
                  <span className="font-mono font-bold text-emerald-400 text-[11px]">Calibrated</span>
                </div>

                <div className="p-3 bg-emerald-500/[0.02] border border-emerald-500/10 rounded-xl flex items-center justify-between text-xs hover:bg-[#071318]/40 hover:border-emerald-500/20 transition-all duration-300">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.5)]" />
                    <span className="text-slate-400 font-medium">Acoustic Audio Quality</span>
                  </div>
                  <span className="font-mono font-bold text-emerald-400 text-[11px]">Clear Feed</span>
                </div>
              </div>

              {/* Cognitive evaluator card */}
              <div className="p-4 bg-white/[0.01] border border-white/[0.04] rounded-2xl text-left space-y-2 relative overflow-hidden">
                <div className="absolute right-[-20px] top-[-20px] w-16 h-16 bg-indigo-500/[0.03] rounded-full blur-xl pointer-events-none" />
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Cpu className="w-3.5 h-3.5 text-indigo-400" />
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest font-mono">Cognitive Evaluation Ingestion</span>
                  </div>
                  <span className="text-[8px] text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20 font-bold uppercase font-mono">
                    v3.0
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 leading-relaxed">
                  Voice answers and notepad compiler code have been ingested dynamically to the **Agnos AI Scorer** semantic logical checker.
                </p>
              </div>

              {/* Terminal cryptographic block */}
              <div className="p-4 bg-[#050B14] border border-white/[0.05] rounded-2xl text-left space-y-2">
                <div className="flex items-center justify-between">
                  <span className="uppercase text-slate-500 font-bold tracking-widest text-[8px] font-mono">
                    Cryptographic Compliance Seal
                  </span>
                  <Server className="w-3.5 h-3.5 text-blue-500" />
                </div>
                
                <div className="font-mono text-[9px] text-blue-400 select-all bg-slate-950/60 p-2.5 rounded-lg border border-white/[0.04] break-all leading-normal">
                  {sessionHash}
                </div>

                <button
                  onClick={handleCopyHash}
                  className="w-full bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 hover:text-blue-300 font-bold text-xs py-2 rounded-xl border border-blue-500/20 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-[10px] text-emerald-400 font-mono font-bold">Copy Success</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span className="text-[10px] font-mono font-bold">Copy Secure Seal</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* environment badges */}
            <div className="grid grid-cols-3 gap-2 text-center pt-4 border-t border-white/[0.04] mt-4">
              <div className="p-2 bg-white/[0.01] border border-white/[0.02] rounded-xl text-center">
                <span className="block text-[7px] text-slate-500 uppercase tracking-widest font-mono">SSL PORT</span>
                <span className="font-mono font-bold text-[9px] text-emerald-400">443 SAFE</span>
              </div>
              <div className="p-2 bg-white/[0.01] border border-white/[0.02] rounded-xl text-center">
                <span className="block text-[7px] text-slate-500 uppercase tracking-widest font-mono">SANDBOX</span>
                <span className="font-mono font-bold text-[9px] text-emerald-400">ENFORCED</span>
              </div>
              <div className="p-2 bg-white/[0.01] border border-white/[0.02] rounded-xl text-center">
                <span className="block text-[7px] text-slate-500 uppercase tracking-widest font-mono">ROUTER</span>
                <span className="font-mono font-bold text-[9px] text-blue-400">STAGED</span>
              </div>
            </div>
          </motion.div>

        </div>

        {/* 3. FULL-WIDTH SECURE SECURITY EVENT LOGS CONSOLE */}
        <motion.div
          className="bg-[#050914]/90 border border-white/[0.06] rounded-[2rem] shadow-2xl p-6 relative overflow-hidden"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut', delay: 0.25 }}
        >
          {/* Top header line */}
          <div className="flex items-center justify-between border-b border-white/[0.05] pb-4 mb-4">
            <div className="flex items-center gap-2.5">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
                <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/60" />
                <span className="w-2.5 h-2.5 rounded-full bg-green-500/60" />
              </div>
              <div className="h-4 w-[1px] bg-white/[0.08]" />
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-slate-400" />
                <span className="font-mono text-xs font-bold text-slate-400 uppercase tracking-wider">A.I. Integrity Verification Console</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
              <span className="font-mono text-[9px] font-bold text-emerald-400 uppercase tracking-widest">FEED ACTIVE</span>
            </div>
          </div>

          {/* Console logger windows */}
          <div className="h-36 overflow-y-auto font-mono text-[11px] leading-relaxed space-y-1.5 scrollbar-thin bg-black/40 rounded-xl p-4 border border-white/[0.03]">
            {visibleLogs.map((log, index) => {
              let logColor = "text-slate-400";
              if (log.includes("SUCCESSFUL") || log.includes("PASSED")) logColor = "text-emerald-400 font-bold";
              if (log.includes("SEALED") || log.includes("SECURE COMPLIANCE")) logColor = "text-blue-400 font-bold";
              return (
                <div key={index} className="flex items-start gap-1">
                  <ChevronRight className="w-3.5 h-3.5 text-slate-600 mt-[1px] flex-shrink-0" />
                  <span className={logColor}>{log}</span>
                </div>
              );
            })}
            <div ref={terminalBottomRef} />
          </div>
          
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-4 pt-4 border-t border-white/[0.04] text-[10px] text-slate-500 font-mono font-semibold">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-slate-600" />
                <span>IP GATEWAY: REGISTERED</span>
              </span>
              <span className="flex items-center gap-1.5">
                <Server className="w-3.5 h-3.5 text-slate-600" />
                <span>NODE: INGESTION-AWS-EAST-4</span>
              </span>
            </div>
            <div>
              <span>SECURITY ENVELOPE v2.4.0 (COMMIT 8A52BD1)</span>
            </div>
          </div>
        </motion.div>

      </main>

      {/* Footer */}
      <footer className="py-5 text-center text-[10px] text-slate-600 bg-[#060B17]/40 border-t border-white/[0.04] backdrop-blur-sm z-10 mt-auto">
        <p>© {new Date().getFullYear()} AgnoHire Corporation. Powered by AgnoHire Proctor Secure Engine v2.4.0. All Rights Reserved.</p>
      </footer>
    </div>
  );
}
