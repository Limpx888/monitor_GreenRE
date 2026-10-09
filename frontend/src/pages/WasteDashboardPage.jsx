import React, { useState, useEffect, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, AreaChart, Area,
} from 'recharts';
import { analyticsApi } from '../api/wasteApi';

const COLORS = ['#22c55e', '#64748b', '#84cc16', '#ef4444', '#eab308', '#3b82f6', '#8b5cf6', '#f97316'];
const CATEGORY_COLORS_MAP = {
  RECYCLE: '#22c55e', GENERAL: '#64748b', ORGANIC: '#84cc16', HAZARDOUS: '#ef4444', REVIEW: '#eab308',
};

export default function WasteDashboardPage() {
  const { activeSite } = useOutletContext();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState('30');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!activeSite) return;
    setLoading(true);
    const days = parseInt(dateRange);
    const end = new Date();
    const start = new Date(end - days * 86400000);

    analyticsApi.get(
      activeSite,
      start.toISOString().split('T')[0],
      end.toISOString().split('T')[0],
    ).then(d => {
      setData(d);
      setError('');
    }).catch(e => {
      setError(e.message);
    }).finally(() => setLoading(false));
  }, [activeSite, dateRange]);

  const pieData = useMemo(() => {
    if (!data?.category_breakdown) return [];
    return Object.entries(data.category_breakdown).map(([name, v]) => ({
      name,
      value: v.count,
      weight: v.weight_kg,
    }));
  }, [data]);

  const materialData = useMemo(() => {
    if (!data?.material_breakdown) return [];
    return Object.entries(data.material_breakdown)
      .map(([name, v]) => ({ name, count: v.count, weight: parseFloat(v.weight_kg.toFixed(2)) }))
      .sort((a, b) => b.count - a.count);
  }, [data]);

  if (loading) {
    return (
      <div className="waste-page">
        <div className="waste-loading">
          <div className="waste-spinner large" />
          <p>Loading analytics...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="waste-page">
        <div className="waste-alert error">
          {error}. Make sure the waste-api backend is running on port 8000.
        </div>
      </div>
    );
  }

  return (
    <div className="waste-page">
      <div className="waste-page-header">
        <h1>📊 Waste Analytics Dashboard</h1>
        <div className="waste-controls-bar">
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="waste-select"
          >
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
          </select>
        </div>
      </div>

      {data && (
        <>
          {/* KPI Cards */}
          <div className="waste-kpi-grid">
            <div className="waste-kpi-card">
              <div className="waste-kpi-icon">⚖️</div>
              <div className="waste-kpi-value">{data.total_waste_kg.toFixed(1)}</div>
              <div className="waste-kpi-label">Total Waste (kg)</div>
              <div className="waste-kpi-sub">
                Est: {data.estimated_waste_kg.toFixed(1)} | Meas: {data.measured_waste_kg.toFixed(1)}
              </div>
            </div>
            <div className="waste-kpi-card highlight-green">
              <div className="waste-kpi-icon">♻️</div>
              <div className="waste-kpi-value">{data.recycling_rate.toFixed(1)}%</div>
              <div className="waste-kpi-label">Recycling Rate</div>
              <div className="waste-kpi-sub">Recycled / Total</div>
            </div>
            <div className="waste-kpi-card highlight-blue">
              <div className="waste-kpi-icon">🌍</div>
              <div className="waste-kpi-value">{data.diversion_rate.toFixed(1)}%</div>
              <div className="waste-kpi-label">Diversion Rate</div>
              <div className="waste-kpi-sub">(Recycled + Composted) / Total</div>
            </div>
            <div className="waste-kpi-card">
              <div className="waste-kpi-icon">📦</div>
              <div className="waste-kpi-value">{data.total_items.toLocaleString()}</div>
              <div className="waste-kpi-label">Items Scanned</div>
            </div>
            <div className="waste-kpi-card highlight-teal">
              <div className="waste-kpi-icon">🌿</div>
              <div className="waste-kpi-value">{data.co2e_avoided_kg.toFixed(1)}</div>
              <div className="waste-kpi-label">CO₂e Avoided (kg)</div>
              <div className="waste-kpi-sub">Estimated from recycling</div>
            </div>
            <div className="waste-kpi-card" style={{ borderColor: data.contamination_rate > 10 ? '#ef4444' : '#e2e8f0' }}>
              <div className="waste-kpi-icon">⚠️</div>
              <div className="waste-kpi-value">{data.contamination_rate.toFixed(1)}%</div>
              <div className="waste-kpi-label">Contamination Rate</div>
            </div>
          </div>

          {/* Charts Row 1: Category Pie + Material Bar */}
          <div className="waste-charts-row">
            <div className="waste-chart-card">
              <h3>Waste by Category</h3>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%" cy="50%"
                    outerRadius={100}
                    dataKey="value"
                    label={({ name, value }) => `${name} (${value})`}
                  >
                    {pieData.map((entry, i) => (
                      <Cell key={i} fill={CATEGORY_COLORS_MAP[entry.name] || COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(val, name, props) => [`${val} items (${props.payload.weight?.toFixed(2)} kg)`, name]} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="waste-chart-card">
              <h3>Waste by Material</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={materialData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis dataKey="name" type="category" width={80} tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Charts Row 2: Daily Trend */}
          <div className="waste-chart-card full-width">
            <h3>Daily Waste Trend</h3>
            <ResponsiveContainer width="100%" height={350}>
              <AreaChart data={data.daily_trend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis />
                <Tooltip />
                <Legend />
                <Area type="monotone" dataKey="recycle" stackId="1" stroke="#22c55e" fill="#dcfce7" name="Recycle" />
                <Area type="monotone" dataKey="general" stackId="1" stroke="#64748b" fill="#f1f5f9" name="General" />
                <Area type="monotone" dataKey="organic" stackId="1" stroke="#84cc16" fill="#ecfccb" name="Organic" />
                <Area type="monotone" dataKey="hazardous" stackId="1" stroke="#ef4444" fill="#fef2f2" name="Hazardous" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Charts Row 3: Top Items + Target Progress */}
          <div className="waste-charts-row">
            <div className="waste-chart-card">
              <h3>Top 10 Waste Items</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={data.top_items}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="class_name" tick={{ fontSize: 10, angle: -30, textAnchor: 'end' }} height={80} />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="waste-chart-card">
              <h3>Target Progress</h3>
              <div className="waste-targets-list">
                {data.target_progress.length > 0 ? data.target_progress.map((t, i) => (
                  <div key={i} className="waste-target-item">
                    <div className="waste-target-header">
                      <span className="waste-target-metric">{t.metric.replace(/_/g, ' ')}</span>
                      <span className="waste-target-values">
                        {t.current_value}% / {t.target_value}%
                      </span>
                    </div>
                    <div className="waste-progress-bar">
                      <div
                        className="waste-progress-fill"
                        style={{
                          width: `${Math.min(t.progress_pct, 100)}%`,
                          background: t.progress_pct >= 100 ? '#22c55e' : t.progress_pct >= 60 ? '#3b82f6' : '#eab308',
                        }}
                      />
                    </div>
                    <span className="waste-target-pct">{t.progress_pct}%</span>
                  </div>
                )) : (
                  <p className="waste-empty-text">No targets set. Add targets in Settings.</p>
                )}
              </div>
            </div>
          </div>

          {/* Methodology note */}
          <div className="waste-methodology-note">
            <strong>📝 Methodology Note:</strong> Weights are estimated from AI-detected item counts × average weights per class.
            Measured weights from collection events take precedence where available.
            CO₂e savings are estimated using material-specific emission factors comparing recycling vs landfill.
            All estimates are clearly labelled.
          </div>
        </>
      )}
    </div>
  );
}
