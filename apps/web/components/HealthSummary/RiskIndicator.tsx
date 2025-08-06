'use client';

interface RiskIndicatorProps {
  level: 'green' | 'amber' | 'red';
  label: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  'data-testid'?: string;
}

const colors = {
  green: {
    bg: 'bg-emerald-500',
    text: 'text-emerald-800',
    bgLight: 'bg-emerald-100',
    border: 'border-emerald-300',
  },
  amber: {
    bg: 'bg-amber-500',
    text: 'text-amber-800',
    bgLight: 'bg-amber-100',
    border: 'border-amber-300',
  },
  red: {
    bg: 'bg-red-500',
    text: 'text-red-800',
    bgLight: 'bg-red-100',
    border: 'border-red-300',
  },
};

const sizes = {
  sm: {
    container: 'px-2 py-1',
    text: 'text-xs',
    dot: 'w-2 h-2',
  },
  md: {
    container: 'px-3 py-1.5',
    text: 'text-sm',
    dot: 'w-3 h-3',
  },
  lg: {
    container: 'px-4 py-2',
    text: 'text-base',
    dot: 'w-4 h-4',
  },
};

export default function RiskIndicator({ 
  level, 
  label, 
  size = 'md', 
  className = '',
  'data-testid': dataTestId,
  ...props
}: RiskIndicatorProps) {
  const color = colors[level];
  const sizeConfig = sizes[size];

  return (
    <div 
      className={`
        inline-flex items-center gap-2 rounded-full font-medium border
        ${color.bgLight} ${color.text} ${color.border}
        ${sizeConfig.container} ${sizeConfig.text}
        ${className}
      `}
      data-testid={dataTestId}
      role="status"
      aria-label={`Risk level: ${label}`}
      {...props}
    >
      <div 
        className={`
          rounded-full ${color.bg} ${sizeConfig.dot}
        `}
        aria-hidden="true"
      />
      <span>{label}</span>
    </div>
  );
}
