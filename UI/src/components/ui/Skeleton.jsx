import { cn } from '../../utils/cn';

export function Skeleton({ className = '', style = {} }) {
  return (
    <div
      className={cn('skeleton', className)}
      style={{ height: 16, borderRadius: 6, ...style }}
    />
  );
}

export function SkeletonCard() {
  return (
    <div className="card" style={{ padding: 24 }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16 }}>
        <Skeleton style={{ width: 40, height: 40, borderRadius: '50%' }} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <Skeleton style={{ width: '60%' }} />
          <Skeleton style={{ width: '40%', height: 12 }} />
        </div>
      </div>
      <Skeleton style={{ height: 12, marginBottom: 8 }} />
      <Skeleton style={{ height: 12, width: '80%' }} />
    </div>
  );
}

export function SkeletonTable({ rows = 5, cols = 5 }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${cols}, 1fr)`,
            gap: 16,
            padding: '14px 16px',
            borderBottom: '1px solid var(--border-color)',
          }}
        >
          {Array.from({ length: cols }).map((_, j) => (
            <Skeleton key={j} style={{ height: 14, width: j === 0 ? '80%' : '60%' }} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function SkeletonKPI() {
  return (
    <div className="kpi-card">
      <Skeleton style={{ width: 40, height: 40, borderRadius: 10, marginBottom: 16 }} />
      <Skeleton style={{ width: '50%', height: 32, marginBottom: 8 }} />
      <Skeleton style={{ width: '70%', height: 12 }} />
    </div>
  );
}
