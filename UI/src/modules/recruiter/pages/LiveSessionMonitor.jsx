/**
 * LiveSessionMonitor.jsx
 * Real-time view of all active candidate assessments for a recruiter.
 * Single-file component — no external sub-components.
 */

import { useState, useEffect, useRef, useCallback, Component } from 'react';
import { io } from 'socket.io-client';
import api from '../../../services/api';
import { useAuthStore } from '../../../store/authStore';

// ─── Error Boundary ───────────────────────────────────────────────────────────

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, message: error.message };
  }

  componentDidCatch(error, info) {
    console.error('[LiveSessionMonitor] Error boundary caught:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: 40, textAlign: 'center',
          background: 'rgba(244,63,94,0.06)',
          borderRadius: 16, border: '1px solid rgba(244,63,94,0.2)', margin: 24,
        }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>⚠️</div>
          <h3 style={{ color: 'var(--color-danger)', fontWeight: 700, marginBottom: 8 }}>Component Error</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{this.state.message}</p>
          <button
            onClick={() => this.setState({ hasError: false, message: '' })}
            style={{
              marginTop: 16, padding: '8px 20px', borderRadius: 8,
              background: 'var(--color-danger)', color: '#fff', border: 'none',
              cursor: 'pointer', fontWeight: 600, fontSize: 13,
            }}
          >
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getInitials(name) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

function formatDuration(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function parseTimeToMinutes(timeStr) {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

function getElapsedSeconds(startIso) {
  return Math.max(0, Math.floor((Date.now() - new Date(startIso).getTime()) / 1000));
}

function getRemainingSeconds(schedule, startIso) {
  if (!schedule) return 0;
  const durationSecs = (parseTimeToMinutes(schedule.timeEnd) - parseTimeToMinutes(schedule.timeStart)) * 60;
  const elapsed = startIso ? getElapsedSeconds(startIso) : 0;
  return Math.max(0, durationSecs - elapsed);
}

function getTotalDurationSeconds(schedule) {
  if (!schedule) return 3600;
  return Math.max(60, (parseTimeToMinutes(schedule.timeEnd) - parseTimeToMinutes(schedule.timeStart)) * 60);
}

function getProgressPercent(elapsed, total) {
  if (total === 0) return 0;
  return Math.min(100, Math.round((elapsed / total) * 100));
}

function getProgressColor(percent) {
  if (percent < 50) return '#16a34a';
  if (percent < 75) return '#d97706';
  return '#dc2626';
}

function getFlagBadgeStyle(count) {
  if (count === 0) return { background: 'rgba(22,163,74,0.1)', color: '#16a34a' };
  if (count < 3) return { background: 'rgba(217,119,6,0.1)', color: '#d97706' };
  return { background: 'rgba(220,38,38,0.1)', color: '#dc2626' };
}

function getSeverityColor(severity) {
  if (severity === 'high') return '#dc2626';
  if (severity === 'medium') return '#d97706';
  return '#2563eb';
}

function formatTime(isoString) {
  return new Date(isoString).toLocaleTimeString('en-IN', {
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

function formatViolationType(type) {
  return type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

// ─── Skeleton Card ────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div style={{
      background: 'var(--bg-surface)', border: '1px solid var(--border-color)',
      borderRadius: 16, padding: 20, display: 'flex', flexDirection: 'column', gap: 12,
      animation: 'pulse 1.5s ease-in-out infinite',
    }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--border-color)' }} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ height: 14, width: '60%', borderRadius: 6, background: 'var(--border-color)' }} />
          <div style={{ height: 11, width: '40%', borderRadius: 6, background: 'var(--border-color)' }} />
        </div>
      </div>
      <div style={{ height: 6, borderRadius: 4, background: 'var(--border-color)' }} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <div style={{ height: 40, borderRadius: 8, background: 'var(--border-color)' }} />
        <div style={{ height: 40, borderRadius: 8, background: 'var(--border-color)' }} />
      </div>
    </div>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KPICard({ label, value, icon, color, bgColor }) {
  return (
    <div style={{
      background: 'var(--bg-surface)', border: '1px solid var(--border-color)',
      borderRadius: 14, padding: '18px 20px',
      display: 'flex', alignItems: 'center', gap: 14,
    }}>
      <div style={{
        width: 44, height: 44, borderRadius: 12, background: bgColor,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 20, flexShrink: 0,
      }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize: 26, fontWeight: 800, color, lineHeight: 1 }}>{value}</div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3, fontWeight: 500 }}>{label}</div>
      </div>
    </div>
  );
}

// ─── Session Card ─────────────────────────────────────────────────────────────

function SessionCard({ interview, onClick }) {
  const violations = interview.violations ?? [];
  const answers = interview.answers ?? [];
  const flagCount = violations.length;
  const elapsed = interview.scheduledAt ? getElapsedSeconds(interview.scheduledAt) : 0;
  const totalDuration = getTotalDurationSeconds(interview.schedule);
  const remaining = getRemainingSeconds(interview.schedule, interview.scheduledAt);
  const progress = getProgressPercent(elapsed, totalDuration);
  const progressColor = getProgressColor(progress);
  const earnedPoints = answers.reduce((sum, a) => sum + (a.score ?? 0), 0);
  const maxPoints = answers.length * 10;
  const latestAnswer = answers[answers.length - 1];
  const currentQType = latestAnswer?.question?.type ?? 'text';
  const currentQDiff = latestAnswer?.question?.difficulty ?? 'medium';
  const cameraOk = interview.session?.cameraChecked ?? false;
  const initials = getInitials(interview.candidate.name);
  const domainName = interview.candidate.domain?.name ?? 'General';

  const [hovered, setHovered] = useState(false);

  return (
    <div
      onClick={() => onClick(interview)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: 'var(--bg-surface)',
        border: `1px solid ${flagCount >= 3 ? 'rgba(220,38,38,0.3)' : 'var(--border-color)'}`,
        borderRadius: 16, padding: 20, cursor: 'pointer',
        transition: 'all 0.2s ease',
        display: 'flex', flexDirection: 'column', gap: 14,
        position: 'relative', overflow: 'hidden',
        transform: hovered ? 'translateY(-2px)' : 'none',
        boxShadow: hovered ? '0 8px 32px rgba(0,0,0,0.12)' : 'none',
      }}
    >
      {/* Hover overlay */}
      {hovered && (
        <div style={{
          position: 'absolute', inset: 0, background: 'rgba(99,102,241,0.06)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          borderRadius: 16, zIndex: 2, pointerEvents: 'none',
        }}>
          <span style={{
            background: '#4f46e5', color: '#fff', padding: '8px 18px',
            borderRadius: 20, fontWeight: 700, fontSize: 13,
          }}>
            View Details →
          </span>
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <div style={{
            width: 44, height: 44, borderRadius: '50%',
            background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontWeight: 800, fontSize: 14, flexShrink: 0,
          }}>
            {initials}
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>
              {interview.candidate.name}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
              {domainName} · {interview.candidate.experienceLevel ?? 'mid'}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 4,
            background: 'rgba(220,38,38,0.1)', color: '#dc2626',
            padding: '3px 9px', borderRadius: 20, fontSize: 11, fontWeight: 800,
          }}>
            <span style={{
              width: 6, height: 6, borderRadius: '50%', background: '#dc2626',
              animation: 'livePulse 1.2s ease-in-out infinite', display: 'inline-block',
            }} />
            LIVE
          </div>
          <div style={{
            padding: '3px 9px', borderRadius: 20, fontSize: 11, fontWeight: 700,
            ...getFlagBadgeStyle(flagCount),
          }}>
            {flagCount} {flagCount === 1 ? 'flag' : 'flags'}
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>⏱ Elapsed: {formatDuration(elapsed)}</span>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Remaining: {formatDuration(remaining)}</span>
        </div>
        <div style={{ height: 6, borderRadius: 4, background: 'var(--border-color)', overflow: 'hidden' }}>
          <div style={{
            height: '100%', width: `${progress}%`, borderRadius: 4,
            background: progressColor, transition: 'width 1s ease',
          }} />
        </div>
        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4, textAlign: 'right' }}>
          {progress}% complete
        </div>
      </div>

      {/* Stats grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <div style={{
          padding: '10px 12px', borderRadius: 10,
          background: 'var(--bg-surface-2)', border: '1px solid var(--border-color)',
        }}>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 2 }}>QUESTIONS</div>
          <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)' }}>
            {answers.length}<span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-muted)' }}> answered</span>
          </div>
        </div>
        <div style={{
          padding: '10px 12px', borderRadius: 10,
          background: 'var(--bg-surface-2)', border: '1px solid var(--border-color)',
        }}>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 2 }}>LIVE SCORE</div>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#4f46e5' }}>
            {earnedPoints}<span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-muted)' }}>/{maxPoints}pts</span>
          </div>
        </div>
      </div>

      {/* Bottom row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 6 }}>
          <span style={{
            padding: '2px 8px', borderRadius: 6, fontSize: 10, fontWeight: 600,
            background: 'rgba(99,102,241,0.1)', color: '#4f46e5', textTransform: 'uppercase',
          }}>{currentQType}</span>
          <span style={{
            padding: '2px 8px', borderRadius: 6, fontSize: 10, fontWeight: 600, textTransform: 'capitalize',
            background: currentQDiff === 'hard' ? 'rgba(220,38,38,0.1)' : currentQDiff === 'medium' ? 'rgba(217,119,6,0.1)' : 'rgba(22,163,74,0.1)',
            color: currentQDiff === 'hard' ? '#dc2626' : currentQDiff === 'medium' ? '#d97706' : '#16a34a',
          }}>{currentQDiff}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: cameraOk ? '#16a34a' : '#dc2626' }}>
          <span>{cameraOk ? '🟢' : '🔴'}</span>
          <span style={{ fontWeight: 600 }}>{cameraOk ? 'Camera OK' : 'No Camera'}</span>
        </div>
      </div>
    </div>
  );
}

// ─── Session Modal ────────────────────────────────────────────────────────────

function SessionModal({ interview, onClose }) {
  const violations = interview.violations ?? [];
  const answers = interview.answers ?? [];
  const elapsed = interview.scheduledAt ? getElapsedSeconds(interview.scheduledAt) : 0;
  const totalDuration = getTotalDurationSeconds(interview.schedule);
  const remaining = getRemainingSeconds(interview.schedule, interview.scheduledAt);
  const progress = getProgressPercent(elapsed, totalDuration);
  const progressColor = getProgressColor(progress);
  const earnedPoints = answers.reduce((sum, a) => sum + (a.score ?? 0), 0);
  const maxPoints = answers.length * 10;
  const scorePercent = maxPoints > 0 ? Math.round((earnedPoints / maxPoints) * 100) : 0;
  const flagCount = violations.length;
  const initials = getInitials(interview.candidate.name);
  const tabSwitches = violations.filter(v => v.violationType === 'tab_switch').length;
  const copyPasteEvents = violations.filter(v => v.violationType === 'copy_paste').length;
  const cameraOk = interview.session?.cameraChecked ?? false;

  useEffect(() => {
    const handleKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20, animation: 'fadeIn 0.15s ease',
      }}
    >
      <div style={{
        background: 'var(--bg-surface)', borderRadius: 20,
        width: '100%', maxWidth: 780, maxHeight: '90vh', overflowY: 'auto',
        boxShadow: '0 24px 80px rgba(0,0,0,0.3)',
        animation: 'slideUp 0.2s ease',
      }}>

        {/* Modal Header */}
        <div style={{
          padding: '20px 24px', borderBottom: '1px solid var(--border-color)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          position: 'sticky', top: 0, background: 'var(--bg-surface)',
          borderRadius: '20px 20px 0 0', zIndex: 10,
        }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <div style={{
              width: 48, height: 48, borderRadius: '50%',
              background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', fontWeight: 800, fontSize: 16,
            }}>
              {initials}
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 16, color: 'var(--text-primary)' }}>
                {interview.candidate.name}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                {interview.candidate.domain?.name ?? 'General'} · {interview.candidate.email}
              </div>
            </div>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 4, marginLeft: 4,
              background: 'rgba(220,38,38,0.1)', color: '#dc2626',
              padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 800,
            }}>
              <span style={{
                width: 6, height: 6, borderRadius: '50%', background: '#dc2626',
                animation: 'livePulse 1.2s ease-in-out infinite', display: 'inline-block',
              }} />
              LIVE
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 32, height: 32, borderRadius: '50%',
              background: 'var(--border-color)', border: 'none', cursor: 'pointer',
              fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--text-primary)', flexShrink: 0,
            }}
          >✕</button>
        </div>

        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* KPI Tiles */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            {[
              { label: 'Elapsed', value: formatDuration(elapsed), color: '#2563eb', bg: 'rgba(37,99,235,0.08)', icon: '⏱' },
              { label: 'Remaining', value: formatDuration(remaining), color: '#16a34a', bg: 'rgba(22,163,74,0.08)', icon: '⏳' },
              { label: 'Questions', value: String(answers.length), color: '#7c3aed', bg: 'rgba(124,58,237,0.08)', icon: '📋' },
              {
                label: 'Score %', value: `${scorePercent}%`,
                color: scorePercent >= 60 ? '#16a34a' : '#dc2626',
                bg: scorePercent >= 60 ? 'rgba(22,163,74,0.08)' : 'rgba(220,38,38,0.08)',
                icon: '🎯',
              },
            ].map(tile => (
              <div key={tile.label} style={{
                padding: '14px 16px', borderRadius: 12,
                background: tile.bg, border: `1px solid ${tile.color}22`,
                display: 'flex', flexDirection: 'column', gap: 4,
              }}>
                <div style={{ fontSize: 18 }}>{tile.icon}</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: tile.color }}>{tile.value}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>{tile.label}</div>
              </div>
            ))}
          </div>

          {/* Time Progress */}
          <div style={{
            padding: '16px 18px', borderRadius: 12,
            background: 'var(--bg-surface-2)', border: '1px solid var(--border-color)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>Session Progress</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: progressColor }}>{progress}%</span>
            </div>
            <div style={{ height: 8, borderRadius: 4, background: 'var(--border-color)', overflow: 'hidden' }}>
              <div style={{
                height: '100%', width: `${progress}%`, borderRadius: 4,
                background: progressColor, transition: 'width 1s ease',
              }} />
            </div>
          </div>

          {/* Session Info Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            {[
              { label: 'Session ID', value: interview.id.slice(0, 8).toUpperCase(), danger: false },
              { label: 'Started', value: interview.scheduledAt ? formatTime(interview.scheduledAt) : '—', danger: false },
              { label: 'Duration', value: interview.schedule ? `${interview.schedule.timeStart} – ${interview.schedule.timeEnd}` : '—', danger: false },
              { label: 'Tab Switches', value: String(tabSwitches), danger: tabSwitches > 0 },
              { label: 'Copy-Paste', value: String(copyPasteEvents), danger: copyPasteEvents > 0 },
              { label: 'Camera', value: cameraOk ? 'Active' : 'Offline', danger: !cameraOk },
            ].map(item => (
              <div key={item.label} style={{
                padding: '12px 14px', borderRadius: 10,
                background: 'var(--bg-surface)', border: '1px solid var(--border-color)',
              }}>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 4, textTransform: 'uppercase' }}>
                  {item.label}
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: item.danger ? '#dc2626' : 'var(--text-primary)' }}>
                  {item.value}
                </div>
              </div>
            ))}
          </div>

          {/* Integrity Flags */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h4 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: 'var(--text-primary)' }}>
                🚨 Integrity Flags ({flagCount})
              </h4>
              {flagCount >= 3 && (
                <span style={{
                  background: 'rgba(220,38,38,0.1)', color: '#dc2626',
                  padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                }}>HIGH RISK</span>
              )}
            </div>
            {violations.length === 0 ? (
              <div style={{
                padding: 16, borderRadius: 10, background: 'rgba(22,163,74,0.06)',
                border: '1px solid rgba(22,163,74,0.2)',
                textAlign: 'center', fontSize: 13, color: '#16a34a', fontWeight: 600,
              }}>
                ✅ No integrity violations detected
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {violations.map(v => (
                  <div key={v.id} style={{
                    padding: '10px 14px', borderRadius: 10,
                    background: 'var(--bg-surface-2)', border: `1px solid ${getSeverityColor(v.severity)}22`,
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  }}>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                      <span style={{
                        width: 8, height: 8, borderRadius: '50%',
                        background: getSeverityColor(v.severity), display: 'inline-block', flexShrink: 0,
                      }} />
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                          {formatViolationType(v.violationType)}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{v.description}</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0, marginLeft: 12 }}>
                      <span style={{
                        padding: '2px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700,
                        textTransform: 'uppercase',
                        background: `${getSeverityColor(v.severity)}15`, color: getSeverityColor(v.severity),
                      }}>{v.severity}</span>
                      <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{formatTime(v.timestamp)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Question Breakdown */}
          <div>
            <h4 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 800, color: 'var(--text-primary)' }}>
              📝 Question Breakdown ({answers.length})
            </h4>
            {answers.length === 0 ? (
              <div style={{
                padding: 16, borderRadius: 10, background: 'var(--bg-surface-2)',
                border: '1px solid var(--border-color)',
                textAlign: 'center', fontSize: 13, color: 'var(--text-muted)',
              }}>
                No answers submitted yet
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {answers.map((ans, idx) => {
                  const scoreVal = ans.score ?? 0;
                  const timeSec = ans.timeTaken ?? 0;
                  return (
                    <div key={ans.id} style={{
                      padding: '14px 16px', borderRadius: 12,
                      background: 'var(--bg-surface-2)', border: '1px solid var(--border-color)',
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 8 }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>
                            Q{idx + 1} · <span style={{ textTransform: 'capitalize' }}>{ans.question?.type ?? 'text'}</span>
                            {' · '}
                            <span style={{
                              color: ans.question?.difficulty === 'hard' ? '#dc2626'
                                : ans.question?.difficulty === 'medium' ? '#d97706' : '#16a34a',
                              textTransform: 'capitalize',
                            }}>
                              {ans.question?.difficulty ?? 'medium'}
                            </span>
                            {timeSec > 0 && <span> · ⏱ {formatDuration(timeSec)}</span>}
                          </div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.4 }}>
                            {ans.question?.text ?? 'Question text unavailable'}
                          </div>
                        </div>
                        <div style={{
                          padding: '4px 10px', borderRadius: 8, fontWeight: 800, fontSize: 13, flexShrink: 0,
                          background: scoreVal >= 7 ? 'rgba(22,163,74,0.1)' : scoreVal >= 4 ? 'rgba(217,119,6,0.1)' : 'rgba(220,38,38,0.1)',
                          color: scoreVal >= 7 ? '#16a34a' : scoreVal >= 4 ? '#d97706' : '#dc2626',
                        }}>
                          {scoreVal}/10
                        </div>
                      </div>
                      {ans.answerText && (
                        <div style={{
                          fontSize: 12, color: 'var(--text-secondary)', fontStyle: 'italic',
                          background: 'var(--bg-surface)', padding: '8px 12px', borderRadius: 8,
                          overflow: 'hidden', display: '-webkit-box',
                          WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                        }}>
                          "{ans.answerText.slice(0, 200)}{ans.answerText.length > 200 ? '…' : ''}"
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div style={{
            display: 'flex', justifyContent: 'flex-end', gap: 10,
            paddingTop: 4, borderTop: '1px solid var(--border-color)',
          }}>
            <button
              onClick={onClose}
              style={{
                padding: '9px 20px', borderRadius: 10,
                background: 'var(--bg-surface-2)', border: '1px solid var(--border-color)',
                color: 'var(--text-primary)', fontWeight: 600, fontSize: 13, cursor: 'pointer',
              }}
            >Close</button>
            <button
              onClick={() => navigator.clipboard?.writeText(interview.id)}
              style={{
                padding: '9px 20px', borderRadius: 10,
                background: '#4f46e5', border: 'none',
                color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer',
              }}
            >Copy Session ID</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function LiveSessionMonitor() {
  const user = useAuthStore(s => s.user);

  const [sessions, setSessions] = useState([]);
  const [filter, setFilter] = useState('all');
  const [selectedSession, setSelectedSession] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState(null);
  const [lastRefreshTime, setLastRefreshTime] = useState(null);

  const socketRef = useRef(null);
  const intervalRef = useRef(null);
  const tickRef = useRef(null);
  const abortRef = useRef(null);
  const isMounted = useRef(true);

  // ── Fetch live sessions ──────────────────────────────────────────────────────
  const fetchLiveSessions = useCallback(async (silent = false) => {
    if (!user?.id) return;
    if (!silent) setIsLoading(true);
    setError(null);

    abortRef.current?.abort();
    abortRef.current = new AbortController();
    const timeout = setTimeout(() => abortRef.current?.abort(), 10_000);

    try {
      const res = await api.get('/interviews', {
        params: { status: 'in_progress', recruiterId: user.id },
        signal: abortRef.current.signal,
      });
      if (!isMounted.current) return;

      const raw = res.data?.data?.interviews ?? [];
      setSessions(raw.map(iv => ({ ...iv, violations: iv.violations ?? [], answers: iv.answers ?? [] })));
      setLastRefreshTime(new Date().toLocaleTimeString('en-IN', {
        hour: '2-digit', minute: '2-digit', second: '2-digit',
      }));
    } catch (err) {
      if (!isMounted.current) return;
      if (err?.name !== 'CanceledError' && err?.name !== 'AbortError') {
        setError(err?.message ?? 'Failed to fetch live sessions');
      }
    } finally {
      clearTimeout(timeout);
      if (isMounted.current) setIsLoading(false);
    }
  }, [user?.id]);

  // ── Fetch full detail for modal ──────────────────────────────────────────────
  const fetchSessionDetail = useCallback(async (id) => {
    try {
      const res = await api.get(`/interviews/${id}`);
      if (!isMounted.current) return;
      const detail = res.data?.data?.interview;
      if (detail) setSelectedSession(detail);
    } catch {
      // modal keeps cached data on error
    }
  }, []);

  // ── Socket setup ─────────────────────────────────────────────────────────────
  const setupSocketConnection = useCallback(() => {
    if (socketRef.current?.connected) return;
    const token = useAuthStore.getState().accessToken;
    if (!token) return;

    const socket = io(
      import.meta.env.VITE_SOCKET_URL ?? 'http://localhost:5000',
      { auth: { token }, transports: ['websocket'], reconnection: true, reconnectionAttempts: 5 }
    );

    socket.on('connect', () => { if (isMounted.current) setIsConnected(true); });
    socket.on('disconnect', () => { if (isMounted.current) setIsConnected(false); });

    socket.on('interview:started', () => fetchLiveSessions(true));

    socket.on('interview:completed', (data) => {
      if (!isMounted.current) return;
      setSessions(prev => prev.filter(s => s.id !== data.interviewId));
      setLastRefreshTime(new Date().toLocaleTimeString('en-IN', {
        hour: '2-digit', minute: '2-digit', second: '2-digit',
      }));
    });

    socket.on('interview:proctoring_alert', (data) => {
      if (!isMounted.current) return;
      setSessions(prev => prev.map(s =>
        s.id === data.interviewId
          ? { ...s, violations: [...(s.violations ?? []), data.violation] }
          : s
      ));
      setSelectedSession(prev =>
        prev?.id === data.interviewId
          ? { ...prev, violations: [...(prev.violations ?? []), data.violation] }
          : prev
      );
    });

    socketRef.current = socket;
  }, [fetchLiveSessions]);

  // ── KPI calculation ──────────────────────────────────────────────────────────
  const kpi = {
    active: sessions.length,
    warnings: sessions.reduce((sum, s) => sum + (s.violations?.length ?? 0), 0),
    highRisk: sessions.filter(s => (s.violations?.length ?? 0) >= 3).length,
    clean: sessions.filter(s => (s.violations?.length ?? 0) === 0).length,
  };

  // ── Filtered sessions ────────────────────────────────────────────────────────
  const filteredSessions = sessions.filter(s => {
    const flags = s.violations?.length ?? 0;
    if (filter === 'flagged') return flags > 0;
    if (filter === 'clean') return flags === 0;
    return true;
  });

  // ── Handlers ─────────────────────────────────────────────────────────────────
  const handleCardClick = useCallback((interview) => {
    setSelectedSession(interview);
    setIsModalOpen(true);
    fetchSessionDetail(interview.id);
  }, [fetchSessionDetail]);

  const handleRefresh = useCallback(() => fetchLiveSessions(false), [fetchLiveSessions]);

  // ── Lifecycle ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    isMounted.current = true;
    fetchLiveSessions();
    setupSocketConnection();

    // auto-refresh every 5 seconds
    intervalRef.current = setInterval(() => fetchLiveSessions(true), 5000);

    // tick every second for live timers
    tickRef.current = setInterval(() => {
      if (isMounted.current) setSessions(prev => [...prev]); // trigger re-render for timers
    }, 1000);

    return () => {
      isMounted.current = false;
      clearInterval(intervalRef.current);
      clearInterval(tickRef.current);
      abortRef.current?.abort();
      socketRef.current?.disconnect();
      socketRef.current = null;
    };
  }, [fetchLiveSessions, setupSocketConnection]);

  // ─── Render ──────────────────────────────────────────────────────────────────
  return (
    <ErrorBoundary>
      <style>{`
        @keyframes livePulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(0.8); }
        }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .live-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
        @media (max-width: 1024px) { .live-grid { grid-template-columns: repeat(2, 1fr) !important; } }
        @media (max-width: 640px)  { .live-grid { grid-template-columns: 1fr !important; } }
      `}</style>

      <div style={{ padding: '0 0 40px' }}>

        {/* Header */}
        <div style={{
          display: 'flex', justifyContent: 'space-between',
          alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 12,
        }}>
          <div>
            <h1 className="page-title">Live Session Monitor</h1>
            <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>
              Real-time view of all active candidate assessments
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '6px 14px', borderRadius: 20,
              background: isConnected ? 'rgba(22,163,74,0.08)' : 'rgba(107,114,128,0.08)',
              border: `1px solid ${isConnected ? 'rgba(22,163,74,0.2)' : 'rgba(107,114,128,0.2)'}`,
              fontSize: 12, fontWeight: 600,
              color: isConnected ? '#16a34a' : '#6b7280',
            }}>
              <span style={{
                width: 7, height: 7, borderRadius: '50%',
                background: isConnected ? '#16a34a' : '#9ca3af', display: 'inline-block',
                animation: isConnected ? 'livePulse 2s ease-in-out infinite' : 'none',
              }} />
              {isConnected ? 'Connected' : 'Offline'}
            </div>
            {lastRefreshTime && (
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                Updated {lastRefreshTime}
              </span>
            )}
            <button
              onClick={handleRefresh}
              disabled={isLoading}
              style={{
                padding: '7px 16px', borderRadius: 10,
                background: '#4f46e5', border: 'none',
                color: '#fff', fontWeight: 700, fontSize: 13,
                cursor: isLoading ? 'not-allowed' : 'pointer',
                opacity: isLoading ? 0.7 : 1,
                display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              <span style={{ display: 'inline-block', animation: isLoading ? 'spin 1s linear infinite' : 'none' }}>↻</span>
              Refresh
            </button>
          </div>
        </div>

        {/* Error Banner */}
        {error && (
          <div style={{
            padding: '12px 16px', borderRadius: 10, marginBottom: 20,
            background: 'rgba(220,38,38,0.06)', border: '1px solid rgba(220,38,38,0.2)',
            color: '#dc2626', fontSize: 13, fontWeight: 600,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            ⚠️ {error}
            <button onClick={() => setError(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: '#dc2626' }}>✕</button>
          </div>
        )}

        {/* KPI Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 24 }}>
          <KPICard label="Active Sessions" value={kpi.active}   icon="🎯" color="#2563eb" bgColor="rgba(37,99,235,0.08)" />
          <KPICard label="Integrity Flags" value={kpi.warnings} icon="⚠️" color="#d97706" bgColor="rgba(217,119,6,0.08)" />
          <KPICard label="High Risk"        value={kpi.highRisk} icon="🚨" color="#dc2626" bgColor="rgba(220,38,38,0.08)" />
          <KPICard label="Clean Sessions"   value={kpi.clean}    icon="✅" color="#16a34a" bgColor="rgba(22,163,74,0.08)" />
        </div>

        {/* Filter Tabs */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          marginBottom: 20, flexWrap: 'wrap', gap: 10,
        }}>
          <div style={{ display: 'flex', gap: 4 }}>
            {['all', 'flagged', 'clean'].map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                style={{
                  padding: '7px 18px', borderRadius: 20,
                  border: filter === f ? 'none' : '1px solid var(--border-color)',
                  background: filter === f ? '#4f46e5' : 'transparent',
                  color: filter === f ? '#fff' : 'var(--text-secondary)',
                  fontWeight: 700, fontSize: 13, cursor: 'pointer',
                  transition: 'all 0.15s', textTransform: 'capitalize',
                }}
              >
                {f}
                {f === 'all'     && ` (${sessions.length})`}
                {f === 'flagged' && ` (${sessions.filter(s => (s.violations?.length ?? 0) > 0).length})`}
                {f === 'clean'   && ` (${kpi.clean})`}
              </button>
            ))}
          </div>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            Showing {filteredSessions.length} of {sessions.length} sessions
          </span>
        </div>

        {/* Grid */}
        {isLoading ? (
          <div className="live-grid">
            {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : filteredSessions.length === 0 ? (
          <div style={{
            padding: '60px 24px', textAlign: 'center',
            background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: 16,
          }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>
              {filter === 'flagged' ? '🛡️' : filter === 'clean' ? '✅' : '📭'}
            </div>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>
              {filter === 'all' ? 'No Active Sessions' : filter === 'flagged' ? 'No Flagged Sessions' : 'No Clean Sessions'}
            </h3>
            <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              {filter === 'all'
                ? 'No interviews are currently in progress. Sessions will appear here automatically when candidates start.'
                : `No sessions match the "${filter}" filter right now.`}
            </p>
            {filter !== 'all' && (
              <button
                onClick={() => setFilter('all')}
                style={{
                  marginTop: 16, padding: '8px 20px', borderRadius: 10,
                  background: '#4f46e5', border: 'none',
                  color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer',
                }}
              >Show All Sessions</button>
            )}
          </div>
        ) : (
          <div className="live-grid">
            {filteredSessions.map(session => (
              <SessionCard key={session.id} interview={session} onClick={handleCardClick} />
            ))}
          </div>
        )}
      </div>

      {/* Modal */}
      {isModalOpen && selectedSession && (
        <SessionModal
          interview={selectedSession}
          onClose={() => { setIsModalOpen(false); setSelectedSession(null); }}
        />
      )}
    </ErrorBoundary>
  );
}
