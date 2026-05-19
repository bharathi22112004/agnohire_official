import { cn } from '../../utils/cn';

export function Input({
  label,
  error,
  helper,
  className = '',
  leftIcon,
  rightIcon,
  id,
  style,
  ...props
}) {
  const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');

  return (
    <div className="input-wrapper">
      {label && (
        <label htmlFor={inputId} className="input-label">
          {label}
        </label>
      )}
      <div style={{ position: 'relative' }}>
        {leftIcon && (
          <span style={{
            position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
            color: 'var(--text-muted)', pointerEvents: 'none',
          }}>
            {leftIcon}
          </span>
        )}
        <input
          id={inputId}
          className={cn('input', error && 'error', className)}
          style={{
            paddingLeft: leftIcon ? 38 : undefined,
            paddingRight: rightIcon ? 38 : undefined,
            ...style
          }}
          {...props}
        />
        {rightIcon && (
          <span style={{
            position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
            color: 'var(--text-muted)',
          }}>
            {rightIcon}
          </span>
        )}
      </div>
      {helper && !error && <span className="input-helper">{helper}</span>}
      {error && <span className="input-error">{error}</span>}
    </div>
  );
}

export function Select({ label, error, children, className = '', id, style, ...props }) {
  const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');
  return (
    <div className="input-wrapper">
      {label && <label htmlFor={inputId} className="input-label">{label}</label>}
      <select
        id={inputId}
        className={cn('input', error && 'error', className)}
        style={{ cursor: 'pointer', ...style }}
        {...props}
      >
        {children}
      </select>
      {error && <span className="input-error">{error}</span>}
    </div>
  );
}

export function Textarea({ label, error, helper, className = '', id, style, ...props }) {
  const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');
  return (
    <div className="input-wrapper">
      {label && <label htmlFor={inputId} className="input-label">{label}</label>}
      <textarea
        id={inputId}
        className={cn('input', error && 'error', className)}
        style={{ resize: 'vertical', minHeight: 100, ...style }}
        {...props}
      />
      {helper && !error && <span className="input-helper">{helper}</span>}
      {error && <span className="input-error">{error}</span>}
    </div>
  );
}
