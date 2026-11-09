import React from 'react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Banknote, Clock, Droplets, Factory, Leaf, Zap } from 'lucide-react';
import AppShell from '../layouts/AppShell';
import { Badge, Card, CardHeader, ChartCard, ErrorState, LoadingState, PageHeader, StatCard, chart } from '../ui';
import { useSustainability } from '../features/modules/useModuleData';

const fmt = (n, d = 0) => (n == null ? '—' : Number(n).toLocaleString(undefined, { maximumFractionDigits: d, minimumFractionDigits: d }));

function BeforeAfter({ label, before, after, unit, pct }) {
  const d = before != null && before < 100 ? 1 : 0;
  const width = before ? Math.max(4, (after / before) * 100) : 0;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-semibold text-fg">{label}</span>
        {pct != null && <Badge tone="success">−{fmt(pct, 1)}%</Badge>}
      </div>
      <div className="mt-2 space-y-1.5" aria-hidden="true">
        <div className="h-2.5 rounded-full bg-surface-3" />
        <div className="h-2.5 rounded-full bg-brand-500" style={{ width: `${width}%` }} />
      </div>
      <p className="mt-1.5 text-xs text-muted">
        <span className="font-mono tabular">{fmt(before, d)}</span> → <span className="font-mono tabular font-semibold text-success">{fmt(after, d)}</span> {unit}
      </p>
    </div>
  );
}

export default function CarbonPage() {
  const { data, error, loading, reload } = useSustainability();
  const hvac = data?.hvac;

  const emissions = hvac ? [
    { name: 'Baseline', co2e: Math.round(hvac.co2e_before_kg / 1000 * 10) / 10 },
    { name: 'With GoGreen', co2e: Math.round(hvac.co2e_after_kg / 1000 * 10) / 10 },
  ] : [];

  return (
    <AppShell>
      <PageHeader
        eyebrow="Carbon dioxide"
        accent="var(--gg-energy)"
        title="Carbon footprint"
        description="Operational CO₂e from HVAC and lighting, before and after GoGreen's automated controls, using the Malaysian grid factor of 0.585 kg CO₂e/kWh."
        meta={data?.is_simulated && <Badge tone="info">Controlled experiment</Badge>}
      />

      {error && !data ? (
        <Card><ErrorState title="Can't load the carbon results" description={`${error}. Make sure the backend is running (npm run backend).`} onRetry={reload} /></Card>
      ) : loading && !data ? (
        <Card><LoadingState label="Loading carbon results…" /></Card>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="CO₂e avoided" value={fmt(data.total_co2e_saved_kg / 1000, 1)} unit="t / month" icon={<Leaf className="size-4" />}
              accent="var(--gg-energy)" tone="success" hint={`≈ ${fmt(data.total_co2e_saved_kg / 21)} trees for a year`} />
            <StatCard label="Energy saved" value={fmt(data.total_energy_saved_kwh)} unit="kWh" icon={<Zap className="size-4" />} tone="success" hint={`−${fmt(hvac?.pct_saved, 1)}% HVAC + lighting`} />
            <StatCard label="Cost saved" value={`RM ${fmt(data.total_cost_saved_myr)}`} icon={<Banknote className="size-4" />} hint="per month" />
            <StatCard label="GreenRE EEI" value={fmt(data.greenre_eei_after, 1)} unit="kWh/m²·yr" icon={<Factory className="size-4" />} tone="success"
              hint={`from ${fmt(data.greenre_eei_before, 1)} (−${fmt(data.greenre_eei_improvement_pct, 1)}%)`} />
          </div>

          <div className="grid gap-6 xl:grid-cols-[1.2fr_1fr]">
            <ChartCard title="Monthly emissions" description={`Tonnes CO₂e over a ${fmt(data.window_hours / 24)}-day window`} height={300}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={emissions} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                  <CartesianGrid {...chart.grid} />
                  <XAxis dataKey="name" {...chart.axis} />
                  <YAxis {...chart.axis} unit=" t" />
                  <Tooltip {...chart.tooltip} cursor={{ fill: 'var(--gg-surface-2)' }} formatter={(v) => [`${v} t CO₂e`, 'Emissions']} />
                  <Legend {...chart.legend} />
                  <Bar name="t CO₂e" dataKey="co2e" fill="var(--gg-energy)" radius={[6, 6, 0, 0]} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <Card>
              <CardHeader title="Where the savings come from" description="Baseline vs. with GoGreen, per month." />
              <div className="space-y-5">
                <BeforeAfter label="HVAC + lighting energy" before={hvac?.energy_before_kwh} after={hvac?.energy_after_kwh} unit="kWh" pct={hvac?.pct_saved} />
                <BeforeAfter label="Operational CO₂e" before={hvac?.co2e_before_kg} after={hvac?.co2e_after_kg} unit="kg" pct={hvac?.pct_saved} />
                <BeforeAfter label="Water lost to leaks" before={data.water?.litres_leaked_before} after={data.water?.litres_leaked_after} unit="L"
                  pct={data.water?.litres_leaked_before ? (data.water.litres_saved / data.water.litres_leaked_before) * 100 : null} />
                <BeforeAfter label="Audit preparation" before={data.audit?.hours_before} after={data.audit?.hours_after} unit="hours"
                  pct={data.audit?.hours_before ? (data.audit.hours_saved / data.audit.hours_before) * 100 : null} />
              </div>
            </Card>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <StatCard label="Water saved" value={fmt(data.total_water_saved_litres)} unit="L / month" icon={<Droplets className="size-4" />} accent="var(--gg-water)" />
            <StatCard label="Audit hours saved" value={fmt(data.audit?.hours_saved, 1)} unit="h / month" icon={<Clock className="size-4" />} accent="var(--gg-reserve)" />
          </div>

          {data.methodology_notes?.length > 0 && (
            <Card>
              <CardHeader title="Methodology" description={`Experiment ${data.experiment_id}`} />
              <ul className="grid gap-x-8 gap-y-2 text-sm text-muted md:grid-cols-2">
                {data.methodology_notes.map((n) => <li key={n} className="flex gap-2"><span className="text-success" aria-hidden="true">•</span>{n}</li>)}
              </ul>
            </Card>
          )}
        </div>
      )}
    </AppShell>
  );
}
