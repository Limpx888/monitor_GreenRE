import React from 'react';
import useSWR from 'swr';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from 'recharts';

const API_BASE = 'http://localhost:5000';
const fetcher = (url) => {
  const fullUrl = url.startsWith('http') ? url : (typeof window !== 'undefined' && window.location.origin.includes('5173') ? url : `${API_BASE}${url}`);
  return fetch(fullUrl).then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  });
};

// Fallback baseline profile if API is momentarily synchronizing
const DEFAULT_24H_DATA = [
  { time: '00:00', total: 690, 'Hyatt Hotel': 380, 'Offices': 130, 'Podium': 95, 'M&E Plant': 85 },
  { time: '01:00', total: 700, 'Hyatt Hotel': 390, 'Offices': 135, 'Podium': 90, 'M&E Plant': 85 },
  { time: '02:00', total: 710, 'Hyatt Hotel': 400, 'Offices': 135, 'Podium': 90, 'M&E Plant': 85 },
  { time: '03:00', total: 727, 'Hyatt Hotel': 420, 'Offices': 130, 'Podium': 85, 'M&E Plant': 92 },
  { time: '04:00', total: 705, 'Hyatt Hotel': 410, 'Offices': 125, 'Podium': 85, 'M&E Plant': 85 },
  { time: '06:00', total: 730, 'Hyatt Hotel': 370, 'Offices': 180, 'Podium': 95, 'M&E Plant': 85 },
  { time: '09:00', total: 1100, 'Hyatt Hotel': 340, 'Offices': 500, 'Podium': 165, 'M&E Plant': 95 },
  { time: '12:00', total: 1390, 'Hyatt Hotel': 360, 'Offices': 680, 'Podium': 250, 'M&E Plant': 100 },
  { time: '14:00', total: 1450, 'Hyatt Hotel': 350, 'Offices': 720, 'Podium': 280, 'M&E Plant': 100 },
  { time: '18:00', total: 1180, 'Hyatt Hotel': 410, 'Offices': 480, 'Podium': 200, 'M&E Plant': 90 },
  { time: '21:00', total: 880, 'Hyatt Hotel': 430, 'Offices': 200, 'Podium': 165, 'M&E Plant': 85 },
  { time: '23:00', total: 730, 'Hyatt Hotel': 405, 'Offices': 145, 'Podium': 95, 'M&E Plant': 85 },
];

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    const total = payload.reduce((acc, entry) => acc + (Number(entry.value) || 0), 0);
    return (
      <div
        style={{
          background: 'rgba(15, 23, 42, 0.95)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255, 255, 255, 0.15)',
          borderRadius: '8px',
          padding: '8px 12px',
          color: '#fff',
          fontSize: '11px',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.25)',
          minWidth: '150px',
        }}
      >
        <div style={{ fontWeight: 800, color: '#38bdf8', marginBottom: '4px', display: 'flex', justifyContent: 'space-between' }}>
          <span>Hour: {label}</span>
          <span style={{ color: '#f8fafc' }}>{total.toFixed(1)} kWh Total</span>
        </div>
        <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.1)', paddingTop: '4px' }}>
          {payload.map((entry, index) => (
            <div
              key={index}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: '12px',
                color: entry.color || '#fff',
                fontSize: '10.5px',
                padding: '1px 0',
              }}
            >
              <span>{entry.name}:</span>
              <strong style={{ color: '#fff' }}>{(Number(entry.value) || 0).toFixed(1)} kWh</strong>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return null;
};

export default function NilmChart({ currentTime = '03:00' }) {
  const { data: historyData } = useSWR('/api/v1/dashboard/nilm-history', fetcher, {
    refreshInterval: 5000,
    revalidateOnFocus: true,
  });

  const chartData = (historyData && historyData.length > 0) ? historyData : DEFAULT_24H_DATA;

  return (
    <div
      className="w-full bg-white p-3 rounded-xl border border-slate-200/80 shadow-sm mt-3 mb-3 hover:shadow-md transition-shadow duration-200"
      style={{
        background: '#ffffff',
        borderRadius: '12px',
        border: '1px solid #e2e8f0',
        padding: '10px 12px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
      }}
    >
      <div
        className="flex justify-between items-center mb-1.5"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '6px',
        }}
      >
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-extrabold text-slate-700 uppercase tracking-wide">
            📈 Analyzed Load Patterns (24H NILM)
          </span>
          <span className="text-[9px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-extrabold">
            STACKED · 100% CLOSED LOOP
          </span>
        </div>
        <div className="flex items-center gap-2 text-[10px] text-slate-500 font-bold">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-sm" style={{ background: '#ef4444' }}></span> Hotel
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-sm" style={{ background: '#3b82f6' }}></span> Offices
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-sm" style={{ background: '#eab308' }}></span> Podium
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-sm" style={{ background: '#9ca3af' }}></span> M&E
          </span>
        </div>
      </div>

      <div style={{ width: '100%', height: '105px' }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="hotelColor" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#ef4444" stopOpacity={0.85} />
                <stop offset="95%" stopColor="#ef4444" stopOpacity={0.4} />
              </linearGradient>
              <linearGradient id="officeColor" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.85} />
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.4} />
              </linearGradient>
              <linearGradient id="podiumColor" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#eab308" stopOpacity={0.85} />
                <stop offset="95%" stopColor="#eab308" stopOpacity={0.4} />
              </linearGradient>
              <linearGradient id="meColor" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#9ca3af" stopOpacity={0.85} />
                <stop offset="95%" stopColor="#9ca3af" stopOpacity={0.4} />
              </linearGradient>
              <linearGradient id="amenityColor" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.85} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0.4} />
              </linearGradient>
            </defs>

            <XAxis dataKey="time" tick={{ fontSize: 9, fill: '#94a3b8' }} interval="preserveStartEnd" />
            <YAxis tick={{ fontSize: 9, fill: '#94a3b8' }} domain={['auto', 'auto']} />
            <Tooltip content={<CustomTooltip />} />

            {/* Area components with stackId="1" automatically sum up to aggregate building utility power */}
            <Area
              type="monotone"
              dataKey="M&E Plant"
              stackId="1"
              stroke="#9ca3af"
              fill="url(#meColor)"
              strokeWidth={1.2}
              name="M&E Plant"
            />
            <Area
              type="monotone"
              dataKey="Podium"
              stackId="1"
              stroke="#eab308"
              fill="url(#podiumColor)"
              strokeWidth={1.2}
              name="Podium"
            />
            <Area
              type="monotone"
              dataKey="Offices"
              stackId="1"
              stroke="#3b82f6"
              fill="url(#officeColor)"
              strokeWidth={1.2}
              name="Offices"
            />
            <Area
              type="monotone"
              dataKey="Hyatt Hotel"
              stackId="1"
              stroke="#ef4444"
              fill="url(#hotelColor)"
              strokeWidth={1.2}
              name="Hyatt Hotel"
            />
            <Area
              type="monotone"
              dataKey="Amenities"
              stackId="1"
              stroke="#10b981"
              fill="url(#amenityColor)"
              strokeWidth={1.2}
              name="Amenities"
            />

            {/* Vertical timeline reference line */}
            <ReferenceLine
              x={currentTime}
              stroke="#dc2626"
              strokeWidth={2}
              strokeDasharray="3 3"
              label={{ position: 'top', value: `▼ ${currentTime}`, fill: '#dc2626', fontSize: 9, fontWeight: 800 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
