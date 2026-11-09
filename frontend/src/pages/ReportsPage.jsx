import React, { useCallback, useEffect, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AlertTriangle, Bot, Download, FileText, Leaf, RefreshCw, Recycle, Wind, Zap } from 'lucide-react';
import AppShell from '../layouts/AppShell';
import {
  Badge, Button, Card, CardHeader, ChartCard, DataState, EmptyState, ErrorState, Field, Input, PageHeader, Skeleton,
  StatCard, Table, Tabs, chart, toast,
} from '../ui';

const DAY = 86400000;
const iso = (d) => d.toISOString().slice(0, 10);
const fmt = (v, d = 0) => (v == null ? '—' : Number(v).toLocaleString(undefined, { maximumFractionDigits: d, minimumFractionDigits: d }));
const PRESETS = [
  { value: '7', label: '7 days' },
  { value: '30', label: '30 days' },
  { value: '90', label: '90 days' },
  { value: 'custom', label: 'Custom' },
];

function Unavailable({ what }) {
  return <EmptyState title={`No ${what} data for this period`} description="The data source didn't respond when the report was built." />;
}

function useHistory() {
  const [state, setState] = useState({ items: [], store: null, loading: true, error: null });
  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/reports/history');
      if (!res.ok) throw new Error(`Server responded ${res.status}`);
      const j = await res.json();
      setState({ items: j.reports, store: j.store, loading: false, error: null });
    } catch (e) {
      setState((s) => ({ ...s, loading: false, error: e.message }));
    }
  }, []);
  useEffect(() => { load(); }, [load]);
  return { ...state, reload: load };
}

export default function ReportsPage() {
  const [today] = useState(() => new Date());
  const [preset, setPreset] = useState('30');
  const [range, setRange] = useState({ start: iso(new Date(today - 30 * DAY)), end: iso(today) });
  const [query, setQuery] = useState(range);
  const [state, setState] = useState({ data: null, loading: true, error: null });
  const [exporting, setExporting] = useState(false);
  const history = useHistory();

  const choosePreset = (v) => {
    setPreset(v);
    if (v !== 'custom') {
      const next = { start: iso(new Date(today - Number(v) * DAY)), end: iso(today) };
      setRange(next);
      setQuery(next);
    }
  };

  const qs = `start=${query.start}T00:00:00Z&end=${query.end}T23:59:59Z`;

  useEffect(() => {
    const ctrl = new AbortController();
    setState((s) => ({ ...s, loading: true, error: null }));
    fetch(`/api/v1/reports/overview?${qs}`, { signal: ctrl.signal })
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json().catch(() => ({}))).detail || `Server responded ${r.status}`);
        return r.json();
      })
      .then((data) => setState({ data, loading: false, error: null }))
      .catch((e) => { if (e.name !== 'AbortError') setState({ data: null, loading: false, error: e.message }); });
    return () => ctrl.abort();
  }, [qs]);

  const exportPdf = async () => {
    setExporting(true);
    try {
      const res = await fetch(`/api/v1/reports/overview.pdf?${qs}`);
      if (!res.ok) throw new Error(`Server responded ${res.status}`);
      const blob = await res.blob();
      const name = /filename="([^"]+)"/.exec(res.headers.get('Content-Disposition') || '')?.[1] || 'gogreen-report.pdf';
      const url = URL.createObjectURL(blob);
      const a = Object.assign(document.createElement('a'), { href: url, download: name });
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      const store = res.headers.get('X-Report-Store');
      toast.success(store === 'azure-blob' ? 'PDF downloaded and archived to Azure Blob Storage' : 'PDF downloaded');
      history.reload();
    } catch (e) {
      toast.error(`Couldn't export the PDF: ${e.message}`);
    } finally {
      setExporting(false);
    }
  };

  const d = state.data;
  const loading = state.loading && !d;
  const e = d?.energy, i = d?.indoor, w = d?.water, ws = d?.waste, al = d?.alarms;
  const invalid = range.start > range.end;

  const historyCols = [
    { key: 'name', header: 'Report', render: (r) => <span className="font-mono text-xs">{r.name}</span> },
    { key: 'created_at', header: 'Created', render: (r) => new Date(r.created_at).toLocaleString() },
    { key: 'size', header: 'Size', align: 'right', render: (r) => `${fmt(r.size / 1024, 1)} KB` },
    {
      key: 'dl', header: '', align: 'right',
      render: (r) => (
        <Button as="a" href={`/api/v1/reports/files/${encodeURIComponent(r.name)}`} download size="sm" variant="ghost" icon={<Download className="size-4" />}>
          Download
        </Button>
      ),
    },
  ];

  return (
    <AppShell>
      <PageHeader
        eyebrow="Reports"
        title="Overall sustainability report"
        description="Energy, carbon, indoor air, water, waste and alarms for any period, with an AI executive summary. Export it as a PDF for audits and management."
        actions={
          <Button onClick={exportPdf} loading={exporting} disabled={!d || invalid} icon={<FileText className="size-4" />}>
            Export PDF
          </Button>
        }
      />

      <Card className="mb-6">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <p className="mb-1.5 text-sm font-semibold text-fg">Period</p>
            <Tabs label="Report period" items={PRESETS} value={preset} onChange={choosePreset} />
          </div>
          <Field label="From">
            <Input type="date" value={range.start} max={range.end} onChange={(ev) => { setPreset('custom'); setRange((r) => ({ ...r, start: ev.target.value })); }} />
          </Field>
          <Field label="To" error={invalid ? 'End date is before start date' : undefined}>
            <Input type="date" value={range.end} min={range.start} onChange={(ev) => { setPreset('custom'); setRange((r) => ({ ...r, end: ev.target.value })); }} />
          </Field>
          {preset === 'custom' && (
            <Button variant="secondary" disabled={invalid} onClick={() => setQuery(range)} icon={<RefreshCw className="size-4" />}>Update</Button>
          )}
        </div>
      </Card>

      {state.error ? (
        <Card><ErrorState title="Couldn't build the report" description={state.error} onRetry={() => setQuery({ ...query })} /></Card>
      ) : (
        <div className="space-y-6" aria-busy={state.loading}>
          {/* KPIs */}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <StatCard loading={loading} label="Energy" value={e?.available ? fmt(e.total_kwh) : '—'} unit="kWh" icon={<Zap className="size-4" />} accent="var(--gg-energy)"
              hint={e?.available ? `RM ${fmt(e.total_cost_myr)}` : null} />
            <StatCard loading={loading} label="Carbon" value={e?.available ? fmt(e.carbon_kg / 1000, 1) : '—'} unit="t CO₂e" icon={<Leaf className="size-4" />} accent="var(--gg-energy)"
              hint="0.585 kg CO₂e/kWh grid factor" />
            <StatCard loading={loading} label="Indoor air" value={i?.available ? `${i.compliant_floors}/${i.total_floors}` : '—'} unit="floors OK" icon={<Wind className="size-4" />}
              tone={i?.available && i.compliant_floors < i.total_floors ? 'danger' : 'success'} hint={i?.available ? `peak CO₂ ${fmt(i.max_co2)} ppm` : null} />
            <StatCard loading={loading} label="Waste recycled" value={ws?.available ? fmt(ws.recycling_rate, 1) : '—'} unit="%" icon={<Recycle className="size-4" />} accent="var(--gg-waste)"
              hint={ws?.available ? `${fmt(ws.total_kg, 1)} kg · ${fmt(ws.contamination_rate, 1)}% contaminated` : null} />
            <StatCard loading={loading} label="Open alarms" value={al?.available ? al.open : '—'} icon={<AlertTriangle className="size-4" />}
              tone={al?.open ? 'danger' : 'success'} hint={al?.available ? `${al.total} raised in period` : null} />
          </div>

          {/* AI summary */}
          <Card className="border-primary/30 bg-primary-soft">
            <CardHeader
              icon={<Bot className="size-5" />}
              title="Executive summary"
              description={d?.ai_summary ? `Written by ${({ azure: 'Azure OpenAI', gemini: 'Gemini', openai: 'OpenAI' })[d.ai_summary.source] || 'rules'} from the figures below` : 'Generating…'}
            />
            {loading ? (
              <div className="space-y-2"><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-11/12" /><Skeleton className="h-4 w-3/4" /></div>
            ) : (
              <>
                <p className="leading-relaxed text-fg">{d?.ai_summary?.summary}</p>
                {d?.ai_summary?.actions?.length > 0 && (
                  <ol className="mt-4 space-y-2">
                    {d.ai_summary.actions.map((a, n) => (
                      <li key={n} className="flex gap-3 text-sm text-fg">
                        <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary font-bold text-on-brand">{n + 1}</span>
                        <span className="pt-0.5">{a}</span>
                      </li>
                    ))}
                  </ol>
                )}
              </>
            )}
          </Card>

          {/* Charts */}
          <div className="grid gap-6 xl:grid-cols-2">
            <ChartCard title="Daily electricity" description="kWh per day" height={280}
              state={loading ? <DataState loading /> : !e?.available ? <Unavailable what="energy" /> : !e.daily.length ? <EmptyState title="No meter readings in this period" /> : null}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={e?.daily || []} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                  <CartesianGrid {...chart.grid} />
                  <XAxis dataKey="date" {...chart.axis} tickFormatter={(v) => v.slice(5)} />
                  <YAxis {...chart.axis} tickFormatter={(v) => (v >= 1e6 ? `${v / 1e6}M` : v >= 1e3 ? `${v / 1e3}k` : v)} />
                  <Tooltip {...chart.tooltip} cursor={{ fill: 'var(--gg-surface-2)' }} formatter={(v) => [`${fmt(v)} kWh`, 'Electricity']} />
                  <Bar dataKey="kwh" fill="var(--gg-energy)" radius={[5, 5, 0, 0]} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="CO₂ by floor" description={i?.available ? 'Live snapshot · dashed line = GreenRE EQ-3 limit' : 'Live snapshot'} height={280}
              state={loading ? <DataState loading /> : !i?.available ? <Unavailable what="indoor air" /> : null}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={i?.floors || []} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                  <CartesianGrid {...chart.grid} />
                  <XAxis dataKey="floor" {...chart.axis} />
                  <YAxis {...chart.axis} domain={[0, 1300]} />
                  <Tooltip {...chart.tooltip} cursor={{ fill: 'var(--gg-surface-2)' }} formatter={(v) => [`${fmt(v)} ppm`, 'CO₂']} />
                  <ReferenceLine y={i?.threshold_ppm || 1000} stroke="var(--gg-danger)" strokeDasharray="5 4" />
                  <Bar dataKey="co2" radius={[5, 5, 0, 0]} isAnimationActive={false}>
                    {(i?.floors || []).map((f) => <Cell key={f.floor} fill={f.status === 'NORMAL' ? 'var(--gg-energy)' : 'var(--gg-danger)'} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Water by sub-system" description={w?.available ? `Last 24 h · ${w.active_meters} live meters · ${fmt(w.flow_m3_per_hr, 2)} m³/h now` : 'Last 24 h'} height={260}
              state={loading ? <DataState loading /> : !w?.available ? <Unavailable what="water" /> : null}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={w?.distribution_24h || []} layout="vertical" margin={{ top: 4, right: 16, left: 24, bottom: 0 }}>
                  <CartesianGrid {...chart.grid} horizontal={false} vertical />
                  <XAxis type="number" {...chart.axis} />
                  <YAxis type="category" dataKey="water_category" {...chart.axis} width={100} />
                  <Tooltip {...chart.tooltip} cursor={{ fill: 'var(--gg-surface-2)' }} formatter={(v) => [`${fmt(v, 1)} m³`, 'Volume']} />
                  <Bar dataKey="volume_m3" fill="var(--gg-water)" radius={[0, 5, 5, 0]} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <Card>
              <CardHeader title="Energy by zone" description={e?.available ? `Building EEI ${fmt(e.building_eei, 1)} kWh/m²·yr` : undefined} />
              {loading ? <DataState loading /> : !e?.available ? <Unavailable what="energy" /> : (
                <ul className="divide-y divide-line">
                  {e.zones.map((z) => (
                    <li key={z.name} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                      <span className="min-w-0">
                        <span className="block truncate font-semibold text-fg">{z.name}</span>
                        <span className="text-xs text-muted">{z.floors} · EEI {fmt(z.eei, 1)} vs {fmt(z.baseline_eei)}</span>
                      </span>
                      <span className="flex shrink-0 items-center gap-3">
                        <span className="font-mono tabular text-fg">{fmt(z.kwh)} kWh</span>
                        <Badge tone={z.status === 'compliant' ? 'success' : 'warning'}>{z.status}</Badge>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>

          {/* Alarms */}
          <section aria-labelledby="rep-alarms">
            <h2 id="rep-alarms" className="mb-3 text-base font-bold text-fg">Alarms in this period</h2>
            <Table
              caption="Alarms raised in the report period"
              loading={loading}
              rows={al?.available ? al.recent : []}
              rowKey={(r, n) => `${r.code}-${n}`}
              emptyTitle={al && !al.available ? 'Alarm data unavailable' : 'No alarms in this period'}
              columns={[
                { key: 'at', header: 'Raised', render: (r) => new Date(r.at).toLocaleString() },
                { key: 'code', header: 'Code', render: (r) => <span className="font-mono text-xs">{r.code}</span> },
                { key: 'severity', header: 'Severity', render: (r) => <Badge tone={r.severity === 'HIGH' || r.severity === 'CRITICAL' ? 'danger' : 'warning'}>{r.severity}</Badge> },
                { key: 'description', header: 'Description' },
              ]}
            />
          </section>

          {/* Archive */}
          <section aria-labelledby="rep-history">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <h2 id="rep-history" className="text-base font-bold text-fg">Past reports</h2>
              {history.store && <Badge tone={history.store === 'azure-blob' ? 'info' : 'neutral'}>{history.store === 'azure-blob' ? 'Stored in Azure Blob Storage' : 'Stored locally'}</Badge>}
            </div>
            <Table
              caption="Previously exported PDF reports"
              columns={historyCols}
              rows={history.items}
              rowKey="name"
              loading={history.loading}
              error={history.error}
              onRetry={history.reload}
              emptyTitle="No reports exported yet"
              emptyDescription="Use Export PDF to create the first one."
            />
          </section>
        </div>
      )}
    </AppShell>
  );
}
