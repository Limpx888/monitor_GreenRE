/**
 * Shared recharts styling, so every chart matches the tokens in both themes.
 * Colours are CSS variables, which update automatically when the theme switches.
 *
 *   <CartesianGrid {...chart.grid} />
 *   <XAxis dataKey="t" {...chart.axis} />
 *   <Tooltip {...chart.tooltip} />
 *   <Legend {...chart.legend} />
 */
export const SERIES = {
  general_water: '#0ea5e9',
  chilled_water: '#06b6d4',
  irrigation: '#10b981',
  hot_water: '#f97316',
  steam: '#8b5cf6',
};

/** Categorical palette for charts without a fixed mapping (CVD-friendly order). */
export const PALETTE = ['#10b981', '#0ea5e9', '#f59e0b', '#8b5cf6', '#ef4444', '#14b8a6', '#ec4899', '#64748b'];

export const chart = {
  grid: { strokeDasharray: '3 3', stroke: 'var(--gg-line)', vertical: false },
  axis: {
    stroke: 'var(--gg-line-strong)',
    tick: { fill: 'var(--gg-subtle)', fontSize: 11 },
    tickLine: false,
    axisLine: false,
  },
  tooltip: {
    contentStyle: {
      background: 'var(--gg-surface)',
      border: '1px solid var(--gg-line)',
      borderRadius: 10,
      boxShadow: 'var(--gg-shadow-md)',
      color: 'var(--gg-fg)',
      fontSize: 12,
    },
    labelStyle: { color: 'var(--gg-muted)', fontWeight: 600, marginBottom: 4 },
    itemStyle: { color: 'var(--gg-fg)' },
    cursor: { stroke: 'var(--gg-line-strong)', strokeWidth: 1 },
  },
  legend: { wrapperStyle: { fontSize: 12, fontWeight: 600, color: 'var(--gg-muted)' }, iconType: 'circle', iconSize: 8 },
};
