import React from 'react';
import { AreaChart, Area, XAxis, Tooltip, ReferenceLine, ResponsiveContainer } from 'recharts';

// Simulated 24-hour energy trend data (perfectly aligning with your 3 roadshow scenarios)
const nilm24hData = [
  { time: '00:00', total: 920, hotel: 380 },
  { time: '01:00', total: 950, hotel: 390 },
  { time: '03:00', total: 1007, hotel: 420 }, // 🚨 Late-night anomaly point (Cool Night Anomaly)
  { time: '06:00', total: 1100, hotel: 350 },
  { time: '09:00', total: 1800, hotel: 310 }, // Office hours begin, total power surges, hotel drops
  { time: '14:00', total: 2450, hotel: 350 }, // 🏢 Afternoon nominal peak (Nominal Afternoon)
  { time: '19:00', total: 2100, hotel: 480 }, // Hotel evening peak
  { time: '23:00', total: 1050, hotel: 400 },
];

export default function NilmChart({ currentTime }) {
  return (
    <div
      className="w-full h-32 mt-4 bg-white p-2 rounded-lg border border-gray-100 shadow-sm"
      style={{
        background: '#ffffff',
        borderRadius: '10px',
        border: '1px solid #e2e8f0',
        padding: '10px',
        marginTop: '10px',
        marginBottom: '10px',
        boxShadow: '0 2px 6px rgba(0,0,0,0.03)'
      }}
    >
      <div
        className="flex justify-between items-center mb-1"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '6px'
        }}
      >
        <span
          className="text-xs font-bold text-gray-600"
          style={{ fontSize: '0.72rem', fontWeight: 800, color: '#475569' }}
        >
          24H NILM Load Disaggregation (kW)
        </span>
        <span
          className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded"
          style={{
            fontSize: '0.6rem',
            background: '#dbeafe',
            color: '#1d4ed8',
            padding: '2px 6px',
            borderRadius: '4px',
            fontWeight: 700
          }}
        >
          Seq2Point 1D-CNN
        </span>
      </div>
      
      <div style={{ width: '100%', height: '85px' }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={nilm24hData} margin={{ top: 5, right: 8, left: 8, bottom: 0 }}>
            <XAxis dataKey="time" hide /> {/* Hide X-axis to keep UI minimalist */}
            <Tooltip 
              contentStyle={{
                fontSize: '11px',
                borderRadius: '8px',
                background: 'rgba(15, 23, 42, 0.92)',
                color: '#fff',
                border: 'none',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
              }}
              itemStyle={{ fontSize: '11px', color: '#fff' }}
            />
            {/* Grey Area: Building Total Meter Power */}
            <Area type="monotone" dataKey="total" stroke="#cbd5e1" fill="#f1f5f9" strokeWidth={2} name="Building Total" />
            {/* Red Area: AI Disaggregated Hotel Power */}
            <Area type="monotone" dataKey="hotel" stroke="#ef4444" fill="#fee2e2" strokeWidth={2} name="Hotel Disaggregated" />
            
            {/* 🔥 Core Explainability Feature: Current Time Indicator Line */}
            <ReferenceLine
              x={currentTime}
              stroke="#dc2626"
              strokeDasharray="3 3"
              label={{ position: 'top', value: currentTime, fill: '#dc2626', fontSize: 10 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
