import React, { useState, useEffect, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts';
import { ChartFx, DonutActiveShape, GlassTooltip, PillLegend, fxAxis, fxGrid } from '../ui';
import { waterApi } from '../api/waterApi';
import { useWaterLiveStore } from '../stores/waterLiveStore';

const METER_COLORS = {
  general_water: '#0284c7', // Sky blue
  chilled_water: '#06b6d4', // Cyan
  irrigation: '#10b981',    // Emerald green
  hot_water: '#f97316',     // Amber / Orange
  steam: '#8b5cf6',         // Purple
};

const METER_LABELS = {
  general_water: 'General Domestic Water',
  chilled_water: 'Cooling / Chilled Water',
  irrigation: 'Landscape Irrigation',
  hot_water: 'Domestic Hot Water',
  steam: 'Boiler Steam System',
};

// Chart series: largest flows drawn first so the smaller ones stay visible on top
const SERIES_ORDER = ['general_water', 'chilled_water', 'hot_water', 'steam', 'irrigation'];
const SERIES_NAMES = {
  general_water: 'General Water',
  chilled_water: 'Chilled / Cooling',
  hot_water: 'Hot Water',
  steam: 'Steam',
  irrigation: 'Irrigation',
};

const EMPTY_TOTALS = { general_water: 0, chilled_water: 0, irrigation: 0, hot_water: 0, steam: 0 };

const LIVE_STATUS = {
  open: { label: 'LIVE', bg: 'var(--gg-success-bg)', fg: 'var(--gg-success)' },
  connecting: { label: 'CONNECTING', bg: 'var(--gg-warning-bg)', fg: 'var(--gg-warning)' },
  reconnecting: { label: 'RECONNECTING', bg: 'var(--gg-warning-bg)', fg: 'var(--gg-warning)' },
  closed: { label: 'OFFLINE', bg: 'var(--gg-danger-bg)', fg: 'var(--gg-danger)' },
  idle: { label: 'OFFLINE', bg: 'var(--gg-danger-bg)', fg: 'var(--gg-danger)' },
};

const formatClock = (iso) => (iso ? iso.slice(11, 19) : '--:--:--');
const formatBucketTick = (iso) => (iso ? iso.slice(11, 16) : '');

export default function WaterDashboardPage() {
  const { activeBuilding, selectedBuildingData, loading: buildingsLoading, connError, retryConnect } = useOutletContext();
  const [mode, setMode] = useState('live'); // 'live' (MQTT -> DuckDB -> WS) | 'historical' (BDG2)
  const isLive = mode === 'live';
  const [readings, setReadings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [granularity, setGranularity] = useState('daily');
  const [limit, setLimit] = useState(60);
  const [error, setError] = useState('');

  // Live stream state (zustand)
  const liveStatus = useWaterLiveStore((s) => s.status);
  const liveKpi = useWaterLiveStore((s) => s.kpi);
  const liveDistribution = useWaterLiveStore((s) => s.distribution);
  const liveSeries = useWaterLiveStore((s) => s.timeSeries);
  const livePipeline = useWaterLiveStore((s) => s.pipeline);
  const liveBucket = useWaterLiveStore((s) => s.bucket);
  const liveUpdatedAt = useWaterLiveStore((s) => s.lastUpdate);
  const connectLive = useWaterLiveStore((s) => s.connect);
  const disconnectLive = useWaterLiveStore((s) => s.disconnect);
  const setLiveBucket = useWaterLiveStore((s) => s.setBucket);

  useEffect(() => {
    if (!isLive) return undefined;
    connectLive();
    return () => disconnectLive();
  }, [isLive, connectLive, disconnectLive]);

  useEffect(() => {
    if (isLive) return;
    if (!activeBuilding) {
      if (!buildingsLoading) {
        setLoading(false);
      }
      return;
    }
    setLoading(true);
    waterApi.getConsumption(activeBuilding, { limit, granularity })
      .then((res) => {
        setReadings(res.data || []);
        setError('');
      })
      .catch((err) => {
        setError(err.message || 'Unable to load water consumption data');
      })
      .finally(() => setLoading(false));
  }, [isLive, activeBuilding, granularity, limit, buildingsLoading]);

  // Pivot long-format readings into wide-format for stacked area chart.
  // The live stream arrives already pivoted by DuckDB (one row per tumbling window).
  const chartData = useMemo(() => {
    if (isLive) return liveSeries;
    if (!readings || readings.length === 0) return [];
    const grouped = {};
    readings.forEach((r) => {
      const ts = r.timestamp;
      if (!grouped[ts]) {
        grouped[ts] = { timestamp: ts };
      }
      grouped[ts][r.meter_type] = r.consumption;
    });
    // Sort chronological
    return Object.values(grouped).sort((a, b) => (a.timestamp > b.timestamp ? 1 : -1));
  }, [isLive, liveSeries, readings]);

  // Aggregate consumption by meter type for this view
  // (live = volume consumed over the rolling 24 h window, from DuckDB)
  const totalsByType = useMemo(() => {
    const totals = { ...EMPTY_TOTALS };
    if (isLive) {
      liveDistribution.forEach((d) => {
        if (totals[d.meter_type] !== undefined) totals[d.meter_type] = d.volume_m3;
      });
      return totals;
    }
    readings.forEach((r) => {
      if (totals[r.meter_type] !== undefined) {
        totals[r.meter_type] += r.consumption;
      }
    });
    return totals;
  }, [isLive, liveDistribution, readings]);

  const windowVolume = Object.values(totalsByType).reduce((a, b) => a + b, 0);
  // Live headline KPI = building-wide sum of meter registers (total_volume_m3), ticking every 2 s
  const totalVolume = isLive ? (liveKpi?.total_volume_m3 ?? 0) : windowVolume;
  const liveBadge = LIVE_STATUS[liveStatus] || LIVE_STATUS.idle;
  const brokerDown = isLive && liveStatus === 'open' && livePipeline && !livePipeline.connected;

  // Robust y-axis: scale to typical values so a one-off catch-up spike (e.g. the meter
  // register jumping after a backend restart) doesn't flatten every other reading.
  // The spike still runs off the top, its true value stays in the tooltip, and a note names it.
  const yScale = useMemo(() => {
    const values = [];
    let peak = { value: 0, at: null, key: null };
    chartData.forEach((row) => {
      SERIES_ORDER.forEach((key) => {
        const v = Number(row[key]) || 0;
        if (v > 0) values.push(v);
        if (v > peak.value) peak = { value: v, at: row.timestamp, key };
      });
    });
    if (values.length < 10) return { domain: [0, 'auto'], clipped: [] };
    const sorted = [...values].sort((a, b) => a - b);
    const p98 = sorted[Math.floor(sorted.length * 0.98) - 1] || sorted[sorted.length - 1];
    const cap = p98 * 1.6;
    if (peak.value <= cap * 1.5) return { domain: [0, 'auto'], clipped: [] };
    const clipped = [];
    chartData.forEach((row) => {
      SERIES_ORDER.forEach((key) => {
        const v = Number(row[key]) || 0;
        if (v > cap) clipped.push({ at: row.timestamp, key, value: v });
      });
    });
    return { domain: [0, Number(cap.toPrecision(2))], clipped: clipped.sort((a, b) => b.value - a.value), peak };
  }, [chartData]);

  const pieData = useMemo(() => {
    return Object.entries(totalsByType)
      .filter(([_, val]) => val > 0)
      .map(([type, val]) => ({
        name: METER_LABELS[type] || type,
        meter_type: type,
        value: parseFloat(val.toFixed(isLive ? 3 : 1)),
        percent: windowVolume > 0 ? ((val / windowVolume) * 100).toFixed(1) : 0,
      }));
  }, [isLive, totalsByType, windowVolume]);

  const coolingRatio = useMemo(() => {
    const totalGenChilled = totalsByType.general_water + totalsByType.chilled_water;
    if (totalGenChilled === 0) return 0;
    return ((totalsByType.chilled_water / totalGenChilled) * 100).toFixed(1);
  }, [totalsByType]);

  if (buildingsLoading && !isLive) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: 'var(--gg-muted)' }}>
        <div className="waste-spinner large" style={{ margin: '0 auto 16px' }} />
        <p style={{ fontWeight: 600 }}>Loading DuckDB Water Database...</p>
      </div>
    );
  }

  return (
    <div>
      {/* Header bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--gg-fg)', margin: 0 }}>
              💧 Water & Fluid Monitoring
            </h1>
            <span
              style={{
                background: 'var(--gg-info-bg)',
                color: 'var(--gg-water)',
                padding: '4px 12px',
                borderRadius: '12px',
                fontSize: '0.8rem',
                fontWeight: 700,
              }}
            >
              {selectedBuildingData?.space_usage?.toUpperCase() || 'COMMERCIAL'} · {selectedBuildingData?.site}
            </span>
          </div>
          <p style={{ color: 'var(--gg-muted)', fontSize: '0.85rem', margin: '4px 0 0 0' }}>
            {isLive
              ? `Real-time smart flow meters · MQTT → DuckDB → WebSocket · ${liveKpi?.active_meters ?? 0} meters reporting · updated ${formatClock(liveUpdatedAt)}`
              : 'High-precision multi-meter telemetry queried from DuckDB (BDG2 2016–2017 historical records)'}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Live / Historical mode switch */}
          <div style={{ display: 'flex', background: 'var(--gg-surface-2)', borderRadius: '10px', padding: '3px' }}>
            {[['live', '● Live'], ['historical', 'Historical']].map(([m, label]) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                style={{
                  background: mode === m ? (m === 'live' ? '#059669' : '#0284c7') : 'transparent',
                  color: mode === m ? 'white' : 'var(--gg-muted)',
                  border: 'none',
                  padding: '6px 14px',
                  borderRadius: '8px',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {isLive ? (
            /* Tumbling-window size for the live time series */
            <div style={{ display: 'flex', background: 'var(--gg-surface-2)', borderRadius: '10px', padding: '3px' }}>
              {[1, 5].map((b) => (
                <button
                  key={b}
                  type="button"
                  onClick={() => setLiveBucket(b)}
                  style={{
                    background: liveBucket === b ? '#0284c7' : 'transparent',
                    color: liveBucket === b ? 'white' : 'var(--gg-muted)',
                    border: 'none',
                    padding: '6px 14px',
                    borderRadius: '8px',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  {b}-min
                </button>
              ))}
            </div>
          ) : (
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <div style={{ display: 'flex', background: 'var(--gg-surface-2)', borderRadius: '10px', padding: '3px' }}>
            {['hourly', 'daily', 'monthly'].map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => setGranularity(g)}
                style={{
                  background: granularity === g ? '#0284c7' : 'transparent',
                  color: granularity === g ? 'white' : 'var(--gg-muted)',
                  border: 'none',
                  padding: '6px 14px',
                  borderRadius: '8px',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  textTransform: 'capitalize',
                  transition: 'all 0.15s',
                }}
              >
                {g}
              </button>
            ))}
          </div>

          <select
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
            style={{
              padding: '6px 12px',
              borderRadius: '8px',
              border: '1px solid var(--gg-line-strong)',
              fontSize: '0.8rem',
              fontWeight: 600,
              color: 'var(--gg-fg)',
              background: 'var(--gg-surface)',
              cursor: 'pointer'
            }}
          >
            <option value="30">Last 30 periods</option>
            <option value="60">Last 60 periods</option>
            <option value="180">Last 180 periods</option>
            <option value="365">Last 365 periods</option>
          </select>
        </div>
          )}
        </div>
      </div>

      {brokerDown && (
        <div style={{ background: 'var(--gg-warning-bg)', border: '1px solid var(--gg-line)', color: 'var(--gg-warning)', padding: '12px 16px', borderRadius: '12px', marginBottom: '20px', fontSize: '0.85rem' }}>
          ⚠️ Backend is not connected to the MQTT broker ({livePipeline.broker}). Start it with <code>docker compose up -d mqtt</code>, then run <code>python edge-simulator/mock_water_meters.py</code>.
        </div>
      )}

      {!isLive && error && (
        <div style={{ background: 'var(--gg-danger-bg)', border: '1px solid var(--gg-line)', color: 'var(--gg-danger)', padding: '12px 16px', borderRadius: '12px', marginBottom: '20px', fontSize: '0.85rem' }}>
          ⚠️ {error}
        </div>
      )}

      {/* KPI Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div style={{ background: 'var(--gg-surface)', border: '1px solid var(--gg-line)', borderRadius: '16px', padding: '18px', boxShadow: 'var(--gg-shadow-xs)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--gg-muted)', textTransform: 'uppercase' }}>Total Flow Volume</span>
            <span style={{ fontSize: '1.2rem' }}>🌊</span>
          </div>
          <div style={{ fontSize: '1.7rem', fontWeight: 900, color: 'var(--gg-fg)', fontFamily: 'monospace' }}>
            {totalVolume.toLocaleString(undefined, isLive
              ? { minimumFractionDigits: 3, maximumFractionDigits: 3 }
              : { maximumFractionDigits: 1 })} <span style={{ fontSize: '0.9rem', color: 'var(--gg-subtle)' }}>m³</span>
          </div>
          <div style={{ fontSize: '0.75rem', color: isLive && liveStatus !== 'open' ? 'var(--gg-warning)' : 'var(--gg-success)', fontWeight: 600, marginTop: '4px' }}>
            {isLive
              ? `● Live register · ${(liveKpi?.total_flow_m3_per_hr ?? 0).toFixed(2)} m³/h now · +${windowVolume.toFixed(2)} m³ (24h)`
              : '● Active Multi-Meter Stream'}
          </div>
        </div>

        <div style={{ background: 'var(--gg-surface)', border: '1px solid var(--gg-line)', borderRadius: '16px', padding: '18px', boxShadow: 'var(--gg-shadow-xs)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--gg-muted)', textTransform: 'uppercase' }}>Cooling Tower Ratio (WE-3)</span>
            <span style={{ fontSize: '1.2rem' }}>❄️</span>
          </div>
          <div style={{ fontSize: '1.7rem', fontWeight: 900, color: Number(coolingRatio) <= 20.0 ? 'var(--gg-water)' : 'var(--gg-danger)', fontFamily: 'monospace' }}>
            {coolingRatio}%
          </div>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, marginTop: '4px', color: Number(coolingRatio) <= 20.0 ? 'var(--gg-success)' : 'var(--gg-danger)' }}>
            {Number(coolingRatio) <= 20.0 ? '✓ GreenRE Compliant (<=20%)' : '⚠️ Exceeds 20% Standard'}
          </div>
        </div>

        <div style={{ background: 'var(--gg-surface)', border: '1px solid var(--gg-line)', borderRadius: '16px', padding: '18px', boxShadow: 'var(--gg-shadow-xs)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--gg-muted)', textTransform: 'uppercase' }}>Landscape Irrigation</span>
            <span style={{ fontSize: '1.2rem' }}>🌱</span>
          </div>
          <div style={{ fontSize: '1.7rem', fontWeight: 900, color: 'var(--gg-fg)', fontFamily: 'monospace' }}>
            {totalsByType.irrigation.toLocaleString(undefined, { maximumFractionDigits: 1 })} <span style={{ fontSize: '0.9rem', color: 'var(--gg-subtle)' }}>m³</span>
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--gg-muted)', fontWeight: 600, marginTop: '4px' }}>
            WE-4 Drip network monitored
          </div>
        </div>

        <div style={{ background: 'var(--gg-surface)', border: '1px solid var(--gg-line)', borderRadius: '16px', padding: '18px', boxShadow: 'var(--gg-shadow-xs)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--gg-muted)', textTransform: 'uppercase' }}>Thermal / Steam Energy</span>
            <span style={{ fontSize: '1.2rem' }}>♨️</span>
          </div>
          <div style={{ fontSize: '1.7rem', fontWeight: 900, color: 'var(--gg-fg)', fontFamily: 'monospace' }}>
            {(totalsByType.hot_water + totalsByType.steam).toLocaleString(undefined, { maximumFractionDigits: 1 })} <span style={{ fontSize: '0.9rem', color: 'var(--gg-subtle)' }}>m³</span>
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--gg-muted)', fontWeight: 600, marginTop: '4px' }}>
            Hot water & steam condensate
          </div>
        </div>
      </div>

      {/* Main Charts Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px', marginBottom: '24px' }}>
        {/* Time-Series Stacked Flow Chart */}
        <div style={{ background: 'var(--gg-surface)', border: '1px solid var(--gg-line)', borderRadius: '16px', padding: '20px', boxShadow: 'var(--gg-shadow-xs)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--gg-fg)', margin: 0 }}>
                Disaggregated Water Time Series ({isLive ? `LIVE · ${liveBucket}-MIN WINDOWS` : granularity.toUpperCase()})
              </h3>
              <span style={{ fontSize: '0.75rem', color: 'var(--gg-muted)' }}>
                {isLive
                  ? `Volume consumed per ${liveBucket}-minute window (m³), last 24 h`
                  : `Multi-meter volumetric flow trends (m³) for ${activeBuilding}`}
              </span>
            </div>
            {isLive ? (
              <span style={{ fontSize: '0.7rem', background: liveBadge.bg, color: liveBadge.fg, padding: '3px 8px', borderRadius: '6px', fontWeight: 700 }}>
                {liveBadge.label}
              </span>
            ) : (
              <span style={{ fontSize: '0.7rem', background: 'var(--gg-success-bg)', color: 'var(--gg-success)', padding: '3px 8px', borderRadius: '6px', fontWeight: 700 }}>
                LIVE QUERY
              </span>
            )}
          </div>

          <div style={{ height: '300px', width: '100%' }}>
            {isLive && chartData.length === 0 ? (
              <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--gg-subtle)', gap: '8px', textAlign: 'center' }}>
                {liveStatus === 'open' ? (
                  <>
                    <span>Waiting for smart meter readings…</span>
                    <span style={{ fontSize: '0.75rem' }}>Run <code>python edge-simulator/mock_water_meters.py</code> to start streaming.</span>
                  </>
                ) : (
                  <>
                    <div className="waste-spinner" style={{ width: '24px', height: '24px' }} />
                    <span style={{ fontSize: '0.85rem' }}>Connecting to live water stream (backend on port 5000)…</span>
                  </>
                )}
              </div>
            ) : !isLive && loading ? (
              <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--gg-muted)', gap: '8px' }}>
                <div className="waste-spinner" style={{ width: '24px', height: '24px' }} />
                <span style={{ fontSize: '0.85rem' }}>Loading telemetry from DuckDB...</span>
              </div>
            ) : !isLive && !activeBuilding ? (
              <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--gg-subtle)', gap: '10px' }}>
                <span>{connError ? 'Backend disconnected. Please start backend on port 5000.' : 'Please select a building above.'}</span>
                {retryConnect && (
                  <button
                    type="button"
                    onClick={retryConnect}
                    style={{ background: '#0284c7', color: 'white', border: 'none', padding: '6px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 700 }}
                  >
                    Retry Connection
                  </button>
                )}
              </div>
            ) : chartData.length === 0 ? (
              <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--gg-subtle)' }}>
                No telemetry recorded for this timeframe for {activeBuilding}.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 14, right: 12, left: 0, bottom: 0 }}>
                  <ChartFx colors={METER_COLORS} prefix="wts" />
                  <CartesianGrid {...fxGrid} />
                  <XAxis
                    dataKey="timestamp"
                    {...fxAxis}
                    tickFormatter={isLive ? formatBucketTick : undefined}
                    minTickGap={28}
                    dy={6}
                  />
                  <YAxis
                    {...fxAxis}
                    width={52}
                    domain={yScale.domain}
                    allowDataOverflow={yScale.clipped.length > 0}
                    tickFormatter={isLive ? (v) => v.toFixed(2) : (v) => (v >= 1e3 ? `${(v / 1e3).toFixed(0)}k` : v)}
                  />
                  <Tooltip
                    content={<GlassTooltip unit="m³" digits={isLive ? 3 : 1} showTotal labelFormatter={isLive ? formatBucketTick : undefined} />}
                    cursor={{ stroke: 'var(--gg-line-strong)', strokeWidth: 1, strokeDasharray: '4 4' }}
                  />
                  {SERIES_ORDER.map((key) => (
                    <Area
                      key={key}
                      type="monotone"
                      dataKey={key}
                      name={SERIES_NAMES[key]}
                      stroke={METER_COLORS[key]}
                      strokeWidth={2.25}
                      fill={`url(#wts-area-${key})`}
                      fillOpacity={1}
                      filter="url(#wts-glow)"
                      dot={false}
                      activeDot={{ r: 5, strokeWidth: 3, stroke: 'var(--gg-surface)', fill: METER_COLORS[key] }}
                      isAnimationActive={!isLive}
                      animationDuration={900}
                    />
                  ))}
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
          {yScale.clipped.length > 0 && (
            <p style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '10px 0 0', fontSize: '0.75rem', color: 'var(--gg-muted)' }}>
              <span style={{ padding: '2px 8px', borderRadius: '999px', background: 'var(--gg-warning-bg)', color: 'var(--gg-warning)', fontWeight: 700 }}>
                ⤒ {yScale.clipped.length} spike{yScale.clipped.length > 1 ? 's' : ''} above scale
              </span>
              <span>
                Largest: <b style={{ color: 'var(--gg-fg)', fontFamily: 'var(--font-mono)' }}>{yScale.peak.value.toLocaleString(undefined, { maximumFractionDigits: 2 })} m³</b>{' '}
                {SERIES_NAMES[yScale.peak.key]} at {isLive ? formatBucketTick(yScale.peak.at) : yScale.peak.at}. Hover it for exact values.
              </span>
            </p>
          )}
          {chartData.length > 0 && (
            <PillLegend items={SERIES_ORDER.map((key) => ({ key, label: SERIES_NAMES[key], color: METER_COLORS[key] }))} />
          )}
        </div>

        {/* Water Distribution Donut Chart */}
        <div style={{ background: 'var(--gg-surface)', border: '1px solid var(--gg-line)', borderRadius: '16px', padding: '20px', boxShadow: 'var(--gg-shadow-xs)' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--gg-fg)', margin: '0 0 4px 0' }}>
            Fluid Meter Distribution
          </h3>
          <p style={{ fontSize: '0.75rem', color: 'var(--gg-muted)', margin: '0 0 16px 0' }}>
            {isLive ? 'Live share of volume consumed by sub-system (rolling 24 h)' : 'Proportion of fluid load by sub-system'}
          </p>

          <div style={{ position: 'relative', height: '230px', width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <ChartFx colors={METER_COLORS} prefix="wpie" />
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={68}
                  outerRadius={96}
                  paddingAngle={3}
                  cornerRadius={7}
                  stroke="none"
                  dataKey="value"
                  activeShape={DonutActiveShape}
                  isAnimationActive={!isLive}
                  animationDuration={900}
                >
                  {pieData.map((entry) => (
                    <Cell key={entry.meter_type} fill={`url(#wpie-slice-${entry.meter_type})`} />
                  ))}
                </Pie>
                <Tooltip content={<GlassTooltip unit="m³" digits={isLive ? 3 : 1} />} />
              </PieChart>
            </ResponsiveContainer>
            {/* Centre label: total volume for the window */}
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
              <span style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--gg-subtle)' }}>
                {isLive ? 'Last 24 h' : 'Total'}
              </span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '1.45rem', fontWeight: 800, color: 'var(--gg-fg)', lineHeight: 1.2 }}>
                {windowVolume.toLocaleString(undefined, { maximumFractionDigits: windowVolume < 100 ? 2 : 0 })}
              </span>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--gg-muted)' }}>m³</span>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '14px' }}>
            {pieData.map((item) => (
              <div key={item.name}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', marginBottom: '4px' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: METER_COLORS[item.meter_type], boxShadow: `0 0 8px ${METER_COLORS[item.meter_type]}` }} />
                    <span style={{ color: 'var(--gg-muted)', fontWeight: 600 }}>{item.name}</span>
                  </span>
                  <span style={{ fontWeight: 800, color: 'var(--gg-fg)', fontFamily: 'var(--font-mono)' }}>{item.percent}%</span>
                </div>
                <div style={{ height: '5px', borderRadius: '999px', background: 'var(--gg-surface-2)', overflow: 'hidden' }}>
                  <div style={{ width: `${Math.max(Number(item.percent), 1.5)}%`, height: '100%', borderRadius: '999px', background: `linear-gradient(90deg, ${METER_COLORS[item.meter_type]}66, ${METER_COLORS[item.meter_type]})`, transition: 'width 600ms cubic-bezier(0.2,0,0,1)' }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
