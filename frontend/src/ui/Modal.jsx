import React, { useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';
import { cn } from './cn';
import { IconButton } from './Button';

/**
 * Modal dialog built on native <dialog>. The browser provides the focus trap,
 * Esc to close, inert background and top-layer stacking.
 * <Modal open={open} onClose={() => setOpen(false)} title="Evidence pack" footer={<Button>…</Button>}>…</Modal>
 */
export function Modal({ open, onClose, title, description, footer, size = 'md', children, className }) {
  const ref = useRef(null);
  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const width = { sm: 'max-w-md', md: 'max-w-xl', lg: 'max-w-3xl', xl: 'max-w-5xl' }[size];

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={description ? descId : undefined}
      onCancel={(e) => { e.preventDefault(); onClose?.(); }}
      onClick={(e) => { if (e.target === ref.current) onClose?.(); }}
      className={cn(
        'gg m-auto w-[calc(100%-2rem)] rounded-xl border border-line bg-surface p-0 text-fg shadow-lg',
        'backdrop:bg-overlay backdrop:backdrop-blur-[2px]',
        width,
        className,
      )}
    >
      {open && (
        <div className="flex max-h-[85vh] flex-col">
          <header className="flex items-start justify-between gap-4 border-b border-line px-6 py-4">
            <div>
              <h2 id={titleId} className="text-lg font-bold">{title}</h2>
              {description && <p id={descId} className="mt-1 text-sm text-muted">{description}</p>}
            </div>
            <IconButton label="Close dialog" size="sm" onClick={onClose}><X className="size-4" /></IconButton>
          </header>
          <div className="overflow-y-auto px-6 py-5">{children}</div>
          {footer && <footer className="flex justify-end gap-2 border-t border-line px-6 py-4">{footer}</footer>}
        </div>
      )}
    </dialog>
  );
}
