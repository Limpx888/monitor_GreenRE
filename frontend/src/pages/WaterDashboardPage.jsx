import React, { useState, useEffect, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, BarChart, Bar
} from 'recharts';
import { waterApi } from '../api/waterApi';

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

export default function WaterDashboardPage() {
  const { activeBuilding, selectedBuildingData, loading: buildingsLoading, connError, retryConnect } = useOutletContext();
  const [readings, setReadings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [granularity, setGranularity] = useState('daily');
  const [limit, setLimit] = useState(60);
  const [error, setError] = useState('');

  useEffect(() => {
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
  }, [activeBuilding, granularity, limit, buildingsLoading]);

  // Pivot long-format readings into wide-format for stacked area chart
  const chartData = useMemo(() => {
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
  }, [readings]);

  // Aggregate total consumption by meter type for this view
  const totalsByType = useMemo(() => {
    const totals = { general_water: 0, chilled_water: 0, irrigation: 0, hot_water: 0, steam: 0 };
    readings.forEach((r) => {
      if (totals[r.meter_type] !== undefined) {
        totals[r.meter_type] += r.consumption;
      }
    });
    return totals;
  }, [readings]);

  const totalVolume = Object.values(totalsByType).reduce((a, b) => a + b, 0);

  const pieData = useMemo(() => {
    return Object.entries(totalsByType)
      .filter(([_, val]) => val > 0)
      .map(([type, val]) => ({
        name: METER_LABELS[type] || type,
        meter_type: type,
        value: parseFloat(val.toFixed(1)),
        percent: totalVolume > 0 ? ((val / totalVolume) * 100).toFixed(1) : 0,
      }));
  }, [totalsByType, totalVolume]);

  const coolingRatio = useMemo(() => {
    const totalGenChilled = totalsByType.general_water + totalsByType.chilled_water;
    if (totalGenChilled === 0) return 0;
    return ((totalsByType.chilled_water / totalGenChilled) * 100).toFixed(1);
  }, [totalsByType]);

  if (buildingsLoading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
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
            <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
              💧 Water & Fluid Monitoring
            </h1>
            <span
              style={{
                background: '#e0f2fe',
                color: '#0369a1',
                padding: '4px 12px',
                borderRadius: '12px',
                fontSize: '0.8rem',
                fontWeight: 700,
              }}
            >
              {selectedBuildingData?.space_usage?.toUpperCase() || 'COMMERCIAL'} · {selectedBuildingData?.site}
            </span>
          </div>
          <p style={{ color: '#64748b', fontSize: '0.85rem', margin: '4px 0 0 0' }}>
            High-precision multi-meter telemetry queried from DuckDB (20,641,574 historical records)
          </p>
        </div>

        {/* Granularity & Limit Filters */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <div style={{ display: 'flex', background: '#f1f5f9', borderRadius: '10px', padding: '3px' }}>
            {['hourly', 'daily', 'monthly'].map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => setGranularity(g)}
                style={{
                  background: granularity === g ? '#0284c7' : 'transparent',
                  color: granularity === g ? 'white' : '#64748b',
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
              border: '1px solid #cbd5e1',
              fontSize: '0.8rem',
              fontWeight: 600,
              color: '#334155',
              background: 'white',
              cursor: 'pointer'
            }}
          >
            <option value="30">Last 30 periods</option>
            <option value="60">Last 60 periods</option>
            <option value="180">Last 180 periods</option>
            <option value="365">Last 365 periods</option>
          </select>
        </div>
      </div>

      {error && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', padding: '12px 16px', borderRadius: '12px', marginBottom: '20px', fontSize: '0.85rem' }}>
          ⚠️ {error}
        </div>
      )}

      {/* KPI Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '18px', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Total Flow Volume</span>
            <span style={{ fontSize: '1.2rem' }}>🌊</span>
          </div>
          <div style={{ fontSize: '1.7rem', fontWeight: 900, color: '#0f172a', fontFamily: 'monospace' }}>
            {totalVolume.toLocaleString(undefined, { maximumFractionDigits: 1 })} <span style={{ fontSize: '0.9rem', color: '#94a3b8' }}>m³</span>
          </div>
          <div style={{ fontSize: '0.75rem', color: '#059669', fontWeight: 600, marginTop: '4px' }}>
            ● Active Multi-Meter Stream
          </div>
        </div>

        <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '18px', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Cooling Tower Ratio (WE-3)</span>
            <span style={{ fontSize: '1.2rem' }}>❄️</span>
          </div>
          <div style={{ fontSize: '1.7rem', fontWeight: 900, color: Number(coolingRatio) <= 20.0 ? '#0284c7' : '#e11d48', fontFamily: 'monospace' }}>
            {coolingRatio}%
          </div>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, marginTop: '4px', color: Number(coolingRatio) <= 20.0 ? '#059669' : '#dc2626' }}>
            {Number(coolingRatio) <= 20.0 ? '✓ GreenRE Compliant (<=20%)' : '⚠️ Exceeds 20% Standard'}
          </div>
        </div>

        <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '18px', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Landscape Irrigation</span>
            <span style={{ fontSize: '1.2rem' }}>🌱</span>
          </div>
          <div style={{ fontSize: '1.7rem', fontWeight: 900, color: '#0f172a', fontFamily: 'monospace' }}>
            {totalsByType.irrigation.toLocaleString(undefined, { maximumFractionDigits: 1 })} <span style={{ fontSize: '0.9rem', color: '#94a3b8' }}>m³</span>
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, marginTop: '4px' }}>
            WE-4 Drip network monitored
          </div>
        </div>

        <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '18px', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Thermal / Steam Energy</span>
            <span style={{ fontSize: '1.2rem' }}>♨️</span>
          </div>
          <div style={{ fontSize: '1.7rem', fontWeight: 900, color: '#0f172a', fontFamily: 'monospace' }}>
            {(totalsByType.hot_water + totalsByType.steam).toLocaleString(undefined, { maximumFractionDigits: 1 })} <span style={{ fontSize: '0.9rem', color: '#94a3b8' }}>m³</span>
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, marginTop: '4px' }}>
            Hot water & steam condensate
          </div>
        </div>
      </div>

      {/* Main Charts Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px', marginBottom: '24px' }}>
        {/* Time-Series Stacked Flow Chart */}
        <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                Disaggregated Water Time Series ({granularity.toUpperCase()})
              </h3>
              <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                Multi-meter volumetric flow trends (m³) for {activeBuilding}
              </span>
            </div>
            <span style={{ fontSize: '0.7rem', background: '#f0fdf4', color: '#166534', padding: '3px 8px', borderRadius: '6px', fontWeight: 700 }}>
              LIVE QUERY
            </span>
          </div>

          <div style={{ height: '320px', width: '100%' }}>
            {loading ? (
              <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#64748b', gap: '8px' }}>
                <div className="waste-spinner" style={{ width: '24px', height: '24px' }} />
                <span style={{ fontSize: '0.85rem' }}>Loading telemetry from DuckDB...</span>
              </div>
            ) : !activeBuilding ? (
              <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', gap: '10px' }}>
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
              <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
                No telemetry recorded for this timeframe for {activeBuilding}.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorGeneral" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={METER_COLORS.general_water} stopOpacity={0.7} />
                      <stop offset="95%" stopColor={METER_COLORS.general_water} stopOpacity={0.05} />
                    </linearGradient>
                    <linearGradient id="colorChilled" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={METER_COLORS.chilled_water} stopOpacity={0.7} />
                      <stop offset="95%" stopColor={METER_COLORS.chilled_water} stopOpacity={0.05} />
                    </linearGradient>
                    <linearGradient id="colorIrrigation" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={METER_COLORS.irrigation} stopOpacity={0.7} />
                      <stop offset="95%" stopColor={METER_COLORS.irrigation} stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="timestamp" stroke="#94a3b8" fontSize={11} tickLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      background: 'rgba(255, 255, 255, 0.96)',
                      borderRadius: '10px',
                      border: '1px solid #e2e8f0',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                      fontSize: '12px',
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', fontWeight: 600 }} />
                  <Area type="monotone" dataKey="general_water" name="General Water" stroke={METER_COLORS.general_water} fillOpacity={1} fill="url(#colorGeneral)" />
                  <Area type="monotone" dataKey="chilled_water" name="Chilled / Cooling" stroke={METER_COLORS.chilled_water} fillOpacity={1} fill="url(#colorChilled)" />
                  <Area type="monotone" dataKey="irrigation" name="Irrigation" stroke={METER_COLORS.irrigation} fillOpacity={1} fill="url(#colorIrrigation)" />
                  <Area type="monotone" dataKey="hot_water" name="Hot Water" stroke={METER_COLORS.hot_water} fill={METER_COLORS.hot_water} fillOpacity={0.2} />
                  <Area type="monotone" dataKey="steam" name="Steam" stroke={METER_COLORS.steam} fill={METER_COLORS.steam} fillOpacity={0.2} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Water Distribution Donut Chart */}
        <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a', margin: '0 0 4px 0' }}>
            Fluid Meter Distribution
          </h3>
          <p style={{ fontSize: '0.75rem', color: '#64748b', margin: '0 0 16px 0' }}>
            Proportion of fluid load by sub-system
          </p>

          <div style={{ height: '220px', width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={85}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={METER_COLORS[entry.meter_type] || '#94a3b8'} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(val) => [`${val} m³`, 'Volume']}
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '12px' }}>
            {pieData.map((item) => (
              <div key={item.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: METER_COLORS[item.meter_type] }} />
                  <span style={{ color: '#475569', fontWeight: 600 }}>{item.name}</span>
                </span>
                <span style={{ fontWeight: 800, color: '#0f172a' }}>{item.percent}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
