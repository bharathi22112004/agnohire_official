import { getInitials } from '../../utils/cn';

const sizes = {
  sm:  { cls: 'avatar avatar-sm' },
  md:  { cls: 'avatar avatar-md' },
  lg:  { cls: 'avatar avatar-lg' },
  xl:  { cls: 'avatar avatar-xl' },
};

export function Avatar({ name, src, size = 'md', className = '' }) {
  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className={`${sizes[size].cls} ${className}`}
        style={{ objectFit: 'cover' }}
      />
    );
  }

  return (
    <div className={`${sizes[size].cls} ${className}`}>
      {getInitials(name)}
    </div>
  );
}
