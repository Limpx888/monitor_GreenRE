import React, { cloneElement, forwardRef, isValidElement, useId } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from './cn';

const FIELD = cn(
  'w-full h-10 rounded-md border border-line-strong bg-surface px-3 text-sm text-fg placeholder:text-subtle',
  'transition-[border-color,box-shadow] duration-fast ease-standard',
  'hover:border-subtle focus:border-primary focus:outline-none focus:shadow-ring',
  'disabled:opacity-50 disabled:cursor-not-allowed aria-[invalid=true]:border-danger',
);

/**
 * Label + control + hint/error, with ids wired for screen readers.
 * <Field label="Bin location" hint="Shown on reports" error={err}><Input … /></Field>
 */
export function Field({ label, hint, error, required, children, className }) {
  const id = useId();
  const hintId = `${id}-hint`;
  const describedBy = error || hint ? hintId : undefined;
  const control = isValidElement(children)
    ? cloneElement(children, { id, 'aria-describedby': describedBy, 'aria-invalid': error ? true : undefined, required })
    : children;
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {label && (
        <label htmlFor={id} className="text-sm font-semibold text-fg">
          {label}
          {required && <span className="text-danger ml-0.5" aria-hidden="true">*</span>}
        </label>
      )}
      {control}
      {(error || hint) && (
        <p id={hintId} className={cn('text-xs', error ? 'text-danger font-semibold' : 'text-muted')}>{error || hint}</p>
      )}
    </div>
  );
}

export const Input = forwardRef(function Input({ className, ...props }, ref) {
  return <input ref={ref} className={cn(FIELD, className)} {...props} />;
});

export const Textarea = forwardRef(function Textarea({ className, rows = 4, ...props }, ref) {
  return <textarea ref={ref} rows={rows} className={cn(FIELD, 'h-auto py-2', className)} {...props} />;
});

export const Select = forwardRef(function Select({ className, children, ...props }, ref) {
  return (
    <div className={cn('relative', className)}>
      <select ref={ref} className={cn(FIELD, 'appearance-none pr-9 cursor-pointer')} {...props}>
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-subtle" aria-hidden="true" />
    </div>
  );
});

/** Switch (role="switch"). <Toggle checked={on} onChange={setOn} label="Auto-scan" /> */
export function Toggle({ checked, onChange, label, description, disabled, className }) {
  const id = useId();
  return (
    <div className={cn('flex items-start justify-between gap-4', className)}>
      {(label || description) && (
        <label htmlFor={id} className="cursor-pointer">
          {label && <span className="block text-sm font-semibold text-fg">{label}</span>}
          {description && <span className="block text-xs text-muted mt-0.5">{description}</span>}
        </label>
      )}
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={!!checked}
        disabled={disabled}
        onClick={() => onChange?.(!checked)}
        className={cn(
          'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-base ease-standard',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          checked ? 'bg-primary' : 'bg-line-strong',
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            'inline-block size-5 rounded-full bg-white shadow-sm transition-transform duration-base ease-standard',
            checked ? 'translate-x-5.5' : 'translate-x-0.5',
          )}
        />
      </button>
    </div>
  );
}
