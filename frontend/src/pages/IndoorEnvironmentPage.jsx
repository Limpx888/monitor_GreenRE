import React, { useMemo } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AlertTriangle, Gauge, ThermometerSun, Wind } from 'lucide-react';
import AppShell from '../layouts/AppShell';
import {
  Badge, Card, CardHeader, ChartCard, DataState, ErrorState, PageHeader, StatCard, StatusPill, Table, chart,
} from '../ui';
import { IEQ_TONE, useIeqLive } from '../features/modules/useModuleData';

const BAR_COLOR = { NORMAL: 'var(--gg-energy)', WARNING: 'var(--gg-warning)', CRITICAL: 'var(--gg-danger)' };

const columns = [
  { key: 'floor_id', header: 'Floor', render: (r) => <span className="font-mono font-semibold">{r.floor_id}</span> },
  { key: 'name', header: 'Space' },
  { key: 'co2', header: 'CO₂ (ppm)', align: 'right', render: (r) => <span className="font-mono tabular">{r.co2.toFixed(0)}</span> },
  { key: 'pm25', header: 'PM2.5 (µg/m³)', align: 'right', render: (r) => <span className="font-mono tabular">{r.pm25.toFixed(1)}</span> },
  { key: 'damper', header: 'Fresh-air damper', align: 'right', render: (r) => <span className="font-mono tabular">{r.damper_position_pct}%</span> },
  { key: 'status', header: 'Status', render: (r) => <Badge tone={IEQ_TONE[r.status] ?? 'neutral'}>{r.status}</Badge> },
];

export default function IndoorEnvironmentPage() {
  const { data, error, loading, reload } = useIeqLive();
  const floors = useMemo(() => data?.floors ?? [], [data]);

  const avg = (k) => (floors.length ? floors.reduce((s, f) => s + f[k], 0) / floors.length : 0);
  const alerts = floors.filter((f) => f.status !== 'NORMAL');
  const threshold = data?.co2_threshold_ppm ?? 1000;
  const overall = data?.overall_status ?? 'NORMAL';

  return (
    <AppShell>
      <PageHeader
        eyebrow="Indoor environment"
        accent="var(--gg-energy)"
        title="Indoor air quality"
        description="Live CO₂ and PM2.5 for every monitored floor, checked against the GreenRE EQ-3 fresh-air limit of 1,000 ppm."
        meta={data && <StatusPill tone={IEQ_TONE[overall]} pulse>{overall === 'NORMAL' ? 'All floors compliant' : `${alerts.length} floor${alerts.length > 1 ? 's' : ''} over limit`}</StatusPill>}
      />

      {error && !data ? (
        <Card><ErrorState title="Can't reach the IEQ sensors" description={`${error}. Make sure the backend is running (npm run backend).`} onRetry={reload} /></Card>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard loading={loading && !data} label="Peak CO₂" value={data?.max_co2?.toFixed(0)} unit="ppm" icon={<Gauge className="size-4" />}
              accent="var(--gg-energy)" tone={data?.max_co2 > threshold ? 'danger' : 'success'}
              hint={data ? `${Math.round((data.max_co2 / threshold) * 100)}% of the ${threshold.toFixed(0)} ppm limit` : null} />
            <StatCard loading={loading && !data} label="Average CO₂" value={avg('co2').toFixed(0)} unit="ppm" icon={<Wind className="size-4" />} hint={`${floors.length} floors monitored`} />
            <StatCard loading={loading && !data} label="Average PM2.5" value={avg('pm25').toFixed(1)} unit="µg/m³" icon={<ThermometerSun className="size-4" />}
              tone={avg('pm25') > 25 ? 'warning' : 'success'} hint="WHO 24 h guideline: 15 µg/m³" />
            <StatCard loading={loading && !data} label="Active alerts" value={alerts.length} icon={<AlertTriangle className="size-4" />}
              tone={alerts.length ? 'danger' : 'success'} hint={alerts.length ? alerts.map((f) => f.floor_id).join(', ') : 'No breaches right now'} />
          </div>

          <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
            <ChartCard
              title="CO₂ by floor"
              description="Updated every 4 seconds. The dashed line is the GreenRE EQ-3 limit."
              height={300}
              state={(loading && !data) || !floors.length ? <DataState loading={loading} empty={!floors.length} emptyTitle="No floor readings yet" /> : null}
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={floors} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                  <CartesianGrid {...chart.grid} />
                  <XAxis dataKey="floor_id" {...chart.axis} />
                  <YAxis {...chart.axis} domain={[0, (max) => Math.max(1300, Math.ceil(max / 100) * 100)]} />
                  <Tooltip {...chart.tooltip} cursor={{ fill: 'var(--gg-surface-2)' }} formatter={(v) => [`${Number(v).toFixed(0)} ppm`, 'CO₂']} labelFormatter={(id) => floors.find((f) => f.floor_id === id)?.name ?? id} />
                  <ReferenceLine y={threshold} stroke="var(--gg-danger)" strokeDasharray="5 4" />
                  <Bar dataKey="co2" radius={[6, 6, 0, 0]} isAnimationActive={false}>
                    {floors.map((f) => <Cell key={f.floor_id} fill={BAR_COLOR[f.status] ?? BAR_COLOR.NORMAL} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <Card>
              <CardHeader title="Recommended actions" description="Generated from the live readings." />
              {alerts.length ? (
                <ul className="space-y-3">
                  {alerts.map((f) => (
                    <li key={f.floor_id} className="rounded-md border border-line bg-surface-2 p-4">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-fg">{f.floor_id} · {f.name}</span>
                        <Badge tone={IEQ_TONE[f.status]}>{f.status}</Badge>
                      </div>
                      <p className="mt-1 text-sm text-muted">{f.alert}</p>
                      <p className="mt-2 text-sm font-semibold text-fg">{f.recommended_action}</p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="rounded-md bg-success-bg p-4 text-sm font-semibold text-success">
                  Every floor is within the GreenRE EQ-3 limit. Ventilation is running at the optimal rate.
                </p>
              )}
            </Card>
          </div>

          <section aria-labelledby="ieq-table">
            <h2 id="ieq-table" className="mb-3 text-base font-bold text-fg">Floor readings</h2>
            <Table columns={columns} rows={floors} rowKey="floor_id" loading={loading && !data} caption="Indoor air quality per floor" />
          </section>
        </div>
      )}
    </AppShell>
  );
}
