import { useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Shield, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';

export default function Completion() {
  const [searchParams] = useSearchParams();

  // Extract dynamic parameters passed from the interview room
  const candidateName = searchParams.get('name') || 'Candidate';
  const position = searchParams.get('role') || 'Technical Specialist';
  const email = searchParams.get('email') || '';
  const submissionTime = searchParams.get('time') || new Date().toLocaleString();

  const handleCloseWindow = () => {
    window.close();
    toast.success('Your session has safely terminated. You can close this tab now.', {
      duration: 6000,
      icon: '👋',
    });
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center font-sans text-slate-600 relative overflow-x-hidden p-4 md:p-8">
      
      {/* Main Card */}
      <motion.div 
        className="w-full max-w-[480px] bg-white rounded-[32px] shadow-[0_8px_40px_-12px_rgba(0,0,0,0.08)] p-8 md:p-12 flex flex-col items-center"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
      >
        {/* Success Icon */}
        <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center mb-6">
          <CheckCircle2 className="w-8 h-8 text-emerald-500" strokeWidth={2.5} />
        </div>

        <h2 className="text-[28px] font-bold text-slate-900 tracking-tight text-center leading-tight mb-3">
          Interview Completed
        </h2>

        <p className="text-[15px] text-slate-500 text-center leading-relaxed max-w-[320px]">
          Thank you, <span className="font-medium text-slate-700">{candidateName}</span>. Your solutions have been successfully submitted and uploaded to the recruitment network.
        </p>

        {/* Info Box */}
        {email && (
          <div className="w-full mt-8 bg-[#F5F7FF] rounded-2xl p-5 flex gap-3.5 items-start border border-indigo-50">
            <div className="mt-0.5">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-indigo-600">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="16" x2="12" y2="12"></line>
                <line x1="12" y1="8" x2="12.01" y2="8"></line>
              </svg>
            </div>
            <p className="text-[13px] text-indigo-900/80 leading-relaxed font-medium pr-2">
              Assessment evaluation results and the next steps will be sent directly to your registered email address:
              <br />
              <span className="text-indigo-700 font-bold mt-1.5 inline-block">{email}</span>
            </p>
          </div>
        )}

        {/* Details List */}
        <div className="w-full mt-8 flex flex-col">
          <div className="flex justify-between items-center py-4 border-b border-slate-100">
            <span className="text-[14px] text-slate-500 font-medium">Applied Position</span>
            <span className="text-[14px] text-slate-900 font-bold">{position}</span>
          </div>
          <div className="flex justify-between items-center py-4 border-b border-slate-100">
            <span className="text-[14px] text-slate-500 font-medium">Submission Time</span>
            <span className="text-[14px] text-slate-900 font-bold">{submissionTime.includes('AM') || submissionTime.includes('PM') ? submissionTime : new Date(submissionTime).toLocaleTimeString()}</span>
          </div>
        </div>

        {/* Button */}
        <button
          onClick={handleCloseWindow}
          className="w-full mt-10 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-[14px] py-4 rounded-xl shadow-[0_4px_14px_rgba(37,99,235,0.2)] hover:shadow-[0_6px_20px_rgba(37,99,235,0.3)] transition-all flex items-center justify-center cursor-pointer active:scale-[0.98] uppercase tracking-wide"
        >
          CLOSE ASSESSMENT SESSION
        </button>
      </motion.div>

      {/* Footer */}
      <motion.div 
        className="mt-10 flex flex-col items-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3, duration: 0.5 }}
      >
        <div className="flex items-center gap-1.5 text-slate-400 text-[13px] font-medium">
          <Shield className="w-3.5 h-3.5" />
          <span>Secure connection verified</span>
        </div>
        
        <div className="flex items-center gap-5 mt-6 text-[13px] text-slate-500 font-medium">
          <a href="#" className="hover:text-slate-800 transition-colors">Privacy Policy</a>
          <a href="#" className="hover:text-slate-800 transition-colors">Support</a>
        </div>
        
        <p className="mt-3 text-[13px] text-slate-500 font-medium">
          © {new Date().getFullYear()} AgnoHire Corporation. All rights reserved.
        </p>
        
        <p className="mt-5 text-[10px] font-bold text-slate-400 tracking-[0.2em] uppercase font-mono">
          AgnoHire Protocol
        </p>
      </motion.div>
    </div>
  );
}
