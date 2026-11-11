import React, { useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Activity, ChevronDown, Droplets, Fan, FileCheck2, Gauge, Lightbulb, ShieldCheck, SlidersHorizontal, ToggleRight, Waves } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import AppShell from '../layouts/AppShell';
import BuildingScene from '../components/BuildingScene';
import CssTower from '../components/CssTower';
import NilmTimeSeriesChart from '../components/NilmTimeSeriesChart';
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

// Evidence and control metadata used by the War Room. These are intentionally
// scenario-local so the pitch can show how separate EMS domains converge on one
// incident without pretending that a dry-run is live building control.
const SCENARIO_DEEP_DATA = {
  ae_co2_spike: {
    telemetry: [
      { source: 'RESERVE / ACCESS', signal: 'Booked vs actual headcount', value: '20 → 350 pax', baseline: '20 pax', delta: '+1,650%', status: 'OVER CAPACITY', tone: 'red', detail: '17.5× booking variance' },
      { source: 'INDOOR / EQ-3', signal: 'L8 CO₂ concentration', value: '1,500 ppm', baseline: '< 1,000 ppm', delta: '+500 ppm', status: 'BREACH', tone: 'red', detail: 'GreenRE EQ-3 red line' },
      { source: 'ELECTRIC / NILM', signal: 'AHU fan load', value: '126 kW', baseline: '82 kW', delta: '+44 kW', status: 'COMPENSATING', tone: 'amber', detail: 'Fan at high speed; air not exchanging' },
    ],
    assetLifecycle: { lastServiced: '180 days ago', location: 'L8 podium AHU room', protocol: 'BACnet/IP · AO-08-DA' },
    deepStrategies: {
      A: { action: 'Send forced-open command to VAV-08 via BACnet/IP.', impact: 'CO₂ expected below 900 ppm in ~12 seconds.', cost: 'Transient +44 kW fan demand', avoided: '+ RM 400.00 avoided tenant/compliance exposure', risk: 'Revert to automatic control after recovery.', operator: 'Energy Manager · dry-run authority' },
      B: { action: 'Dispatch emergency work order to technician Tan.', impact: 'Bearing replacement estimated at 45 minutes.', cost: '− RM 200.00 labor / call-out', avoided: 'Prevents repeat breach after temporary recovery', risk: 'Room remains above threshold until arrival.', operator: 'Facilities Supervisor · RBAC L2' },
    },
  },
  cool_night_gap: {
    telemetry: [
      { source: 'RESERVE / ACCESS', signal: 'L2 occupancy at event time', value: '0 pax', baseline: '0 pax', delta: 'No demand', status: 'VACANT', tone: 'green', detail: 'No legitimate water draw expected' },
      { source: 'WATER / M-PODIUM', signal: 'Pressure + continuous flow', value: '−1.6 bar · 0.8 m³/h', baseline: '4.2 bar · 0.0 m³/h', delta: 'Leak signature', status: 'ANOMALY', tone: 'red', detail: 'Static night baseline violated' },
      { source: 'ELECTRIC / PUMP-02', signal: 'Booster short-cycles', value: '14 starts / h', baseline: '< 2 starts / h', delta: '+12 starts', status: 'CYCLING', tone: 'amber', detail: 'Phantom pump energy load' },
    ],
    assetLifecycle: { lastServiced: '92 days ago', location: 'L2 podium riser · Branch B', protocol: 'Modbus TCP · XV-L2-04' },
    deepStrategies: {
      A: { action: 'Close the L2 sectional solenoid to isolate branch B.', impact: 'Stops leak flow and pump short-cycling immediately.', cost: 'Temporary loss of L2 branch service', avoided: '+ RM 95.50 water + pump energy saved', risk: 'Verify no critical tenant demand before isolation.', operator: 'Water Sentinel · automated dry-run' },
      B: { action: 'Dispatch on-duty plumber with ultrasonic detector.', impact: 'Permanent repair after night inspection.', cost: '− RM 180.00 night-shift surcharge', avoided: 'Finds hidden leak before pipe failure', risk: '0.8 m³/h loss continues until arrival.', operator: 'Facilities Supervisor · RBAC L2' },
    },
  },
  office_vav_fault: {
    telemetry: [
      { source: 'RESERVE / ZONE', signal: 'L8 occupancy context', value: '84 pax', baseline: '76 pax', delta: '+11%', status: 'NORMAL', tone: 'green', detail: 'Occupancy does not explain load' },
      { source: 'INDOOR / VAV-08', signal: 'Zone temperature', value: '16.1°C', baseline: '24.0°C setpoint', delta: '−7.9°C', status: 'OVER-COOL', tone: 'red', detail: 'Peer floors remain normal' },
      { source: 'ELECTRIC / NILM', signal: 'Office zone demand', value: '126 kW', baseline: '45 kW peer avg', delta: '+81 kW', status: 'SURGE', tone: 'amber', detail: 'Reheat + fan compensation' },
    ],
    assetLifecycle: { lastServiced: '61 days ago', location: 'L8 west office ceiling void', protocol: 'BACnet/IP · VAV-08-AI' },
    deepStrategies: {
      A: { action: 'Reset VAV-08 to design airflow and clear reheat override.', impact: 'Returns zone to 24.0°C design setpoint.', cost: 'Short transient airflow change', avoided: '+ RM 285.04 excess cooling avoided', risk: 'Monitor comfort for five minutes after reset.', operator: 'Energy Manager · dry-run authority' },
      B: { action: 'Create field ticket for actuator and sensor inspection.', impact: 'Permanent diagnosis at next maintenance window.', cost: '− RM 150.00 labor / ticket', avoided: 'Prevents recurring over-cool energy waste', risk: 'Over-cooling continues until technician arrives.', operator: 'Facilities Supervisor · RBAC L2' },
    },
  },
  podium_lighting_fault: {
    telemetry: [
      { source: 'RESERVE / ACCESS', signal: 'Podium occupancy', value: '0 pax', baseline: '0 pax', delta: 'No demand', status: 'VACANT', tone: 'green', detail: 'After-hours schedule expected' },
      { source: 'INDOOR / SCHEDULE', signal: 'Night setback command', value: 'ON', baseline: 'OFF', delta: 'Override held', status: 'BREACH', tone: 'red', detail: 'Occupancy sensor failed closed' },
      { source: 'ELECTRIC / LTG-L2', signal: 'Lighting circuit load', value: '176 kW', baseline: '18 kW', delta: '+158 kW', status: 'FULL LOAD', tone: 'amber', detail: 'Daytime load after 22:00' },
    ],
    assetLifecycle: { lastServiced: '244 days ago', location: 'L2 podium lighting control panel', protocol: 'BACnet MS/TP · LTG-L2-OC' },
    deepStrategies: {
      A: { action: 'Force night lighting schedule and bypass failed occupancy input.', impact: 'Circuit drops to the 18 kW night setback immediately.', cost: 'Temporary sensor bypass', avoided: '+ RM 420.00 after-hours energy avoided', risk: 'Restore sensor interlock after replacement.', operator: 'Energy Manager · dry-run authority' },
      B: { action: 'Dispatch electrician to replace occupancy sensor.', impact: 'Restores automatic schedule control permanently.', cost: '− RM 160.00 labor / call-out', avoided: 'Prevents recurring night-load waste', risk: '176 kW load remains until repair.', operator: 'Facilities Supervisor · RBAC L2' },
    },
  },
  rainstorm_cooling: {
    telemetry: [
      { source: 'WEATHER / FABRIC', signal: 'Humidity + outdoor temperature', value: '96% RH · 22.4°C', baseline: '78% RH · 28.0°C', delta: '+18% RH', status: 'STORM FRONT', tone: 'red', detail: 'Dew-point protection active' },
      { source: 'WATER / SUMP-SYS-02', signal: 'Basement stormwater pump', value: 'Full load', baseline: 'Standby', delta: '+110 kW', status: 'RUNNING', tone: 'amber', detail: 'Rainwater plant at 96%' },
      { source: 'ELECTRIC / TNB MD', signal: 'Building maximum demand', value: '2,048 kW', baseline: '2,100 kW limit', delta: '52 kW headroom', status: 'AT RISK', tone: 'red', detail: 'One more pump start breaches MD' },
    ],
    assetLifecycle: { lastServiced: '27 days ago', location: 'Plant room + basement sump', protocol: 'BACnet/IP · MD-SHED-01' },
    deepStrategies: {
      A: { action: 'Sequence chillers and shed non-critical pump/VAV demand.', impact: 'Frees approximately 70 kW safety margin under TNB limit.', cost: 'Comfort margin narrows in non-critical zones', avoided: '+ RM 5,900.00 TNB maximum-demand penalty avoided', risk: 'Keep sump protection and critical cooling locked on.', operator: 'Peak Demand Controller · RBAC L3' },
      B: { action: 'Maintain full load and accept the maximum-demand peak.', impact: 'No operational intervention; storm response remains unchanged.', cost: '− RM 5,900.00 penalty incurred', avoided: 'None; preserves maximum comfort margin', risk: 'TNB MD threshold is crossed by the next coincident start.', operator: 'Energy Manager · approval required' },
    },
  },
};

const SCENARIO_REPORT_METRICS = {
  ae_co2_spike: { energySavedKwh: 44, carbonSavedKg: 25.7, clause: 'GreenRE EQ-3', outcome: 'CO₂ expected below 900 ppm in ~12 seconds' },
  cool_night_gap: { energySavedKwh: 6.4, carbonSavedKg: 3.7, clause: 'GreenRE WE 1-1', outcome: 'Leak isolated; pump short-cycling stopped' },
  office_vav_fault: { energySavedKwh: 81, carbonSavedKg: 47.4, clause: 'GreenRE EE-1', outcome: 'L8 zone returned to design setpoint' },
  podium_lighting_fault: { energySavedKwh: 158, carbonSavedKg: 92.4, clause: 'GreenRE EE-1', outcome: 'Lighting circuit dropped to night setback' },
  rainstorm_cooling: { energySavedKwh: 70, carbonSavedKg: 40.9, clause: 'TNB MD / GreenRE EE-1', outcome: '70 kW safety margin restored under 2,100 kW limit' },
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
      <div className="mb-1 flex justify-between text-xs text-gray-500">
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
  if (id === 'water' && scenario === 'rainstorm_cooling') return FRAME.blue;
  if (id === 'indoor' && scenario === 'rainstorm_cooling') return FRAME.cyan;
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
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">{title}</p>
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

function AssetIcon({ scenarioId }) {
  if (scenarioId === 'cool_night_gap') return <Droplets className="size-4 text-sky-300" />;
  if (scenarioId === 'podium_lighting_fault') return <Lightbulb className="size-4 text-amber-300" />;
  if (scenarioId === 'rainstorm_cooling') return <Waves className="size-4 text-cyan-300" />;
  return <Fan className="size-4 text-orange-300" />;
}

function SignalReadout({ label, value, tone = 'cyan', detail }) {
  const tones = {
    cyan: 'border-cyan-900/70 bg-cyan-950/30 text-cyan-200',
    red: 'border-red-900/70 bg-red-950/30 text-red-200',
    amber: 'border-amber-900/70 bg-amber-950/30 text-amber-200',
    green: 'border-emerald-900/70 bg-emerald-950/30 text-emerald-200',
  };
  return (
    <div className={`rounded border px-2 py-1.5 ${tones[tone]}`}>
      <div className="flex items-center justify-between gap-2 text-[11px] font-bold uppercase tracking-wide opacity-70">
        <span>{label}</span><Activity className="size-3" />
      </div>
      <div className="mt-0.5 font-mono text-sm font-bold">{value}</div>
      {detail && <div className="mt-0.5 text-[11px] opacity-70">{detail}</div>}
    </div>
  );
}

function TelemetryMatrix({ rows }) {
  const toneClass = {
    red: 'border-red-900/70 bg-red-950/30 text-red-200',
    amber: 'border-amber-900/70 bg-amber-950/30 text-amber-200',
    green: 'border-emerald-900/70 bg-emerald-950/30 text-emerald-200',
    cyan: 'border-cyan-900/70 bg-cyan-950/30 text-cyan-200',
  };
  return (
    <div className="mt-3 rounded-lg border border-slate-800 bg-slate-950/80 p-2">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-wide text-slate-300">Multi-source telemetry matrix</span>
        <span className="font-mono text-[11px] text-slate-500">3 SIGNAL DOMAINS · CORRELATED</span>
      </div>
      <div className="space-y-1.5">
        {rows.map((row) => (
          <div key={row.source} className={`rounded border p-2 ${toneClass[row.tone] || toneClass.cyan}`}>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wide opacity-70">{row.source}</span>
              <span className="rounded bg-black/25 px-1.5 py-0.5 font-mono text-[11px] font-bold">{row.status}</span>
            </div>
            <div className="mt-1 grid grid-cols-[1.3fr_1fr_auto] items-end gap-2">
              <span className="text-xs font-semibold">{row.signal}</span>
              <span className="font-mono text-xs font-bold">{row.value}</span>
              <span className="font-mono text-xs font-bold">{row.delta}</span>
            </div>
            <div className="mt-1 flex justify-between gap-2 text-[11px] opacity-65"><span>Baseline: {row.baseline}</span><span>{row.detail}</span></div>
          </div>
        ))}
      </div>
    </div>
  );
}

function WarRoom({ spec, scenarioId, resolved, chosen, audit, onStrategy, controls, onDamperChange, onSolenoidToggle }) {
  const healthTone = spec.asset.health <= 20 ? 'bg-red-500' : 'bg-amber-400';
  const telemetryScenario = scenarioId === 'cool_night_gap'
    ? 'cool_night_gap'
    : scenarioId === 'rainstorm_cooling'
      ? 'tropical_heatwave'
      : scenarioId === 'podium_lighting_fault'
        ? 'podium_lighting_fault'
        : 'office_vav_fault';
  const controlReady = scenarioId === 'ae_co2_spike'
    ? controls.damper >= 65
    : scenarioId === 'cool_night_gap'
      ? controls.solenoidClosed
      : true;
  return (
    <div className="space-y-3">
      <section className="rounded-lg border border-red-900/70 bg-gray-950 p-3">
        <p className="text-xs font-bold uppercase tracking-widest text-red-400">Stage 1 · Root cause</p>
        <h3 className="mt-1 text-sm font-semibold text-white">Baseline deviation</h3>
        <div className="mt-3 grid grid-cols-3 gap-1.5">
          <SignalReadout label="Signal confidence" value="96.4%" detail="cross-module match" />
          <SignalReadout label="Deviation" value={scenarioId === 'rainstorm_cooling' ? '+60 kW' : scenarioId === 'cool_night_gap' ? '−1.6 bar' : '2.4×'} tone="red" detail="vs baseline" />
          <SignalReadout label="Window" value={scenarioId === 'cool_night_gap' ? '03:00' : '14:00'} tone="amber" detail="active sample" />
        </div>
        <div className="mt-3">
          <EvidenceChart {...spec.chart} />
        </div>
        <div className="mt-3 rounded-lg border border-slate-800 bg-slate-950/80 p-2">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wide text-slate-300">Live disaggregated telemetry</span>
            <span className="font-mono text-[11px] text-emerald-300">STREAMING · 5s</span>
          </div>
          <NilmTimeSeriesChart currentTime={scenarioId === 'cool_night_gap' ? '03:00' : '14:00'} scenario={telemetryScenario} />
        </div>
        <TelemetryMatrix rows={spec.telemetry || []} />
        <div className="mt-2 grid grid-cols-2 gap-2">
          {spec.cross.map((item) => (
            <div key={item.label} className={`rounded border bg-gray-900 p-2 ${item.alert ? 'border-red-500/60' : 'border-gray-800'}`}>
              <div className="text-[11px] uppercase text-gray-500">{item.label}</div>
              <div className={`font-mono text-sm ${item.alert ? 'font-bold text-red-300' : 'text-white'}`}>{item.value}</div>
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs leading-snug text-gray-400">{spec.crossNote}</p>
      </section>

      <section className="rounded-lg border border-amber-800/70 bg-gray-950 p-3">
        <p className="text-xs font-bold uppercase tracking-widest text-amber-400">Stage 2 · Asset thread</p>
        <div className="mt-1 flex items-center gap-2">
          <div className="rounded-md border border-slate-700 bg-slate-900 p-2"><AssetIcon scenarioId={scenarioId} /></div>
          <h3 className="text-sm font-semibold text-white">{spec.asset.name}</h3>
        </div>
        <dl className="mt-2 space-y-1 font-mono text-[13px] text-gray-300">
          <div className="flex justify-between gap-2"><dt className="text-gray-500">Asset ID</dt><dd>{spec.asset.id}</dd></div>
          <div className="flex items-center justify-between gap-2"><dt className="text-gray-500">Fault code</dt><dd className="rounded bg-red-950 px-1.5 py-0.5 text-right text-xs text-red-200 ring-1 ring-red-800">{spec.asset.code}</dd></div>
        </dl>
        <div className="mt-3">
          <div className="mb-1 flex justify-between text-xs text-gray-500">
            <span>Health score</span>
            <span className={spec.asset.health <= 20 ? 'font-bold text-red-400' : 'font-bold text-amber-300'}>{spec.asset.health}% critical wear</span>
          </div>
          <div className="h-1.5 rounded-full bg-gray-800">
            <div className={`h-1.5 rounded-full ${healthTone}`} style={{ width: `${spec.asset.health}%` }} />
          </div>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-1.5 text-[11px]">
          <div className="rounded border border-slate-800 bg-slate-900 p-2"><span className="block uppercase text-gray-500">Last serviced</span><span className="mt-0.5 block font-mono font-bold text-gray-200">{spec.assetLifecycle?.lastServiced || '—'}</span></div>
          <div className="rounded border border-slate-800 bg-slate-900 p-2"><span className="block uppercase text-gray-500">Control protocol</span><span className="mt-0.5 block font-mono font-bold text-gray-200">{spec.assetLifecycle?.protocol || '—'}</span></div>
        </div>
        <p className="mt-2 text-[11px] text-gray-500">Location: <span className="text-gray-300">{spec.assetLifecycle?.location || 'Unregistered'}</span></p>
        {scenarioId === 'ae_co2_spike' && (
          <div className="mt-3 rounded-md border border-orange-800/70 bg-orange-950/30 p-2">
            <div className="flex items-center justify-between text-xs font-bold text-orange-200">
              <span className="flex items-center gap-1"><SlidersHorizontal className="size-3" /> VAV-08 damper command</span>
              <span className="font-mono text-orange-300">{controls.damper}%</span>
            </div>
            <input aria-label="VAV-08 damper override" type="range" min="15" max="100" step="5" value={controls.damper} onChange={(event) => onDamperChange(Number(event.target.value))} className="mt-2 h-1.5 w-full accent-orange-400" />
            <div className="mt-1 flex justify-between text-[11px] text-gray-500"><span>15% stuck</span><span>65% target</span><span>100%</span></div>
          </div>
        )}
        {scenarioId === 'cool_night_gap' && (
          <button type="button" onClick={onSolenoidToggle} className={`mt-3 flex w-full items-center justify-between rounded-md border px-2 py-2 text-left ${controls.solenoidClosed ? 'border-emerald-500 bg-emerald-950/50' : 'border-sky-800 bg-sky-950/30'}`}>
            <span className="flex items-center gap-2 text-xs font-bold text-sky-100"><ToggleRight className="size-4" /> CLOSE SECTIONAL SOLENOID</span>
            <span className={`font-mono text-xs font-bold ${controls.solenoidClosed ? 'text-emerald-300' : 'text-sky-300'}`}>{controls.solenoidClosed ? 'CLOSED' : 'OPEN'}</span>
          </button>
        )}
      </section>

      <section className="rounded-lg border border-emerald-900/70 bg-gray-950 p-3">
        <p className="text-xs font-bold uppercase tracking-widest text-emerald-400">Stage 3 · What-if</p>
        <h3 className="mt-1 text-sm font-semibold text-white">Intervention and payback</h3>
        <div className="mt-3 space-y-2">
          {['A', 'B'].map((key) => {
            const strategy = { ...spec.strategies[key], ...(spec.deepStrategies?.[key] || {}) };
            const selected = chosen === key;
            return (
              <button
                key={key}
                type="button"
                disabled={resolved}
                onClick={() => onStrategy(key)}
                className={`w-full rounded-md border px-3 py-2 text-left disabled:cursor-default ${
                  selected ? 'border-emerald-400 bg-emerald-950/50' : key === 'A' && controlReady ? 'border-cyan-400 bg-cyan-950/40 shadow-[0_0_14px_rgba(34,211,238,0.18)]' : 'border-gray-700 bg-gray-900 hover:border-gray-500'
                }`}
              >
                <span className="flex items-center justify-between gap-2 text-[13px] font-bold text-white"><span>{strategy.label}</span>{key === 'A' && controlReady && !resolved && <span className="rounded bg-cyan-400 px-1.5 py-0.5 text-[11px] text-gray-950">READY</span>}</span>
                <span className="mt-1 block text-xs leading-snug text-gray-400">{strategy.result}</span>
                <div className="mt-2 grid min-w-0 grid-cols-2 gap-x-3 gap-y-2 border-t border-gray-800 pt-2 text-[11px]">
                  <div className="min-w-0"><span className="block uppercase tracking-wide text-gray-500">Action</span><b className="mt-0.5 block break-words font-normal leading-snug text-gray-300">{strategy.action}</b></div>
                  <div className="min-w-0"><span className="block uppercase tracking-wide text-gray-500">Impact</span><b className="mt-0.5 block break-words font-normal leading-snug text-emerald-200">{strategy.impact}</b></div>
                  <div className="min-w-0"><span className="block uppercase tracking-wide text-gray-500">Cost</span><b className="mt-0.5 block break-words font-normal leading-snug text-amber-200">{strategy.cost}</b></div>
                  <div className="min-w-0"><span className="block uppercase tracking-wide text-gray-500">Avoided</span><b className="mt-0.5 block break-words font-normal leading-snug text-cyan-200">{strategy.avoided}</b></div>
                </div>
                <div className="mt-2 grid min-w-0 grid-cols-2 gap-x-3 gap-y-1 border-t border-gray-800/70 pt-2 text-[11px]">
                  <div className="min-w-0"><span className="block uppercase tracking-wide text-gray-500">Risk</span><span className="mt-0.5 block break-words leading-snug text-gray-400">{strategy.risk}</span></div>
                  <div className="min-w-0"><span className="block uppercase tracking-wide text-gray-500">Operator</span><span className="mt-0.5 block break-words leading-snug text-gray-400">{strategy.operator}</span></div>
                </div>
                <span className={`mt-2 block font-mono text-[13px] font-bold ${strategy.amountLabel.startsWith('+') ? 'text-emerald-300' : 'text-rose-300'}`}>{strategy.amountLabel}</span>
              </button>
            );
          })}
        </div>
        <div className="mt-3 border-t border-gray-800 pt-2">
          <p className="text-xs font-bold uppercase tracking-widest text-gray-500">Intervention audit</p>
          {audit.length === 0 ? (
            <p className="mt-1 text-xs text-gray-500">No strategy booked on this incident yet.</p>
          ) : (
            <ul className="mt-2 space-y-1">
              {audit.slice(0, 3).map((row) => (
                <li key={row.id} className="rounded border border-slate-800 bg-slate-900/80 p-2 text-[11px] leading-snug text-gray-300">
                  <div className="flex items-center justify-between gap-2"><span className="font-bold text-emerald-300">{row.strategy} · {row.amount}</span><span className="font-mono text-gray-500">{row.time}</span></div>
                  <div className="mt-1 font-semibold text-gray-200">{row.title}</div>
                  <div className="mt-1 grid grid-cols-2 gap-x-2 text-gray-500"><span>Actor: <b className="font-normal text-gray-300">{row.actor}</b></span><span>Role: <b className="font-normal text-gray-300">{row.role}</b></span><span>Identity: <b className="font-normal text-cyan-300">{row.identity}</b></span><span>Command: <b className="font-normal text-gray-300">{row.command}</b></span></div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}

function IdleCommandBrief({ onSelectScenario }) {
  const steps = [
    { index: '01', title: 'Inject a case', detail: 'Choose one of five cross-module incident drills from the Scenario Injector.', tone: 'border-cyan-800 bg-cyan-950/30 text-cyan-200' },
    { index: '02', title: 'Read the evidence chain', detail: 'Baseline deviation, asset DNA, fault code, and AI diagnosis snap into the War Room.', tone: 'border-amber-800 bg-amber-950/30 text-amber-200' },
    { index: '03', title: 'Execute the response', detail: 'Adjust the digital control, approve a dry-run strategy, and post the avoided-loss ledger.', tone: 'border-emerald-800 bg-emerald-950/30 text-emerald-200' },
  ];

  return (
    <div className="space-y-3">
      <section className="rounded-lg border border-cyan-800/70 bg-gradient-to-br from-cyan-950/50 via-gray-950 to-gray-950 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-400">Digital Twin Command Center</p>
            <h3 className="mt-1 text-lg font-bold text-white">Scenario sandbox ready</h3>
            <p className="mt-2 text-[13px] leading-relaxed text-gray-400">This view is reserved for incident simulation, spatial localization, and closed-loop intervention. Live operational telemetry remains in the Electric, Indoor, Water, and Waste modules.</p>
          </div>
          <div className="rounded-full border border-emerald-700 bg-emerald-950/50 px-2 py-1 font-mono text-[11px] font-bold text-emerald-300">DRY-RUN</div>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-1.5">
          <div className="rounded border border-gray-800 bg-gray-900/80 p-2"><div className="font-mono text-lg font-bold text-white">05</div><div className="text-[11px] uppercase text-gray-500">drill cases</div></div>
          <div className="rounded border border-gray-800 bg-gray-900/80 p-2"><div className="font-mono text-lg font-bold text-white">04</div><div className="text-[11px] uppercase text-gray-500">linked domains</div></div>
          <div className="rounded border border-gray-800 bg-gray-900/80 p-2"><div className="font-mono text-lg font-bold text-white">03</div><div className="text-[11px] uppercase text-gray-500">response stages</div></div>
        </div>
      </section>

      <section className="rounded-lg border border-gray-800 bg-gray-950 p-3">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Command sequence</p>
          <span className="font-mono text-[11px] text-gray-600">TWIN.MODE / READY</span>
        </div>
        <div className="space-y-2">
          {steps.map((step) => (
            <div key={step.index} className={`rounded border p-2.5 ${step.tone}`}>
              <div className="flex items-center gap-2"><span className="font-mono text-xs font-bold opacity-60">{step.index}</span><span className="text-[13px] font-bold">{step.title}</span></div>
              <p className="mt-1 pl-7 text-xs leading-snug opacity-70">{step.detail}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-gray-800 bg-gray-950 p-3">
        <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Recommended opening drill</p>
        <button type="button" onClick={() => onSelectScenario('ae_co2_spike')} className="mt-2 w-full rounded-md border border-red-800 bg-red-950/40 p-3 text-left hover:border-red-500">
          <div className="flex items-center justify-between gap-2"><span className="text-xs font-bold text-red-100">L8 Meeting CO₂ Surge</span><span className="font-mono text-xs text-emerald-300">+ RM 400</span></div>
          <p className="mt-1 text-xs leading-snug text-red-200/70">Best demonstration of Reserve → Indoor → Electric evidence linkage and live damper control.</p>
        </button>
      </section>
    </div>
  );
}

export default function DigitalTwinCommandCenter() {
  const navigate = useNavigate();
  const [activeModules, setActiveModules] = useState([]);
  const [alertFloor, setAlertFloor] = useState(null);
  const [activeScenario, setActiveScenario] = useState(null);
  const [resolved, setResolved] = useState(false);
  const [chosen, setChosen] = useState(null);
  const [roiLedger, setRoiLedger] = useState([]);
  const [audit, setAudit] = useState([]);
  const [glFailed, setGlFailed] = useState(false);
  const [selectedZone, setSelectedZone] = useState('zone-c');
  const [controls, setControls] = useState({ damper: 15, solenoidClosed: false });

  const triggerScenario = (scenario) => {
    const next = SCENARIOS[scenario];
    setResolved(false);
    setChosen(null);
    setActiveScenario(scenario);
    setActiveModules(next.modules);
    setAlertFloor(next.floor);
    setControls({ damper: 15, solenoidClosed: false });
  };

  const applyStrategy = (key) => {
    if (!activeScenario || resolved) return;
    const strategy = {
      ...SCENARIOS[activeScenario].strategies[key],
      ...(SCENARIO_DEEP_DATA[activeScenario]?.deepStrategies?.[key] || {}),
    };
    const reportMetrics = SCENARIO_REPORT_METRICS[activeScenario] || {};
    const auditTime = new Date();
    const entry = {
      id: `${activeScenario}-${key}-${Date.now()}`,
      strategy: key,
      title: strategy.title,
      detail: strategy.detail,
      amount: strategy.amountLabel,
      time: auditTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      actor: 'Aiman Rahman',
      role: strategy.operator || 'Energy Manager · dry-run authority',
      identity: 'JWT-RBAC / DEMO-042',
      command: strategy.action || strategy.label,
      scenarioId: activeScenario,
      scenarioTitle: SCENARIOS[activeScenario].banner.title,
      floor: SCENARIOS[activeScenario].floor.level,
      clause: reportMetrics.clause,
      outcome: reportMetrics.outcome,
      energySavedKwh: reportMetrics.energySavedKwh,
      carbonSavedKg: reportMetrics.carbonSavedKg,
      savedAt: auditTime.toISOString(),
    };
    const reportHandoff = {
      ...entry,
      telemetry: SCENARIO_DEEP_DATA[activeScenario]?.telemetry || [],
      asset: SCENARIOS[activeScenario].asset,
      reportStatus: 'READY_FOR_GREENRE_REVIEW',
    };
    try {
      window.localStorage.setItem('gogreen:lastScenarioIntervention', JSON.stringify(reportHandoff));
      window.dispatchEvent(new CustomEvent('gogreen:scenario-resolved', { detail: reportHandoff }));
    } catch (error) {
      console.warn('Scenario report handoff unavailable:', error);
    }
    fetch('/api/v1/reports/scenario-interventions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(reportHandoff),
    }).catch((error) => console.warn('Scenario evidence persistence unavailable:', error));
    setChosen(key);
    setResolved(true);
    setAlertFloor((prev) => (prev ? { ...prev, color: 'green', msg: 'System Stabilized' } : prev));
    setRoiLedger((prev) => [entry, ...prev]);
    setAudit((prev) => [entry, ...prev]);
    toast.success(`Strategy ${key} dispatched in Dry-Run mode. ${strategy.amountLabel} posted to the Executive ROI ledger.`);
  };

  const handleApproveExecute = () => applyStrategy('A');

  const spec = activeScenario ? {
    ...SCENARIOS[activeScenario],
    ...(SCENARIO_DEEP_DATA[activeScenario] || {}),
    asset: { ...SCENARIOS[activeScenario].asset, ...(SCENARIO_DEEP_DATA[activeScenario]?.asset || {}) },
  } : null;
  const meshFloor = alertFloor?.color === 'red' ? alertFloor.level : null;
  const labelTone = LABEL[alertFloor?.color] || LABEL.yellow;
  const pointUp = Boolean(alertFloor?.positionCss?.includes('bottom-'));
  const isOpen = (id) => activeModules.includes(id);
  const toggleModule = (id) => setActiveModules((prev) => (
    prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
  ));

  const electricKw = activeScenario === 'rainstorm_cooling' ? '1,840 kW'
    : activeScenario === 'cool_night_gap' ? '1,410 kW'
      : activeScenario === 'ae_co2_spike' ? '1,120 kW'
        : activeScenario === 'office_vav_fault' ? '1,580 kW'
          : activeScenario === 'podium_lighting_fault' ? '1,720 kW'
        : '1,240 kW';
  const electricMetricClass = activeScenario === 'rainstorm_cooling'
    ? 'animate-pulse text-red-400'
    : activeScenario === 'cool_night_gap' || activeScenario === 'office_vav_fault'
      ? 'animate-pulse text-orange-400'
      : activeScenario === 'podium_lighting_fault'
        ? 'animate-pulse text-amber-300'
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
        <aside className="flex max-h-[48vh] w-full shrink-0 flex-col overflow-hidden border-b border-gray-800 bg-gray-900 shadow-2xl lg:h-full lg:max-h-none lg:w-[42%] xl:w-[38%] lg:border-b-0 lg:border-r">
          <div className="border-b border-gray-800 p-4">
            <h2 className="text-xs font-bold uppercase tracking-widest text-gray-500">{spec ? 'War Room' : 'Command Brief'}</h2>
            <p className="mt-1 text-sm font-semibold text-white">{spec ? 'Three-stage incident resolution' : 'Scenario simulation and response control'}</p>
          </div>
          <div className="dt-scroll flex-1 space-y-4 overflow-y-auto p-4">
            {spec && (
                <WarRoom
                  spec={spec}
                  scenarioId={activeScenario}
                  resolved={resolved}
                  chosen={chosen}
                  audit={audit.filter((row) => row.id.startsWith(activeScenario))}
                  onStrategy={applyStrategy}
                  controls={controls}
                  onDamperChange={(damper) => setControls((prev) => ({ ...prev, damper }))}
                  onSolenoidToggle={() => setControls((prev) => ({ ...prev, solenoidClosed: !prev.solenoidClosed }))}
                />
            )}
            {!spec && <IdleCommandBrief onSelectScenario={triggerScenario} />}
            {false && (<>
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
                right={activeScenario === 'rainstorm_cooling' ? '95% Capacity' : activeScenario === 'cool_night_gap' ? 'Base wobble' : activeScenario === 'office_vav_fault' ? '91% Capacity' : activeScenario === 'podium_lighting_fault' ? '88% Capacity' : '87% Capacity'}
                barClass={
                  activeScenario === 'rainstorm_cooling' ? 'w-[95%] bg-red-500'
                    : activeScenario === 'cool_night_gap' ? 'w-[72%] bg-orange-500'
                      : activeScenario === 'office_vav_fault' ? 'w-[91%] bg-orange-500'
                        : activeScenario === 'podium_lighting_fault' ? 'w-[88%] bg-amber-400'
                      : activeScenario === 'ae_co2_spike' ? 'w-[54%] bg-cyan-500'
                        : 'w-[87%] bg-cyan-500'
                }
              />
              <Sparkline
                stroke={activeScenario === 'rainstorm_cooling' ? '#ef4444' : activeScenario === 'cool_night_gap' ? '#f97316' : '#22d3ee'}
                points={
                  activeScenario === 'rainstorm_cooling' ? [40, 48, 62, 78, 90, 96, 94, 95]
                    : activeScenario === 'cool_night_gap' ? [30, 32, 28, 58, 31, 62, 29, 60]
                      : [62, 64, 63, 66, 65, 67, 66, 68]
                }
              />
              {activeScenario === 'rainstorm_cooling' && (
                <div className="mt-3 flex items-start gap-2 rounded border border-red-900/50 bg-red-950/50 p-2">
                  <span className="animate-pulse text-xs text-red-500">⚠️</span>
                  <div className="text-xs leading-tight text-red-300">
                    <strong className="block text-red-400">Peak Demand Warning</strong>
                    Sump pumps and HVAC operating simultaneously. Approaching the 2,100 kW limit.
                  </div>
                </div>
              )}
              {activeScenario === 'cool_night_gap' && (
                <div className="mt-3 flex items-start gap-2 rounded border border-orange-900/50 bg-orange-950/50 p-2">
                  <span className="text-xs text-orange-500">⚠️</span>
                  <div className="text-xs leading-tight text-orange-300">
                    <strong className="block text-orange-400">Base-load Anomaly</strong>
                    Unscheduled pump load detected during unoccupied hours.
                  </div>
                </div>
              )}
              {activeScenario === 'ae_co2_spike' && (
                <p className="mt-3 text-xs leading-tight text-amber-200">AHU fan is holding. Fresh-air damper is not tracking the CO₂ call.</p>
              )}
              {activeScenario === 'office_vav_fault' && (
                <div className="mt-3 flex items-start gap-2 rounded border border-orange-900/50 bg-orange-950/50 p-2">
                  <span className="animate-pulse text-xs text-orange-400">⚠️</span>
                  <div className="text-xs leading-tight text-orange-200">
                    <strong className="block text-orange-300">Local demand spike</strong>
                    VAV-08 reheat and fan compensation are driving excess L8 kW.
                  </div>
                </div>
              )}
              {activeScenario === 'podium_lighting_fault' && (
                <div className="mt-3 flex items-start gap-2 rounded border border-amber-900/50 bg-amber-950/50 p-2">
                  <span className="animate-pulse text-xs text-amber-300">💡</span>
                  <div className="text-xs leading-tight text-amber-100">
                    <strong className="block text-amber-300">After-hours lighting load</strong>
                    Empty podium circuit remains at daytime load.
                  </div>
                </div>
              )}
              {!activeScenario && <p className="mt-2 text-xs text-emerald-400">Nominal demand. No unscheduled plant load.</p>}
            </DockCard>

            <DockCard
              id="indoor"
              scenario={activeScenario}
              open={isOpen('indoor')}
              onToggle={() => toggleModule('indoor')}
              icon={<span className="text-green-400">💨</span>}
              title="IEQ & HVAC"
              metric={activeScenario === 'ae_co2_spike' ? 'L8 ALERT' : activeScenario === 'office_vav_fault' ? 'VAV FAULT' : activeScenario === 'rainstorm_cooling' ? 'VAV SHIFT' : 'AQI OK'}
              metricClass={activeScenario === 'ae_co2_spike' ? 'animate-pulse text-red-400' : activeScenario === 'office_vav_fault' ? 'animate-pulse text-orange-300' : activeScenario === 'rainstorm_cooling' ? 'text-cyan-300' : 'text-green-400'}
            >
              <div className="mb-2 grid grid-cols-2 gap-3">
                <div className="rounded border border-gray-800 bg-gray-900 p-2">
                  <div className="text-[11px] uppercase text-gray-500">Avg Temp</div>
                  <div className={`font-mono text-sm text-white ${activeScenario === 'rainstorm_cooling' ? 'animate-pulse' : ''}`}>
                    {activeScenario === 'rainstorm_cooling' ? '22.4°C' : activeScenario === 'office_vav_fault' ? '16.1°C' : '24.2°C'}
                  </div>
                </div>
                <div className={`rounded border bg-gray-900 p-2 ${activeScenario === 'ae_co2_spike' ? 'border-red-500/50' : 'border-gray-800'}`}>
                  <div className="text-[11px] uppercase text-gray-500">Peak CO₂ (L8)</div>
                  <div className={`font-mono text-sm ${activeScenario === 'ae_co2_spike' ? 'animate-pulse font-bold text-red-400' : 'text-white'}`}>
                    {activeScenario === 'ae_co2_spike' ? '1,500 ppm' : '420 ppm'}
                  </div>
                </div>
              </div>
              <Meter
                label="L8 relative humidity"
                right={activeScenario === 'rainstorm_cooling' ? '78% RH' : '55% RH'}
                barClass={activeScenario === 'rainstorm_cooling' ? 'w-[78%] bg-cyan-400' : 'w-[55%] bg-emerald-500'}
              />
              <Sparkline
                stroke={activeScenario === 'ae_co2_spike' ? '#f87171' : '#34d399'}
                points={activeScenario === 'ae_co2_spike' ? [420, 640, 880, 1100, 1280, 1410, 1500, 1490] : [48, 50, 49, 52, 51, 53, 52, 54]}
              />
              {activeScenario === 'ae_co2_spike' && (
                <div className="mt-2 flex items-start gap-2 rounded border border-red-900/50 bg-red-950/50 p-2">
                  <span className="text-xs text-red-500">🚨</span>
                  <div className="text-xs leading-tight text-red-300">
                    <strong className="block text-red-400">GreenRE EQ-3 Breach</strong>
                    CO₂ above the 1,000 ppm threshold. VAV-08 fresh air damper unresponsive.
                  </div>
                </div>
              )}
              {activeScenario === 'rainstorm_cooling' && (
                <div className="mt-2 flex items-start gap-2 rounded border border-cyan-900/50 bg-cyan-950/40 p-2">
                  <span className="text-xs text-cyan-300">💨</span>
                  <div className="text-xs leading-tight text-cyan-100">
                    <strong className="block text-cyan-300">Anti-condensation</strong>
                    Outdoor air mutated. VAV boxes and chillers retuned to hold surfaces above dew point.
                  </div>
                </div>
              )}
              {activeScenario === 'office_vav_fault' && (
                <div className="mt-2 flex items-start gap-2 rounded border border-orange-900/50 bg-orange-950/50 p-2">
                  <span className="text-xs text-orange-400">⚠️</span>
                  <div className="text-xs leading-tight text-orange-200">
                    <strong className="block text-orange-300">ASHRAE airflow fault</strong>
                    L8 is 8°C below setpoint while peer floors remain normal.
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
              metric={activeScenario === 'cool_night_gap' ? 'ΔP LEAK' : activeScenario === 'rainstorm_cooling' ? 'SUMP ON' : '4.2 bar'}
              metricClass={activeScenario === 'cool_night_gap' ? 'animate-pulse text-red-400' : activeScenario === 'rainstorm_cooling' ? 'animate-pulse text-blue-300' : 'text-sky-300'}
            >
              <div className="space-y-3">
                <Meter
                  label="L2 line pressure"
                  right={activeScenario === 'cool_night_gap' ? '2.6 bar' : '4.2 bar'}
                  barClass={activeScenario === 'cool_night_gap' ? 'w-[48%] bg-red-500' : 'w-[84%] bg-sky-500'}
                />
                <Meter
                  label="Harvest tank level"
                  right={activeScenario === 'rainstorm_cooling' ? '96%' : '64%'}
                  barClass={activeScenario === 'rainstorm_cooling' ? 'w-[96%] bg-blue-400' : 'w-[64%] bg-sky-500'}
                />
              </div>
              <Sparkline
                stroke={activeScenario === 'cool_night_gap' ? '#f87171' : '#38bdf8'}
                points={activeScenario === 'cool_night_gap' ? [84, 80, 76, 70, 74, 66, 72, 60] : activeScenario === 'rainstorm_cooling' ? [60, 68, 74, 82, 88, 93, 96, 95] : [62, 63, 64, 64, 65, 64, 64, 65]}
              />
              {activeScenario === 'rainstorm_cooling' && (
                <div className="mt-3 flex items-start gap-2 rounded border border-blue-900/50 bg-blue-950/40 p-2">
                  <span className="animate-pulse text-xs text-blue-300">🌧️</span>
                  <div className="text-xs leading-tight text-blue-100">
                    <strong className="block text-blue-300">Harvest at capacity</strong>
                    Rainwater plant is full. Subterranean sump pump is draining.
                  </div>
                </div>
              )}
              {activeScenario === 'cool_night_gap' && (
                <div className="mt-3 flex items-start gap-2 rounded border border-red-900/50 bg-red-950/50 p-2">
                  <span className="animate-pulse text-xs text-red-400">💧</span>
                  <div className="text-xs leading-tight text-red-200">
                    <strong className="block text-red-400">Hidden micro-leak</strong>
                    Pressure differential on the L2 podium while the floor is empty.
                  </div>
                </div>
              )}
              {!activeScenario && <p className="mt-2 text-xs text-emerald-400">Pressure stable. No leak signature.</p>}
            </DockCard>

            <DockCard
              id="reserve"
              scenario={activeScenario}
              open={isOpen('reserve')}
              onToggle={() => toggleModule('reserve')}
              icon={<span className="text-amber-300">💰</span>}
              title="Financial ROI"
              metric={activeScenario === 'ae_co2_spike' ? 'RM 200' : activeScenario === 'cool_night_gap' ? 'RM 90' : activeScenario === 'rainstorm_cooling' ? 'RM 480' : activeScenario === 'podium_lighting_fault' ? 'RM 420' : 'RM 0'}
              metricClass={activeScenario ? 'animate-pulse text-amber-300' : 'text-emerald-400'}
            >
              <Meter
                label="Open exposure"
                right={activeScenario === 'ae_co2_spike' ? '4 h labor' : activeScenario === 'cool_night_gap' ? 'tens of tonnes' : activeScenario === 'rainstorm_cooling' ? 'demand charge' : 'clear'}
                barClass={activeScenario ? 'w-[80%] bg-amber-400' : 'w-[8%] bg-emerald-500'}
              />
              <Sparkline
                stroke="#fbbf24"
                points={activeScenario ? [10, 18, 22, 40, 55, 70, 84, 90] : [12, 12, 11, 13, 12, 12, 11, 12]}
              />
              {activeScenario === 'ae_co2_spike' && (
                <p className="mt-2 text-xs leading-tight text-amber-100">Manual path is 4 hours and RM 200 labor, plus tenant-churn exposure. Approve books the avoidance.</p>
              )}
              {activeScenario === 'cool_night_gap' && (
                <p className="mt-2 text-xs leading-tight text-amber-100">Open leak path can lose tens of tonnes before morning. Valve isolation is the booked avoidance.</p>
              )}
              {activeScenario === 'rainstorm_cooling' && (
                <p className="mt-2 text-xs leading-tight text-amber-100">Drainage pumps and cooling share one peak. Coordination is the demand-charge avoidance.</p>
              )}
              {activeScenario === 'podium_lighting_fault' && (
                <p className="mt-2 text-xs leading-tight text-amber-100">Empty podium and 176 kW lighting load conflict. Restoring the schedule books RM 420 avoided loss.</p>
              )}
              {!activeScenario && <p className="mt-2 text-xs text-emerald-400">Ledger quiet. No open avoidance.</p>}
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
              <p className="mt-2 text-xs text-gray-400">Grid and plant intensity inside the monthly envelope.</p>
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
              <p className="mt-2 text-xs text-gray-400">Podium streams are tracking the diversion target.</p>
            </DockCard>
            </>)}
          </div>
        </aside>

        <div className="flex min-h-0 w-full flex-1 flex-col">
          {/* Scenario injector: a compact strip above the twin, so the building gets the full width below */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-gray-800 bg-gray-950 px-4 py-2.5">
            <div className="shrink-0">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-400">Scenario injector</p>
              <h2 className="text-sm font-semibold text-white">Ace linkage drills</h2>
            </div>
            <div className="flex min-w-0 flex-1 flex-wrap gap-2">
              {Object.entries(SCENARIOS).map(([id, item]) => {
                const on = activeScenario === id;
                return (
                  <button
                    key={id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => triggerScenario(id)}
                    className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-left text-xs font-semibold ${
                      on
                        ? 'border-cyan-400 bg-cyan-950/60 text-cyan-50'
                        : 'border-gray-700 bg-gray-900 text-gray-200 hover:border-gray-500'
                    }`}
                  >
                    {item.button}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <section className="relative flex min-h-[420px] w-full flex-1 items-center justify-center bg-gray-900 shadow-[inset_0_0_120px_rgba(0,0,0,1)]">
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

          <div className="relative z-10 h-full min-h-[420px] w-full">
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

        {/* Diagnosis + ROI ledger rail: only takes space when it has something to show */}
        {(spec || roiLedger.length > 0) && (
        <aside className="dt-scroll relative flex max-h-[46vh] w-full shrink-0 flex-col overflow-y-auto border-t border-gray-800 bg-gray-950 lg:max-h-none lg:w-80 lg:border-l lg:border-t-0">
          {spec && (
            <div className="border-b border-cyan-800 bg-gray-950 p-3">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-cyan-400">AI RAG diagnosis</p>
              <h3 className="mt-1 text-sm font-bold text-white">{spec.diagnosis.title}</h3>
              <p className="mt-2 text-[13px] leading-relaxed text-gray-300">{spec.diagnosis.body}</p>
              <p className="mt-2 rounded border border-amber-800/80 bg-amber-950/40 px-2 py-1.5 text-[13px] font-semibold text-amber-100">
                {spec.diagnosis.finding}
              </p>
              <p className="mt-2 text-[13px] leading-relaxed text-gray-400">
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
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-gray-500">Executive ROI ledger</p>
            {roiLedger.length === 0 ? (
              <p className="mt-2 text-[13px] text-gray-500">No booked avoidance yet. Approve a drill to post one.</p>
            ) : (
              <ul className="mt-2 max-h-28 space-y-2 overflow-y-auto">
                {roiLedger.map((row) => (
                  <li key={row.id} className="rounded border border-emerald-900/80 bg-emerald-950/30 px-2 py-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-[13px] font-semibold text-emerald-200">{row.title}</span>
                      <span className="shrink-0 text-[13px] font-bold text-emerald-300">{row.amount}</span>
                    </div>
                    <p className="mt-0.5 text-xs leading-snug text-gray-400">{row.detail}</p>
                  </li>
                ))}
              </ul>
            )}
            {roiLedger.length > 0 && (
              <button type="button" onClick={() => navigate('/executive?tab=reports')} className="mt-3 flex w-full items-center justify-center gap-2 rounded-md border border-cyan-800 bg-cyan-950/40 px-3 py-2 text-xs font-bold text-cyan-200 hover:border-cyan-400">
                <FileCheck2 className="size-3.5" /> Review in GreenRE Audit Reports
              </button>
            )}
          </div>
        </aside>
        )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
