import React from 'react';
import { AlertTriangle, Inbox, Loader2, RotateCw } from 'lucide-react';
import { cn } from './cn';
import { Button } from './Button';

export function Spinner({ label = 'Loading', className }) {
  return (
    <span role="status" className={cn('inline-flex items-center gap-2 text-muted text-sm', className)}>
      <Loader2 className="size-5 animate-spin" aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </span>
  );
}

/** Shimmering placeholder block. Size it with classes: <Skeleton className="h-4 w-40" /> */
export function Skeleton({ className }) {
  return <span aria-hidden="true" className={cn('block rounded-md gg-skeleton', className)} />;
}

function StateFrame({ icon, title, description, action, tone = 'muted', className }) {
  return (
    <div className={cn('h-full w-full flex flex-col items-center justify-center text-center gap-3 p-6', className)}>
      <span
        className={cn(
          'flex size-12 items-center justify-center rounded-full',
          tone === 'danger' ? 'bg-danger-bg text-danger' : 'bg-surface-2 text-subtle',
        )}
        aria-hidden="true"
      >
        {icon}
      </span>
      <div className="max-w-sm">
        <p className="font-semibold text-fg">{title}</p>
        {description && <p className="text-sm text-muted mt-1">{description}</p>}
      </div>
      {action}
    </div>
  );
}

/** Centered loading state for a data view. */
export function LoadingState({ label = 'Loading data…', className }) {
  return (
    <div role="status" className={cn('h-full w-full flex flex-col items-center justify-center gap-3 text-muted', className)}>
      <Loader2 className="size-6 animate-spin" aria-hidden="true" />
      <span className="text-sm">{label}</span>
    </div>
  );
}

export function EmptyState({ icon = <Inbox className="size-6" />, title = 'Nothing here yet', description, action, className }) {
  return <StateFrame icon={icon} title={title} description={description} action={action} className={className} />;
}

export function ErrorState({ title = 'Something went wrong', description, onRetry, className }) {
  return (
    <div role="alert" className="h-full w-full">
      <StateFrame
        tone="danger"
        icon={<AlertTriangle className="size-6" />}
        title={title}
        description={description}
        className={className}
        action={onRetry && (
          <Button variant="secondary" size="sm" icon={<RotateCw className="size-4" aria-hidden="true" />} onClick={onRetry}>
            Try again
          </Button>
        )}
      />
    </div>
  );
}

/**
 * Picks the right state for a data view:
 * <DataState loading={l} error={e} empty={!rows.length} onRetry={reload}>…chart…</DataState>
 */
export function DataState({ loading, error, empty, onRetry, loadingLabel, emptyTitle, emptyDescription, children }) {
  if (loading) return <LoadingState label={loadingLabel} />;
  if (error) return <ErrorState description={typeof error === 'string' ? error : error?.message} onRetry={onRetry} />;
  if (empty) return <EmptyState title={emptyTitle} description={emptyDescription} />;
  return children;
}
