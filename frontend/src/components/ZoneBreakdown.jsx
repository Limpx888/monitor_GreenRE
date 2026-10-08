import React from 'react';

export default function ZoneBreakdown({ zonesData }) {
  // zonesData represents the real-time disaggregation data fetched from your API
  const hotel = zonesData?.hotel || 0;
  const office = zonesData?.office || 0;
  const podium = zonesData?.podium || 0;
  const me = zonesData?.me || 0;
  const total = zonesData?.total || (hotel + office + podium + me) || 1007;

  // Calculate percentages
  const pctHotel = (hotel / total) * 100;
  const pctOffice = (office / total) * 100;
  const pctPodium = (podium / total) * 100;
  const pctMe = (me / total) * 100;

  return (
    <div
      className="bg-white p-3 rounded-lg shadow-sm border border-gray-100 mt-3 mb-4"
      style={{
        background: '#ffffff',
        padding: '0.85rem',
        borderRadius: '10px',
        border: '1px solid #e2e8f0',
        boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
        marginTop: '0.75rem',
        marginBottom: '0.85rem'
      }}
    >
      <div
        className="flex justify-between text-xs font-bold mb-2"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: '0.74rem',
          fontWeight: 800,
          color: '#0f172a',
          marginBottom: '6px'
        }}
      >
        <span className="text-gray-500" style={{ color: '#64748b' }}>Utility Main Meter</span>
        <span className="text-gray-800" style={{ color: '#0f172a' }}>{total} kWh</span>
      </div>
      
      {/* Color-segmented progress bar */}
      <div
        className="w-full flex h-2.5 rounded-full overflow-hidden mb-2"
        style={{
          width: '100%',
          display: 'flex',
          height: '10px',
          borderRadius: '9999px',
          overflow: 'hidden',
          marginBottom: '8px',
          background: '#f1f5f9'
        }}
      >
        <div
          style={{ width: `${pctHotel}%`, background: '#ef4444', transition: 'width 0.4s ease' }}
          className="bg-red-500 hover:opacity-80 transition-all"
          title={`Hyatt Hotel: ${Math.round(pctHotel)}%`}
        />
        <div
          style={{ width: `${pctOffice}%`, background: '#3b82f6', transition: 'width 0.4s ease' }}
          className="bg-blue-500 hover:opacity-80 transition-all"
          title={`Offices: ${Math.round(pctOffice)}%`}
        />
        <div
          style={{ width: `${pctPodium}%`, background: '#eab308', transition: 'width 0.4s ease' }}
          className="bg-yellow-500 hover:opacity-80 transition-all"
          title={`Podium: ${Math.round(pctPodium)}%`}
        />
        <div
          style={{ width: `${pctMe}%`, background: '#94a3b8', transition: 'width 0.4s ease' }}
          className="bg-gray-400 hover:opacity-80 transition-all"
          title={`M&E Plant: ${Math.round(pctMe)}%`}
        />
      </div>

      {/* Disaggregated values legend */}
      <div
        className="grid grid-cols-2 gap-1 text-[11px] font-medium"
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '4px 8px',
          fontSize: '0.68rem',
          color: '#475569'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span><span style={{ color: '#ef4444', fontWeight: 900 }}>●</span> Hyatt Hotel</span>
          <b>{hotel} kWh</b>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span><span style={{ color: '#3b82f6', fontWeight: 900 }}>●</span> Offices</span>
          <b>{office} kWh</b>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span><span style={{ color: '#eab308', fontWeight: 900 }}>●</span> Podium</span>
          <b>{podium} kWh</b>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span><span style={{ color: '#94a3b8', fontWeight: 900 }}>●</span> M&E Plant</span>
          <b>{me} kWh</b>
        </div>
      </div>
    </div>
  );
}
