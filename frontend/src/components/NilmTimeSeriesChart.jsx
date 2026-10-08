import React from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from 'recharts';

// Continuous 24-hour load profile across all 24 hours of the day
export const HOURLY_24H_DATA = {
  cool_night_gap: [
    { time: '00:00', total: 980, hotel: 390, office: 130, podium: 95, me: 85 },
    { time: '01:00', total: 960, hotel: 400, office: 125, podium: 90, me: 85 },
    { time: '02:00', total: 940, hotel: 410, office: 120, podium: 85, me: 85 },
    { time: '03:00', total: 1007, hotel: 420, office: 120, podium: 90, me: 92 }, // Anomaly point
    { time: '04:00', total: 920, hotel: 410, office: 120, podium: 85, me: 85 },
    { time: '05:00', total: 890, hotel: 390, office: 125, podium: 85, me: 85 },
    { time: '06:00', total: 950, hotel: 370, office: 180, podium: 100, me: 88 },
    { time: '07:00', total: 1100, hotel: 360, office: 310, podium: 140, me: 90 },
    { time: '08:00', total: 1350, hotel: 350, office: 490, podium: 180, me: 92 },
    { time: '09:00', total: 1580, hotel: 340, office: 620, podium: 220, me: 95 },
    { time: '10:00', total: 1720, hotel: 340, office: 710, podium: 250, me: 98 },
    { time: '11:00', total: 1810, hotel: 350, office: 760, podium: 270, me: 100 },
    { time: '12:00', total: 1790, hotel: 360, office: 730, podium: 280, me: 100 },
    { time: '13:00', total: 1830, hotel: 350, office: 770, podium: 275, me: 102 },
    { time: '14:00', total: 1850, hotel: 350, office: 780, podium: 270, me: 102 },
    { time: '15:00', total: 1780, hotel: 355, office: 740, podium: 260, me: 100 },
    { time: '16:00', total: 1710, hotel: 360, office: 690, podium: 245, me: 98 },
    { time: '17:00', total: 1620, hotel: 380, office: 600, podium: 230, me: 96 },
    { time: '18:00', total: 1510, hotel: 410, office: 480, podium: 220, me: 94 },
    { time: '19:00', total: 1420, hotel: 430, office: 360, podium: 215, me: 92 },
    { time: '20:00', total: 1350, hotel: 440, office: 280, podium: 200, me: 90 },
    { time: '21:00', total: 1240, hotel: 430, office: 210, podium: 170, me: 88 },
    { time: '22:00', total: 1120, hotel: 420, office: 160, podium: 130, me: 86 },
    { time: '23:00', total: 1040, hotel: 405, office: 140, podium: 105, me: 85 },
  ],
  tropical_heatwave: [
    { time: '00:00', total: 1080, hotel: 430, office: 150, podium: 110, me: 95 },
    { time: '01:00', total: 1060, hotel: 425, office: 145, podium: 105, me: 95 },
    { time: '02:00', total: 1040, hotel: 420, office: 140, podium: 100, me: 94 },
    { time: '03:00', total: 1005, hotel: 415, office: 135, podium: 98, me: 94 },
    { time: '04:00', total: 990, hotel: 410, office: 130, podium: 95, me: 93 },
    { time: '05:00', total: 980, hotel: 405, office: 130, podium: 95, me: 93 },
    { time: '06:00', total: 1050, hotel: 400, office: 190, podium: 115, me: 95 },
    { time: '07:00', total: 1190, hotel: 390, office: 330, podium: 155, me: 98 },
    { time: '08:00', total: 1420, hotel: 380, office: 530, podium: 195, me: 102 },
    { time: '09:00', total: 1680, hotel: 375, office: 670, podium: 240, me: 106 },
    { time: '10:00', total: 1850, hotel: 380, office: 770, podium: 275, me: 110 },
    { time: '11:00', total: 1960, hotel: 390, office: 830, podium: 300, me: 114 },
    { time: '12:00', total: 1980, hotel: 400, office: 820, podium: 310, me: 115 },
    { time: '13:00', total: 2020, hotel: 395, office: 860, podium: 310, me: 116 },
    { time: '14:00', total: 2050, hotel: 390, office: 875, podium: 310, me: 117 },
    { time: '15:00', total: 1990, hotel: 395, office: 835, podium: 300, me: 115 },
    { time: '16:00', total: 1910, hotel: 400, office: 785, podium: 285, me: 112 },
    { time: '17:00', total: 1810, hotel: 415, office: 690, podium: 265, me: 108 },
    { time: '18:00', total: 1690, hotel: 435, office: 560, podium: 250, me: 104 },
    { time: '19:00', total: 1580, hotel: 450, office: 430, podium: 240, me: 100 },
    { time: '20:00', total: 1480, hotel: 460, office: 330, podium: 225, me: 98 },
    { time: '21:00', total: 1360, hotel: 450, office: 250, podium: 195, me: 96 },
    { time: '22:00', total: 1240, hotel: 440, office: 195, podium: 155, me: 95 },
    { time: '23:00', total: 1150, hotel: 435, office: 165, podium: 130, me: 94 },
  ],
  daytime_nominal: [
    { time: '00:00', total: 950, hotel: 380, office: 130, podium: 95, me: 85 },
    { time: '01:00', total: 920, hotel: 370, office: 125, podium: 90, me: 85 },
    { time: '02:00', total: 890, hotel: 360, office: 120, podium: 85, me: 85 },
    { time: '03:00', total: 870, hotel: 350, office: 120, podium: 85, me: 85 },
    { time: '04:00', total: 850, hotel: 340, office: 120, podium: 85, me: 85 },
    { time: '05:00', total: 880, hotel: 340, office: 125, podium: 85, me: 85 },
    { time: '06:00', total: 980, hotel: 340, office: 185, podium: 100, me: 88 },
    { time: '07:00', total: 1180, hotel: 340, office: 330, podium: 145, me: 92 },
    { time: '08:00', total: 1480, hotel: 335, office: 540, podium: 195, me: 96 },
    { time: '09:00', total: 1780, hotel: 330, office: 710, podium: 240, me: 100 },
    { time: '10:00', total: 1980, hotel: 335, office: 830, podium: 280, me: 105 },
    { time: '11:00', total: 2150, hotel: 340, office: 910, podium: 310, me: 108 },
    { time: '12:00', total: 2100, hotel: 345, office: 870, podium: 320, me: 108 },
    { time: '13:00', total: 2200, hotel: 345, office: 930, podium: 320, me: 110 },
    { time: '14:00', total: 2450, hotel: 350, office: 850, podium: 650, me: 110 }, // Nominal afternoon peak
    { time: '15:00', total: 2180, hotel: 350, office: 920, podium: 310, me: 108 },
    { time: '16:00', total: 2050, hotel: 355, office: 850, podium: 290, me: 105 },
    { time: '17:00', total: 1890, hotel: 370, office: 740, podium: 265, me: 102 },
    { time: '18:00', total: 1680, hotel: 390, office: 580, podium: 240, me: 98 },
    { time: '19:00', total: 1490, hotel: 410, office: 420, podium: 225, me: 95 },
    { time: '20:00', total: 1380, hotel: 420, office: 320, podium: 205, me: 92 },
    { time: '21:00', total: 1250, hotel: 410, office: 230, podium: 175, me: 89 },
    { time: '22:00', total: 1110, hotel: 400, office: 170, podium: 135, me: 87 },
    { time: '23:00', total: 1010, hotel: 390, office: 145, podium: 110, me: 85 },
  ],
};

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div
        style={{
          background: 'rgba(15, 23, 42, 0.94)',
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(255, 255, 255, 0.15)',
          borderRadius: '8px',
          padding: '6px 10px',
          color: '#fff',
          fontSize: '11px',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.25)',
        }}
      >
        <div style={{ fontWeight: 800, color: '#38bdf8', marginBottom: '3px' }}>
          Hour: {label}
        </div>
        {payload.map((entry, index) => (
          <div
            key={index}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: '10px',
              color: entry.color || '#fff',
            }}
          >
            <span>{entry.name}:</span>
            <b>{entry.value} kW</b>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

export default function NilmTimeSeriesChart({ currentTime = '03:00', scenario = 'cool_night_gap' }) {
  const chartData = HOURLY_24H_DATA[scenario] || HOURLY_24H_DATA.cool_night_gap;
  const isAnomaly = scenario === 'cool_night_gap';

  return (
    <div
      style={{
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '12px',
        padding: '10px 12px',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
        marginBottom: '0.85rem',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '6px',
        }}
      >
        <div style={{ fontSize: '0.62rem', fontWeight: 800, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          📈 NILM 24H Load Disaggregation (kW)
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.58rem', color: '#64748b', fontWeight: 700 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
            <span style={{ width: '8px', height: '8px', background: '#94a3b8', borderRadius: '2px' }}></span> Total
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
            <span style={{ width: '8px', height: '8px', background: '#ef4444', borderRadius: '2px' }}></span> Hotel
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
            <span style={{ width: '8px', height: '8px', background: '#3b82f6', borderRadius: '2px' }}></span> Office
          </span>
        </div>
      </div>

      <div style={{ height: '90px', width: '100%' }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
            <defs>
              <linearGradient id="totalGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#cbd5e1" stopOpacity={0.6} />
                <stop offset="95%" stopColor="#f1f5f9" stopOpacity={0.05} />
              </linearGradient>
              <linearGradient id="hotelGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={isAnomaly ? '#f87171' : '#fca5a5'} stopOpacity={0.7} />
                <stop offset="95%" stopColor="#fee2e2" stopOpacity={0.1} />
              </linearGradient>
              <linearGradient id="officeGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#60a5fa" stopOpacity={0.5} />
                <stop offset="95%" stopColor="#dbeafe" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <XAxis dataKey="time" hide />
            <YAxis tick={{ fontSize: 9, fill: '#94a3b8' }} domain={['auto', 'auto']} />
            <Tooltip content={<CustomTooltip />} />

            {/* Total Building Power Area */}
            <Area
              type="monotone"
              dataKey="total"
              name="Main Meter"
              stroke="#94a3b8"
              strokeWidth={1.5}
              fill="url(#totalGrad)"
            />

            {/* Hotel Zone Power Area */}
            <Area
              type="monotone"
              dataKey="hotel"
              name="Hotel Zone"
              stroke="#ef4444"
              strokeWidth={1.8}
              fill="url(#hotelGrad)"
            />

            {/* Office Zone Power Area */}
            <Area
              type="monotone"
              dataKey="office"
              name="Offices"
              stroke="#3b82f6"
              strokeWidth={1.2}
              fill="url(#officeGrad)"
            />

            {/* Sliding vertical reference line indicating active evaluation time */}
            <ReferenceLine
              x={currentTime}
              stroke="#ef4444"
              strokeWidth={2}
              strokeDasharray="3 3"
              label={{
                value: `▼ ${currentTime}`,
                position: 'top',
                fill: '#ef4444',
                fontSize: 9,
                fontWeight: 800,
              }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.55rem', color: '#94a3b8', fontWeight: 600, marginTop: '2px' }}>
        <span>00:00 (Midnight)</span>
        <span>06:00</span>
        <span>12:00 (Noon)</span>
        <span>18:00</span>
        <span>23:00</span>
      </div>
    </div>
  );
}
