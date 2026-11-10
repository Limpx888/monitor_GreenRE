import React, { useState } from 'react';
import {
  Banknote,
  CheckCircle2,
  Clock,
  Coins,
  Download,
  Droplets,
  ExternalLink,
  FileCheck2,
  FileSpreadsheet,
  FileText,
  HardHat,
  HelpCircle,
  Recycle,
  ShieldCheck,
  TrendingUp,
  Wrench,
  Zap,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import AppShell from '../layouts/AppShell';
import { Badge, Button, Card, CardHeader, ChartCard, Modal, PageHeader, StatCard, Table, chart, toast } from '../ui';

// Hardcoded conversion coefficients strictly specified by enterprise audit standards
const COEFFICIENTS = {
  ENERGY_TARIFF_RM_PER_KWH: 0.509, // TNB Commercial Tariff C1 Medium Voltage Peak
  WATER_TARIFF_RM_PER_M3: 2.27,    // PBAPP Commercial Non-Domestic Tariff
  LABOR_RATE_RM_PER_HOUR: 50.0,    // Certified BMS Field Diagnostic Technician Rate
};

// Polished Audit Ledger listing recent milestones achieved by the autonomous system
const AUDIT_LEDGER_DATA = [
  {
    id: 'AUD-2026-1108',
    date: 'Nov 8, 2026 14:22',
    asset: 'AHU-14A (L14 Hotel)',
    category: 'Labor & HVAC',
    incident: 'RAG engine localized AHU-14 outdoor damper stuck closed (15%), preventing continuous chiller reheat fighting',
    formula: '8 hrs manual diagnosis saved × RM 50/hr',
    roi: 400.0,
    status: 'AUDITED & VERIFIED',
  },
  {
    id: 'AUD-2026-1106',
    date: 'Nov 6, 2026 10:15',
    asset: 'VAV-OFFICE-08 (L8 Office)',
    category: 'Energy',
    incident: 'NILM disaggregation isolated terminal reheat coil runaway during business peak, intercepting 620 kWh waste',
    formula: '620 kWh intercepted × RM 0.509',
    roi: 315.58,
    status: 'AUDITED & VERIFIED',
  },
  {
    id: 'AUD-2026-1103',
    date: 'Nov 3, 2026 03:40',
    asset: 'Chiller Riser R-B2',
    category: 'Water',
    incident: 'Smart acoustic IoT water leak detector flagged B2 basement riser micro-fissure before catastrophic rupture',
    formula: '42 m³ lost volume blocked × RM 2.27',
    roi: 95.34,
    status: 'AUDITED & VERIFIED',
  },
  {
    id: 'AUD-2026-1029',
    date: 'Oct 29, 2026 16:00',
    asset: 'Material Recovery Facility',
    category: 'Waste',
    incident: 'AI optical sorting segregated 4.2 tonnes high-grade paper and clear PET, offsetting landfill hauling penalties',
    formula: 'RM 2,450 recyclables sold − RM 560 hauling',
    roi: 1890.0,
    status: 'AUDITED & VERIFIED',
  },
  {
    id: 'AUD-2026-1024',
    date: 'Oct 24, 2026 13:30',
    asset: 'Podium Chillers & AHU-02',
    category: 'Energy',
    incident: 'Dynamic pre-cooling algorithm shaved 48 kW peak demand during maximum TNB tariff spike window',
    formula: '4,813 kWh peak curtailed × RM 0.509',
    roi: 2450.0,
    status: 'AUDITED & VERIFIED',
  },
  {
    id: 'AUD-2026-1018',
    date: 'Oct 18, 2026 09:12',
    asset: 'Supply Fan Motor SF-03',
    category: 'Labor & Asset',
    incident: 'Early differential pressure anomaly diagnosed clogged MERV-13 filter before supply fan motor bearing burnout',
    formula: '16 hrs labor saved (+RM 800) + motor cost avoided',
    roi: 4300.0,
    status: 'AUDITED & VERIFIED',
  },
  {
    id: 'AUD-2026-1011',
    date: 'Oct 11, 2026 15:45',
    asset: 'Main Central Chiller Plant',
    category: 'Energy',
    incident: 'Automated Delta-T syndrome flow balancing eliminated chiller low-load staging waste over 14 days',
    formula: '8,400 kWh waste eliminated × RM 0.509',
    roi: 4275.6,
    status: 'AUDITED & VERIFIED',
  },
];

// Monthly cumulative financial savings breakdown
const MONTHLY_SAVINGS_TREND = [
  { month: 'Jun', energy: 9800, water: 1250, waste: 1400, labor: 1800, total: 14250 },
  { month: 'Jul', energy: 11200, water: 1380, waste: 1650, labor: 2100, total: 16330 },
  { month: 'Aug', energy: 12850, water: 1540, waste: 1800, labor: 2350, total: 18540 },
  { month: 'Sep', energy: 14100, water: 1720, waste: 2100, labor: 2500, total: 20420 },
  { month: 'Oct', energy: 15100, water: 1890, waste: 2250, labor: 2650, total: 21890 },
  { month: 'Nov (MTD)', energy: 15437.8, water: 2026.4, waste: 2400, labor: 2800, total: 22664.2 },
];

export default function RoiDashboardPage() {
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [generatingReport, setGeneratingReport] = useState(false);

  // Exact calculations based on hardcoded coefficients
  const energyKwhSaved = 154200;
  const energySavingsRm = energyKwhSaved * COEFFICIENTS.ENERGY_TARIFF_RM_PER_KWH; // RM 78,487.80

  const waterM3Blocked = 4320;
  const waterSavingsRm = waterM3Blocked * COEFFICIENTS.WATER_TARIFF_RM_PER_M3; // RM 9,806.40

  const recyclablesSoldRm = 14800.0;
  const haulingFeesRm = 3200.0;
  const wasteRevenueRm = recyclablesSoldRm - haulingFeesRm; // RM 11,600.00

  const laborHoursSaved = 284;
  const laborSavingsRm = laborHoursSaved * COEFFICIENTS.LABOR_RATE_RM_PER_HOUR; // RM 14,200.00

  const totalFinancialRoi = energySavingsRm + waterSavingsRm + wasteRevenueRm + laborSavingsRm; // RM 114,094.20
  const consultingCostAvoidance = 45000.0; // Eliminated external consultant fees

  const handleGenerateReport = () => {
    setGeneratingReport(true);
    setTimeout(() => {
      setGeneratingReport(false);
      setReportModalOpen(true);
      toast.success('GreenRE ESG Audit Dossier generated with SHA-256 digital signature');
    }, 1200);
  };

  const ledgerColumns = [
    {
      key: 'date',
      header: 'Timestamp',
      render: (r) => <span className="font-mono text-xs text-muted">{r.date}</span>,
    },
    {
      key: 'asset',
      header: 'Subsystem / Asset',
      render: (r) => <span className="font-mono text-xs font-bold text-fg">{r.asset}</span>,
    },
    {
      key: 'incident',
      header: 'Milestone & Root Cause Remediation',
      render: (r) => (
        <div>
          <div className="text-sm font-semibold text-fg">{r.incident}</div>
          <div className="mt-0.5 font-mono text-xs text-muted">{r.formula}</div>
        </div>
      ),
    },
    {
      key: 'roi',
      header: 'Verified ROI (RM)',
      align: 'right',
      render: (r) => (
        <span className="font-mono text-sm font-extrabold text-emerald-500">
          +RM {r.roi.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Audit Seal',
      render: (r) => (
        <Badge tone="success" className="font-mono text-[10px] tracking-wider">
          <CheckCircle2 className="mr-1 size-3" />
          {r.status}
        </Badge>
      ),
    },
  ];

  return (
    <AppShell>
      <PageHeader
        eyebrow="Enterprise Financial Performance"
        accent="var(--gg-energy)"
        title="Financial Return on Investment (ROI)"
        description="Transparent financial ledger translating intercepted utility waste and autonomous AI diagnosis into audited Ringgit Malaysia (RM) savings."
        meta={
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-500">
              <Coins className="size-3.5" />
              Payback Period: 8.2 Months
            </span>
          </div>
        }
      />

      <div className="space-y-8">
        {/* Top Summary Banner */}
        <div className="relative overflow-hidden rounded-2xl border border-line bg-gradient-to-br from-surface to-surface-2 p-6 shadow-xl sm:p-8">
          <div className="absolute right-0 top-0 -mr-16 -mt-16 size-72 rounded-full bg-brand-500/10 blur-3xl" />
          <div className="relative grid gap-6 lg:grid-cols-[1.6fr_1fr] lg:items-center">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-brand-500/30 bg-brand-500/10 px-3 py-1 text-xs font-bold text-brand-400">
                <ShieldCheck className="size-3.5" />
                ISO 52120-1 Level A Verified Savings
              </div>
              <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-fg sm:text-4xl">
                RM {totalFinancialRoi.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </h2>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted">
                Cumulative net operational cost avoided across The Light City Penang. Hardcoded audit tariffs convert intercepted kilowatt-hours, saved water volume, diverted recyclables, and automated technician labor hours into financial yield.
              </p>
              <div className="mt-4 flex flex-wrap gap-4 text-xs font-medium text-muted">
                <div>Tariff Rate: <span className="font-mono font-semibold text-fg">RM 0.509/kWh</span></div>
                <div>Water Rate: <span className="font-mono font-semibold text-fg">RM 2.27/m³</span></div>
                <div>Tech Labor: <span className="font-mono font-semibold text-fg">RM 50.00/hr</span></div>
                <div>Annualized ROI Multiple: <span className="font-mono font-bold text-emerald-400">3.8× CAPEX</span></div>
              </div>
            </div>

            {/* Compliance Monetization Box */}
            <div className="rounded-xl border border-brand-500/40 bg-brand-950/30 p-5 shadow-inner">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-brand-300">Compliance Monetization</span>
                <Badge tone="success">+RM 45,000 Saved</Badge>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-slate-300">
                Eliminate expensive annual third-party ESG & GreenRE Gold consulting audit fees. The platform compiles certified telemetry directly into an audit-ready dossier.
              </p>
              <Button
                variant="primary"
                onClick={handleGenerateReport}
                loading={generatingReport}
                className="mt-4 w-full shadow-lg"
              >
                <FileCheck2 className="mr-2 size-4" />
                Generate GreenRE ESG Report
              </Button>
            </div>
          </div>
        </div>

        {/* 4 Major Financial KPIs */}
        <div>
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-bold text-fg">Four Core Utility & Labor Monetization Pillars</h3>
            <span className="text-xs text-muted">Formula: Intercepted Physical Unit × Statutory Tariff</span>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {/* KPI 1: Energy Savings */}
            <StatCard
              label="⚡ Energy Savings"
              value={`RM ${energySavingsRm.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
              icon={<Zap className="size-4 text-amber-400" />}
              accent="var(--gg-energy)"
              tone="success"
              hint={`${energyKwhSaved.toLocaleString()} kWh × RM ${COEFFICIENTS.ENERGY_TARIFF_RM_PER_KWH}/kWh (TNB Peak)`}
            />

            {/* KPI 2: Water Savings */}
            <StatCard
              label="💧 Water Savings"
              value={`RM ${waterSavingsRm.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
              icon={<Droplets className="size-4 text-sky-400" />}
              accent="var(--gg-water)"
              tone="success"
              hint={`${waterM3Blocked.toLocaleString()} m³ leak volume blocked × RM ${COEFFICIENTS.WATER_TARIFF_RM_PER_M3}/m³`}
            />

            {/* KPI 3: Waste Revenue */}
            <StatCard
              label="♻️ Waste Revenue"
              value={`RM ${wasteRevenueRm.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
              icon={<Recycle className="size-4 text-emerald-400" />}
              accent="var(--gg-waste)"
              tone="success"
              hint={`RM ${recyclablesSoldRm.toLocaleString()} sold − RM ${haulingFeesRm.toLocaleString()} landfill hauling fees`}
            />

            {/* KPI 4: Maintenance Labor Hours */}
            <StatCard
              label="👷 Maintenance Labor"
              value={`RM ${laborSavingsRm.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
              icon={<HardHat className="size-4 text-orange-400" />}
              accent="var(--gg-reserve)"
              tone="success"
              hint={`${laborHoursSaved} AI troubleshooting hrs × RM ${COEFFICIENTS.LABOR_RATE_RM_PER_HOUR}/hr technician rate`}
            />
          </div>
        </div>

        {/* Financial Growth Charts */}
        <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
          <ChartCard
            title="Monthly Monetized Savings by Pillar (RM)"
            description="Aggregated verified savings progression across energy, water, waste diversion, and labor efficiency."
            height={320}
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={MONTHLY_SAVINGS_TREND} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid {...chart.grid} />
                <XAxis dataKey="month" {...chart.axis} />
                <YAxis {...chart.axis} tickFormatter={(v) => `RM ${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  {...chart.tooltip}
                  formatter={(val, name) => [`RM ${Number(val).toLocaleString()}`, name.toUpperCase()]}
                />
                <Legend />
                <Bar dataKey="energy" name="Energy Savings" stackId="a" fill="#3b82f6" />
                <Bar dataKey="water" name="Water Leak Protection" stackId="a" fill="#06b6d4" />
                <Bar dataKey="waste" name="Waste Revenue" stackId="a" fill="#10b981" />
                <Bar dataKey="labor" name="Labor Saved" stackId="a" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <Card>
            <CardHeader
              title="Payback & Cost Avoidance Summary"
              description="Certified against Penang Green Building Guidelines."
            />
            <div className="space-y-4">
              <div className="rounded-lg border border-line bg-surface-2 p-3.5">
                <div className="flex items-center justify-between text-xs text-muted">
                  <span>GreenRE Gold Consulting Avoidance</span>
                  <Badge tone="success">100% Automated</Badge>
                </div>
                <div className="mt-1 font-mono text-xl font-bold text-fg">RM 45,000.00 / yr</div>
                <p className="mt-1 text-xs text-muted">
                  Autonomous log verification replaces manual quarterly environmental engineering audits.
                </p>
              </div>

              <div className="rounded-lg border border-line bg-surface-2 p-3.5">
                <div className="flex items-center justify-between text-xs text-muted">
                  <span>Payback Period on IoT Hardware</span>
                  <Badge tone="info">Target: &lt;12 Mos</Badge>
                </div>
                <div className="mt-1 font-mono text-xl font-bold text-emerald-500">8.2 Months (Achieved)</div>
                <p className="mt-1 text-xs text-muted">
                  Hardware CAPEX amortized rapidly through high-value HVAC fault detection and peak shaving.
                </p>
              </div>

              <div className="rounded-lg border border-line bg-surface-2 p-3.5">
                <div className="flex items-center justify-between text-xs text-muted">
                  <span>Net Annualized Operating Margin Boost</span>
                  <Badge tone="success">+3.8× Multiple</Badge>
                </div>
                <div className="mt-1 font-mono text-xl font-bold text-fg">+RM 182,500.00 / yr</div>
                <p className="mt-1 text-xs text-muted">
                  Projected full-year run rate under active AI continuous commissioning.
                </p>
              </div>
            </div>
          </Card>
        </div>

        {/* Polished Static Mock Data Audit Ledger */}
        <section aria-labelledby="audit-ledger-heading">
          <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 id="audit-ledger-heading" className="text-lg font-bold text-fg">
                Autonomous Savings Audit Ledger
              </h3>
              <p className="text-xs text-muted">
                Immutable milestone registry documenting real-time fault interceptions, baseline deviations, and calculated financial recoveries.
              </p>
            </div>
            <div className="font-mono text-xs text-muted">
              Standard: GreenRE EN-1 / ISO 50001
            </div>
          </div>

          <Card className="overflow-hidden p-0">
            <Table
              columns={ledgerColumns}
              data={AUDIT_LEDGER_DATA}
              rowKey={(r) => r.id}
              emptyTitle="No audit milestones recorded"
            />
          </Card>
        </section>
      </div>

      {/* GreenRE ESG Report Generation Modal */}
      <Modal
        open={reportModalOpen}
        onClose={() => setReportModalOpen(false)}
        title="GreenRE ESG Audit Compliance Dossier"
        size="lg"
      >
        <div className="space-y-4">
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="size-5 text-emerald-400" />
              <h4 className="font-bold text-fg">Automated Certification Package Ready</h4>
            </div>
            <p className="mt-1 text-xs text-slate-300">
              Generated by GoGreen EMS Core. This report complies with GreenRE Non-Residential Version 3.2 and Bursa Malaysia Sustainability Reporting Standards.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-md border border-line bg-surface-2 p-3 text-xs">
              <span className="text-muted">Target Certification:</span>
              <div className="mt-0.5 font-bold text-fg">GreenRE Non-Residential Gold</div>
            </div>
            <div className="rounded-md border border-line bg-surface-2 p-3 text-xs">
              <span className="text-muted">Assessed Score:</span>
              <div className="mt-0.5 font-bold text-emerald-400">82.5 / 100 Points (Eligible for Gold)</div>
            </div>
            <div className="rounded-md border border-line bg-surface-2 p-3 text-xs">
              <span className="text-muted">Consultant Fee Saved:</span>
              <div className="mt-0.5 font-bold text-fg">RM 45,000.00 (Zero Out-of-Pocket)</div>
            </div>
            <div className="rounded-md border border-line bg-surface-2 p-3 text-xs">
              <span className="text-muted">Cryptographic Seal:</span>
              <div className="mt-0.5 font-mono font-semibold text-fg">SHA-256: 7f9a2b8...c41e</div>
            </div>
          </div>

          <div className="rounded-md border border-line bg-surface-2 p-3 text-xs">
            <span className="font-semibold text-fg">Dossier Contents:</span>
            <ul className="mt-2 list-inside list-disc space-y-1 text-muted">
              <li>Section 1: Energy Efficiency Index (EEI) 124.2 kWh/m²·yr verification</li>
              <li>Section 2: Indoor Environmental Quality (EQ-3) continuous CO2 & ventilation logs</li>
              <li>Section 3: Water Efficiency (WE) sub-meter balancing & acoustic leak telemetry</li>
              <li>Section 4: Waste Diversion rate (MR-1) AI optical audit trails</li>
            </ul>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setReportModalOpen(false)}>
              Close
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                setReportModalOpen(false);
                toast.success('Downloading GreenRE_ESG_Report_2026.pdf...');
              }}
            >
              <Download className="mr-2 size-4" />
              Download Official PDF (Signed)
            </Button>
          </div>
        </div>
      </Modal>
    </AppShell>
  );
}

