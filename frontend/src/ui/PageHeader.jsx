import React from 'react';
import { cn } from './cn';

/**
 * Consistent page title block.
 * <PageHeader eyebrow="Water" title="Live monitoring" description="…" actions={<Button/>} meta={<StatusPill/>} />
 */
export function PageHeader({ eyebrow, title, description, actions, meta, accent, className }) {
  return (
    <header className={cn('flex flex-wrap items-end justify-between gap-4 mb-6', className)}>
      <div className="min-w-0">
        {eyebrow && (
          <p className="mb-1 text-xs font-bold uppercase tracking-[0.14em]" style={{ color: accent || 'var(--gg-primary-soft-fg)' }}>
            {eyebrow}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-fg">{title}</h1>
          {meta}
        </div>
        {description && <p className="mt-1.5 max-w-2xl text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}
