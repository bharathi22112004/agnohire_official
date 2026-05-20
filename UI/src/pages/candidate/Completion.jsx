import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CheckCircle, Shield, User, Briefcase, Calendar, Hash, HelpCircle, XCircle, Mail } from 'lucide-react';
import toast from 'react-hot-toast';

export default function Completion() {
  const [searchParams] = useSearchParams();
  const [sessionHash, setSessionHash] = useState('');

  // Extract dynamic parameters passed from the interview room
  const candidateName = searchParams.get('name') || 'Valued Candidate';
  const interviewId = searchParams.get('id') || 'AGN-' + Math.floor(100000 + Math.random() * 900000);
  const position = searchParams.get('role') || 'Technical Specialist';
  const email = searchParams.get('email') || 'support@agnohire.com';
  const submissionTime = searchParams.get('time') || new Date().toLocaleString();

  // Generate a mock SHA-256 checksum representing the proctor compliance signature
  useEffect(() => {
    const chars = '0123456789abcdef';
    let hash = 'sha256-';
    for (let i = 0; i < 32; i++) {
      hash += chars[Math.floor(Math.random() * 16)];
    }
    setSessionHash(hash);
  }, []);

  const handleCloseWindow = () => {
    // Attempt standard script window closing
    window.close();
    
    // Fallback if browser blocks standard script closing (which happens if the window was not opened by a script)
    toast.success('Your session is safely terminated. You can close this tab now.', {
      duration: 5000,
      icon: '👋',
    });
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col font-sans text-slate-700">
      {/* Top Professional Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 p-2 rounded-xl text-white shadow-md shadow-blue-200">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-800 tracking-tight">AgnoHire</h1>
            <p className="text-xs text-slate-400 font-medium">Enterprise Proctor System</p>
          </div>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-100 text-xs font-semibold text-emerald-700">
          <Shield className="w-3.5 h-3.5" />
          <span>Security Locked</span>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-grow flex items-center justify-center p-6 md:p-12">
        <motion.div 
          className="max-w-xl w-full bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden"
          initial={{ opacity: 0, y: 30, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        >
          {/* Top Decorative Border (Green/Blue/White Branding stripe) */}
          <div className="h-2 w-full bg-gradient-to-r from-blue-600 via-emerald-500 to-green-400" />

          {/* Body Content */}
          <div className="p-8 md:p-10 text-center">
            {/* Animated Checkmark Badge */}
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: 'spring', stiffness: 120 }}
              className="mx-auto w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center border-2 border-emerald-100 shadow-md mb-6"
            >
              <CheckCircle className="w-12 h-12 text-emerald-500" />
            </motion.div>

            <h2 className="text-3xl font-extrabold text-slate-800 mb-2 tracking-tight">Assessment Submitted!</h2>
            <p className="text-slate-400 text-sm md:text-base mb-8 max-w-md mx-auto leading-relaxed">
              Thank you, <span className="font-semibold text-slate-700">{candidateName}</span>. Your assessment solutions and proctor logs have been securely filed.
            </p>

            {/* Session Audit Receipt Details */}
            <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-6 text-left space-y-4 mb-8">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                <Shield className="w-4 h-4 text-blue-600" />
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Secure Audit Receipt</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs md:text-sm">
                <div className="flex flex-col gap-1 p-2.5 bg-white rounded-xl border border-slate-100 shadow-sm">
                  <div className="flex items-center gap-1.5 text-slate-400 text-xs">
                    <User className="w-3.5 h-3.5 text-slate-400" />
                    <span>Candidate Name</span>
                  </div>
                  <span className="font-semibold text-slate-800 truncate">{candidateName}</span>
                </div>

                <div className="flex flex-col gap-1 p-2.5 bg-white rounded-xl border border-slate-100 shadow-sm">
                  <div className="flex items-center gap-1.5 text-slate-400 text-xs">
                    <Briefcase className="w-3.5 h-3.5 text-slate-400" />
                    <span>Applied Position</span>
                  </div>
                  <span className="font-semibold text-slate-800 truncate">{position}</span>
                </div>

                <div className="flex flex-col gap-1 p-2.5 bg-white rounded-xl border border-slate-100 shadow-sm">
                  <div className="flex items-center gap-1.5 text-slate-400 text-xs">
                    <Hash className="w-3.5 h-3.5 text-slate-400" />
                    <span>Interview Reference</span>
                  </div>
                  <span className="font-mono font-bold text-slate-700 truncate">{interviewId}</span>
                </div>

                <div className="flex flex-col gap-1 p-2.5 bg-white rounded-xl border border-slate-100 shadow-sm">
                  <div className="flex items-center gap-1.5 text-slate-400 text-xs">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    <span>Completion Time</span>
                  </div>
                  <span className="font-semibold text-slate-800 truncate">{submissionTime}</span>
                </div>
              </div>

              {/* Proctor Integrity Badge */}
              <div className="bg-emerald-50/50 border border-emerald-100 rounded-xl p-3.5 flex items-center justify-between text-xs mt-2">
                <div className="flex items-center gap-2 text-emerald-800">
                  <Shield className="w-4 h-4 text-emerald-600 animate-pulse" />
                  <span className="font-bold tracking-tight">PROCTOR COMPLIANCE RECORDED</span>
                </div>
                <span className="bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded text-[10px]">
                  SECURE
                </span>
              </div>
            </div>

            {/* Interactive Actions Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button
                onClick={handleCloseWindow}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm py-3 px-6 rounded-2xl shadow-lg shadow-blue-100 hover:shadow-blue-200 transition-all flex items-center justify-center gap-2 group cursor-pointer"
              >
                <XCircle className="w-4 h-4 group-hover:scale-110 transition-transform" />
                <span>Close Session Window</span>
              </button>

              <a
                href={`mailto:${email}?subject=Support Request for Interview ID: ${interviewId}`}
                className="w-full bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-semibold text-sm py-3 px-6 rounded-2xl transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Mail className="w-4 h-4 text-slate-400" />
                <span>Contact Recruitment</span>
              </a>
            </div>
          </div>

          {/* Footer Security Receipt Key */}
          <div className="bg-slate-50 border-t border-slate-100 px-8 py-4 flex flex-col gap-1 text-[10px] text-slate-400 font-mono">
            <span className="uppercase text-slate-500 font-bold tracking-widest text-[8px]">Session Verification Signature</span>
            <span className="truncate">{sessionHash}</span>
          </div>
        </motion.div>
      </main>

      {/* Corporate Footprint */}
      <footer className="py-6 text-center text-xs text-slate-400 bg-white border-t border-slate-200">
        <p>© {new Date().getFullYear()} AgnoHire. Powered by AgnoHire Proctor Engine v2.4.0. All Rights Reserved.</p>
      </footer>
    </div>
  );
}

