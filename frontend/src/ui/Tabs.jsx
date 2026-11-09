import React, { useId, useRef } from 'react';
import { NavLink } from 'react-router-dom';
import { cn } from './cn';

/**
 * Accessible tabs (WAI-ARIA tabs pattern, arrow-key navigation).
 * <Tabs value={tab} onChange={setTab} items={[{ value: 'live', label: 'Live', icon }, …]} />
 * Render the panel yourself, using `tabPanelProps(value)` for the ARIA wiring.
 */
export function Tabs({ items, value, onChange, size = 'md', className, label }) {
  const baseId = useId();
  const refs = useRef([]);

  const onKeyDown = (e, index) => {
    const last = items.length - 1;
    let next = null;
    if (e.key === 'ArrowRight') next = index === last ? 0 : index + 1;
    if (e.key === 'ArrowLeft') next = index === 0 ? last : index - 1;
    if (e.key === 'Home') next = 0;
    if (e.key === 'End') next = last;
    if (next === null) return;
    e.preventDefault();
    refs.current[next]?.focus();
    onChange(items[next].value);
  };

  return (
    <div role="tablist" aria-label={label} className={cn('inline-flex items-center gap-1 rounded-lg bg-surface-2 p-1', className)}>
      {items.map((item, i) => {
        const selected = item.value === value;
        return (
          <button
            key={item.value}
            ref={(el) => { refs.current[i] = el; }}
            role="tab"
            type="button"
            id={`${baseId}-tab-${item.value}`}
            aria-selected={selected}
            aria-controls={`${baseId}-panel-${item.value}`}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(item.value)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md font-semibold transition-[background-color,color,box-shadow] duration-fast ease-standard',
              size === 'sm' ? 'h-7 px-2.5 text-xs' : 'h-8 px-3.5 text-sm',
              selected ? 'bg-surface text-fg shadow-sm' : 'text-muted hover:text-fg',
            )}
          >
            {item.icon && <span aria-hidden="true">{item.icon}</span>}
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Router-aware sub-navigation for module sections (Water, Waste, …).
 * <NavTabs items={[{ to: '/water', label: 'Live', end: true }, …]} />
 */
export function NavTabs({ items, className, label = 'Section navigation' }) {
  return (
    <nav aria-label={label} className={cn('overflow-x-auto', className)}>
      <ul className="flex items-center gap-1 border-b border-line min-w-max">
        {items.map((item) => (
          <li key={item.to}>
            <NavLink
              to={item.to}
              end={item.end}
              className={({ isActive }) => cn(
                'relative inline-flex items-center gap-2 h-11 px-3.5 text-sm font-semibold transition-colors duration-fast',
                'after:absolute after:inset-x-2 after:-bottom-px after:h-0.5 after:rounded-full after:transition-colors',
                isActive ? 'text-fg after:bg-primary' : 'text-muted hover:text-fg after:bg-transparent',
              )}
            >
              {item.icon && <span aria-hidden="true">{item.icon}</span>}
              {item.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
