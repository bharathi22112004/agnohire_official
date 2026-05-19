import { Avatar } from './Avatar';
import { Badge } from './Badge';

export function CandidateCard({ candidate }) {
  // Extracting details from candidate or using defaults
  const sector = candidate.sector?.name || 'Engineering';
  const experience = candidate.experience || 'Mid-Level';
  
  // Map status to dot color
  const getStatusColor = (status) => {
    switch(status) {
      case 'pending': return '#f59e0b';
      case 'assigned': return '#3b82f6';
      case 'scheduled': return '#6366f1';
      case 'interviewed': return '#a855f7';
      case 'passed': return '#10b981';
      case 'failed': return '#ef4444';
      default: return '#64748b';
    }
  };

  return (
    <div className="card card-hover" style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 16 }}>
      <div style={{ position: 'relative' }}>
        <Avatar name={candidate.name} size="md" />
        <div style={{
          position: 'absolute',
          bottom: 0,
          right: 0,
          width: 12,
          height: 12,
          borderRadius: '50%',
          background: getStatusColor(candidate.status),
          border: '2px solid var(--bg-surface)'
        }} title={`Status: ${candidate.status}`} />
      </div>

      <div style={{ flex: 1 }}>
        <h4 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>{candidate.name}</h4>
        <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>{candidate.email}</p>
        
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          <Badge variant="neutral" style={{ fontSize: 10, padding: '2px 6px' }}>{sector}</Badge>
          <Badge variant="brand" style={{ fontSize: 10, padding: '2px 6px' }}>{experience}</Badge>
        </div>
      </div>
    </div>
  );
}
