import React from 'react';
import { cn } from './cn';

const TONES = {
  neutral: 'bg-surface-2 text-muted border-line',
  brand: 'bg-primary-soft text-primary-soft-fg border-transparent',
  success: 'bg-success-bg text-success border-transparent',
  warning: 'bg-warning-bg text-warning border-transparent',
  danger: 'bg-danger-bg text-danger border-transparent',
  info: 'bg-info-bg text-info border-transparent',
};

/** Small label. <Badge tone="success">Compliant</Badge> */
export function Badge({ tone = 'neutral', className, children, ...props }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap',
        TONES[tone],
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}

/** Badge with a status dot. `pulse` animates the dot for live streams. */
export function StatusPill({ tone = 'success', pulse = false, children, className }) {
  const dot = {
    neutral: 'bg-subtle', brand: 'bg-primary', success: 'bg-success', warning: 'bg-warning', danger: 'bg-danger', info: 'bg-info',
  }[tone];
  return (
    <Badge tone={tone} className={className}>
      <span className="relative flex size-2" aria-hidden="true">
        {pulse && <span className={cn('absolute inline-flex size-full rounded-full opacity-60 animate-ping', dot)} />}
        <span className={cn('relative inline-flex size-2 rounded-full', dot)} />
      </span>
      {children}
    </Badge>
  );
}
