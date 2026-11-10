import React, { useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  AlertTriangle,
  Building2,
  CalendarCheck,
  DollarSign,
  Droplets,
  FileBarChart,
  Leaf,
  Menu,
  Monitor,
  Moon,
  Recycle,
  Sun,
  Wind,
  X,
  Zap,
} from 'lucide-react';
import { useTheme } from '../design/theme';
import { cn, IconButton } from '../ui';

/** Every module reachable from the home page and the top nav, sorted by GreenRE importance hierarchy. */
export const MODULES = [
  { to: '/electric', label: 'Electric', icon: Zap, accent: 'var(--gg-energy)' },
  { to: '/water', label: 'Water', icon: Droplets, accent: 'var(--gg-water)' },
  { to: '/indoor', label: 'Indoor', icon: Wind, accent: 'var(--gg-energy)' },
  { to: '/carbon', label: 'Carbon', icon: Leaf, accent: '#a3e635' },
  { to: '/waste', label: 'Waste', icon: Recycle, accent: 'var(--gg-waste)' },
  { to: '/reservations', label: 'Reserve', icon: CalendarCheck, accent: 'var(--gg-reserve)' },
  { to: '/executive', label: 'Executive & Reports', icon: DollarSign, accent: 'var(--gg-energy)' },
  { to: '/digital-twin', label: 'Digital Twin', icon: Building2, accent: 'var(--gg-warning)' },
];

const THEME_META = {
  system: { icon: Monitor, label: 'Theme: system (click for light)' },
  light: { icon: Sun, label: 'Theme: light (click for dark)' },
  dark: { icon: Moon, label: 'Theme: dark (click for system)' },
};

export function ThemeToggle({ className }) {
  const preference = useTheme((s) => s.preference);
  const cycle = useTheme((s) => s.cycle);
  const { icon: Icon, label } = THEME_META[preference];
  return (
    <IconButton label={label} onClick={cycle} className={className}>
      <Icon className="size-[18px]" />
    </IconButton>
  );
}

export function Brand({ compact = false }) {
  return (
    <Link to="/" className="flex items-center gap-2.5 rounded-md" aria-label="GoGreen home" title="Back to home">
      <img src="/gogreen-logo-128.jpg" alt="" className="size-9 rounded-md object-cover ring-1 ring-line" />
      {!compact && (
        <span className="leading-tight">
          <span className="block text-sm font-extrabold tracking-[0.12em] text-fg">GOGREEN</span>
          <span className="block text-[11px] font-medium text-muted">The Light City Penang</span>
        </span>
      )}
    </Link>
  );
}

function NavItem({ item, onNavigate }) {
  const Icon = item.icon;
  return (
    <NavLink
      to={item.to}
      end={item.end}
      onClick={onNavigate}
      className={({ isActive }) => cn(
        'group inline-flex items-center gap-2 rounded-md px-3 h-9 text-sm font-semibold transition-colors duration-fast ease-standard',
        isActive ? 'bg-surface-2 text-fg' : 'text-muted hover:text-fg hover:bg-surface-2',
      )}
    >
      {({ isActive }) => (
        <>
          <Icon className="size-4" style={{ color: isActive ? item.accent : undefined }} aria-hidden="true" />
          {item.label}
        </>
      )}
    </NavLink>
  );
}

/**
 * App frame shared by every route: skip link, sticky top nav, optional module
 * sub-nav, and the page content (children or nested <Outlet/>).
 * `fullBleed` removes the max-width container (used by the 3D digital twin).
 */
export default function AppShell({ subnav, fullBleed = false, children }) {
  const location = useLocation();
  // The menu belongs to the route it was opened on, so navigating closes it.
  const [menuPath, setMenuPath] = useState(null);
  const menuOpen = menuPath === location.pathname;
  const setMenuOpen = (next) => {
    const open = typeof next === 'function' ? next(menuOpen) : next;
    setMenuPath(open ? location.pathname : null);
  };

  return (
    <div className="gg min-h-screen flex flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-3 focus:z-[70] focus:rounded-md focus:bg-surface focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:shadow-lg"
      >
        Skip to content
      </a>

      <header className="sticky top-0 z-30 border-b border-line bg-surface/85 backdrop-blur-md supports-[backdrop-filter]:bg-surface/75">
        <div className="mx-auto flex h-16 max-w-[1600px] items-center gap-4 px-4 sm:px-6">
          <Brand />

          <nav aria-label="Modules" className="ml-4 hidden lg:block">
            <ul className="flex items-center gap-1">
              {MODULES.map((m) => <li key={m.to}><NavItem item={m} /></li>)}
            </ul>
          </nav>

          {/* Global State Defense: Real vs Simulated Isolation Badge */}
          <div className="ml-auto flex items-center gap-3">
            {location.pathname.startsWith('/digital-twin') || location.pathname.startsWith('/twin') ? (
              <div
                role="status"
                className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-amber-500/50 bg-amber-500/15 px-3 py-1 text-xs font-extrabold text-amber-500 shadow-sm animate-pulse tracking-wide"
                title="Scenario Demo Hub: Offline sandbox for fault injection & control loop demonstration"
              >
                <span className="size-2 rounded-full bg-amber-500" />
                ⚠️ SCENARIO DEMO MODE (SIMULATED)
              </div>
            ) : (
              <div
                role="status"
                className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-500 shadow-sm tracking-wide"
                title="Telemetry connected to Azure Event Hubs live production stream"
              >
                <span className="relative flex size-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
                </span>
                🟢 LIVE AZURE STREAM (PRODUCTION)
              </div>
            )}

            <ThemeToggle />
            <IconButton
              label={menuOpen ? 'Close menu' : 'Open menu'}
              className="lg:hidden"
              aria-expanded={menuOpen}
              aria-controls="gg-mobile-nav"
              onClick={() => setMenuOpen((v) => !v)}
            >
              {menuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
            </IconButton>
          </div>
        </div>

        {menuOpen && (
          <nav id="gg-mobile-nav" aria-label="Modules" className="lg:hidden border-t border-line px-4 py-3">
            <ul className="flex flex-col gap-1">
              {MODULES.map((m) => <li key={m.to}><NavItem item={m} onNavigate={() => setMenuOpen(false)} /></li>)}
            </ul>
          </nav>
        )}

        {subnav && <div className="mx-auto max-w-[1600px] px-4 sm:px-6">{subnav}</div>}
      </header>

      <main
        id="main"
        tabIndex={-1}
        key={location.pathname}
        className={cn('gg-page-enter flex-1 outline-none', fullBleed ? 'relative' : 'mx-auto w-full max-w-[1600px] px-4 sm:px-6 py-6 sm:py-8')}
      >
        {children ?? <Outlet />}
      </main>
    </div>
  );
}
