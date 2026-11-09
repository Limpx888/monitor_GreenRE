import React from 'react';
import { cn } from './cn';
import { Skeleton } from './Feedback';

/** Base surface. `interactive` adds hover elevation for clickable cards. */
export function Card({ as: Comp = 'div', interactive = false, padded = true, className, children, ...props }) {
  return (
    <Comp
      className={cn(
        'bg-surface border border-line rounded-lg shadow-xs',
        padded && 'p-5',
        interactive && 'transition-[box-shadow,transform,border-color] duration-base ease-standard hover:shadow-md hover:-translate-y-0.5 hover:border-line-strong cursor-pointer',
        className,
      )}
      {...props}
    >
      {children}
    </Comp>
  );
}

/** Title row for a Card: title, optional description, and right-aligned actions. */
export function CardHeader({ title, description, actions, icon, className }) {
  return (
    <div className={cn('flex items-start justify-between gap-4 mb-4', className)}>
      <div className="flex items-start gap-3 min-w-0">
        {icon && <span className="mt-0.5 text-muted shrink-0" aria-hidden="true">{icon}</span>}
        <div className="min-w-0">
          <h3 className="text-base font-bold text-fg leading-tight">{title}</h3>
          {description && <p className="text-sm text-muted mt-1">{description}</p>}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
}

const TONES = {
  neutral: 'text-muted',
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-danger',
  info: 'text-info',
};

/**
 * KPI tile: label, big tabular value with unit, optional footnote/trend.
 * <StatCard label="Total flow" value="41,486.120" unit="m³" icon={<Waves/>} hint="+0.4 m³ today" tone="success" />
 */
export function StatCard({ label, value, unit, icon, hint, tone = 'neutral', loading = false, accent, className }) {
  return (
    <Card className={cn('relative overflow-hidden', className)}>
      {accent && <span className="absolute inset-x-0 top-0 h-1" style={{ background: accent }} aria-hidden="true" />}
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</span>
        {icon && <span className="text-subtle" aria-hidden="true">{icon}</span>}
      </div>
      {loading ? (
        <Skeleton className="h-8 w-32 my-1" />
      ) : (
        <div className="font-mono tabular text-2xl font-bold text-fg leading-tight break-all">
          {value}
          {unit && <span className="ml-1.5 text-sm font-medium text-subtle">{unit}</span>}
        </div>
      )}
      {hint && <div className={cn('text-xs font-semibold mt-1.5', TONES[tone])}>{hint}</div>}
    </Card>
  );
}

/** Card wrapper for a chart: header + fixed-height body that handles loading/empty/error. */
export function ChartCard({ title, description, actions, height = 320, state, className, children }) {
  return (
    <Card className={className}>
      <CardHeader title={title} description={description} actions={actions} />
      <div style={{ height }} className="w-full">
        {state || children}
      </div>
    </Card>
  );
}
