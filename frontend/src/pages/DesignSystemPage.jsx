import React, { useState } from 'react';
import { Area, AreaChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Bell, Download, Droplets, Leaf, Plus, Recycle, Trash2, Zap } from 'lucide-react';
import AppShell from '../layouts/AppShell';
import {
  Badge, Button, Card, CardHeader, ChartCard, DataState, EmptyState, ErrorState, Field, IconButton, Input, LoadingState,
  Modal, PageHeader, Select, SERIES, SidePanel, Skeleton, StatCard, StatusPill, Table, Tabs, Textarea, Toggle,
  UploadDropzone, chart, toast,
} from '../ui';

const SWATCHES = [
  ['bg', 'Background'], ['surface', 'Surface'], ['surface-2', 'Surface 2'], ['surface-3', 'Surface 3'],
  ['line', 'Line'], ['line-strong', 'Line strong'], ['fg', 'Text'], ['muted', 'Muted'], ['subtle', 'Subtle'],
  ['primary', 'Primary'], ['energy', 'Energy'], ['water', 'Water'], ['waste', 'Waste'], ['reserve', 'Reserve'],
  ['success', 'Success'], ['warning', 'Warning'], ['danger', 'Danger'], ['info', 'Info'],
];
const BRAND = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900];

const DEMO_SERIES = Array.from({ length: 24 }, (_, i) => ({
  t: `${String(i).padStart(2, '0')}:00`,
  general_water: +(2 + Math.sin(i / 3) * 1.2 + (i > 8 && i < 19 ? 2 : 0)).toFixed(2),
  chilled_water: +(1 + Math.max(0, Math.sin((i - 7) / 4)) * 1.4).toFixed(2),
  irrigation: i === 6 || i === 7 || i === 18 ? 1.8 : 0.05,
}));

const ROWS = [
  { id: 1, time: '14:02', item: 'PET bottle', category: 'Recyclable', confidence: 0.97 },
  { id: 2, time: '13:47', item: 'Food scraps', category: 'Organic', confidence: 0.91 },
  { id: 3, time: '13:30', item: 'Battery', category: 'Hazardous', confidence: 0.88 },
];
const CATEGORY_TONE = { Recyclable: 'success', Organic: 'brand', Hazardous: 'danger' };

function Section({ title, description, children }) {
  return (
    <section className="mb-12" aria-labelledby={`ds-${title}`}>
      <h2 id={`ds-${title}`} className="text-xl font-bold text-fg">{title}</h2>
      {description && <p className="mt-1 mb-5 text-sm text-muted max-w-2xl">{description}</p>}
      {children}
    </section>
  );
}

export default function DesignSystemPage() {
  const [tab, setTab] = useState('live');
  const [modal, setModal] = useState(false);
  const [panel, setPanel] = useState(false);
  const [toggle, setToggle] = useState(true);
  const [stateDemo, setStateDemo] = useState('ready');

  return (
    <AppShell>
      <PageHeader
        eyebrow="Design system"
        title="GoGreen UI kit"
        description="Tokens and shared components used by every page. Use the theme toggle in the top bar to check both themes."
        meta={<Badge tone="brand">v1.0</Badge>}
        actions={<Button variant="secondary" icon={<Download className="size-4" aria-hidden="true" />}>Export tokens</Button>}
      />

      <Section title="Colour tokens" description="Semantic tokens switch automatically between light and dark. All text pairs meet WCAG AA.">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
          {SWATCHES.map(([token, name]) => (
            <div key={token} className="rounded-lg border border-line bg-surface p-2">
              <div className="h-12 rounded-md border border-line" style={{ background: `var(--gg-${token})` }} />
              <p className="mt-2 text-xs font-semibold text-fg">{name}</p>
              <p className="font-mono text-[11px] text-subtle">--gg-{token}</p>
            </div>
          ))}
        </div>
        <div className="flex overflow-hidden rounded-lg border border-line">
          {BRAND.map((n) => (
            <div key={n} className="flex-1 h-14 flex items-end p-1.5" style={{ background: `var(--gg-brand-${n})` }}>
              <span className={`font-mono text-[10px] font-bold ${n >= 500 ? 'text-white' : 'text-[#064e3b]'}`}>{n}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Typography" description="Inter for UI, JetBrains Mono with tabular figures for metrics.">
        <Card className="space-y-2">
          <p className="text-5xl font-extrabold tracking-tight">Continuous compliance</p>
          <p className="text-3xl font-bold">GreenRE Platinum, verified live</p>
          <p className="text-xl font-semibold">Section title · 20px</p>
          <p className="text-base">Body text · 16px. Water, energy and waste in one view.</p>
          <p className="text-sm text-muted">Secondary text · 14px muted</p>
          <p className="font-mono tabular text-2xl font-bold">41,486.120 m³</p>
        </Card>
      </Section>

      <Section title="Buttons">
        <div className="flex flex-wrap items-center gap-3">
          <Button icon={<Plus className="size-4" aria-hidden="true" />}>Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="soft">Soft</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger" icon={<Trash2 className="size-4" aria-hidden="true" />}>Delete</Button>
          <Button loading>Saving</Button>
          <Button size="sm">Small</Button>
          <Button size="lg">Large</Button>
          <IconButton label="Notifications" variant="secondary"><Bell className="size-4" /></IconButton>
        </div>
      </Section>

      <Section title="Stat cards & badges">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
          <StatCard label="Total flow volume" value="41,486.120" unit="m³" icon={<Droplets className="size-4" />} hint="● Live · 2.31 m³/h now" tone="success" accent="var(--gg-water)" />
          <StatCard label="Energy (EE-1)" value="128.4" unit="kWh/m²" icon={<Zap className="size-4" />} hint="12% below baseline" tone="success" accent="var(--gg-energy)" />
          <StatCard label="Diversion rate" value="62.5" unit="%" icon={<Recycle className="size-4" />} hint="Target 70%" tone="warning" accent="var(--gg-waste)" />
          <StatCard label="GreenRE score" loading />
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge>Neutral</Badge><Badge tone="brand">Brand</Badge><Badge tone="success">Compliant</Badge>
          <Badge tone="warning">At risk</Badge><Badge tone="danger">Breach</Badge><Badge tone="info">Info</Badge>
          <StatusPill pulse>Live</StatusPill><StatusPill tone="warning">Reconnecting</StatusPill><StatusPill tone="danger">Offline</StatusPill>
        </div>
      </Section>

      <Section title="Tabs, chart card & data states">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <Tabs label="Chart mode" value={tab} onChange={setTab} items={[{ value: 'live', label: 'Live' }, { value: 'history', label: 'Historical' }]} />
          <Tabs label="State demo" size="sm" value={stateDemo} onChange={setStateDemo} items={['ready', 'loading', 'empty', 'error'].map((v) => ({ value: v, label: v }))} />
        </div>
        <ChartCard
          title="Disaggregated water time series"
          description="Volume per hour by sub-meter (m³)"
          actions={<StatusPill pulse>Live</StatusPill>}
        >
          <DataState loading={stateDemo === 'loading'} error={stateDemo === 'error' && 'Backend unreachable on port 5000.'} empty={stateDemo === 'empty'} onRetry={() => setStateDemo('ready')} emptyTitle="No meter readings yet" emptyDescription="Start the edge simulator to stream data.">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={DEMO_SERIES}>
                <CartesianGrid {...chart.grid} />
                <XAxis dataKey="t" {...chart.axis} minTickGap={24} />
                <YAxis {...chart.axis} width={36} />
                <Tooltip {...chart.tooltip} />
                <Legend {...chart.legend} />
                {Object.keys(SERIES).filter((k) => k in DEMO_SERIES[0]).map((k) => (
                  <Area key={k} dataKey={k} name={{ general_water: 'General water', chilled_water: 'Chilled / cooling', irrigation: 'Irrigation' }[k]} type="monotone" stackId="1" stroke={SERIES[k]} fill={SERIES[k]} fillOpacity={0.25} strokeWidth={2} />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          </DataState>
        </ChartCard>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
          <Card className="h-48" padded={false}><LoadingState /></Card>
          <Card className="h-48" padded={false}><EmptyState title="No scans today" description="Upload a photo to classify waste." /></Card>
          <Card className="h-48" padded={false}><ErrorState description="Detection service timed out." onRetry={() => toast.info('Retrying…')} /></Card>
        </div>
      </Section>

      <Section title="Table">
        <Table
          caption="Recent waste scans"
          columns={[
            { key: 'time', header: 'Time' },
            { key: 'item', header: 'Item' },
            { key: 'category', header: 'Category', render: (r) => <Badge tone={CATEGORY_TONE[r.category]}>{r.category}</Badge> },
            { key: 'confidence', header: 'Confidence', align: 'right', render: (r) => `${(r.confidence * 100).toFixed(0)}%` },
          ]}
          rows={ROWS}
          onRowClick={(r) => toast.info(`Selected ${r.item}`)}
        />
      </Section>

      <Section title="Forms & upload">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card className="space-y-4">
            <CardHeader title="Bin settings" description="Example form built from Field + controls" />
            <Field label="Bin name" hint="Shown on reports" required><Input placeholder="Podium L2 · East" /></Field>
            <Field label="Stream"><Select defaultValue="recyclable"><option value="recyclable">Recyclable</option><option value="organic">Organic</option><option value="general">General</option></Select></Field>
            <Field label="Threshold" error="Must be between 1 and 100"><Input type="number" defaultValue={140} /></Field>
            <Field label="Notes"><Textarea placeholder="Optional" /></Field>
            <Toggle label="Auto-scan" description="Classify every frame from the live camera" checked={toggle} onChange={setToggle} />
          </Card>
          <UploadDropzone accept="image/*" maxSizeMb={10} title="Drop a waste photo or click to browse" hint="JPG or PNG, up to 10 MB" onFiles={(f) => toast.success('File ready', { description: f[0].name })} />
        </div>
      </Section>

      <Section title="Overlays & feedback">
        <div className="flex flex-wrap gap-3">
          <Button variant="secondary" onClick={() => setModal(true)}>Open modal</Button>
          <Button variant="secondary" onClick={() => setPanel(true)}>Open side panel</Button>
          <Button variant="secondary" onClick={() => toast.success('Evidence pack exported', { description: 'GreenRE_WE-1_2026-11.pdf' })}>Success toast</Button>
          <Button variant="secondary" onClick={() => toast.error('Upload failed', { description: 'The detection service returned 503.' })}>Error toast</Button>
        </div>
        <div className="mt-4 flex items-center gap-3"><Skeleton className="size-10 rounded-full" /><div className="space-y-2"><Skeleton className="h-3 w-48" /><Skeleton className="h-3 w-32" /></div></div>
      </Section>

      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title="Export GreenRE evidence"
        description="Bundle the latest audit for submission."
        footer={<><Button variant="ghost" onClick={() => setModal(false)}>Cancel</Button><Button onClick={() => { setModal(false); toast.success('Export started'); }}>Export</Button></>}
      >
        <p className="text-sm text-muted">The pack includes WE-1 water, EE-1 energy and waste diversion evidence for November 2026.</p>
      </Modal>

      <SidePanel open={panel} onClose={() => setPanel(false)} title="Zone C · Offices" subtitle="L4–L12 · 9 floors">
        <div className="space-y-3">
          <StatCard label="Live load" value="182.4" unit="kW" icon={<Zap className="size-4" />} />
          <StatCard label="Compliance" value="91" unit="/100" icon={<Leaf className="size-4" />} hint="GreenRE Platinum" tone="success" />
        </div>
      </SidePanel>
    </AppShell>
  );
}
