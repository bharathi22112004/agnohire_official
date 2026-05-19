import { cn, getStatusBadge } from '../../utils/cn';

export function Badge({ children, variant = 'neutral', className = '' }) {
  return (
    <span className={cn('badge', `badge-${variant}`, className)}>
      {children}
    </span>
  );
}

export function StatusBadge({ status }) {
  const label = status?.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
  const variant = getStatusBadge(status);
  return <Badge variant={variant.replace('badge-', '')}>{label}</Badge>;
}
