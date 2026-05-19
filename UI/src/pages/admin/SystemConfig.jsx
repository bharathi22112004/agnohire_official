import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Settings, Check, RefreshCw, Server, HelpCircle, Eye, EyeOff, AlertTriangle, Key } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { useAuthStore } from '../../store/authStore';
import api from '../../services/api';
import toast from 'react-hot-toast';

export default function AdminConfig() {
  const [configs, setConfigs] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showSmtpPass, setShowSmtpPass] = useState(false);
  const [showGuide, setShowGuide] = useState(false);

  const currentUser = useAuthStore(state => state.user);
  const sectorId = currentUser?.sectorId;

  const smtpHostKey = `smtp_host_${sectorId}`;
  const smtpPortKey = `smtp_port_${sectorId}`;
  const smtpUserKey = `smtp_user_${sectorId}`;
  const smtpPassKey = `smtp_pass_${sectorId}`;

  useEffect(() => {
    load();
  }, []);

  async function load() {
    try {
      const res = await api.get('/users/config/all');
      const obj = {};
      res.data.data.configs.forEach((cfg) => {
        obj[cfg.key] = cfg.value;
      });
      setConfigs(obj);
    } catch {
      toast.error('Failed to load system configurations');
    } finally {
      setLoading(false);
    }
  }

  async function handleSave(key, val) {
    setSaving(key);
    try {
      await api.put('/users/config/update', { key, value: val });
      setConfigs((prev) => ({ ...prev, [key]: val }));
      toast.success('Configuration updated successfully');
    } catch {
      toast.error('Failed to update configuration');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div className="skeleton" style={{ height: 40, width: '30%' }} />
        <div className="skeleton" style={{ height: 200 }} />
      </div>
    );
  }

  const items = [
    {
      key: 'max_candidates_per_hr_upload',
      label: 'Bulk Candidate Ingestion Limit',
      description: 'Maximum number of candidates that can be uploaded by HR managers in a single CSV batch.',
      type: 'number',
    },
    {
      key: 'max_candidates_per_recruiter',
      label: 'Recruiter Workload Threshold',
      description: 'Maximum active candidate evaluations that can be assigned to a single recruiter simultaneously.',
      type: 'number',
    },
    {
      key: 'interview_link_expiry_hours',
      label: 'Interview Token Expiration',
      description: 'Duration (in hours) that an interview invite link is valid before expiring.',
      type: 'number',
    },
  ];

  return (
    <div style={{ position: 'relative', overflow: 'hidden', minHeight: 'calc(100vh - 100px)' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Sector Configurations</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 4 }}>
            Control and assign administrative limitations and SMTP settings for {currentUser?.sector?.name || 'your assigned sector'}
          </p>
        </div>
        <Button variant="secondary" leftIcon={<RefreshCw size={15} />} onClick={load}>
          Refresh Settings
        </Button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        {/* Operations Settings Card */}
        <motion.div
          className="card"
          style={{ padding: 24 }}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Settings size={18} style={{ color: 'var(--color-brand)' }} />
            Operations & Control Settings
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {items.map((item) => {
              const currentVal = configs[item.key] ?? '';
              const isSavingThis = saving === item.key;

              return (
                <div
                  key={item.key}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '12px 16px',
                    borderRadius: 12,
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-card-header)',
                    flexWrap: 'wrap',
                    gap: 16,
                  }}
                >
                  <div style={{ flex: 1, minWidth: 260 }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{item.label}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{item.description}</div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    {item.type === 'number' && (
                      <input
                        className="input"
                        type="number"
                        defaultValue={currentVal}
                        onBlur={(e) => {
                          const val = parseInt(e.target.value);
                          if (!isNaN(val) && val !== currentVal) handleSave(item.key, val);
                        }}
                        style={{ width: 100, height: 38 }}
                      />
                    )}

                    <div style={{ width: 32, display: 'flex', justifyContent: 'center' }}>
                      {isSavingThis ? (
                        <RefreshCw size={16} className="animate-spin" style={{ color: 'var(--color-brand)' }} />
                      ) : (
                        <Check size={16} style={{ color: 'var(--color-success)', opacity: currentVal !== '' ? 0.7 : 0 }} />
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>

        {/* Global Sector SMTP Settings Card */}
        <motion.div
          className="card"
          style={{ padding: 24 }}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Server size={18} style={{ color: 'var(--color-brand)' }} />
              SMTP Global Mail Server Configuration
            </h3>
            <Button
              variant="secondary"
              type="button"
              size="sm"
              onClick={() => setShowGuide(true)}
              leftIcon={<HelpCircle size={13} />}
              style={{ fontSize: 11, padding: '4px 10px' }}
            >
              App Password Guide
            </Button>
          </div>

          <p style={{ margin: '-8px 0 16px 0', fontSize: 12, color: 'var(--text-muted)' }}>
            Configure the corporate email gateway for all HR invite dispatch and validation emails within {currentUser?.sector?.name || 'this sector'}.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label className="label" style={{ fontSize: 12, fontWeight: 600 }}>SMTP Host Address</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input
                    className="input"
                    placeholder="e.g. smtp.gmail.com"
                    defaultValue={configs[smtpHostKey] || ''}
                    onBlur={(e) => handleSave(smtpHostKey, e.target.value.trim())}
                    style={{ flex: 1, height: 38 }}
                  />
                  <div style={{ width: 20 }}>
                    {saving === smtpHostKey && <RefreshCw size={14} className="animate-spin" style={{ color: 'var(--color-brand)' }} />}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label className="label" style={{ fontSize: 12, fontWeight: 600 }}>SMTP Port</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input
                    className="input"
                    placeholder="587"
                    defaultValue={configs[smtpPortKey] || ''}
                    onBlur={(e) => handleSave(smtpPortKey, e.target.value.trim())}
                    style={{ flex: 1, height: 38 }}
                  />
                  <div style={{ width: 20 }}>
                    {saving === smtpPortKey && <RefreshCw size={14} className="animate-spin" style={{ color: 'var(--color-brand)' }} />}
                  </div>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label className="label" style={{ fontSize: 12, fontWeight: 600 }}>SMTP Authentication User Email</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  className="input"
                  placeholder="e.g. ragul@genagno.ai"
                  defaultValue={configs[smtpUserKey] || ''}
                  onBlur={(e) => handleSave(smtpUserKey, e.target.value.trim())}
                  style={{ flex: 1, height: 38 }}
                />
                <div style={{ width: 20 }}>
                  {saving === smtpUserKey && <RefreshCw size={14} className="animate-spin" style={{ color: 'var(--color-brand)' }} />}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, position: 'relative' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <label className="label" style={{ margin: 0, fontWeight: 600, fontSize: 12 }}>SMTP / Google App Password</label>
                <a
                  href="https://myaccount.google.com/apppasswords"
                  target="_blank"
                  rel="noreferrer"
                  style={{ fontSize: 11, color: 'var(--color-brand)', fontWeight: 700, textDecoration: 'underline' }}
                >
                  Generate Google App Password ↗
                </a>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, position: 'relative' }}>
                <input
                  className="input"
                  type={showSmtpPass ? 'text' : 'password'}
                  placeholder="e.g. ophn rhhm uzaw ywwz"
                  defaultValue={configs[smtpPassKey] || ''}
                  onBlur={(e) => handleSave(smtpPassKey, e.target.value.trim())}
                  style={{ flex: 1, height: 38, paddingRight: 40 }}
                />
                <button
                  type="button"
                  onClick={() => setShowSmtpPass(!showSmtpPass)}
                  style={{
                    position: 'absolute', right: 36, top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)',
                    display: 'flex', alignItems: 'center'
                  }}
                >
                  {showSmtpPass ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
                <div style={{ width: 20 }}>
                  {saving === smtpPassKey && <RefreshCw size={14} className="animate-spin" style={{ color: 'var(--color-brand)' }} />}
                </div>
              </div>
            </div>

            <div style={{
              display: 'flex', gap: 10, alignItems: 'flex-start',
              padding: 12, background: 'rgba(245, 158, 11, 0.05)',
              border: '1px solid rgba(245, 158, 11, 0.2)', borderRadius: 10
            }}>
              <AlertTriangle size={16} style={{ color: 'var(--color-warning)', flexShrink: 0, marginTop: 2 }} />
              <p style={{ margin: 0, fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                <strong>Note:</strong> Sector SMTP settings are prioritized for this sector's evaluations. Leave these blank to automatically fall back to the system-wide `.env` parameters.
              </p>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Interactive sliding Gmail App Password Guide Overlay */}
      <AnimatePresence>
        {showGuide && (
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 220 }}
            style={{
              position: 'absolute',
              top: 0, right: 0, bottom: 0, left: 0,
              background: 'var(--bg-surface)',
              zIndex: 50,
              display: 'flex',
              flexDirection: 'column',
              borderLeft: '1px solid var(--border-color)',
              padding: 4
            }}
          >
            {/* Guide Header */}
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '12px 16px', borderBottom: '1px solid var(--border-color)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Key size={16} style={{ color: 'var(--color-brand)' }} />
                <span style={{ fontSize: 13, fontWeight: 700 }}>Google App Password Guide</span>
              </div>
              <button
                onClick={() => setShowGuide(false)}
                className="btn btn-ghost"
                style={{ padding: '4px 8px', fontSize: 11 }}
              >
                Close Guide
              </button>
            </div>

            {/* Guide Body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <p style={{ margin: 0, fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                Google does not allow third-party apps to access your primary account password. You must generate an <strong>App Password</strong> (a secure 16-character code) to use custom SMTP.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', gap: 10 }}>
                  <div style={{
                    width: 22, height: 22, borderRadius: '50%', background: 'var(--color-primary-500)', color: 'white',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0
                  }}>1</div>
                  <div style={{ fontSize: 12, lineHeight: 1.4 }}>
                    Go directly to Google's <strong>App Passwords Page</strong>:<br />
                    <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noreferrer" style={{ color: 'var(--color-brand)', fontWeight: 700, textDecoration: 'underline', marginTop: 4, display: 'inline-block' }}>
                      myaccount.google.com/apppasswords ↗
                    </a>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 10 }}>
                  <div style={{
                    width: 22, height: 22, borderRadius: '50%', background: 'var(--color-primary-500)', color: 'white',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0
                  }}>2</div>
                  <div style={{ fontSize: 12, lineHeight: 1.4 }}>
                    Go to the <strong>Security</strong> tab in the left sidebar menu.
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 10 }}>
                  <div style={{
                    width: 22, height: 22, borderRadius: '50%', background: 'var(--color-primary-500)', color: 'white',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0
                  }}>3</div>
                  <div style={{ fontSize: 12, lineHeight: 1.4 }}>
                    Under <em>"How you sign in to Google"</em>, click **2-Step Verification** and make sure it is <strong>turned ON</strong> (required by Google).
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 10 }}>
                  <div style={{
                    width: 22, height: 22, borderRadius: '50%', background: 'var(--color-primary-500)', color: 'white',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0
                  }}>4</div>
                  <div style={{ fontSize: 12, lineHeight: 1.4 }}>
                    If prompted, verify your password (or use the direct link in Step 1 to skip manual navigation).
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 10 }}>
                  <div style={{
                    width: 22, height: 22, borderRadius: '50%', background: 'var(--color-primary-500)', color: 'white',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0
                  }}>5</div>
                  <div style={{ fontSize: 12, lineHeight: 1.4 }}>
                    Select **Mail** as the app (or select <em>"Other"</em> and type <strong>"AgnoHire"</strong>), then click <strong>Generate</strong>.
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 10 }}>
                  <div style={{
                    width: 22, height: 22, borderRadius: '50%', background: 'var(--color-primary-500)', color: 'white',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0
                  }}>6</div>
                  <div style={{ fontSize: 12, lineHeight: 1.4 }}>
                    A yellow box will pop up displaying your unique <strong>16-character code</strong> (e.g. <code style={{ background: 'var(--border-color)', padding: '2px 6px', borderRadius: 4, fontWeight: 600 }}>ophn rhhm uzaw ywwz</code>). Copy it!
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 10 }}>
                  <div style={{
                    width: 22, height: 22, borderRadius: '50%', background: 'var(--color-brand)', color: 'white',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0
                  }}>7</div>
                  <div style={{ fontSize: 12, lineHeight: 1.4 }}>
                    <strong>Paste</strong> the code into the <strong>SMTP App Password</strong> field in AgnoHire, and it will be updated immediately!
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
