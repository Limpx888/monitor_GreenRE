import React, { useState, useEffect } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';
import { waterApi } from '../api/waterApi';

const METER_COLORS = {
  general_water: '#0284c7', // Sky blue
  chilled_water: '#06b6d4', // Cyan
  irrigation: '#10b981',    // Emerald green
  hot_water: '#f97316',     // Amber / Orange
  steam: '#8b5cf6',         // Purple
};

export default function WaterAnalyticsPage() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchStats = () => {
    setLoading(true);
    setError(null);
    waterApi.getPortfolioStats()
      .then((data) => {
        setStats(data);
        setError(null);
      })
      .catch((err) => {
        console.error('Analytics load error:', err);
        setError(err.message || 'Unable to connect to DuckDB water analytics backend');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchStats();
  }, []);

  if (loading) {
    return (
      <div style={{ padding: '80px 20px', textAlign: 'center', color: '#64748b' }}>
        <div className="waste-spinner large" style={{ margin: '0 auto 18px' }} />
        <p style={{ fontWeight: 700, fontSize: '1.05rem', color: '#0f172a', margin: '0 0 6px 0' }}>
          Aggregating 20.6M Telemetry Records in DuckDB...
        </p>
        <p style={{ fontSize: '0.82rem', color: '#94a3b8', margin: 0 }}>
          Calculating portfolio totals, meter distributions, and space typology benchmarks
        </p>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div style={{ padding: '40px 20px', textAlign: 'center' }}>
        <div
          style={{
            maxWidth: '600px',
            margin: '0 auto',
            background: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '16px',
            padding: '24px',
            boxShadow: '0 4px 12px rgba(220, 38, 38, 0.08)',
          }}
        >
          <div style={{ fontSize: '2rem', marginBottom: '8px' }}>⚠️</div>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#991b1b', margin: '0 0 8px 0' }}>
            Analytics Backend Not Reachable
          </h3>
          <p style={{ fontSize: '0.85rem', color: '#b91c1c', margin: '0 0 16px 0', lineHeight: 1.5 }}>
            {error || 'Unable to retrieve portfolio benchmarks.'} Ensure the Python backend is running on <code>http://127.0.0.1:5000</code> via <code>npm run backend</code>.
          </p>
          <button
            type="button"
            onClick={fetchStats}
            style={{
              background: '#0284c7',
              color: 'white',
              border: 'none',
              padding: '10px 24px',
              borderRadius: '10px',
              fontWeight: 700,
              fontSize: '0.85rem',
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(2, 132, 199, 0.3)',
            }}
          >
            🔄 Retry Analytics Aggregation
          </button>
        </div>
      </div>
    );
  }

  const spaceData = (stats.space_breakdown || []).map((s) => ({
    name: s.space_usage,
    buildings: s.buildings,
    volume: Math.round(s.total_volume),
    avg_rate: s.avg_rate,
  }));

  const meterData = (stats.meter_totals || []).map((m) => ({
    name: m.meter_type.replace('_', ' ').toUpperCase(),
    meter_type: m.meter_type,
    volume: Math.round(m.total_volume),
    buildings: m.buildings_count,
    avg: m.avg_hourly,
  }));

  const totalVolAllMeters = meterData.reduce((acc, m) => acc + m.volume, 0);

  const meterPieData = meterData.map((m) => ({
    name: m.name,
    meter_type: m.meter_type,
    value: m.volume,
    percent: totalVolAllMeters > 0 ? ((m.volume / totalVolAllMeters) * 100).toFixed(1) : 0,
  }));

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
            📈 Portfolio Water Intelligence & Benchmarking
          </h1>
          <p style={{ color: '#64748b', fontSize: '0.85rem', margin: '4px 0 0 0' }}>
            Aggregated cross-sectional fluid load analytics across {stats.total_buildings || 769} facilities in {stats.total_sites || 13} campus sites
          </p>
        </div>

        <button
          type="button"
          onClick={fetchStats}
          style={{
            background: 'white',
            border: '1px solid #cbd5e1',
            padding: '8px 16px',
            borderRadius: '10px',
            fontSize: '0.82rem',
            fontWeight: 700,
            color: '#334155',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          }}
        >
          🔄 Refresh DuckDB
        </button>
      </div>

      {/* KPI Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '18px', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Monitored Buildings</span>
            <span style={{ fontSize: '1.2rem' }}>🏢</span>
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#0f172a', fontFamily: 'monospace' }}>
            {stats.total_buildings || 769}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#059669', fontWeight: 600, marginTop: '4px' }}>
            Across {stats.total_sites || 13} Regional Sites
          </div>
        </div>

        <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '18px', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>DuckDB Records</span>
            <span style={{ fontSize: '1.2rem' }}>⚡</span>
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#0284c7', fontFamily: 'monospace' }}>
            {(stats.total_records || 20641574).toLocaleString()}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, marginTop: '4px' }}>
            Sub-hourly meter observations
          </div>
        </div>

        <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '18px', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Fluid Classifications</span>
            <span style={{ fontSize: '1.2rem' }}>💧</span>
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#0f172a', fontFamily: 'monospace' }}>
            {meterData.length} Types
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, marginTop: '4px' }}>
            Chilled, Hot, Steam, Domestic, Irrig.
          </div>
        </div>

        <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '18px', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Top Typology Load</span>
            <span style={{ fontSize: '1.2rem' }}>🎓</span>
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#0f172a', textTransform: 'capitalize' }}>
            {spaceData[0]?.name || 'Education'}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, marginTop: '4px' }}>
            {spaceData[0]?.buildings || 0} monitored facilities
          </div>
        </div>
      </div>

      {/* Main Charts Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '20px', marginBottom: '24px' }}>
        {/* Space Usage Breakdown Chart */}
        <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a', margin: '0 0 4px 0' }}>
            Consumption by Space Typology
          </h3>
          <p style={{ fontSize: '0.75rem', color: '#64748b', margin: '0 0 16px 0' }}>
            Total volumetric water demand across building categories (m³)
          </p>

          <div style={{ height: '320px', width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={spaceData.slice(0, 8)} margin={{ top: 10, right: 10, left: 20, bottom: 24 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} angle={-20} textAnchor="end" />
                <YAxis stroke="#94a3b8" fontSize={11} tickFormatter={(val) => val >= 1e9 ? `${(val / 1e9).toFixed(0)}B` : val >= 1e6 ? `${(val / 1e6).toFixed(0)}M` : val} />
                <Tooltip
                  formatter={(val) => [`${Number(val).toLocaleString()} m³`, 'Total Volume']}
                  contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0' }}
                />
                <Bar dataKey="volume" fill="#0284c7" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Meter Type Distribution Bar Chart */}
        <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a', margin: '0 0 4px 0' }}>
            Fluid Meter Deployment
          </h3>
          <p style={{ fontSize: '0.75rem', color: '#64748b', margin: '0 0 16px 0' }}>
            Number of monitored facilities by fluid meter classification
          </p>

          <div style={{ height: '320px', width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={meterData} layout="vertical" margin={{ top: 10, right: 20, left: 40, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis type="number" stroke="#94a3b8" fontSize={11} />
                <YAxis dataKey="name" type="category" stroke="#94a3b8" fontSize={10} width={90} />
                <Tooltip
                  formatter={(val) => [`${val} Buildings`, 'Coverage']}
                  contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0' }}
                />
                <Bar dataKey="buildings" fill="#0ea5e9" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
