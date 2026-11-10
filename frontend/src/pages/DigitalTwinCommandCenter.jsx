import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, ShieldCheck } from 'lucide-react';
import AppShell from '../layouts/AppShell';
import BuildingScene from '../components/BuildingScene';
import CssTower from '../components/CssTower';
import { toast } from '../ui';

const LABEL = {
  red: { shell: 'bg-red-950/70 border-red-500 border-l-red-500', ping: 'bg-red-500', line: 'from-red-500' },
  blue: { shell: 'bg-blue-950/70 border-blue-500 border-l-blue-500', ping: 'bg-blue-500', line: 'from-blue-500' },
  cyan: { shell: 'bg-cyan-950/70 border-cyan-400 border-l-cyan-400', ping: 'bg-cyan-400', line: 'from-cyan-400' },
  green: { shell: 'bg-emerald-950/70 border-emerald-400 border-l-emerald-400', ping: 'bg-emerald-400', line: 'from-emerald-400' },
  yellow: { shell: 'bg-yellow-950/70 border-yellow-500 border-l-yellow-500', ping: 'bg-yellow-400', line: 'from-yellow-400' },
};

const FRAME = {
  red: 'border-red-500 bg-gray-800 dt-breathe-red',
  blue: 'border-blue-500 bg-gray-800 dt-breathe-blue',
  orange: 'border-orange-500 bg-gray-800 dt-breathe-orange',
  cyan: 'border-cyan-400 bg-gray-800 dt-breathe-cyan',
  amber: 'border-amber-400 bg-gray-800 dt-breathe-amber',
};

const SCENARIOS = {
  rainstorm: {
    button: '🌧️ 14:00 Rainstorm & VAV Surge (Multi-Module)',
    modules: ['indoor', 'water', 'electric'],
    floor: {
      level: 'L8',
      color: 'cyan',
      msg: 'Humidity surge · anti-condensation',
      positionCss: 'top-[22%] right-[32%]',
    },
    weather: { emoji: '🌧️', title: 'Penang rainstorm', detail: 'Outdoor humidity spiked. Temperature dropped.' },
    diagnosis: {
      title: 'Cross-module rainstorm linkage',
      body: 'L8 temperature and humidity sensors read the outdoor air shift. VAV boxes and chillers are retuned to keep indoor surfaces above dew point. Rainwater harvesting is at full capacity and the subterranean sump is draining. Pumps and air conditioning hit full load together.',
      finding: 'Peak Demand warning — instantaneous building demand stepped up.',
      action: 'Hold the condensation guard and log the demand spike. Dry-run only: no field write until you approve.',
    },
    roi: {
      title: 'Peak-demand coordination',
      detail: 'Chiller and drainage pumps sequenced before the demand charge window locked in.',
      amount: 'RM 480',
    },
  },
  co2_surge: {
    button: '👥 14:00 L8 Meeting CO₂ Surge (Cross-Module)',
    modules: ['indoor', 'electric', 'reserve'],
    floor: {
      level: 'L8',
      color: 'red',
      msg: 'CO₂ > 1500ppm',
      positionCss: 'top-[25%] right-[35%]',
    },
    weather: { emoji: '👥', title: 'L8 meeting load', detail: '100 occupants. Fresh-air path is not tracking.' },
    diagnosis: {
      title: 'GreenRE EQ-3 breach',
      body: 'CO₂ climbed through 1,000 ppm and is reading 1,500 ppm in the L8 meeting room. RAG isolates the actuator, not the crowd.',
      finding: 'VAV-08 fresh air damper is stuck at 15%.',
      action: 'One-click guidance for the operations team. Manual troubleshooting would take 4 hours (RM 200 labor) and risks tenant churn.',
    },
    roi: {
      title: 'Preventing tenant churn and labor time waste',
      detail: 'AI guidance replaced a 4-hour manual damper hunt (RM 200 labor).',
      amount: 'RM 200',
    },
  },
  night_leak: {
    button: '💧 03:00 L2 Podium Night Leak (Water-Energy Nexus)',
    modules: ['water', 'electric', 'reserve'],
    floor: {
      level: 'L2',
      color: 'blue',
      msg: 'Hidden micro-leak',
      positionCss: 'bottom-[30%] left-[20%]',
    },
    weather: { emoji: '🌙', title: '03:00 empty podium', detail: 'Offices are vacant. A pipe is losing pressure.' },
    diagnosis: {
      title: 'Hidden micro-leak',
      body: 'L2 podium pressure differential mutated while the floor was unoccupied. The pump is short-cycling to rebuild pressure, and the meter shows an unscheduled base-load wobble.',
      finding: 'Sectional solenoid can isolate the leaking run.',
      action: 'Approve to close the sectional solenoid valve and stop tens of tonnes of water from leaving the system.',
    },
    roi: {
      title: 'Water loss interdicted',
      detail: 'Sectional valve closed before tens of tonnes left the L2 podium run.',
      amount: 'RM 90',
    },
  },
};

class CanvasBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error) {
    console.error('3D Canvas Error:', error);
    this.props.onError?.();
  }

  render() {
    if (this.state.hasError) return null;
    return this.props.children;
  }
}

function Sparkline({ points, stroke }) {
  const width = 120;
  const height = 28;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const d = points.map((point, index) => {
    const x = (index / (points.length - 1)) * width;
    const y = height - 2 - ((point - min) / span) * (height - 6);
    return `${index === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="mt-2 h-7 w-full" aria-hidden="true">
      <path d={d} fill="none" stroke={stroke} strokeWidth="1.7" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function Meter({ label, right, barClass }) {
  return (
    <div>
      <div className="mb-1 flex justify-between text-[10px] text-gray-500">
        <span>{label}</span>
        <span>{right}</span>
      </div>
      <div className="mb-1 h-1.5 w-full rounded-full bg-gray-800">
        <div className={`h-1.5 rounded-full ${barClass}`} />
      </div>
    </div>
  );
}

function frameClass(id, scenario, open) {
  if (!open) return 'border-gray-800 bg-gray-900/50';
  if (id === 'water' && scenario === 'rainstorm') return FRAME.blue;
  if (id === 'indoor' && scenario === 'rainstorm') return FRAME.cyan;
  if (id === 'reserve') return FRAME.amber;
  if (id === 'carbon' || id === 'waste') return FRAME.cyan;
  return FRAME.red;
}

function DockCard({ id, scenario, open, onToggle, icon, title, metric, metricClass, children }) {
  return (
    <div className={`overflow-hidden rounded-lg border transition-all duration-500 ${frameClass(id, scenario, open)}`}>
      <button
        type="button"
        aria-expanded={open}
        onClick={onToggle}
        className="flex w-full cursor-pointer items-center justify-between p-3 text-left hover:bg-gray-800"
      >
        <span className="flex items-center gap-2">
          <span aria-hidden="true">{icon}</span>
          <span className="text-sm font-bold text-gray-200">{title}</span>
        </span>
        <span className="flex items-center gap-2">
          <span className={`font-mono text-xs ${metricClass}`}>{metric}</span>
          <ChevronDown className={`size-3.5 text-gray-500 transition-transform ${open ? 'rotate-180' : ''}`} />
        </span>
      </button>
      {open && (
        <div className="border-t border-gray-800 bg-gray-950 p-4">
          {children}
        </div>
      )}
    </div>
  );
}

export default function DigitalTwinCommandCenter() {
  const [activeModules, setActiveModules] = useState([]);
  const [alertFloor, setAlertFloor] = useState(null);
  const [activeScenario, setActiveScenario] = useState(null);
  const [resolved, setResolved] = useState(false);
  const [roiLedger, setRoiLedger] = useState([]);
  const [glFailed, setGlFailed] = useState(false);
  const [selectedZone, setSelectedZone] = useState('zone-c');
  const resetTimer = useRef(null);

  useEffect(() => () => {
    if (resetTimer.current) window.clearTimeout(resetTimer.current);
  }, []);

  const triggerScenario = (scenario) => {
    if (resetTimer.current) {
      window.clearTimeout(resetTimer.current);
      resetTimer.current = null;
    }
    const spec = SCENARIOS[scenario];
    setResolved(false);
    setActiveScenario(scenario);
    setActiveModules(spec.modules);
    setAlertFloor(spec.floor);
  };

  const handleApproveExecute = () => {
    const scenario = activeScenario;
    const spec = scenario ? SCENARIOS[scenario] : null;
    setAlertFloor((prev) => (prev ? { ...prev, color: 'green', msg: 'System Stabilized' } : prev));
    setResolved(true);
    if (spec) {
      setRoiLedger((prev) => [
        {
          id: `${scenario}-${Date.now()}`,
          title: spec.roi.title,
          detail: spec.roi.detail,
          amount: spec.roi.amount,
        },
        ...prev,
      ]);
    }
    toast.success('Command securely dispatched to BMS Stub in Dry-Run mode. Issue resolved.');
    resetTimer.current = window.setTimeout(() => {
      setActiveModules([]);
      setAlertFloor(null);
      setActiveScenario(null);
      setResolved(false);
      resetTimer.current = null;
    }, 3000);
  };

  const spec = activeScenario ? SCENARIOS[activeScenario] : null;
  const meshFloor = alertFloor?.color === 'red' ? alertFloor.level : null;
  const labelTone = LABEL[alertFloor?.color] || LABEL.yellow;
  const pointUp = Boolean(alertFloor?.positionCss?.includes('bottom-'));
  const isOpen = (id) => activeModules.includes(id);
  const toggleModule = (id) => setActiveModules((prev) => (
    prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
  ));

  const electricKw = activeScenario === 'rainstorm' ? '1,840 kW'
    : activeScenario === 'night_leak' ? '1,410 kW'
      : activeScenario === 'co2_surge' ? '1,120 kW'
        : '1,240 kW';
  const electricMetricClass = activeScenario === 'rainstorm'
    ? 'animate-pulse text-red-400'
    : activeScenario === 'night_leak'
      ? 'animate-pulse text-orange-400'
      : 'text-cyan-400';

  return (
    <AppShell fullBleed>
      <style>{`
        @keyframes dt-fade-down { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }
        .dt-fade-down { animation: dt-fade-down 0.45s ease-out; }
        @keyframes dt-breathe-red { 0%,100% { box-shadow: 0 0 8px rgba(239,68,68,0.25); } 50% { box-shadow: 0 0 20px rgba(239,68,68,0.7); } }
        @keyframes dt-breathe-blue { 0%,100% { box-shadow: 0 0 8px rgba(59,130,246,0.25); } 50% { box-shadow: 0 0 20px rgba(59,130,246,0.7); } }
        @keyframes dt-breathe-orange { 0%,100% { box-shadow: 0 0 8px rgba(249,115,22,0.25); } 50% { box-shadow: 0 0 20px rgba(249,115,22,0.7); } }
        @keyframes dt-breathe-cyan { 0%,100% { box-shadow: 0 0 8px rgba(34,211,238,0.22); } 50% { box-shadow: 0 0 20px rgba(34,211,238,0.6); } }
        @keyframes dt-breathe-amber { 0%,100% { box-shadow: 0 0 8px rgba(251,191,36,0.22); } 50% { box-shadow: 0 0 18px rgba(251,191,36,0.55); } }
        .dt-breathe-red { animation: dt-breathe-red 1.6s ease-in-out infinite; }
        .dt-breathe-blue { animation: dt-breathe-blue 1.6s ease-in-out infinite; }
        .dt-breathe-orange { animation: dt-breathe-orange 1.6s ease-in-out infinite; }
        .dt-breathe-cyan { animation: dt-breathe-cyan 1.6s ease-in-out infinite; }
        .dt-breathe-amber { animation: dt-breathe-amber 1.6s ease-in-out infinite; }
        .dt-scroll::-webkit-scrollbar { width: 6px; }
        .dt-scroll::-webkit-scrollbar-thumb { background: #334155; border-radius: 99px; }
      `}</style>
      <div className="flex h-[calc(100dvh-4rem)] flex-col overflow-hidden bg-gray-950 text-gray-100 lg:flex-row">
        <aside className="flex max-h-[48vh] w-full shrink-0 flex-col overflow-hidden border-b border-gray-800 bg-gray-900 shadow-2xl lg:h-full lg:max-h-none lg:w-1/4 lg:border-b-0 lg:border-r">
          <div className="border-b border-gray-800 p-4">
            <h2 className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Module Dock</h2>
            <p className="mt-1 text-sm font-semibold text-white">Live Telemetry Summaries</p>
          </div>
          <div className="dt-scroll flex-1 space-y-4 overflow-y-auto p-4">
            <DockCard
              id="electric"
              scenario={activeScenario}
              open={isOpen('electric')}
              onToggle={() => toggleModule('electric')}
              icon={<span className="text-cyan-400">⚡</span>}
              title="Electric Power"
              metric={electricKw}
              metricClass={electricMetricClass}
            >
              <Meter
                label="Main MSB Demand"
                right={activeScenario === 'rainstorm' ? '95% Capacity' : activeScenario === 'night_leak' ? 'Base wobble' : '87% Capacity'}
                barClass={
                  activeScenario === 'rainstorm' ? 'w-[95%] bg-red-500'
                    : activeScenario === 'night_leak' ? 'w-[72%] bg-orange-500'
                      : activeScenario === 'co2_surge' ? 'w-[54%] bg-cyan-500'
                        : 'w-[87%] bg-cyan-500'
                }
              />
              <Sparkline
                stroke={activeScenario === 'rainstorm' ? '#ef4444' : activeScenario === 'night_leak' ? '#f97316' : '#22d3ee'}
                points={
                  activeScenario === 'rainstorm' ? [40, 48, 62, 78, 90, 96, 94, 95]
                    : activeScenario === 'night_leak' ? [30, 32, 28, 58, 31, 62, 29, 60]
                      : [62, 64, 63, 66, 65, 67, 66, 68]
                }
              />
              {activeScenario === 'rainstorm' && (
                <div className="mt-3 flex items-start gap-2 rounded border border-red-900/50 bg-red-950/50 p-2">
                  <span className="animate-pulse text-xs text-red-500">⚠️</span>
                  <div className="text-[10px] leading-tight text-red-300">
                    <strong className="block text-red-400">Peak Demand Warning</strong>
                    Sump pumps and HVAC operating simultaneously. Approaching the 2,100 kW limit.
                  </div>
                </div>
              )}
              {activeScenario === 'night_leak' && (
                <div className="mt-3 flex items-start gap-2 rounded border border-orange-900/50 bg-orange-950/50 p-2">
                  <span className="text-xs text-orange-500">⚠️</span>
                  <div className="text-[10px] leading-tight text-orange-300">
                    <strong className="block text-orange-400">Base-load Anomaly</strong>
                    Unscheduled pump load detected during unoccupied hours.
                  </div>
                </div>
              )}
              {activeScenario === 'co2_surge' && (
                <p className="mt-3 text-[10px] leading-tight text-amber-200">AHU fan is holding. Fresh-air damper is not tracking the CO₂ call.</p>
              )}
              {!activeScenario && <p className="mt-2 text-[10px] text-emerald-400">Nominal demand. No unscheduled plant load.</p>}
            </DockCard>

            <DockCard
              id="indoor"
              scenario={activeScenario}
              open={isOpen('indoor')}
              onToggle={() => toggleModule('indoor')}
              icon={<span className="text-green-400">💨</span>}
              title="IEQ & HVAC"
              metric={activeScenario === 'co2_surge' ? 'L8 ALERT' : activeScenario === 'rainstorm' ? 'VAV SHIFT' : 'AQI OK'}
              metricClass={activeScenario === 'co2_surge' ? 'animate-pulse text-red-400' : activeScenario === 'rainstorm' ? 'text-cyan-300' : 'text-green-400'}
            >
              <div className="mb-2 grid grid-cols-2 gap-3">
                <div className="rounded border border-gray-800 bg-gray-900 p-2">
                  <div className="text-[9px] uppercase text-gray-500">Avg Temp</div>
                  <div className={`font-mono text-sm text-white ${activeScenario === 'rainstorm' ? 'animate-pulse' : ''}`}>
                    {activeScenario === 'rainstorm' ? '22.4°C' : '24.2°C'}
                  </div>
                </div>
                <div className={`rounded border bg-gray-900 p-2 ${activeScenario === 'co2_surge' ? 'border-red-500/50' : 'border-gray-800'}`}>
                  <div className="text-[9px] uppercase text-gray-500">Peak CO₂ (L8)</div>
                  <div className={`font-mono text-sm ${activeScenario === 'co2_surge' ? 'animate-pulse font-bold text-red-400' : 'text-white'}`}>
                    {activeScenario === 'co2_surge' ? '1,500 ppm' : '420 ppm'}
                  </div>
                </div>
              </div>
              <Meter
                label="L8 relative humidity"
                right={activeScenario === 'rainstorm' ? '78% RH' : '55% RH'}
                barClass={activeScenario === 'rainstorm' ? 'w-[78%] bg-cyan-400' : 'w-[55%] bg-emerald-500'}
              />
              <Sparkline
                stroke={activeScenario === 'co2_surge' ? '#f87171' : '#34d399'}
                points={activeScenario === 'co2_surge' ? [420, 640, 880, 1100, 1280, 1410, 1500, 1490] : [48, 50, 49, 52, 51, 53, 52, 54]}
              />
              {activeScenario === 'co2_surge' && (
                <div className="mt-2 flex items-start gap-2 rounded border border-red-900/50 bg-red-950/50 p-2">
                  <span className="text-xs text-red-500">🚨</span>
                  <div className="text-[10px] leading-tight text-red-300">
                    <strong className="block text-red-400">GreenRE EQ-3 Breach</strong>
                    CO₂ above the 1,000 ppm threshold. VAV-08 fresh air damper unresponsive.
                  </div>
                </div>
              )}
              {activeScenario === 'rainstorm' && (
                <div className="mt-2 flex items-start gap-2 rounded border border-cyan-900/50 bg-cyan-950/40 p-2">
                  <span className="text-xs text-cyan-300">💨</span>
                  <div className="text-[10px] leading-tight text-cyan-100">
                    <strong className="block text-cyan-300">Anti-condensation</strong>
                    Outdoor air mutated. VAV boxes and chillers retuned to hold surfaces above dew point.
                  </div>
                </div>
              )}
            </DockCard>

            <DockCard
              id="water"
              scenario={activeScenario}
              open={isOpen('water')}
              onToggle={() => toggleModule('water')}
              icon={<span className="text-sky-400">💧</span>}
              title="Water"
              metric={activeScenario === 'night_leak' ? 'ΔP LEAK' : activeScenario === 'rainstorm' ? 'SUMP ON' : '4.2 bar'}
              metricClass={activeScenario === 'night_leak' ? 'animate-pulse text-red-400' : activeScenario === 'rainstorm' ? 'animate-pulse text-blue-300' : 'text-sky-300'}
            >
              <div className="space-y-3">
                <Meter
                  label="L2 line pressure"
                  right={activeScenario === 'night_leak' ? '2.6 bar' : '4.2 bar'}
                  barClass={activeScenario === 'night_leak' ? 'w-[48%] bg-red-500' : 'w-[84%] bg-sky-500'}
                />
                <Meter
                  label="Harvest tank level"
                  right={activeScenario === 'rainstorm' ? '96%' : '64%'}
                  barClass={activeScenario === 'rainstorm' ? 'w-[96%] bg-blue-400' : 'w-[64%] bg-sky-500'}
                />
              </div>
              <Sparkline
                stroke={activeScenario === 'night_leak' ? '#f87171' : '#38bdf8'}
                points={activeScenario === 'night_leak' ? [84, 80, 76, 70, 74, 66, 72, 60] : activeScenario === 'rainstorm' ? [60, 68, 74, 82, 88, 93, 96, 95] : [62, 63, 64, 64, 65, 64, 64, 65]}
              />
              {activeScenario === 'rainstorm' && (
                <div className="mt-3 flex items-start gap-2 rounded border border-blue-900/50 bg-blue-950/40 p-2">
                  <span className="animate-pulse text-xs text-blue-300">🌧️</span>
                  <div className="text-[10px] leading-tight text-blue-100">
                    <strong className="block text-blue-300">Harvest at capacity</strong>
                    Rainwater plant is full. Subterranean sump pump is draining.
                  </div>
                </div>
              )}
              {activeScenario === 'night_leak' && (
                <div className="mt-3 flex items-start gap-2 rounded border border-red-900/50 bg-red-950/50 p-2">
                  <span className="animate-pulse text-xs text-red-400">💧</span>
                  <div className="text-[10px] leading-tight text-red-200">
                    <strong className="block text-red-400">Hidden micro-leak</strong>
                    Pressure differential on the L2 podium while the floor is empty.
                  </div>
                </div>
              )}
              {!activeScenario && <p className="mt-2 text-[10px] text-emerald-400">Pressure stable. No leak signature.</p>}
            </DockCard>

            <DockCard
              id="reserve"
              scenario={activeScenario}
              open={isOpen('reserve')}
              onToggle={() => toggleModule('reserve')}
              icon={<span className="text-amber-300">💰</span>}
              title="Financial ROI"
              metric={activeScenario === 'co2_surge' ? 'RM 200' : activeScenario === 'night_leak' ? 'RM 90' : activeScenario === 'rainstorm' ? 'RM 480' : 'RM 0'}
              metricClass={activeScenario ? 'animate-pulse text-amber-300' : 'text-emerald-400'}
            >
              <Meter
                label="Open exposure"
                right={activeScenario === 'co2_surge' ? '4 h labor' : activeScenario === 'night_leak' ? 'tens of tonnes' : activeScenario === 'rainstorm' ? 'demand charge' : 'clear'}
                barClass={activeScenario ? 'w-[80%] bg-amber-400' : 'w-[8%] bg-emerald-500'}
              />
              <Sparkline
                stroke="#fbbf24"
                points={activeScenario ? [10, 18, 22, 40, 55, 70, 84, 90] : [12, 12, 11, 13, 12, 12, 11, 12]}
              />
              {activeScenario === 'co2_surge' && (
                <p className="mt-2 text-[10px] leading-tight text-amber-100">Manual path is 4 hours and RM 200 labor, plus tenant-churn exposure. Approve books the avoidance.</p>
              )}
              {activeScenario === 'night_leak' && (
                <p className="mt-2 text-[10px] leading-tight text-amber-100">Open leak path can lose tens of tonnes before morning. Valve isolation is the booked avoidance.</p>
              )}
              {activeScenario === 'rainstorm' && (
                <p className="mt-2 text-[10px] leading-tight text-amber-100">Drainage pumps and cooling share one peak. Coordination is the demand-charge avoidance.</p>
              )}
              {!activeScenario && <p className="mt-2 text-[10px] text-emerald-400">Ledger quiet. No open avoidance.</p>}
            </DockCard>

            <DockCard
              id="carbon"
              scenario={activeScenario}
              open={isOpen('carbon')}
              onToggle={() => toggleModule('carbon')}
              icon={<span className="text-lime-400">🍃</span>}
              title="Carbon"
              metric="42 t"
              metricClass="text-lime-300"
            >
              <Meter label="Monthly intensity" right="62% of budget" barClass="w-[62%] bg-lime-500" />
              <Sparkline stroke="#a3e635" points={[70, 68, 66, 64, 63, 62, 61, 62]} />
              <p className="mt-2 text-[10px] text-gray-400">Grid and plant intensity inside the monthly envelope.</p>
            </DockCard>

            <DockCard
              id="waste"
              scenario={activeScenario}
              open={isOpen('waste')}
              onToggle={() => toggleModule('waste')}
              icon={<span className="text-emerald-300">♻️</span>}
              title="Waste"
              metric="71%"
              metricClass="text-emerald-300"
            >
              <Meter label="Diversion rate" right="71% diverted" barClass="w-[71%] bg-emerald-500" />
              <Sparkline stroke="#34d399" points={[64, 66, 65, 68, 69, 70, 71, 71]} />
              <p className="mt-2 text-[10px] text-gray-400">Podium streams are tracking the diversion target.</p>
            </DockCard>
          </div>
        </aside>

        <section className="relative flex min-h-[420px] w-full flex-1 items-center justify-center bg-gray-900 shadow-[inset_0_0_120px_rgba(0,0,0,1)] lg:w-2/4 lg:flex-none">
          <div className="absolute top-0 z-30 w-full">
            {activeScenario === 'rainstorm' && (
              <div className="dt-fade-down flex items-center justify-between border-b border-blue-500 bg-blue-900/80 px-6 py-3 text-blue-100 backdrop-blur-sm">
                <div className="flex items-center gap-3">
                  <span className="animate-pulse text-2xl">🌧️</span>
                  <div>
                    <h3 className="text-sm font-bold tracking-wide">SCENARIO: Penang Tropical Rainstorm</h3>
                    <p className="text-xs text-blue-300">Outdoor humidity spiked. Ambient temperature dropped. System compensating.</p>
                  </div>
                </div>
              </div>
            )}
            {activeScenario === 'night_leak' && (
              <div className="dt-fade-down flex items-center justify-between border-b border-orange-500 bg-orange-900/80 px-6 py-3 text-orange-100 backdrop-blur-sm">
                <div className="flex items-center gap-3">
                  <span className="animate-pulse text-2xl">💧</span>
                  <div>
                    <h3 className="text-sm font-bold tracking-wide">SCENARIO: 03:00 Unoccupied Podium</h3>
                    <p className="text-xs text-orange-300">Offices are vacant. Anomaly detected in water pressure signatures.</p>
                  </div>
                </div>
              </div>
            )}
            {activeScenario === 'co2_surge' && (
              <div className="dt-fade-down flex items-center justify-between border-b border-red-500 bg-red-950/80 px-6 py-3 text-red-100 backdrop-blur-sm">
                <div className="flex items-center gap-3">
                  <span className="animate-pulse text-2xl">👥</span>
                  <div>
                    <h3 className="text-sm font-bold tracking-wide">SCENARIO: L8 Meeting CO₂ Surge</h3>
                    <p className="text-xs text-red-300">100 occupants. Fresh-air damper is stuck. GreenRE EQ-3 threshold crossed.</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="pointer-events-none absolute bottom-20 h-16 w-64 rounded-full bg-cyan-500/20 blur-3xl" />

          <div className="relative z-10 h-full min-h-[420px] w-full lg:h-[700px]">
            {glFailed ? (
              <CssTower selectedZone={selectedZone} onSelect={setSelectedZone} />
            ) : (
              <CanvasBoundary onError={() => setGlFailed(true)}>
                <BuildingScene
                  selectedZone={selectedZone}
                  onSelect={setSelectedZone}
                  onFail={() => setGlFailed(true)}
                  anomalyFloor={meshFloor}
                  anomalyZone={null}
                />
              </CanvasBoundary>
            )}
          </div>

          {alertFloor && (
            <div className={`absolute ${alertFloor.positionCss} z-20 flex flex-col items-start`}>
              {pointUp && (
                <div className={`ml-4 h-8 w-px bg-gradient-to-t ${labelTone.line} to-transparent`} />
              )}
              <div className={`flex items-center gap-2 rounded-sm border border-l-4 px-3 py-1.5 shadow-[0_0_20px_rgba(0,0,0,0.5)] backdrop-blur-md ${labelTone.shell}`}>
                <span className={`h-2 w-2 animate-ping rounded-full ${labelTone.ping}`} />
                <span className="font-mono text-xs font-bold tracking-wider text-white">
                  [{alertFloor.level}] {alertFloor.msg}
                </span>
              </div>
              {!pointUp && (
                <div className={`ml-4 h-8 w-px bg-gradient-to-b ${labelTone.line} to-transparent`} />
              )}
            </div>
          )}
        </section>

        <aside className="relative flex w-full shrink-0 flex-col border-t border-gray-800 bg-gray-950 lg:w-1/4 lg:border-l lg:border-t-0 max-h-[46vh] lg:max-h-none overflow-hidden">
          <div className="border-b border-gray-800 px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-amber-400">Scenario injector</p>
            <h2 className="mt-1 text-sm font-semibold text-white">Ace linkage drills</h2>
          </div>

          <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-3">
            {Object.entries(SCENARIOS).map(([id, item]) => {
              const on = activeScenario === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => triggerScenario(id)}
                  className={`rounded-lg border px-3 py-2 text-left text-xs font-semibold leading-snug ${
                    on
                      ? 'border-cyan-400 bg-cyan-950/50 text-cyan-50'
                      : 'border-gray-700 bg-gray-900 text-gray-200 hover:border-gray-500'
                  }`}
                >
                  {item.button}
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => {
                if (resetTimer.current) window.clearTimeout(resetTimer.current);
                setActiveModules([]);
                setAlertFloor(null);
                setActiveScenario(null);
                setResolved(false);
              }}
              className="rounded-lg border border-emerald-800 bg-emerald-950/40 px-3 py-2 text-left text-xs font-bold text-emerald-300"
            >
              Nominal — clear injectors
            </button>
          </div>

          {spec && (
            <div className="max-h-[46%] overflow-y-auto border-t border-cyan-800 bg-gray-950 p-3 shadow-[0_-16px_40px_rgba(0,0,0,0.55)]">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-cyan-400">AI RAG diagnosis</p>
              <h3 className="mt-1 text-sm font-bold text-white">{spec.diagnosis.title}</h3>
              <p className="mt-2 text-[11px] leading-relaxed text-gray-300">{spec.diagnosis.body}</p>
              <p className="mt-2 rounded border border-amber-800/80 bg-amber-950/40 px-2 py-1.5 text-[11px] font-semibold text-amber-100">
                {spec.diagnosis.finding}
              </p>
              <p className="mt-2 text-[11px] leading-relaxed text-gray-400">{resolved ? 'Dry-run command accepted. Returning to nominal.' : spec.diagnosis.action}</p>
              <button
                type="button"
                onClick={handleApproveExecute}
                disabled={resolved}
                className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-md bg-cyan-500 px-3 py-2 text-xs font-bold text-gray-950 disabled:cursor-default disabled:bg-emerald-600 disabled:text-white"
              >
                <ShieldCheck className="size-4" />
                {resolved ? 'Dispatched' : 'Approve & Execute'}
              </button>
            </div>
          )}

          <div className="mt-auto border-t border-gray-800 px-3 py-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-gray-500">Executive ROI ledger</p>
            {roiLedger.length === 0 ? (
              <p className="mt-2 text-[11px] text-gray-500">No booked avoidance yet. Approve a drill to post one.</p>
            ) : (
              <ul className="mt-2 max-h-28 space-y-2 overflow-y-auto">
                {roiLedger.map((row) => (
                  <li key={row.id} className="rounded border border-emerald-900/80 bg-emerald-950/30 px-2 py-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-[11px] font-semibold text-emerald-200">{row.title}</span>
                      <span className="shrink-0 text-[11px] font-bold text-emerald-300">{row.amount}</span>
                    </div>
                    <p className="mt-0.5 text-[10px] leading-snug text-gray-400">{row.detail}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>
      </div>
    </AppShell>
  );
}
