import React from 'react';
import { create } from 'zustand';
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';
import { cn } from './cn';

/**
 * Global toasts. Works from anywhere, including outside React components:
 *   import { toast } from '../ui';
 *   toast.success('Scan saved');  toast.error('Upload failed', { description: err.message });
 * <Toaster /> is mounted once in App.
 */
const useToastStore = create((set) => ({
  toasts: [],
  push: (t) => set((s) => ({ toasts: [...s.toasts.slice(-3), t] })),
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

let counter = 0;
function show(tone, title, { description, duration = 4500 } = {}) {
  const id = ++counter;
  useToastStore.getState().push({ id, tone, title, description });
  if (duration > 0) setTimeout(() => useToastStore.getState().dismiss(id), duration);
  return id;
}

export const toast = {
  info: (title, opts) => show('info', title, opts),
  success: (title, opts) => show('success', title, opts),
  warning: (title, opts) => show('warning', title, opts),
  error: (title, opts) => show('danger', title, { duration: 7000, ...opts }),
  dismiss: (id) => useToastStore.getState().dismiss(id),
};

const ICONS = {
  info: <Info className="size-5 text-info" />,
  success: <CheckCircle2 className="size-5 text-success" />,
  warning: <AlertTriangle className="size-5 text-warning" />,
  danger: <XCircle className="size-5 text-danger" />,
};

export function Toaster() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);
  return (
    <div
      aria-live="polite"
      aria-relevant="additions"
      className="gg-toaster pointer-events-none fixed bottom-4 right-4 z-[60] flex w-[min(380px,calc(100vw-2rem))] flex-col gap-2"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          role={t.tone === 'danger' ? 'alert' : 'status'}
          className={cn(
            'pointer-events-auto flex items-start gap-3 rounded-lg border border-line bg-surface p-4 shadow-lg',
            'animate-[gg-toast-in_var(--gg-dur-slow)_cubic-bezier(0.3,0,0,1)]',
          )}
        >
          <span className="mt-0.5 shrink-0" aria-hidden="true">{ICONS[t.tone]}</span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-fg">{t.title}</p>
            {t.description && <p className="mt-0.5 text-sm text-muted break-words">{t.description}</p>}
          </div>
          <button type="button" onClick={() => dismiss(t.id)} aria-label="Dismiss notification" className="shrink-0 rounded-sm p-0.5 text-subtle hover:text-fg">
            <X className="size-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
