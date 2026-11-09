import React, { forwardRef } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from './cn';

const VARIANTS = {
  primary: 'bg-primary text-on-brand hover:bg-primary-hover shadow-xs',
  secondary: 'bg-surface text-fg border border-line-strong hover:bg-surface-2 shadow-xs',
  ghost: 'bg-transparent text-fg hover:bg-surface-2',
  soft: 'bg-primary-soft text-primary-soft-fg hover:brightness-95',
  danger: 'bg-danger text-white hover:brightness-110 shadow-xs dark:text-[#1a0505]',
};

const SIZES = {
  sm: 'h-8 px-3 text-sm gap-1.5 rounded-md',
  md: 'h-10 px-4 text-sm gap-2 rounded-md',
  lg: 'h-12 px-6 text-base gap-2 rounded-lg',
};

/**
 * <Button variant="primary|secondary|ghost|soft|danger" size="sm|md|lg" loading icon={<Icon/>}>
 * Pass `as={Link}` (or 'a') to render a router link with button styling.
 */
export const Button = forwardRef(function Button(
  { as: Comp = 'button', variant = 'primary', size = 'md', loading = false, icon, iconRight, className, children, disabled, ...props },
  ref,
) {
  const isButton = Comp === 'button';
  return (
    <Comp
      ref={ref}
      className={cn(
        'inline-flex items-center justify-center font-semibold whitespace-nowrap select-none',
        'transition-[background-color,box-shadow,filter,transform] duration-fast ease-standard active:scale-[0.98]',
        'disabled:opacity-50 disabled:pointer-events-none',
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...(isButton ? { type: props.type || 'button', disabled: disabled || loading } : { 'aria-disabled': disabled || undefined })}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : icon}
      {children}
      {iconRight}
    </Comp>
  );
});

/** Square icon-only button. `label` is required for screen readers. */
export const IconButton = forwardRef(function IconButton(
  { label, variant = 'ghost', size = 'md', className, children, ...props },
  ref,
) {
  const dims = { sm: 'size-8', md: 'size-10', lg: 'size-12' }[size];
  return (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex items-center justify-center rounded-md transition-colors duration-fast ease-standard',
        'disabled:opacity-50 disabled:pointer-events-none',
        VARIANTS[variant],
        dims,
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
});
