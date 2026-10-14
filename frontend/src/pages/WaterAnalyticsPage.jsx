import React, { useState, useEffect } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';
import { waterApi } from '../api/waterApi';

const SPACE_COLORS = ['#0284c7', '#06b6d4', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'];

export default function WaterAnalyticsPage() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    waterApi.getPortfolioStats()
      .then(setStats)
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div style={{ padding: '60px', textAlign: 'center', color: '#64748b' }}>
        <div className="waste-spinner large" style={{ margin: '0 auto 16px' }} />
        <p style={{ fontWeight: 600 }}>Aggregating 20.6M records in DuckDB...</p>
      </div>
    );
  }

  const spaceData = (stats?.space_breakdown || []).map((s) => ({
    name: s.space_usage,
    buildings: s.buildings,
    volume: Math.round(s.total_volume),
    avg_rate: s.avg_rate,
  }));

  const meterData = (stats?.meter_totals || []).map((m) => ({
    name: m.meter_type.replace('_', ' ').toUpperCase(),
    volume: Math.round(m.total_volume),
    buildings: m.buildings_count,
    avg: m.avg_hourly,
  }));

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
          📈 Portfolio Water Intelligence & Benchmarking
        </h1>
        <p style={{ color: '#64748b', fontSize: '0.85rem', margin: '4px 0 0 0' }}>
          Aggregated cross-sectional fluid load analytics across {stats?.total_buildings} monitored facilities
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}>
        {/* Space Usage Breakdown Chart */}
        <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a', margin: '0 0 4px 0' }}>
            Consumption by Space Typology
          </h3>
          <p style={{ fontSize: '0.75rem', color: '#64748b', margin: '0 0 16px 0' }}>
            Total volumetric water demand across building categories (m³)
          </p>

          <div style={{ height: '300px', width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={spaceData} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} angle={-15} textAnchor="end" />
                <YAxis stroke="#94a3b8" fontSize={11} />
                <Tooltip
                  formatter={(val) => [`${val.toLocaleString()} m³`, 'Total Volume']}
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

          <div style={{ height: '300px', width: '100%' }}>
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
