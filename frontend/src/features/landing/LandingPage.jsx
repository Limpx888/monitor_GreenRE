import React, { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Activity, ArrowRight, BrainCircuit, Building2, CalendarCheck, ChevronDown, DollarSign, Droplets, FileBarChart, Leaf, Radio, Recycle, ShieldCheck, Wind, Zap,
} from 'lucide-react';
import { Brand, MODULES } from '../../layouts/AppShell';
import { Button, StatusPill, cn } from '../../ui';
import { detectTier, prefersReducedMotion } from '../building3d/capabilities';
import { useWaterLiveStore } from '../../stores/waterLiveStore';
import { useScrollStory } from './useScrollStory';
import { useIeqLive, useSustainability } from '../modules/useModuleData';

const LightCityCanvas = lazy(() => import('../building3d/LightCityCanvas'));

const HEADLINE = 'Continuous GreenRE compliance for living buildings.';

const PROBLEMS = [
  { icon: Zap, title: 'Energy drift', text: 'Chillers and AHUs lose efficiency between audits, and nobody notices until the bill arrives.' },
  { icon: Droplets, title: 'Hidden water loss', text: 'Leaks and over-irrigation disappear inside monthly meter totals.' },
  { icon: Recycle, title: 'Contaminated recycling', text: 'One wrong item spoils a bin and quietly sinks diversion targets.' },
];

const STEPS = [
  { n: '01', icon: Radio, title: 'Sense', text: 'Smart meters, BMS points and cameras stream telemetry over MQTT and Azure Event Hubs.' },
  { n: '02', icon: BrainCircuit, title: 'Understand', text: 'DuckDB analytics and NILM disaggregation break consumption down by zone, floor and system, against GreenRE criteria.' },
  { n: '03', icon: ShieldCheck, title: 'Act', text: 'Rules flag breaches as they happen. AI explains the root cause with cited standards and exports audit-ready evidence.' },
];

const FEATURES = [
  { id: 'electric', to: '/electric', icon: Zap, title: 'Electric power', text: '24-hour total load curves, rush-hour peak demand, and live cost rates.', accent: '#3b82f6' },
  { id: 'water', to: '/water', icon: Droplets, title: 'Water management', text: 'Live sub-metering, leak detection and WE-credit tracking.', accent: 'var(--gg-water)' },
  { id: 'indoor', to: '/indoor', icon: Wind, title: 'Indoor environment', text: 'Live floor-by-floor CO₂ and PM2.5 checked against GreenRE EQ-3.', accent: '#34d399' },
  { id: 'carbon', to: '/carbon', icon: Leaf, title: 'Carbon dioxide', text: 'Operational CO₂e before and after automated HVAC and lighting control.', accent: '#a3e635' },
  { id: 'waste', to: '/waste', icon: Recycle, title: 'Waste management', text: 'Camera AI classifies items, guides disposal and tracks diversion.', accent: 'var(--gg-waste)' },
  { id: 'reserve', to: '/reservations', icon: CalendarCheck, title: 'Reserve management', text: 'Space bookings that drive HVAC and lighting schedules.', accent: 'var(--gg-reserve)' },
  { id: 'executive', to: '/executive', icon: DollarSign, title: 'Executive & Reports', text: 'Dual-purpose enterprise cost ROI, multi-period audit analytics & AI executive summary.', accent: '#10b981' },
  { id: 'twin', to: '/digital-twin', icon: Building2, title: 'Scenario Demo Hub', text: '3D building sandbox with fault injection and operator control loop.', accent: '#f59e0b' },
];

/** One live figure per module card, so the home page works as the dashboard. */
function useFeatureStats() {
  const ieq = useIeqLive(8000);
  const carbon = useSustainability();
  const waterKpi = useWaterLiveStore((s) => s.kpi);
  const waterOpen = useWaterLiveStore((s) => s.status) === 'open';
  const ieqAlerts = ieq.data?.exceeded_floors?.length ?? 0;
  return {
    electric: { value: '948 kW', label: 'live demand · RM 482/h', tone: 'success' },
    indoor: ieq.data
      ? { value: `${Math.round(ieq.data.max_co2)} ppm`, label: ieqAlerts ? `peak CO₂ · ${ieqAlerts} floor alert${ieqAlerts > 1 ? 's' : ''}` : 'peak CO₂ · all floors compliant', tone: ieqAlerts ? 'danger' : 'success' }
      : { value: ieq.error ? 'Offline' : '…', label: 'peak CO₂' },
    executive: { value: 'RM 114k', label: 'verified ROI · 61.8 t CO₂e', tone: 'success' },
    roi: { value: 'RM 114k', label: 'verified net ROI', tone: 'success' },
    carbon: carbon.data
      ? { value: `${(carbon.data.total_co2e_saved_kg / 1000).toFixed(1)} t`, label: 'CO₂e avoided per month', tone: 'success' }
      : { value: carbon.error ? 'Offline' : '…', label: 'CO₂e avoided per month' },
    water: waterOpen && waterKpi?.active_meters > 0
      ? { value: `${waterKpi.total_flow_m3_per_hr.toFixed(2)} m³/h`, label: `live flow · ${waterKpi.active_meters} meters`, tone: 'success' }
      : { value: '…', label: 'live flow' },
    waste: { value: 'AI scan', label: 'camera classification' },
    reserve: { value: 'Book', label: 'rooms, halls and courts' },
    twin: { value: 'Demo 3D', label: 'fault injection sandbox' },
    reports: { value: 'PDF', label: 'AI summary · Azure archive' },
  };
}

/** Every module, one click from the top of the home page. */
function ModuleNav({ onOpen, className }) {
  return (
    <nav aria-label="Modules" className={className}>
      <ul className="flex min-w-max items-center gap-1">
        {MODULES.map(({ to, label, icon: Icon, accent }) => (
          <li key={to}>
            <a
              href={to}
              onClick={(e) => { e.preventDefault(); onOpen(to); }}
              className="group inline-flex h-9 items-center gap-2 rounded-md px-3 text-sm font-semibold text-[#d5e3dc] transition-colors duration-fast hover:bg-white/10 hover:text-white"
            >
              <Icon className="size-4 opacity-80 group-hover:opacity-100" style={{ color: accent }} aria-hidden="true" />
              {label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function Poster({ visible }) {
  return (
    <div
      aria-hidden="true"
      className={cn('absolute inset-0 transition-opacity duration-[1200ms] ease-standard', visible ? 'opacity-100' : 'opacity-0')}
      style={{ background: 'linear-gradient(180deg, #0a2430 0%, #1d4c56 38%, #3f7f7a 58%, #f0b48f 74%, #0b2c31 75%, #06191c 100%)' }}
    >
      <img
        src="/landing-poster.jpg"
        fetchPriority="high"
        alt=""
        className="h-full w-full object-cover"
        onError={(e) => { e.currentTarget.style.display = 'none'; }}
      />
    </div>
  );
}

function SectionPanel({ align = 'left', className, children }) {
  return (
    <div className={cn('mx-auto flex w-full max-w-[1400px] px-5 sm:px-10', align === 'right' ? 'justify-end' : align === 'center' ? 'justify-center' : 'justify-start')}>
      <div
        data-reveal
        className={cn(
          'w-full max-w-xl rounded-xl border border-white/10 bg-[rgb(8_18_15/0.72)] p-6 sm:p-8 shadow-lg backdrop-blur-xl',
          className,
        )}
      >
        {children}
      </div>
    </div>
  );
}

function Eyebrow({ children }) {
  return <p className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-brand-300">{children}</p>;
}

function LiveTeaser() {
  const connect = useWaterLiveStore((s) => s.connect);
  const disconnect = useWaterLiveStore((s) => s.disconnect);
  const status = useWaterLiveStore((s) => s.status);
  const kpi = useWaterLiveStore((s) => s.kpi);
  useEffect(() => { connect(); return () => disconnect(); }, [connect, disconnect]);

  const live = status === 'open' && kpi?.active_meters > 0;
  return (
    <div className="mt-6 rounded-lg border border-white/10 bg-black/30 p-5" aria-live="polite">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted">Building water register</span>
        <StatusPill tone={live ? 'success' : 'warning'} pulse={live}>{live ? 'Live' : status === 'open' ? 'Waiting for meters' : 'Connecting'}</StatusPill>
      </div>
      <p className="mt-2 font-mono tabular text-3xl sm:text-4xl font-bold text-fg">
        {live ? kpi.total_volume_m3.toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 }) : '—'}
        <span className="ml-2 text-base font-medium text-subtle">m³</span>
      </p>
      <p className="mt-1 text-sm text-muted">
        {live
          ? `${kpi.total_flow_m3_per_hr.toFixed(2)} m³/h flowing now across ${kpi.active_meters} smart meters`
          : 'Start the backend (npm run backend) to stream live meter data here.'}
      </p>
    </div>
  );
}

export default function LandingPage() {
  const navigate = useNavigate();
  const rootRef = useRef(null);
  const progressRef = useRef(0);
  const phaseRef = useRef('intro');
  const [reducedMotion] = useState(prefersReducedMotion);
  const [tier] = useState(detectTier);
  const [sceneReady, setSceneReady] = useState(false);
  const [sceneFailed, setSceneFailed] = useState(false);
  const [entering, setEntering] = useState(false);
  const { scrollTo } = useScrollStory(rootRef, progressRef, reducedMotion);

  useEffect(() => {
    const prev = document.title;
    document.title = 'GoGreen · Dashboard';
    return () => { document.title = prev; };
  }, []);

  const stats = useFeatureStats();

  /** Camera flies into the hotel tower, the page fades to the app background, then the router hands over. */
  const enter = (to) => {
    if (reducedMotion) { navigate(to); return; }
    setEntering(true);
    phaseRef.current = 'enter';
    setTimeout(() => navigate(to, { viewTransition: true }), 1150);
  };

  const show3D = tier !== 'none' && !sceneFailed;
  // ?clean hides the overlay UI (used to capture the poster image / review the render)
  const [clean] = useState(() => new URLSearchParams(window.location.search).has('clean'));

  return (
    <div data-theme="dark" className={cn('gg relative min-h-screen text-fg', clean && '[&_header]:hidden [&_main]:invisible [&_.gg-scrim]:hidden')}>
      {/* Layer 0: the 3D scene (or poster), fixed behind the story */}
      <div className="fixed inset-0 z-0 overflow-hidden">
        <Poster visible={!sceneReady} />
        {show3D && (
          <Suspense fallback={null}>
            <LightCityCanvas
              tier={tier}
              progressRef={progressRef}
              phaseRef={phaseRef}
              reducedMotion={reducedMotion}
              onReady={() => setSceneReady(true)}
              onFail={() => setSceneFailed(true)}
            />
          </Suspense>
        )}
        <p className="sr-only">Illustration: a 3D render of The Light City waterfront at dusk, with four lit towers above a retail podium and a palm-lined promenade.</p>
        {/* Legibility scrims */}
        <div aria-hidden="true" className="gg-scrim pointer-events-none absolute inset-0 max-sm:bg-[rgb(3_10_8/0.55)] bg-[linear-gradient(90deg,rgb(3_10_8/0.88)_0%,rgb(3_10_8/0.62)_34%,rgb(3_10_8/0.2)_55%,transparent_70%)]" />
        <div aria-hidden="true" className="gg-scrim pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-[linear-gradient(0deg,rgb(3_10_8/0.7),transparent)]" />
      </div>

      {/* Layer 1: decorative parallax glows */}
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-[1] overflow-hidden">
        <div data-speed="0.35" className="absolute -left-40 top-[60vh] size-[34rem] rounded-full bg-brand-500/10 blur-3xl" />
        <div data-speed="0.6" className="absolute right-[-10rem] top-[140vh] size-[28rem] rounded-full bg-[#2dd4bf]/10 blur-3xl" />
      </div>

      {/* Header */}
      <header className="fixed inset-x-0 top-0 z-30 bg-[linear-gradient(180deg,rgb(3_10_8/0.78),rgb(3_10_8/0.35)_70%,transparent)]">
        <div className="mx-auto flex h-16 max-w-[1400px] items-center gap-6 px-5 sm:px-10">
          <Brand />
          <ModuleNav onOpen={enter} className="ml-auto hidden lg:block" />
        </div>
        {/* Smaller screens: the same modules as a swipeable row under the brand */}
        <ModuleNav onOpen={enter} className="lg:hidden -mt-1 overflow-x-auto px-5 pb-2 sm:px-10" />
      </header>

      <main ref={rootRef} className="relative z-10">
        {/* Hero */}
        <section aria-labelledby="hero-title" className="relative flex min-h-svh items-center pt-28 pb-16 lg:pt-16 lg:pb-0">
          <div className="mx-auto w-full max-w-[1400px] px-5 sm:px-10">
            <div className="max-w-2xl">
              <div data-hero-fade><StatusPill tone="success" pulse>Live at The Light City Penang</StatusPill></div>
              <h1 id="hero-title" className="mt-5 text-4xl font-extrabold leading-[1.05] tracking-tight text-white sm:text-6xl">
                {HEADLINE.split(' ').map((w, i) => (
                  <span key={i} className="inline-block overflow-hidden pb-1 align-bottom">
                    <span data-hero-word className="inline-block">{w}&nbsp;</span>
                  </span>
                ))}
              </h1>
              <p data-hero-fade className="mt-5 max-w-xl text-lg leading-relaxed text-[#d5e3dc]">
                GoGreen streams energy, water and waste data from every floor into an AI digital twin, so facility and
                sustainability teams catch waste as it happens and their audit evidence builds itself.
              </p>
              <div data-hero-fade className="mt-8 flex flex-wrap gap-3">
                <Button size="lg" onClick={() => scrollTo('#features')} iconRight={<ArrowRight className="size-5" aria-hidden="true" />}>Explore modules</Button>
                <Button size="lg" variant="secondary" className="border-white/20 bg-white/5 text-white hover:bg-white/10" onClick={() => scrollTo('#how')}>
                  See how it works
                </Button>
              </div>
              <ul data-hero-fade className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-[#bcd0c7]">
                <li className="flex items-center gap-2"><Activity className="size-4 text-brand-300" aria-hidden="true" /> GreenRE EE · WE · IEQ</li>
                <li className="flex items-center gap-2"><Leaf className="size-4 text-brand-300" aria-hidden="true" /> CO₂ tracking</li>
                <li className="flex items-center gap-2"><Radio className="size-4 text-brand-300" aria-hidden="true" /> Live IoT telemetry</li>
                <li className="flex items-center gap-2"><Recycle className="size-4 text-brand-300" aria-hidden="true" /> AI waste vision</li>
              </ul>
            </div>
          </div>
          {!reducedMotion && (
            <button
              type="button"
              onClick={() => scrollTo('#problem')}
              className="absolute bottom-8 left-1/2 -translate-x-1/2 max-sm:hidden flex flex-col items-center gap-1 text-xs font-semibold text-[#bcd0c7] hover:text-white"
            >
              Scroll to explore
              <ChevronDown className="size-5 animate-bounce" aria-hidden="true" />
            </button>
          )}
        </section>

        {/* Problem */}
        <section id="problem" aria-labelledby="problem-title" className="flex min-h-svh items-center py-24">
          <SectionPanel align="right">
            <Eyebrow>The problem</Eyebrow>
            <h2 id="problem-title" className="text-3xl font-extrabold tracking-tight text-fg sm:text-4xl">Certified once. Drifting every day.</h2>
            <p className="mt-4 text-muted">
              A green rating is earned at handover and re-audited years later. In between, performance slips silently.
            </p>
            <ul className="mt-6 space-y-4">
              {PROBLEMS.map(({ icon: Icon, title, text }) => (
                <li key={title} className="flex gap-4">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-danger-bg text-danger"><Icon className="size-5" aria-hidden="true" /></span>
                  <div><p className="font-semibold text-fg">{title}</p><p className="text-sm text-muted">{text}</p></div>
                </li>
              ))}
            </ul>
          </SectionPanel>
        </section>

        {/* How it works */}
        <section id="how" aria-labelledby="how-title" className="flex min-h-svh items-center py-24">
          <div className="mx-auto w-full max-w-[1400px] px-5 sm:px-10">
            <div data-reveal className="max-w-xl">
              <Eyebrow>How it works</Eyebrow>
              <h2 id="how-title" className="[text-shadow:0_2px_28px_rgb(0_0_0/0.75)] text-3xl font-extrabold tracking-tight text-white sm:text-5xl">Sense. Understand. Act.</h2>
            </div>
            <ol className="mt-10 grid gap-4 md:grid-cols-3">
              {STEPS.map(({ n, icon: Icon, title, text }, i) => (
                <li
                  key={n}
                  data-reveal
                  data-reveal-delay={i * 0.12}
                  className="rounded-xl border border-white/10 bg-[rgb(8_18_15/0.72)] p-6 shadow-lg backdrop-blur-xl"
                >
                  <div className="flex items-center justify-between">
                    <span className="flex size-11 items-center justify-center rounded-md bg-primary-soft text-primary-soft-fg"><Icon className="size-5" aria-hidden="true" /></span>
                    <span className="font-mono text-sm font-bold text-subtle">{n}</span>
                  </div>
                  <h3 className="mt-5 text-xl font-bold text-fg">{title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted">{text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Features */}
        <section id="features" aria-labelledby="features-title" className="flex min-h-svh items-center py-24">
          <div className="mx-auto w-full max-w-[1400px] px-5 sm:px-10">
            <div className="ml-auto max-w-4xl">
              <div data-reveal>
                <Eyebrow>Modules</Eyebrow>
                <h2 id="features-title" className="[text-shadow:0_2px_28px_rgb(0_0_0/0.75)] text-3xl font-extrabold tracking-tight text-white sm:text-5xl">Every system, one source of truth.</h2>
              </div>
              <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {FEATURES.map(({ id, to, icon: Icon, title, text, accent }, i) => (
                  <li key={to} data-reveal data-reveal-delay={i * 0.06}>
                    <Link
                      to={to}
                      onClick={(e) => { e.preventDefault(); enter(to); }}
                      className="group relative block h-full overflow-hidden rounded-xl border border-white/10 bg-[rgb(8_18_15/0.72)] p-5 shadow-lg backdrop-blur-xl transition-[transform,border-color] duration-base ease-standard hover:-translate-y-1 hover:border-white/25"
                    >
                      <span className="absolute inset-x-0 top-0 h-1" style={{ background: accent }} aria-hidden="true" />
                      <div className="flex items-start justify-between gap-3">
                        <Icon className="size-6" style={{ color: accent }} aria-hidden="true" />
                        <span className="text-right">
                          <span className={cn('block font-mono tabular text-lg font-bold leading-tight', stats[id].tone === 'danger' ? 'text-danger' : 'text-fg')}>{stats[id].value}</span>
                          <span className="block text-[11px] font-medium text-subtle">{stats[id].label}</span>
                        </span>
                      </div>
                      <h3 className="mt-4 text-lg font-bold text-fg">{title}</h3>
                      <p className="mt-1 text-sm text-muted">{text}</p>
                      <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-fg">
                        Open <ArrowRight className="size-4 transition-transform duration-base group-hover:translate-x-1" aria-hidden="true" />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* Live demo teaser */}
        <section id="live" aria-labelledby="live-title" className="flex min-h-svh items-center py-24">
          <SectionPanel align="left" className="max-w-2xl">
            <Eyebrow>Live demo</Eyebrow>
            <h2 id="live-title" className="text-3xl font-extrabold tracking-tight text-fg sm:text-4xl">Watching the meters right now.</h2>
            <p className="mt-3 text-muted">
              Six smart water meters stream readings every two seconds through MQTT into DuckDB and out to the dashboard over WebSockets.
            </p>
            <LiveTeaser />
            <div className="mt-6 flex flex-wrap gap-3">
              <Button size="lg" onClick={() => enter('/water')} iconRight={<ArrowRight className="size-5" aria-hidden="true" />}>Open water monitoring</Button>
              <Button size="lg" variant="secondary" className="border-white/20 bg-white/5 text-white hover:bg-white/10" onClick={() => scrollTo('#features')}>
                All modules
              </Button>
            </div>
          </SectionPanel>
        </section>

        <footer className="border-t border-white/10 bg-[rgb(3_10_8/0.85)] py-8 backdrop-blur">
          <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-4 px-5 text-sm text-muted sm:px-10">
            <Brand />
            <p>© 2026 GoGreen · Continuous GreenRE compliance for The Light City Penang</p>
          </div>
        </footer>
      </main>

      {/* Hand-off overlay: fades to the app background while the camera flies in */}
      <div
        aria-hidden="true"
        className={cn(
          'pointer-events-none fixed inset-0 z-50 bg-[#0a110e] transition-opacity duration-[900ms] delay-200 ease-standard',
          entering ? 'opacity-100' : 'opacity-0',
        )}
      />
    </div>
  );
}
