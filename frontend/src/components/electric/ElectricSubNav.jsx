import React from 'react';
import { BarChart3, BookOpen, ShieldCheck, Zap } from 'lucide-react';
import { cn } from '../../ui';

export const ELECTRIC_TABS = [
  { id: 'dashboard', label: 'Dashboard', icon: Zap },
  { id: 'trends', label: 'Trends & Analytics', icon: BarChart3 },
  { id: 'audit', label: 'GreenRE EE Audit', icon: ShieldCheck },
  { id: 'rules', label: 'Standards & Rules', icon: BookOpen },
];

export default function ElectricSubNav({ activeTab, onTabChange, className }) {
  return (
    <nav aria-label="Electric sections" className={cn('overflow-x-auto -mb-px', className)}>
      <ul className="flex items-center gap-1 border-b border-line min-w-max">
        {ELECTRIC_TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <li key={tab.id}>
              <button
                type="button"
                onClick={() => onTabChange(tab.id)}
                className={cn(
                  'relative inline-flex items-center gap-2 h-11 px-3.5 text-sm font-semibold transition-colors duration-fast cursor-pointer',
                  'after:absolute after:inset-x-2 after:-bottom-px after:h-0.5 after:rounded-full after:transition-colors',
                  isActive
                    ? 'text-fg after:bg-primary font-bold'
                    : 'text-muted hover:text-fg after:bg-transparent',
                )}
              >
                <Icon className={cn('size-4', isActive ? 'text-primary' : 'text-muted')} aria-hidden="true" />
                <span>{tab.label}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

