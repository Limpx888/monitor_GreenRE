import React, { useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';
import { cn } from './cn';
import { IconButton } from './Button';

/**
 * Slide-in side panel (non-modal: the page, e.g. the 3D building, stays interactive).
 * Esc closes it. Focus moves into the panel on open and back to the opener on close.
 * <SidePanel open={!!zone} onClose={clear} title="Zone C · Offices" subtitle="L4–L12">…</SidePanel>
 */
export function SidePanel({ open, onClose, title, subtitle, actions, width = 420, side = 'right', children, className }) {
  const panelRef = useRef(null);
  const openerRef = useRef(null);
  const titleId = useId();
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  useEffect(() => {
    if (!open) return undefined;
    openerRef.current = document.activeElement;
    // Focus the panel itself so screen readers announce the title
    const t = setTimeout(() => panelRef.current?.focus(), 30);
    const onKey = (e) => { if (e.key === 'Escape') onCloseRef.current?.(); };
    window.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(t);
      window.removeEventListener('keydown', onKey);
      if (openerRef.current instanceof HTMLElement && document.contains(openerRef.current)) openerRef.current.focus();
    };
  }, [open]);

  return (
    <aside
      ref={panelRef}
      role="complementary"
      aria-labelledby={titleId}
      aria-hidden={!open}
      inert={!open}
      tabIndex={-1}
      style={{ width: `min(${width}px, 100vw)` }}
      className={cn(
        'fixed top-0 bottom-0 z-40 flex flex-col bg-surface border-line shadow-lg outline-none',
        'transition-[transform,visibility] duration-slow ease-emphasized',
        side === 'right' ? 'right-0 border-l' : 'left-0 border-r',
        // `invisible` when closed keeps it out of the tab order and page width
        open ? 'translate-x-0 visible' : cn('invisible', side === 'right' ? 'translate-x-full' : '-translate-x-full'),
        className,
      )}
    >
      <header className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
        <div className="min-w-0">
          <h2 id={titleId} className="text-lg font-bold text-fg truncate">{title}</h2>
          {subtitle && <p className="text-sm text-muted mt-0.5">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {actions}
          <IconButton label="Close panel (Esc)" size="sm" onClick={onClose}><X className="size-4" /></IconButton>
        </div>
      </header>
      <div className="flex-1 overflow-y-auto px-5 py-4">{open && children}</div>
    </aside>
  );
}
