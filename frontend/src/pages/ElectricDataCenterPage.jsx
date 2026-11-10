import React, { useState, useMemo } from 'react';
import {
  Activity,
  AlertTriangle,
  Award,
  BarChart3,
  BookOpen,
  CheckCircle2,
  Clock,
  Cpu,
  DollarSign,
  FileText,
  Flame,
  Gauge,
  Info,
  Layers,
  Power,
  RefreshCw,
  ShieldCheck,
  Sun,
  TrendingDown,
  TrendingUp,
  Zap,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import AppShell from '../layouts/AppShell';
import ElectricSubNav from '../components/electric/ElectricSubNav';
import ElectricDemandChart from '../components/electric/ElectricDemandChart';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  ChartCard,
  PageHeader,
  StatCard,
  StatusPill,
  Table,
  chart,
  toast,
} from '../ui';
import { TARIFF_CONFIG } from '../config/tariffs';

// TNB Commercial Tariff C1 Medium Voltage Peak/Off-Peak Rates
const TNB_TARIFF = {
  PEAK_RATE_RM_PER_KWH: 0.509,       // 08:00 - 22:00
  OFF_PEAK_RATE_RM_PER_KWH: 0.380,   // 22:00 - 08:00
  MAX_DEMAND_CHARGE_PER_KW: 38.30,   // RM / kW / month
  MIN_POWER_FACTOR_PENALTY: 0.85,    // Penalty applied if PF < 0.85
};

// Subsystem Breakdown
const SUBSYSTEM_LOADS = [
  { subsystem: 'HVAC & Central Chillers', powerKw: 956.8, share: 52.0, color: '#14b8a6' },
  { subsystem: 'Lighting & Facade LEDs', powerKw: 331.2, share: 18.0, color: '#f59e0b' },
  { subsystem: 'Elevators & Escalators', powerKw: 220.8, share: 12.0, color: '#0ea5e9' },
  { subsystem: 'IT & Edge Server Rooms', powerKw: 202.4, share: 11.0, color: '#8b5cf6' },
  { subsystem: 'Plug Loads & Amenities', powerKw: 128.8, share: 7.0, color: '#10b981' },
];

// Substation Distribution Feeders
const SUBSTATION_FEEDERS = [
  {
    feederId: 'FDR-MSB-01',
    name: 'Main Chiller Plant 11kV/415V TX-1',
    capacityKva: 2000,
    activeKw: 956.8,
    loadingPct: 47.8,
    voltageV: 415.2,
    currentA: 1332,
    pf: 0.97,
    status: 'OPTIMAL',
  },
  {
    feederId: 'FDR-MSB-02',
    name: 'Hyatt Hotel Tower (L14-L28) TX-2',
    capacityKva: 1500,
    activeKw: 412.5,
    loadingPct: 27.5,
    voltageV: 414.8,
    currentA: 574,
    pf: 0.95,
    status: 'OPTIMAL',
  },
  {
    feederId: 'FDR-MSB-03',
    name: 'Commercial Office Tower (L4-L12) TX-3',
    capacityKva: 1500,
    activeKw: 388.2,
    loadingPct: 25.8,
    voltageV: 415.6,
    currentA: 540,
    pf: 0.94,
    status: 'OPTIMAL',
  },
  {
    feederId: 'FDR-MSB-04',
    name: 'Retail Podium & Waterfront Pier TX-4',
    capacityKva: 1000,
    activeKw: 82.5,
    loadingPct: 8.2,
    voltageV: 416.1,
    currentA: 115,
    pf: 0.98,
    status: 'NORMAL',
  },
];

const FEEDER_COLUMNS = [
  { key: 'feederId', header: 'Feeder ID', render: (r) => <span className="font-mono font-bold text-primary">{r.feederId}</span> },
  { key: 'name', header: 'Designation / Service Zone', render: (r) => <span className="font-medium text-fg">{r.name}</span> },
  { key: 'capacityKva', header: 'Capacity', align: 'right', render: (r) => <span className="font-mono text-muted">{r.capacityKva} kVA</span> },
  { key: 'activeKw', header: 'Active Load', align: 'right', render: (r) => <span className="font-mono font-bold text-fg">{r.activeKw} kW</span> },
  {
    key: 'loadingPct',
    header: 'Loading %',
    align: 'right',
    render: (r) => (
      <div className="flex items-center justify-end gap-2">
        <span className="font-mono font-bold text-fg">{r.loadingPct}%</span>
        <div className="h-1.5 w-14 rounded-full bg-line overflow-hidden">
          <div
            className={`h-full rounded-full ${
              r.loadingPct > 80 ? 'bg-rose-500' : r.loadingPct > 50 ? 'bg-amber-500' : 'bg-emerald-500'
            }`}
            style={{ width: `${r.loadingPct}%` }}
          />
        </div>
      </div>
    ),
  },
  { key: 'voltageV', header: 'Voltage', align: 'right', render: (r) => <span className="font-mono text-fg">{r.voltageV} V</span> },
  { key: 'currentA', header: 'Current', align: 'right', render: (r) => <span className="font-mono text-fg">{r.currentA} A</span> },
  { key: 'pf', header: 'Power Factor', align: 'right', render: (r) => <span className="font-mono text-emerald-500 font-semibold">{r.pf}</span> },
  { key: 'status', header: 'Status', align: 'center', render: (r) => <StatusPill tone="success">{r.status}</StatusPill> },
];

export default function ElectricDataCenterPage() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [liveDemand, setLiveDemand] = useState(1840.0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Real-time calculated indicators
  const currentCostPerHour = useMemo(() => {
    return (liveDemand * TARIFF_CONFIG.ELECTRICITY_BASE_RATE_KWH).toFixed(2);
  }, [liveDemand]);

  const handleManualRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      const delta = (Math.random() - 0.5) * 15;
      setLiveDemand((prev) => +(prev + delta).toFixed(1));
      setIsRefreshing(false);
      toast.success('Electrical busbar telemetry refreshed from hardware meters.');
    }, 450);
  };

  return (
    <AppShell subnav={<ElectricSubNav activeTab={activeTab} onTabChange={setActiveTab} />}>
      <PageHeader
        eyebrow="Electric Power"
        accent="var(--gg-energy)"
        title="Electric Power Telemetry Center"
        description="Live electrical busbar telemetry, 24-hour stacked area demand profile, and GreenRE Energy Efficiency (EE) certification audit."
        meta={<Badge tone="success">LIVE AZURE STREAM (PRODUCTION)</Badge>}
        actions={
          <Button
            variant="secondary"
            size="sm"
            icon={<RefreshCw className={`size-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />}
            onClick={handleManualRefresh}
          >
            Refresh Busbars
          </Button>
        }
      />

      {/* =========================================================================
          TAB 1: DASHBOARD
          ========================================================================= */}
      {activeTab === 'dashboard' && (
        <div className="space-y-6">
          {/* 4 Core Financial & Power KPIs */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Real-Time Demand"
              value={liveDemand.toLocaleString()}
              unit="kW"
              icon={<Zap className="size-4" />}
              accent="var(--gg-energy)"
              tone="brand"
              hint="Threshold: 2,100 kW (Contracted MD)"
            />
            <StatCard
              label="Instantaneous Burn Rate"
              value={`RM ${currentCostPerHour}`}
              unit="/ hr"
              icon={<DollarSign className="size-4" />}
              accent="#f59e0b"
              tone="warning"
              hint="TNB C1 Peak Tariff (RM 0.509/kWh)"
            />
            <StatCard
              label="Daily Power Cost"
              value="RM 17,249.50"
              icon={<TrendingUp className="size-4" />}
              accent="#06b6d4"
              tone="info"
              hint="−6.4% vs Baseline"
            />
            <StatCard
              label="Power Factor"
              value="0.96"
              unit="Lagging"
              icon={<Gauge className="size-4" />}
              accent="#10b981"
              tone="success"
              hint="Zero TNB Penalty Surcharge (>0.85)"
            />
          </div>

          {/* 3-Phase Busbar Telemetry & Substation Feeder Distribution */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            {/* 3-Phase Busbar Physical Telemetry Card */}
            <div className="lg:col-span-5">
              <Card className="h-full flex flex-col justify-between">
                <CardHeader
                  title="3-Phase Busbar Telemetry (Main MSB)"
                  description="Direct reading from Siemens PAC4200 Power Meter"
                  actions={<Badge tone="success">IN BALANCE (99.8%)</Badge>}
                />

                <div className="grid grid-cols-3 gap-3 p-4">
                  <div className="rounded-lg border border-line bg-surface-2 p-3 text-center">
                    <span className="text-xs font-bold text-red-500">PHASE L1-N</span>
                    <div className="text-lg font-extrabold text-fg mt-1">240.2 V</div>
                    <div className="text-xs text-muted font-mono mt-0.5">2,556 A</div>
                  </div>
                  <div className="rounded-lg border border-line bg-surface-2 p-3 text-center">
                    <span className="text-xs font-bold text-amber-500">PHASE L2-N</span>
                    <div className="text-lg font-extrabold text-fg mt-1">239.8 V</div>
                    <div className="text-xs text-muted font-mono mt-0.5">2,548 A</div>
                  </div>
                  <div className="rounded-lg border border-line bg-surface-2 p-3 text-center">
                    <span className="text-xs font-bold text-blue-500">PHASE L3-N</span>
                    <div className="text-lg font-extrabold text-fg mt-1">240.5 V</div>
                    <div className="text-xs text-muted font-mono mt-0.5">2,562 A</div>
                  </div>
                </div>

                <div className="space-y-3 px-4 pb-4 text-xs">
                  <div className="flex items-center justify-between border-b border-line pb-2">
                    <span className="text-muted flex items-center gap-1.5">
                      <Activity className="size-3.5 text-primary" /> Grid Frequency
                    </span>
                    <span className="font-mono font-bold text-fg">50.01 Hz (±0.02%)</span>
                  </div>
                  <div className="flex items-center justify-between border-b border-line pb-2">
                    <span className="text-muted flex items-center gap-1.5">
                      <Gauge className="size-3.5 text-primary" /> Total Harmonic Distortion (THD-V)
                    </span>
                    <span className="font-mono font-bold text-emerald-500">1.8% (&lt; 5.0% IEEE 519)</span>
                  </div>
                  <div className="flex items-center justify-between border-b border-line pb-2">
                    <span className="text-muted flex items-center gap-1.5">
                      <Layers className="size-3.5 text-primary" /> Reactive Power (kVAR)
                    </span>
                    <span className="font-mono font-bold text-fg">536 kVAR (Stage 4/6)</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted flex items-center gap-1.5">
                      <Power className="size-3.5 text-primary" /> Apparent Power (kVA)
                    </span>
                    <span className="font-mono font-bold text-fg">1,916.6 kVA</span>
                  </div>
                </div>
              </Card>
            </div>

            {/* Quick Summary of Connected Distribution Feeders */}
            <div className="lg:col-span-7">
              <Card className="h-full flex flex-col justify-between">
                <CardHeader
                  title="Substation Feeder Highlights"
                  description="Current active loading on the 4 primary 11kV distribution transformers"
                  actions={<Badge tone="neutral">6,000 kVA Total Capacity</Badge>}
                />

                <div className="p-4 grid grid-cols-2 gap-4">
                  <div className="rounded-lg border border-line bg-surface-2 p-3.5">
                    <span className="text-xs font-semibold text-muted">Chiller Plant (TX-1)</span>
                    <div className="text-xl font-mono font-bold text-fg mt-1">956.8 kW</div>
                    <div className="text-xs text-emerald-500 font-semibold mt-1">47.8% Loading • PF 0.97</div>
                  </div>
                  <div className="rounded-lg border border-line bg-surface-2 p-3.5">
                    <span className="text-xs font-semibold text-muted">Hyatt Tower (TX-2)</span>
                    <div className="text-xl font-mono font-bold text-fg mt-1">412.5 kW</div>
                    <div className="text-xs text-emerald-500 font-semibold mt-1">27.5% Loading • PF 0.95</div>
                  </div>
                  <div className="rounded-lg border border-line bg-surface-2 p-3.5">
                    <span className="text-xs font-semibold text-muted">Commercial Office (TX-3)</span>
                    <div className="text-xl font-mono font-bold text-fg mt-1">388.2 kW</div>
                    <div className="text-xs text-emerald-500 font-semibold mt-1">25.8% Loading • PF 0.94</div>
                  </div>
                  <div className="rounded-lg border border-line bg-surface-2 p-3.5">
                    <span className="text-xs font-semibold text-muted">Retail & Waterfront (TX-4)</span>
                    <div className="text-xl font-mono font-bold text-fg mt-1">82.5 kW</div>
                    <div className="text-xs text-emerald-500 font-semibold mt-1">8.2% Loading • PF 0.98</div>
                  </div>
                </div>

                <div className="p-4 pt-0">
                  <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 flex items-center justify-between text-xs">
                    <span className="flex items-center gap-2 text-fg font-medium">
                      <Zap className="size-4 text-primary" />
                      Automatic Demand Limiter is active with 260 kW reserve headroom.
                    </span>
                    <Button size="xs" variant="secondary" onClick={() => setActiveTab('trends')}>
                      View Stacked Load Curves →
                    </Button>
                  </div>
                </div>
              </Card>
            </div>
          </div>

          {/* Substation Feeder Distribution Table */}
          <Card className="p-0 overflow-hidden">
            <div className="p-5 pb-3">
              <CardHeader
                title="11kV / 415V Main Substation Feeder Distribution"
                description="High-voltage switchgear branch circuits supplying The Light City commercial and hospitality zones."
                actions={
                  <Badge tone="neutral">
                    4 Active Feeders • 6,000 kVA Installed Capacity
                  </Badge>
                }
              />
            </div>

            <Table
              columns={FEEDER_COLUMNS}
              rows={SUBSTATION_FEEDERS}
              rowKey="feederId"
            />
          </Card>
        </div>
      )}

      {/* =========================================================================
          TAB 2: TRENDS & ANALYTICS (STACKED AREA CHART & BREAKDOWN)
          ========================================================================= */}
      {activeTab === 'trends' && (
        <div className="space-y-6">
          <ChartCard
            title="Multi-Level Demand Profile (Stacked Area Curve)"
            description="24-hour continuous subsystem load telemetry layered into Plug Loads, IT & Edge, Elevators, Lighting, and HVAC chillers against the historical baseline."
            height="auto"
          >
            <div className="p-1">
              <ElectricDemandChart />
            </div>
          </ChartCard>

          {/* Subsystem Breakdown & Peak Shifting Analysis */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            {/* Horizontal Bar Chart for Subsystem Allocation */}
            <div className="lg:col-span-7">
              <ChartCard
                title="Electrical Subsystem Load Allocation"
                description="Instantaneous disaggregation of active power by major mechanical & electrical loads."
                height={260}
              >
                <div className="h-full w-full pt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      layout="vertical"
                      data={SUBSYSTEM_LOADS}
                      margin={{ top: 10, right: 30, left: 20, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={chart.grid} />
                      <XAxis type="number" unit=" kW" stroke={chart.axis} tick={{ fill: chart.tick, fontSize: 11 }} />
                      <YAxis
                        dataKey="subsystem"
                        type="category"
                        stroke={chart.axis}
                        tick={{ fill: chart.tick, fontSize: 11 }}
                        width={160}
                      />
                      <Tooltip
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const d = payload[0].payload;
                            return (
                              <div className="rounded-lg border border-line bg-surface p-2.5 shadow-md text-xs">
                                <p className="font-bold text-fg">{d.subsystem}</p>
                                <p className="text-primary font-semibold">{d.powerKw} kW ({d.share}%)</p>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Bar dataKey="powerKw" radius={[0, 4, 4, 0]}>
                        {SUBSYSTEM_LOADS.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2 border-t border-line pt-3 sm:grid-cols-5 text-center text-xs">
                  {SUBSYSTEM_LOADS.map((item) => (
                    <div key={item.subsystem} className="p-1">
                      <span className="block font-medium text-muted truncate">{item.subsystem.split(' ')[0]}</span>
                      <span className="block font-bold text-fg mt-0.5">{item.powerKw} kW</span>
                      <span className="text-[10px] text-muted-foreground">{item.share}%</span>
                    </div>
                  ))}
                </div>
              </ChartCard>
            </div>

            {/* Peak Demand Management Card */}
            <div className="lg:col-span-5">
              <Card className="h-full flex flex-col justify-between">
                <CardHeader
                  title="TNB C1 Peak Shifting Optimization"
                  description="Automated thermal pre-cooling and load modulation"
                  actions={<Badge tone="brand">AI LOAD SHIFT</Badge>}
                />

                <div className="space-y-3.5 p-4 text-xs">
                  <div className="rounded-lg border border-line bg-surface-2 p-3">
                    <div className="flex items-center justify-between font-bold text-fg">
                      <span>Pre-Cooling Chilled Water Storage</span>
                      <span className="text-emerald-500 font-mono">−120 kW Peak Reduction</span>
                    </div>
                    <p className="text-muted mt-1 leading-relaxed">
                      Ice storage / low-temp chilled water loop charged during Off-Peak window (04:00 - 07:00 @ RM 0.380/kWh), discharging at 14:00 peak hours.
                    </p>
                  </div>

                  <div className="rounded-lg border border-line bg-surface-2 p-3">
                    <div className="flex items-center justify-between font-bold text-fg">
                      <span>Smart Elevator Dispatch Staggering</span>
                      <span className="text-emerald-500 font-mono">−35 kW Surge Damping</span>
                    </div>
                    <p className="text-muted mt-1 leading-relaxed">
                      Regenerative drive elevator bank limits concurrent acceleration spikes when campus occupancy exceeds 85%.
                    </p>
                  </div>

                  <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
                    <div className="flex items-center justify-between text-emerald-400 font-bold">
                      <span>Monthly Maximum Demand Cost Avoidance</span>
                      <span className="font-mono text-sm">RM 5,936.50 / mo</span>
                    </div>
                    <p className="text-muted text-[11px] mt-0.5">
                      Avoided 155 kW peak demand charge at TNB rate of RM 38.30 / kW / month.
                    </p>
                  </div>
                </div>

                <div className="p-4 pt-0">
                  <Button size="sm" variant="secondary" className="w-full" onClick={() => setActiveTab('audit')}>
                    Review GreenRE EE Credit Performance →
                  </Button>
                </div>
              </Card>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 3: GREENRE EE AUDIT (ENERGY EFFICIENCY AUDIT)
          ========================================================================= */}
      {activeTab === 'audit' && (
        <div className="space-y-6">
          {/* Top Scorecard Banner */}
          <div className="rounded-xl border border-primary/30 bg-surface-2 p-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-start gap-4">
              <div className="p-3.5 rounded-xl bg-primary/10 text-primary">
                <Award className="size-8" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold text-fg">GreenRE Part 1: Energy Efficiency (EE) Audit</h2>
                  <Badge tone="success">PLATINUM TIER TRAJECTORY</Badge>
                </div>
                <p className="text-sm text-muted mt-1 max-w-2xl">
                  Evaluated under GreenRE Non-Residential Certified Standard (NRD v3.0). Verified against MS 1525:2019 and ASHRAE 90.1 guidelines.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-6 border-t md:border-t-0 md:border-l border-line pt-4 md:pt-0 md:pl-6 shrink-0">
              <div className="text-center">
                <span className="text-xs uppercase font-semibold text-muted">EE Points Earned</span>
                <div className="text-3xl font-extrabold text-primary font-mono mt-0.5">41.5 <span className="text-base text-muted">/ 50</span></div>
                <span className="text-[11px] text-emerald-500 font-semibold">83.0% Compliance</span>
              </div>
              <div className="text-center">
                <span className="text-xs uppercase font-semibold text-muted">Campus BEI</span>
                <div className="text-3xl font-extrabold text-fg font-mono mt-0.5">138.4</div>
                <span className="text-[11px] text-muted">kWh/m²·yr (Limit 150)</span>
              </div>
            </div>
          </div>

          {/* 5 Core Energy Efficiency Audit Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {/* EE 1.0 Envelope OTTV */}
            <Card className="flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold text-primary font-mono uppercase tracking-wider">EE 1.0 Building Envelope</span>
                  <Badge tone="success">12.0 / 15 Pts</Badge>
                </div>
                <h3 className="text-base font-bold text-fg">OTTV & Envelope Thermal Performance</h3>
                <p className="text-xs text-muted mt-1.5 leading-relaxed">
                  Overall Thermal Transfer Value (OTTV) calculation for external facade fenestration and wall assemblies.
                </p>

                <div className="mt-4 space-y-2 text-xs">
                  <div className="flex items-center justify-between py-1.5 border-b border-line">
                    <span className="text-muted">Calculated OTTV</span>
                    <span className="font-mono font-bold text-emerald-500">41.2 W/m² (Pass ≤ 50 W/m²)</span>
                  </div>
                  <div className="flex items-center justify-between py-1.5 border-b border-line">
                    <span className="text-muted">Roof Thermal Transfer (EOTTI)</span>
                    <span className="font-mono font-bold text-fg">21.4 W/m² (Pass ≤ 25 W/m²)</span>
                  </div>
                  <div className="flex items-center justify-between py-1.5">
                    <span className="text-muted">Glazing Shading Coeff (SC)</span>
                    <span className="font-mono font-bold text-fg">0.38 (Double Low-E)</span>
                  </div>
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-line text-[11px] text-emerald-500 flex items-center gap-1.5">
                <CheckCircle2 className="size-3.5 shrink-0" /> Exceeds MS 1525 minimum requirement by 17.6%
              </div>
            </Card>

            {/* EE 2.0 Chiller Plant Efficiency */}
            <Card className="flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold text-primary font-mono uppercase tracking-wider">EE 2.0 Air Conditioning</span>
                  <Badge tone="success">16.0 / 18 Pts</Badge>
                </div>
                <h3 className="text-base font-bold text-fg">Chiller Plant Operating COP</h3>
                <p className="text-xs text-muted mt-1.5 leading-relaxed">
                  Water-cooled centrifugal chillers with magnetic bearing compressors and VFD secondary pumping.
                </p>

                <div className="mt-4 space-y-2 text-xs">
                  <div className="flex items-center justify-between py-1.5 border-b border-line">
                    <span className="text-muted">Plant Total Efficiency</span>
                    <span className="font-mono font-bold text-emerald-500">0.601 kW/RT (Limit 0.680)</span>
                  </div>
                  <div className="flex items-center justify-between py-1.5 border-b border-line">
                    <span className="text-muted">Chiller COP</span>
                    <span className="font-mono font-bold text-fg">5.85 COP</span>
                  </div>
                  <div className="flex items-center justify-between py-1.5">
                    <span className="text-muted">Secondary Pump Power</span>
                    <span className="font-mono font-bold text-fg">0.022 kW/RT (VFD Mode)</span>
                  </div>
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-line text-[11px] text-emerald-500 flex items-center gap-1.5">
                <CheckCircle2 className="size-3.5 shrink-0" /> GreenRE High Efficiency Tier (&lt; 0.65 kW/RT)
              </div>
            </Card>

            {/* EE 3.0 Artificial Lighting & LPD */}
            <Card className="flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold text-primary font-mono uppercase tracking-wider">EE 3.0 Artificial Lighting</span>
                  <Badge tone="success">5.0 / 6 Pts</Badge>
                </div>
                <h3 className="text-base font-bold text-fg">Lighting Power Density (LPD)</h3>
                <p className="text-xs text-muted mt-1.5 leading-relaxed">
                  High-efficacy architectural LED luminaires with daylight harvesting sensors and occupancy controls.
                </p>

                <div className="mt-4 space-y-2 text-xs">
                  <div className="flex items-center justify-between py-1.5 border-b border-line">
                    <span className="text-muted">Commercial Office LPD</span>
                    <span className="font-mono font-bold text-emerald-500">7.2 W/m² (Limit ≤ 10.0)</span>
                  </div>
                  <div className="flex items-center justify-between py-1.5 border-b border-line">
                    <span className="text-muted">Hyatt Corridor & Lobby LPD</span>
                    <span className="font-mono font-bold text-fg">4.8 W/m² (Limit ≤ 7.0)</span>
                  </div>
                  <div className="flex items-center justify-between py-1.5">
                    <span className="text-muted">Daylight Sensor Coverage</span>
                    <span className="font-mono font-bold text-fg">92% Perimeter Zones</span>
                  </div>
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-line text-[11px] text-emerald-500 flex items-center gap-1.5">
                <CheckCircle2 className="size-3.5 shrink-0" /> 28% LPD reduction vs MS 1525 benchmark
              </div>
            </Card>

            {/* EE 4.0 Sub-Metering & Telemetry */}
            <Card className="flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold text-primary font-mono uppercase tracking-wider">EE 4.0 Energy Management</span>
                  <Badge tone="success">5.0 / 5 Pts</Badge>
                </div>
                <h3 className="text-base font-bold text-fg">Digital Sub-Metering Infrastructure</h3>
                <p className="text-xs text-muted mt-1.5 leading-relaxed">
                  Continuous digital energy metering on all loads exceeding 15 kW with Azure cloud archiving.
                </p>

                <div className="mt-4 space-y-2 text-xs">
                  <div className="flex items-center justify-between py-1.5 border-b border-line">
                    <span className="text-muted">Major Mechanical Load Metering</span>
                    <span className="font-mono font-bold text-emerald-500">100% Monitored</span>
                  </div>
                  <div className="flex items-center justify-between py-1.5 border-b border-line">
                    <span className="text-muted">Tenant Tenancy Sub-Meters</span>
                    <span className="font-mono font-bold text-fg">42 Digital Meters</span>
                  </div>
                  <div className="flex items-center justify-between py-1.5">
                    <span className="text-muted">Telemetry Polling Frequency</span>
                    <span className="font-mono font-bold text-fg">5 Seconds</span>
                  </div>
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-line text-[11px] text-emerald-500 flex items-center gap-1.5">
                <CheckCircle2 className="size-3.5 shrink-0" /> Full 5/5 score for comprehensive sub-metering
              </div>
            </Card>

            {/* EE 5.0 Renewable Energy (Solar PV) */}
            <Card className="flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold text-primary font-mono uppercase tracking-wider">EE 5.0 Renewable Energy</span>
                  <Badge tone="info">3.5 / 6 Pts</Badge>
                </div>
                <h3 className="text-base font-bold text-fg">Rooftop Solar PV Array</h3>
                <p className="text-xs text-muted mt-1.5 leading-relaxed">
                  Podium rooftop and Hyatt crown monocrystalline photovoltaic panels connected via grid-tied inverters.
                </p>

                <div className="mt-4 space-y-2 text-xs">
                  <div className="flex items-center justify-between py-1.5 border-b border-line">
                    <span className="text-muted">Installed PV Capacity</span>
                    <span className="font-mono font-bold text-amber-500">240 kWp</span>
                  </div>
                  <div className="flex items-center justify-between py-1.5 border-b border-line">
                    <span className="text-muted">Annual Clean Generation</span>
                    <span className="font-mono font-bold text-fg">312,000 kWh / yr</span>
                  </div>
                  <div className="flex items-center justify-between py-1.5">
                    <span className="text-muted">Clean Energy Replacement</span>
                    <span className="font-mono font-bold text-fg">3.5% Campus Demand</span>
                  </div>
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-line text-[11px] text-primary flex items-center gap-1.5">
                <Sun className="size-3.5 shrink-0" /> Offsets ~182.2 tCO₂e annual emissions
              </div>
            </Card>

            {/* Summary & Audit Action Card */}
            <Card className="flex flex-col justify-between bg-primary/5 border-primary/20">
              <div>
                <span className="text-xs font-bold text-primary uppercase tracking-wider">Audit Documentation</span>
                <h3 className="text-base font-bold text-fg mt-1">Official Submission Ready</h3>
                <p className="text-xs text-muted mt-2 leading-relaxed">
                  All digital calculation worksheets, 12-month interval data logs, and single-line feeder diagrams are packaged in GreenRE v3.0 submission format.
                </p>

                <div className="mt-4 space-y-1.5 text-xs text-muted">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="size-3.5 text-emerald-500 shrink-0" />
                    <span>Energy Commission (ST) Certified Engineer Endorsed</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="size-3.5 text-emerald-500 shrink-0" />
                    <span>TNB Commercial Schedule C1 Bill Verification Attached</span>
                  </div>
                </div>
              </div>

              <div className="mt-5">
                <a
                  href="/api/v1/reports/greenre"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 text-xs font-bold rounded-lg bg-primary text-primary-fg hover:opacity-90 transition-opacity"
                >
                  <FileText className="size-3.5" />
                  Download GreenRE EE Audit PDF Report
                </a>
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 4: STANDARDS & RULES (REGULATORY FRAMEWORKS)
          ========================================================================= */}
      {activeTab === 'rules' && (
        <div className="space-y-6">
          <div className="rounded-xl border border-line bg-surface p-5">
            <h2 className="text-lg font-bold text-fg flex items-center gap-2">
              <BookOpen className="size-5 text-primary" />
              Electrical Energy Efficiency Compliance Frameworks
            </h2>
            <p className="text-xs text-muted mt-1 max-w-3xl leading-relaxed">
              The Light City Penang electrical systems are engineered and operated in strict accordance with Malaysian statutory codes and GreenRE rating tool criteria.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Standard 1: GreenRE NRD v3.0 */}
            <Card>
              <CardHeader
                title="GreenRE Non-Residential Standard (v3.0)"
                description="Part 1: Energy Efficiency (Max 50 Points)"
                icon={<Award className="size-5 text-primary" />}
                actions={<Badge tone="success">Primary Benchmark</Badge>}
              />
              <div className="space-y-3 text-xs leading-relaxed text-muted">
                <p>
                  GreenRE requires demonstrative energy savings over the baseline standard building model. Core criteria include:
                </p>
                <ul className="list-disc list-inside space-y-1.5 pl-1 text-fg">
                  <li><strong>Building Envelope OTTV:</strong> Must not exceed 50 W/m² (MS 1525 requirement).</li>
                  <li><strong>Air-Conditioning Plant Efficiency:</strong> Water-cooled chillers must achieve operating COP ≥ 5.50 (&lt; 0.68 kW/RT).</li>
                  <li><strong>Building Energy Intensity (BEI):</strong> Monitored annual consumption must maintain &lt; 150 kWh/m²·yr for commercial office spaces.</li>
                  <li><strong>Sub-Metering Provision:</strong> Dedicated digital meters required on all major tenant risers and plant equipment.</li>
                </ul>
              </div>
            </Card>

            {/* Standard 2: MS 1525:2019 */}
            <Card>
              <CardHeader
                title="MS 1525:2019 (Malaysian Standard)"
                description="Energy Efficiency and Use of Renewable Energy for Non-Residential Buildings"
                icon={<ShieldCheck className="size-5 text-emerald-500" />}
                actions={<Badge tone="neutral">Statutory Code</Badge>}
              />
              <div className="space-y-3 text-xs leading-relaxed text-muted">
                <p>
                  Malaysia's governing standard for commercial building energy compliance, referenced under the Uniform Building By-Laws (UBBL):
                </p>
                <ul className="list-disc list-inside space-y-1.5 pl-1 text-fg">
                  <li><strong>Lighting Power Density:</strong> Maximum allowable LPD of 10.0 W/m² for general offices, 7.0 W/m² for hotel public spaces.</li>
                  <li><strong>Thermal Envelope (EOTTI):</strong> Roof thermal transfer value capped at 25.0 W/m².</li>
                  <li><strong>Solar Shading:</strong> Facades with window-to-wall ratios (WWR) exceeding 40% require horizontal or vertical louvre shading.</li>
                </ul>
              </div>
            </Card>

            {/* Standard 3: ASHRAE 90.1 */}
            <Card>
              <CardHeader
                title="ASHRAE Standard 90.1-2022"
                description="Energy Standard for Buildings Except Low-Rise Residential Buildings"
                icon={<Layers className="size-5 text-sky-500" />}
                actions={<Badge tone="info">International Ref</Badge>}
              />
              <div className="space-y-3 text-xs leading-relaxed text-muted">
                <p>
                  International baseline standard for mechanical HVAC performance and whole-building energy modeling:
                </p>
                <ul className="list-disc list-inside space-y-1.5 pl-1 text-fg">
                  <li><strong>Chiller Minimum IPLV:</strong> Path B variable speed centrifugal chiller requirements across part-load test conditions.</li>
                  <li><strong>Pumping Power Limits:</strong> Variable flow hydronic systems must include variable speed controls throttling down to 50% flow.</li>
                  <li><strong>Fan System Power:</strong> Supply and return AHU fans restricted to &lt; 1.3 W per liter/sec airflow.</li>
                </ul>
              </div>
            </Card>

            {/* Standard 4: TNB Commercial Tariff C1 & Power Factor Regulations */}
            <Card>
              <CardHeader
                title="TNB Commercial Tariff Schedule & PF Surcharge"
                description="Tenaga Nasional Berhad Commercial Medium Voltage Rules"
                icon={<Zap className="size-5 text-amber-500" />}
                actions={<Badge tone="warning">Tariff Schedule</Badge>}
              />
              <div className="space-y-3 text-xs leading-relaxed text-muted">
                <p>
                  TNB Schedule of Tariffs for Medium Voltage Commercial Consumers (Tariff C1 / TOU):
                </p>
                <ul className="list-disc list-inside space-y-1.5 pl-1 text-fg">
                  <li><strong>Peak Hours Rate:</strong> RM 0.509 / kWh (08:00 to 22:00 daily).</li>
                  <li><strong>Off-Peak Hours Rate:</strong> RM 0.380 / kWh (22:00 to 08:00 daily).</li>
                  <li><strong>Maximum Demand Charge:</strong> RM 38.30 / kW / month applied to peak instantaneous demand.</li>
                  <li><strong>Power Factor Penalty:</strong> If PF drops below 0.85, a statutory penalty of 1.5% to 3.0% is added to the entire electric bill per 0.01 shortfall. The Light City operates at 0.96 with zero penalty.</li>
                </ul>
              </div>
            </Card>
          </div>
        </div>
      )}
    </AppShell>
  );
}
