import React from 'react';
import { Sector } from 'recharts';

/**
 * Visual effects shared by GoGreen charts (recharts 3):
 *   <ChartFx colors={{ water: '#0284c7' }} />   inside a chart: gradients + glow filter
 *   fill="url(#gg-area-water)"   vertical area fade      stroke filter="url(#gg-glow)"
 *   fill="url(#gg-bar-water)"    vertical bar sheen      fill="url(#gg-hbar-water)" horizontal
 *   <Tooltip content={<GlassTooltip unit="m³" />} />
 *   <Pie activeShape={DonutActiveShape} cornerRadius={6} … />
 * Colours stay readable in light and dark themes because text uses the --gg-* tokens.
 */
export function ChartFx({ colors, prefix = 'gg' }) {
  return (
    <defs>
      {Object.entries(colors).map(([key, c]) => (
        <React.Fragment key={key}>
          <linearGradient id={`${prefix}-area-${key}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={c} stopOpacity={0.55} />
            <stop offset="55%" stopColor={c} stopOpacity={0.16} />
            <stop offset="100%" stopColor={c} stopOpacity={0} />
          </linearGradient>
          <linearGradient id={`${prefix}-bar-${key}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={c} stopOpacity={1} />
            <stop offset="100%" stopColor={c} stopOpacity={0.45} />
          </linearGradient>
          <linearGradient id={`${prefix}-hbar-${key}`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={c} stopOpacity={0.45} />
            <stop offset="100%" stopColor={c} stopOpacity={1} />
          </linearGradient>
          <linearGradient id={`${prefix}-slice-${key}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={c} stopOpacity={1} />
            <stop offset="100%" stopColor={c} stopOpacity={0.7} />
          </linearGradient>
        </React.Fragment>
      ))}
      <filter id={`${prefix}-glow`} x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="3" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>
  );
}

const fmtNum = (v, digits) => Number(v).toLocaleString(undefined, { maximumFractionDigits: digits, minimumFractionDigits: 0 });

/** Frosted-glass tooltip: coloured dots, values sorted high→low, and an optional total row. */
export function GlassTooltip({ active, payload, label, unit = '', digits = 2, labelFormatter, showTotal = false, nameOverride }) {
  if (!active || !payload?.length) return null;
  const rows = payload
    .filter((p) => p.value != null)
    .map((p) => ({ name: nameOverride || p.name, value: Number(p.value), color: p.payload?.fill && !String(p.payload.fill).startsWith('url') ? p.payload.fill : p.color || p.stroke }))
    .sort((a, b) => b.value - a.value);
  const total = rows.reduce((s, r) => s + r.value, 0);
  const title = labelFormatter ? labelFormatter(label) : label ?? payload[0]?.payload?.name;
  return (
    <div
      style={{
        background: 'color-mix(in srgb, var(--gg-surface) 82%, transparent)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        border: '1px solid var(--gg-line-strong)',
        borderRadius: 14,
        boxShadow: 'var(--gg-shadow-lg)',
        padding: '10px 14px',
        minWidth: 180,
        color: 'var(--gg-fg)',
        fontSize: 12,
      }}
    >
      {title != null && <div style={{ fontWeight: 700, color: 'var(--gg-muted)', marginBottom: 6, letterSpacing: 0.2 }}>{title}</div>}
      {rows.map((r) => (
        <div key={r.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '2px 0' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 9, height: 9, borderRadius: 999, background: r.color, boxShadow: `0 0 8px ${r.color}` }} />
            <span style={{ color: 'var(--gg-muted)', fontWeight: 600 }}>{r.name}</span>
          </span>
          <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{fmtNum(r.value, digits)}{unit && ` ${unit}`}</span>
        </div>
      ))}
      {showTotal && rows.length > 1 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--gg-line)', marginTop: 6, paddingTop: 6, fontWeight: 800 }}>
          <span>Total</span>
          <span style={{ fontFamily: 'var(--font-mono)' }}>{fmtNum(total, digits)}{unit && ` ${unit}`}</span>
        </div>
      )}
    </div>
  );
}

/** Hovered donut slice: pops outward with a thin halo ring. */
export function DonutActiveShape(props) {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill, cornerRadius } = props;
  return (
    <g>
      <Sector cx={cx} cy={cy} innerRadius={innerRadius - 2} outerRadius={outerRadius + 6} startAngle={startAngle} endAngle={endAngle} fill={fill} cornerRadius={cornerRadius} />
      <Sector cx={cx} cy={cy} innerRadius={outerRadius + 10} outerRadius={outerRadius + 13} startAngle={startAngle} endAngle={endAngle} fill={fill} opacity={0.45} cornerRadius={2} />
    </g>
  );
}

/** Pill legend matching the tooltip dots. items: [{ key, label, color }] */
export function PillLegend({ items }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginTop: 10 }}>
      {items.map((it) => (
        <span
          key={it.key}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 999,
            background: 'var(--gg-surface-2)', border: '1px solid var(--gg-line)', fontSize: 11, fontWeight: 700, color: 'var(--gg-muted)',
          }}
        >
          <span style={{ width: 8, height: 8, borderRadius: 999, background: it.color, boxShadow: `0 0 6px ${it.color}` }} />
          {it.label}
        </span>
      ))}
    </div>
  );
}

/** Axis + grid props tuned for the effects above (horizontal hairlines only, no axis lines). */
export const fxAxis = { stroke: 'var(--gg-subtle)', tick: { fill: 'var(--gg-subtle)', fontSize: 11 }, tickLine: false, axisLine: false };
export const fxGrid = { stroke: 'var(--gg-line)', strokeDasharray: '2 6', vertical: false };
