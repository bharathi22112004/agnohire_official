import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Settings, ShieldAlert, Check, RefreshCw, Save } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Input, Select } from '../../components/ui/Input';
import api from '../../services/api';
import toast from 'react-hot-toast';

export default function SystemConfig() {
  const [configs, setConfigs] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

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
    } catch (err) {
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
      toast.success('Setting updated successfully');
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Failed to update setting');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div className="skeleton" style={{ height: 40, width: '30%' }} />
        <div className="skeleton" style={{ height: 280 }} />
      </div>
    );
  }

  const sections = [
    {
      title: 'Platform Branding',
      items: [
        {
          key: 'platform_name',
          label: 'Platform Name',
          description: 'The title displayed in the header and navigation elements.',
          type: 'text',
        },
        {
          key: 'dark_mode_default',
          label: 'Default Dark Mode',
          description: 'Whether new accounts default to dark mode when registered.',
          type: 'boolean',
        },
      ],
    },
    {
      title: 'Limits & Allocation',
      items: [
        {
          key: 'max_admins_per_sector',
          label: 'Max Sector Admins',
          description: 'Maximum number of sector admin users that can be created per sector.',
          type: 'number',
        },
        {
          key: 'max_hrs_per_sector',
          label: 'Max Sector HRs',
          description: 'Maximum number of HR users that can be created per sector.',
          type: 'number',
        },
        {
          key: 'max_candidates_per_hr_upload',
          label: 'Max Bulk Upload Limit',
          description: 'Maximum candidates allowed in a single CSV file upload.',
          type: 'number',
        },
        {
          key: 'max_candidates_per_recruiter',
          label: 'Max Candidates per Recruiter',
          description: 'Maximum active candidates assigned to a single recruiter.',
          type: 'number',
        },
      ],
    },
    {
      title: 'AI & Interview System',
      items: [
        {
          key: 'ai_scoring_enabled',
          label: 'AI Grading & Sentiment',
          description: 'Enable automated grading and sentiment analysis on voice recordings.',
          type: 'boolean',
        },
        {
          key: 'interview_link_expiry_hours',
          label: 'Interview Token Expiry (Hours)',
          description: 'How long candidate secure interview links remain valid for execution.',
          type: 'number',
        },
      ],
    },
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">System Configurations</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 4 }}>
            Manage platform limits, security scopes, and engine parameters
          </p>
        </div>
        <Button variant="secondary" leftIcon={<RefreshCw size={15} />} onClick={load}>
          Sync Settings
        </Button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        {sections.map((section, idx) => (
          <motion.div
            key={section.title}
            className="card"
            style={{ padding: 24 }}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.08 }}
          >
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Settings size={18} style={{ color: 'var(--color-brand)' }} />
              {section.title}
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {section.items.map((item) => {
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
                      {item.type === 'text' && (
                        <input
                          className="input"
                          type="text"
                          value={currentVal}
                          onChange={(e) => setConfigs({ ...configs, [item.key]: e.target.value })}
                          onBlur={(e) => handleSave(item.key, e.target.value)}
                          style={{ width: 180, height: 38 }}
                        />
                      )}

                      {item.type === 'number' && (
                        <input
                          className="input"
                          type="number"
                          value={currentVal}
                          onChange={(e) => setConfigs({ ...configs, [item.key]: e.target.value })}
                          onBlur={(e) => {
                            const val = parseInt(e.target.value);
                            if (!isNaN(val)) handleSave(item.key, val);
                          }}
                          style={{ width: 100, height: 38 }}
                        />
                      )}

                      {item.type === 'boolean' && (
                        <Select
                          value={currentVal ? 'true' : 'false'}
                          onChange={(e) => handleSave(item.key, e.target.value === 'true')}
                          style={{ width: 100, height: 38, marginBottom: 0 }}
                        >
                          <option value="true">Enabled</option>
                          <option value="false">Disabled</option>
                        </Select>
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
        ))}
      </div>
    </div>
  );
}
