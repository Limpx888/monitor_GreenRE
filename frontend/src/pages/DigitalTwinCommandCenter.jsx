import React, { useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
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
  ae_co2_spike: {
    button: '👥 14:00 L8 Meeting CO₂ Surge',
    modules: ['reserve', 'indoor', 'electric'],
    floor: { level: 'L8', color: 'red', msg: 'CO₂ > 1,500 ppm (GreenRE Breach)', positionCss: 'top-[25%] right-[35%]' },
    banner: { emoji: '👥', title: 'SCENARIO: L8 Meeting CO₂ Surge', detail: 'Overcrowding plus a jammed fresh-air damper. EQ-3 threshold crossed.', shell: 'border-red-500 bg-red-950/80 text-red-100', detailClass: 'text-red-300' },
    diagnosis: {
      title: 'Stuck damper under a crowd load',
      body: 'Reserve shows the L8 room filled far past its booking. Indoor CO₂ crossed 1,000 ppm and is reading 1,500 ppm. Electric shows the AHU fan at full speed, so the plant is working. The air is not changing because the fresh-air damper is mechanically jammed.',
      finding: 'VAV-08 fresh air damper stuck at 15%. Overcrowding is the external driver. The jammed actuator is why CO₂ will not fall.',
    },
    chart: { title: 'Indoor CO₂ by floor', unit: 'ppm', limit: 1000, highlight: 'L8', rows: [
      { name: 'L2', value: 460 }, { name: 'L4', value: 510 }, { name: 'L6', value: 640 }, { name: 'L8', value: 1500 }, { name: 'L10', value: 540 },
    ] },
    cross: [
      { label: 'Reserve expected', value: '20 pax' },
      { label: 'Reserve actual', value: '350 pax', alert: true },
    ],
    crossNote: 'Booking overflow is the external root cause. The damper fault is why ventilation cannot catch up.',
    asset: { id: 'AHU-08-L8-OFFICE', code: 'ASHRAE-Stuck-Damper-Err-404', health: 8, name: 'L8 fresh-air damper actuator' },
    strategies: {
      A: { label: 'Strategy A: Force damper override (65%)', result: 'Compliance restored in about 12s. Fines and tenant churn avoided.', amountLabel: '+ RM 400.00', title: 'Damper override — tenant churn avoided', detail: 'Fresh-air damper forced to 65%. EQ-3 recovered without a call-out.' },
      B: { label: 'Strategy B: Auto-dispatch field ticket', result: 'Work order sent. Labor is deducted while the room stays out of compliance.', amountLabel: '− RM 200.00', title: 'Field ticket labor', detail: 'Manual damper hunt booked at RM 200 labor. Breach remains until arrival.' },
    },
  },
  cool_night_gap: {
    button: '💧 03:00 L2 Podium Night Leak',
    modules: ['water', 'electric'],
    floor: { level: 'L2', color: 'blue', msg: 'Hidden micro-leak', positionCss: 'bottom-[30%] left-[20%]' },
    banner: { emoji: '💧', title: 'SCENARIO: 03:00 Unoccupied Podium', detail: 'Offices are empty. A pressure signature and a short-cycling pump do not belong on the night baseline.', shell: 'border-orange-500 bg-orange-900/80 text-orange-100', detailClass: 'text-orange-300' },
    diagnosis: {
      title: 'Night micro-leak and phantom pump load',
      body: 'At 03:00 the L2 podium is unoccupied. Line pressure is falling while the booster pump starts and stops to rebuild it. The electric meter shows that cycling as an unscheduled base-load wobble.',
      finding: 'Pressure differential isolates a hidden leak. Pump short-cycling is the energy consequence, not a separate fault.',
    },
    chart: { title: 'L2 line pressure vs night baseline', unit: 'bar', limit: 4.0, highlight: '03:00', rows: [
      { name: '00:00', value: 4.2 }, { name: '01:00', value: 4.0 }, { name: '02:00', value: 3.4 }, { name: '03:00', value: 2.6 }, { name: '04:00', value: 2.7 },
    ] },
    cross: [
      { label: 'Water ΔP', value: '−1.6 bar', alert: true },
      { label: 'Pump starts / h', value: '14', alert: true },
    ],
    crossNote: 'The leak explains the pressure loss. The short-cycle explains the phantom kilowatts.',
    asset: { id: 'PUMP-02-L2-PODIUM', code: 'ASHRAE-Short-Cycle-Pump-Err-217', health: 22, name: 'L2 podium booster pump' },
    strategies: {
      A: { label: 'Strategy A: Close sectional solenoid', result: 'Leak path isolated. Water loss and pump cycling stop.', amountLabel: '+ RM 95.50', title: 'Sectional valve — water and phantom load stopped', detail: 'L2 sectional solenoid closed. Avoided water loss and night pump runtime.' },
      B: { label: 'Strategy B: Auto-dispatch plumber', result: 'Ticket waits until morning. Labor is deducted and the leak continues.', amountLabel: '− RM 180.00', title: 'After-hours plumber call-out', detail: 'Field ticket raised. Leak and short-cycling continue until arrival.' },
    },
  },
  office_vav_fault: {
    button: '⚠️ Office VAV Fault · High kWh',
    modules: ['indoor', 'electric'],
    floor: { level: 'L8', color: 'red', msg: 'VAV over-cool · kWh surge', positionCss: 'top-[28%] right-[30%]' },
    banner: { emoji: '⚠️', title: 'SCENARIO: Office VAV Malfunction', detail: 'One office zone is over-cooling. Zone energy has left its baseline.', shell: 'border-red-500 bg-red-950/80 text-red-100', detailClass: 'text-red-300' },
    diagnosis: {
      title: 'VAV airflow no longer tracking the zone',
      body: 'L8 supply air is far below setpoint while neighboring office floors stay normal. The zone electrical load has jumped with the reheat and fan compensation. This is a local air-volume failure, not a whole-building cooling call.',
      finding: 'VAV-08 is delivering uncontrolled volume. Local over-cool and the kilowatt spike are the same fault.',
    },
    chart: { title: 'Office zone demand vs peers', unit: 'kW', limit: 70, highlight: 'L8', rows: [
      { name: 'L4', value: 42 }, { name: 'L6', value: 48 }, { name: 'L8', value: 126 }, { name: 'L10', value: 44 }, { name: 'L12', value: 46 },
    ] },
    cross: [
      { label: 'Zone temp', value: '16.1°C', alert: true },
      { label: 'Setpoint', value: '24.0°C' },
    ],
    crossNote: 'An 8°C over-cool on one floor, with peer floors still inside baseline, localizes the VAV.',
    asset: { id: 'VAV-08-L8-OFFICE', code: 'ASHRAE-VAV-Airflow-Err-312', health: 19, name: 'L8 office VAV box' },
    strategies: {
      A: { label: 'Strategy A: Reset VAV to design airflow', result: 'Zone returns to setpoint. The excess kilowatts drop out of the peak.', amountLabel: '+ RM 285.04', title: 'VAV reset — excess cooling removed', detail: 'Design airflow restored on VAV-08. Avoided the zone over-cool energy.' },
      B: { label: 'Strategy B: Auto-dispatch field ticket', result: 'Zone stays over-cooled until a technician arrives. Labor is deducted.', amountLabel: '− RM 150.00', title: 'VAV field ticket', detail: 'Work order sent. Over-cool and the kilowatt penalty continue until arrival.' },
    },
  },
  podium_lighting_fault: {
    button: '💡 Podium Lighting Held On',
    modules: ['electric', 'reserve'],
    floor: { level: 'L2', color: 'yellow', msg: 'Lighting held at full load', positionCss: 'bottom-[34%] left-[24%]' },
    banner: { emoji: '💡', title: 'SCENARIO: Podium Lighting Override', detail: 'Off-peak commercial lighting is still at full load. The floor is empty.', shell: 'border-amber-500 bg-amber-950/80 text-amber-100', detailClass: 'text-amber-300' },
    diagnosis: {
      title: 'Occupancy sensor failed closed',
      body: 'Reserve shows the podium tenancy vacant after hours. The lighting circuit that should have dropped to the night setback is still drawing a daytime load. Electric and Reserve disagree, which is the fault signature.',
      finding: 'Podium occupancy sensor failed in the occupied state. The schedule never released the lights.',
    },
    chart: { title: 'Podium lighting kW vs night schedule', unit: 'kW', limit: 40, highlight: '22:00', rows: [
      { name: '18:00', value: 210 }, { name: '20:00', value: 180 }, { name: '22:00', value: 176 }, { name: '00:00', value: 168 },
    ] },
    cross: [
      { label: 'Reserve occupancy', value: '0 pax' },
      { label: 'Lighting load', value: '176 kW', alert: true },
    ],
    crossNote: 'An empty floor with a daytime lighting load means the sensor, not the tenants, is holding the circuit.',
    asset: { id: 'LTG-L2-PODIUM-OCC', code: 'ASHRAE-Occ-Sensor-Fail-Closed-118', health: 11, name: 'L2 podium occupancy sensor' },
    strategies: {
      A: { label: 'Strategy A: Force night lighting schedule', result: 'Circuit drops to setback immediately. After-hours kilowatts stop.', amountLabel: '+ RM 420.00', title: 'Lighting schedule restored', detail: 'Podium lights forced to the night setback. Avoided the after-hours lighting run.' },
      B: { label: 'Strategy B: Auto-dispatch electrician', result: 'Lights stay on until the ticket is closed. Labor is deducted.', amountLabel: '− RM 160.00', title: 'Lighting call-out', detail: 'Electrician ticket raised. The circuit keeps the daytime load until arrival.' },
    },
  },
  rainstorm_cooling: {
    button: '🌧️ Rainstorm & 2,100 kW Limit',
    modules: ['electric', 'indoor', 'water'],
    floor: { level: 'L8', color: 'cyan', msg: 'Demand approaching 2,100 kW', positionCss: 'top-[22%] right-[32%]' },
    banner: { emoji: '🌧️', title: 'SCENARIO: Penang Tropical Rainstorm', detail: 'Humidity spiked and temperature dropped. Chillers and flood pumps are both at full load.', shell: 'border-blue-500 bg-blue-900/80 text-blue-100', detailClass: 'text-blue-300' },
    diagnosis: {
      title: 'Storm load is walking into the TNB penalty',
      body: 'Indoor sensors caught the outdoor air swing, so chillers and VAV boxes opened up to stop condensation. Water harvesting is full and the basement sump is draining. Those two plants together push building demand toward the 2,100 kW maximum-demand threshold.',
      finding: 'No single asset is failed. The penalty risk is the coincidence of HVAC and drainage at 14:00.',
    },
    chart: { title: 'Building demand vs 2,100 kW MD limit', unit: 'kW', limit: 2100, highlight: '14:00', rows: [
      { name: '12:00', value: 1420 }, { name: '13:00', value: 1680 }, { name: '14:00', value: 2040 }, { name: '15:00', value: 1960 },
    ] },
    cross: [
      { label: 'HVAC + pumps', value: '2,040 kW', alert: true },
      { label: 'TNB MD limit', value: '2,100 kW' },
    ],
    crossNote: 'Sixty kilowatts of headroom. One more pump start locks the month’s maximum-demand charge.',
    asset: { id: 'CH-01-PLANT', code: 'TNB-MD-Approach-2100', health: 34, name: 'Lead chiller, coincident with sump pump' },
    strategies: {
      A: { label: 'Strategy A: Sequence chillers and shed pumps', result: 'Demand steps back under the penalty line. The MD charge is avoided.', amountLabel: '+ RM 5,900.00', title: 'Avoided maximum-demand penalty', detail: 'Chillers and sump pumps sequenced. Building demand held under the 2,100 kW TNB threshold.' },
      B: { label: 'Strategy B: Hold full load', result: 'Both plants stay at full output. The month’s MD penalty is accepted.', amountLabel: '− RM 5,900.00', title: 'MD penalty accepted', detail: 'No shed. Coincident HVAC and drainage load locks the maximum-demand charge.' },
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

function EvidenceChart({ title, rows, unit, limit, highlight }) {
  return (
    <div>
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400">{title}</p>
      <div className="h-36">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 8, right: 4, left: -18, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
            <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 10 }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} tickLine={false} axisLine={false} />
            <Tooltip
              formatter={(value) => [`${value} ${unit}`, 'Measured']}
              contentStyle={{ background: '#020617', border: '1px solid #334155', borderRadius: 8, fontSize: 11, color: '#e2e8f0' }}
            />
            {limit != null && <ReferenceLine y={limit} stroke="#fb7185" strokeDasharray="4 3" />}
            <Bar dataKey="value" radius={[4, 4, 0, 0]} isAnimationActive={false}>
              {rows.map((row) => (
                <Cell key={row.name} fill={row.name === highlight ? '#ef4444' : '#22d3ee'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function WarRoom({ spec, resolved, chosen, audit, onStrategy }) {
  const healthTone = spec.asset.health <= 20 ? 'bg-red-500' : 'bg-amber-400';
  return (
    <div className="space-y-3">
      <section className="rounded-lg border border-red-900/70 bg-gray-950 p-3">
        <p className="text-[10px] font-bold uppercase tracking-widest text-red-400">Stage 1 · Root cause</p>
        <h3 className="mt-1 text-sm font-semibold text-white">Baseline deviation</h3>
        <div className="mt-3">
          <EvidenceChart {...spec.chart} />
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {spec.cross.map((item) => (
            <div key={item.label} className={`rounded border bg-gray-900 p-2 ${item.alert ? 'border-red-500/60' : 'border-gray-800'}`}>
              <div className="text-[9px] uppercase text-gray-500">{item.label}</div>
              <div className={`font-mono text-sm ${item.alert ? 'font-bold text-red-300' : 'text-white'}`}>{item.value}</div>
            </div>
          ))}
        </div>
        <p className="mt-2 text-[10px] leading-snug text-gray-400">{spec.crossNote}</p>
      </section>

      <section className="rounded-lg border border-amber-800/70 bg-gray-950 p-3">
        <p className="text-[10px] font-bold uppercase tracking-widest text-amber-400">Stage 2 · Asset thread</p>
        <h3 className="mt-1 text-sm font-semibold text-white">{spec.asset.name}</h3>
        <dl className="mt-2 space-y-1 font-mono text-[11px] text-gray-300">
          <div className="flex justify-between gap-2"><dt className="text-gray-500">Asset ID</dt><dd>{spec.asset.id}</dd></div>
          <div className="flex justify-between gap-2"><dt className="text-gray-500">Fault</dt><dd className="text-right text-amber-200">{spec.asset.code}</dd></div>
        </dl>
        <div className="mt-3">
          <div className="mb-1 flex justify-between text-[10px] text-gray-500">
            <span>Health score</span>
            <span className={spec.asset.health <= 20 ? 'font-bold text-red-400' : 'font-bold text-amber-300'}>{spec.asset.health}% critical wear</span>
          </div>
          <div className="h-1.5 rounded-full bg-gray-800">
            <div className={`h-1.5 rounded-full ${healthTone}`} style={{ width: `${spec.asset.health}%` }} />
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-emerald-900/70 bg-gray-950 p-3">
        <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-400">Stage 3 · What-if</p>
        <h3 className="mt-1 text-sm font-semibold text-white">Intervention and payback</h3>
        <div className="mt-3 space-y-2">
          {['A', 'B'].map((key) => {
            const strategy = spec.strategies[key];
            const selected = chosen === key;
            return (
              <button
                key={key}
                type="button"
                disabled={resolved}
                onClick={() => onStrategy(key)}
                className={`w-full rounded-md border px-3 py-2 text-left disabled:cursor-default ${
                  selected ? 'border-emerald-400 bg-emerald-950/50' : 'border-gray-700 bg-gray-900 hover:border-gray-500'
                }`}
              >
                <span className="block text-[11px] font-bold text-white">{strategy.label}</span>
                <span className="mt-1 block text-[10px] leading-snug text-gray-400">{strategy.result}</span>
                <span className={`mt-1 block font-mono text-[11px] font-bold ${strategy.amountLabel.startsWith('+') ? 'text-emerald-300' : 'text-rose-300'}`}>{strategy.amountLabel}</span>
              </button>
            );
          })}
        </div>
        <div className="mt-3 border-t border-gray-800 pt-2">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Intervention audit</p>
          {audit.length === 0 ? (
            <p className="mt-1 text-[10px] text-gray-500">No strategy booked on this incident yet.</p>
          ) : (
            <ul className="mt-2 space-y-1">
              {audit.slice(0, 3).map((row) => (
                <li key={row.id} className="text-[10px] leading-snug text-gray-300">
                  <span className="font-bold text-emerald-300">{row.strategy}</span> · {row.amount} · {row.title}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}

export default function DigitalTwinCommandCenter() {
  const [activeModules, setActiveModules] = useState([]);
  const [alertFloor, setAlertFloor] = useState(null);
  const [activeScenario, setActiveScenario] = useState(null);
  const [resolved, setResolved] = useState(false);
  const [chosen, setChosen] = useState(null);
  const [roiLedger, setRoiLedger] = useState([]);
  const [audit, setAudit] = useState([]);
  const [glFailed, setGlFailed] = useState(false);
  const [selectedZone, setSelectedZone] = useState('zone-c');

  const triggerScenario = (scenario) => {
    const next = SCENARIOS[scenario];
    setResolved(false);
    setChosen(null);
    setActiveScenario(scenario);
    setActiveModules(next.modules);
    setAlertFloor(next.floor);
  };

  const applyStrategy = (key) => {
    if (!activeScenario || resolved) return;
    const strategy = SCENARIOS[activeScenario].strategies[key];
    const entry = {
      id: `${activeScenario}-${key}-${Date.now()}`,
      strategy: key,
      title: strategy.title,
      detail: strategy.detail,
      amount: strategy.amountLabel,
    };
    setChosen(key);
    setResolved(true);
    setAlertFloor((prev) => (prev ? { ...prev, color: 'green', msg: 'System Stabilized' } : prev));
    setRoiLedger((prev) => [entry, ...prev]);
    setAudit((prev) => [entry, ...prev]);
    toast.success(`Strategy ${key} dispatched in Dry-Run mode. ${strategy.amountLabel} posted to the Executive ROI ledger.`);
  };

  const handleApproveExecute = () => applyStrategy('A');

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
            <h2 className="text-[10px] font-bold uppercase tracking-widest text-gray-500">{spec ? 'War Room' : 'Module Dock'}</h2>
            <p className="mt-1 text-sm font-semibold text-white">{spec ? 'Three-stage incident resolution' : 'Live Telemetry Summaries'}</p>
          </div>
          <div className="dt-scroll flex-1 space-y-4 overflow-y-auto p-4">
            {spec && (
              <WarRoom spec={spec} resolved={resolved} chosen={chosen} audit={audit.filter((row) => row.id.startsWith(activeScenario))} onStrategy={applyStrategy} />
            )}
            {!spec && (<>
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
            </>)}
          </div>
        </aside>

        <section className="relative flex min-h-[420px] w-full flex-1 items-center justify-center bg-gray-900 shadow-[inset_0_0_120px_rgba(0,0,0,1)] lg:w-2/4 lg:flex-none">
          {spec && (
            <div className="absolute top-0 z-30 w-full">
              <div className={`dt-fade-down flex items-center gap-3 border-b px-6 py-3 backdrop-blur-sm ${spec.banner.shell}`}>
                <span className="animate-pulse text-2xl">{spec.banner.emoji}</span>
                <div>
                  <h3 className="text-sm font-bold tracking-wide">{spec.banner.title}</h3>
                  <p className={`text-xs ${spec.banner.detailClass}`}>{spec.banner.detail}</p>
                </div>
              </div>
            </div>
          )}

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
                setActiveModules([]);
                setAlertFloor(null);
                setActiveScenario(null);
                setResolved(false);
                setChosen(null);
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
              <p className="mt-2 text-[11px] leading-relaxed text-gray-400">
                {resolved ? `Strategy ${chosen} booked. Floor marker is nominal. The ledger line stays.` : 'Pick a strategy on the left, or approve Strategy A from here. Dry-run only.'}
              </p>
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
