import { CheckCircle } from 'lucide-react';
import { motion } from 'framer-motion';

export default function Completion() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-base)' }}>
      <motion.div className="card" style={{ padding: 48, textAlign: 'center', maxWidth: 480 }}
        initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
        <CheckCircle size={56} style={{ color: 'var(--color-success)', margin: '0 auto 20px', display: 'block' }} />
        <h2 style={{ fontFamily: 'Syne', fontSize: 26, marginBottom: 10 }}>All Done!</h2>
        <p style={{ color: 'var(--text-secondary)' }}>Your interview has been submitted. You will hear back from the recruiter soon.</p>
      </motion.div>
    </div>
  );
}
