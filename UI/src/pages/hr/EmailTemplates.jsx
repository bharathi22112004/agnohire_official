import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Mail, Edit, Check, RefreshCw, Sparkles, Send } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { useAuthStore } from '../../store/authStore';

export default function EmailTemplates() {
  const { user } = useAuthStore();
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(null);

  const [subject, setSubject] = useState('');
  const [bodyHtml, setBodyHtml] = useState('');

  const [testing, setTesting] = useState(false);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    try {
      const res = await api.get('/users/config/email-templates');
      const list = res.data.data.templates || [];
      setTemplates(list);
      if (list.length > 0) {
        selectTemplate(list[0]);
      }
    } catch {
      toast.error('Failed to load email templates');
    } finally {
      setLoading(false);
    }
  }

  function selectTemplate(t) {
    setSelectedTemplate(t);
    setSubject(t.subject);
    setBodyHtml(t.bodyHtml);
  }

  async function handleSave() {
    setSaving(true);
    try {
      await api.put(`/users/config/email-templates/${selectedTemplate.id}`, {
        subject,
        bodyHtml
      });
      toast.success('Email Template updated');
      load();
    } catch {
      toast.error('Failed to save template changes');
    } finally {
      setSaving(false);
    }
  }

  async function handleSendTest() {
    const targetEmail = user?.email;
    if (!targetEmail) {
      const promptEmail = window.prompt("Enter a real email address to receive this test preview:", "your-real-email@gmail.com");
      if (!promptEmail) return;
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(promptEmail.trim())) {
        return toast.error('Please enter a valid email address');
      }
      return executeSendTest(promptEmail.trim());
    }
    return executeSendTest(targetEmail);
  }

  async function executeSendTest(email) {
    setTesting(true);
    try {
      await api.post('/users/config/email-templates/test', {
        email,
        subject,
        bodyHtml
      });
      toast.success(`Test email successfully sent to ${email}! Check your inbox/spam.`);
    } catch (err) {
      const errMsg = err.response?.data?.error?.message || '';
      if (errMsg.includes('SMTP') || errMsg.includes('transport')) {
        toast((t) => (
          <span style={{ fontSize: 13, lineHeight: 1.4 }}>
            💡 <strong>Template Valid!</strong> But server SMTP credentials in <code>server/.env</code> are still the default placeholders. Configure your real SMTP credentials there to receive real emails!
          </span>
        ), { duration: 6000, icon: '⚠️' });
      } else {
        toast.error(errMsg || 'Failed to dispatch test email');
      }
    } finally {
      setTesting(false);
    }
  }

  function insertVariable(variable) {
    // Inserts at the end of body textarea
    setBodyHtml(prev => prev + ` ${variable} `);
  }

  if (loading) {
    return (
      <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div className="skeleton" style={{ height: 40, width: '30%' }} />
        <div className="skeleton" style={{ height: 320 }} />
      </div>
    );
  }

  const variableTokens = [
    { token: '{{candidateName}}', desc: 'Full name of candidate' },
    { token: '{{link}}', desc: 'Secure assessment execution link' },
    { token: '{{platformName}}', desc: 'AgnoHire custom system tag' },
    { token: '{{recruiterName}}', desc: 'Assigned recruiter name' },
    { token: '{{sectorName}}', desc: 'Assigned industrial sector' }
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Transactional Email Templates</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 4 }}>
            Customize dynamic auto-responder notifications, interview alerts, and decision templates
          </p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 20 }}>
        {/* Sidebar: List of templates */}
        <div className="card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <h3 style={{ fontSize: 13, fontWeight: 700, margin: '0 0 8px', color: 'var(--text-muted)' }}>Template Templates</h3>
          {templates.map(t => (
            <button
              key={t.id}
              onClick={() => selectTemplate(t)}
              className={`btn btn-block ${selectedTemplate?.id === t.id ? 'btn-primary' : 'btn-ghost'}`}
              style={{
                textAlign: 'left',
                justifyContent: 'flex-start',
                padding: '10px 14px',
                fontSize: 13,
                fontWeight: 600,
                border: '1px solid transparent',
                borderRadius: 10
              }}
            >
              <Mail size={14} style={{ marginRight: 8 }} />
              {t.name}
            </button>
          ))}
        </div>

        {/* Content: Selected template editor */}
        {selectedTemplate ? (
          <motion.div
            className="card"
            style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
          >
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Configure {selectedTemplate.name}</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 2 }}>Edit SMTP email templates utilizing markup tags</p>
            </div>

            {/* Insertion tokens */}
            <div>
              <h4 style={{ fontSize: 12, fontWeight: 700, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
                <Sparkles size={13} style={{ color: 'var(--color-brand)' }} />
                Click Dynamic Variable Pills to Insert:
              </h4>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {variableTokens.map(v => (
                  <button
                    key={v.token}
                    type="button"
                    onClick={() => insertVariable(v.token)}
                    className="badge badge-brand"
                    style={{ border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center' }}
                    title={v.desc}
                  >
                    {v.token}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <Input
                label="Email Subject Title"
                value={subject}
                onChange={e => setSubject(e.target.value)}
                required
              />

              <div className="input-group">
                <label className="label" style={{ fontWeight: 600, fontSize: 13, marginBottom: 6 }}>Email HTML Body Layout</label>
                <textarea
                  className="input"
                  style={{ minHeight: 280, fontFamily: 'DM Mono, Courier, monospace', fontSize: 13, lineHeight: '1.5' }}
                  value={bodyHtml}
                  onChange={e => setBodyHtml(e.target.value)}
                  required
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-color)', paddingTop: 20, marginTop: 12 }}>
              <Button variant="secondary" leftIcon={<Send size={14} />} onClick={handleSendTest} loading={testing}>
                Send Test Email
              </Button>
              <Button onClick={handleSave} loading={saving} leftIcon={<Check size={14} />}>
                Save Template Changes
              </Button>
            </div>
          </motion.div>
        ) : (
          <div className="card" style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>
            No Email Template Selected
          </div>
        )}
      </div>
    </div>
  );
}
