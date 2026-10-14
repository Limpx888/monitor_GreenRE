import React from 'react';
import useSWR from 'swr';

const API_BASE = 'http://localhost:5000';
const fetcher = (url) => {
  const fullUrl = url.startsWith('http') ? url : (typeof window !== 'undefined' && window.location.origin.includes('5173') ? url : `${API_BASE}${url}`);
  return fetch(fullUrl).then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  });
};

function zoneKw(zone) {
  if (zone?.demand_kw != null && zone.demand_kw > 0) return zone.demand_kw;
  return (zone?.reading_kwh || 0) * 4;
}

// 1. Add overrideData property
export default function UtilityMainMeter({ className = '', overrideData = null }) {
  const { data: liveData, error: liveError, isLoading: liveLoading } = useSWR('/api/v1/dashboard/nilm-live', fetcher, {
    refreshInterval: 5000,
    revalidateOnFocus: true,
  });

  // 2. If overrideData (Scenario) exists, prioritize it; otherwise, use liveData
  const data = overrideData || liveData;
  const error = overrideData ? null : liveError;
  const isLoading = overrideData ? false : liveLoading;

  if (error && !data) {
    return (
      <div className="bg-white p-3.5 rounded-xl shadow-sm border border-red-100 mb-3 text-xs text-red-600">
        <div className="font-bold flex items-center gap-1.5">
          <span>⚠️</span> Utility Main Meter Offline
        </div>
        <p className="text-[11px] text-gray-500 mt-1">Connecting to live PostgreSQL NILM stream...</p>
      </div>
    );
  }

  if (isLoading && !data) {
    return (
      <div className="bg-white p-3.5 rounded-xl shadow-sm border border-slate-100 mb-3 animate-pulse">
        <div className="flex justify-between items-center mb-3">
          <div className="h-4 bg-slate-200 rounded w-1/3"></div>
          <div className="h-4 bg-slate-200 rounded w-1/4"></div>
        </div>
        <div className="w-full h-3 bg-slate-100 rounded-full mb-3"></div>
      </div>
    );
  }

  const loads = data?.disaggregated_loads || [];
  const total = Number(
    data?.total_main_meter_kw != null
      ? data.total_main_meter_kw
      : loads.reduce((sum, zone) => sum + zoneKw(zone), 0)
  );

  return (
    <div
      className={`bg-white p-3.5 rounded-xl shadow-sm border border-slate-200/80 mb-3 hover:shadow-md transition-shadow duration-200 ${className}`}
    >
      <div className="flex justify-between items-center font-bold mb-2.5">
        <div className="flex items-center gap-1.5">
          <span className="text-xs uppercase tracking-wider text-slate-500 font-extrabold">
            ⚡ Utility Main Meter
          </span>
          {/* 3. Dynamic badge state: LIVE or SCENARIO */}
          <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold animate-pulse ${overrideData ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>
            {overrideData ? 'SCENARIO' : 'LIVE'}
          </span>
        </div>
        <div className="flex flex-col items-end">
          <span className="text-3xl font-bold text-gray-800">
            {total.toFixed(1)} <span className="text-lg">kW</span>
          </span>
          <span className={`text-xs uppercase font-semibold tracking-wider ${overrideData ? 'text-amber-600' : 'text-green-600'}`}>
            {overrideData ? 'Scenario Demand' : 'Live Demand'}
          </span>
        </div>
      </div>

      {/* Progress bar rendering area */}
      <div className="flex w-full h-3 rounded-full overflow-hidden mb-3.5 bg-slate-100 p-0.5 shadow-inner">
        {loads.map((zone) => {
          const kw = zoneKw(zone);
          const pct = total > 0 ? (kw / total) * 100 : 0;
          // ⚠️ Get estimation flag. If not passed in Live mode, NILM is still essentially an estimation, so default to true
          const isEstimated = zone.is_estimated ?? true;

          return (
            <div
              key={zone.zone_name}
              style={{
                width: `${pct}%`,
                backgroundColor: zone.color,
                // ⚠️ Industrial UI design: Estimated data uses a translucent striped background, never mixing up with physical measurements
                backgroundImage: isEstimated ? 'repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(255,255,255,0.3) 4px, rgba(255,255,255,0.3) 8px)' : 'none',
                transition: 'width 0.5s ease-in-out',
              }}
              className="h-full transition-all duration-500 ease-in-out hover:opacity-90 relative cursor-pointer"
              title={`${zone.zone_name}: ${kw.toFixed(1)} kW (${pct.toFixed(1)}%) ${isEstimated ? `[AI Estimated, Conf: ${zone.confidence || 85}%]` : '[Measured]'}`}
            />
          );
        })}
      </div>

      {/* List rendering area */}
      <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs text-slate-600 font-medium">
        {loads.map((zone) => {
          const kw = zoneKw(zone);
          const isEstimated = zone.is_estimated ?? true;

          return (
            <div
              key={zone.zone_name}
              className="flex items-center justify-between py-0.5 px-1 rounded hover:bg-slate-50 transition-colors"
            >
              <div className="flex items-center truncate mr-1.5">
                <span
                  className="w-2.5 h-2.5 rounded-full mr-1.5 shrink-0 shadow-sm"
                  style={{ backgroundColor: zone.color }}
                />
                <span className="truncate text-slate-700 font-semibold" title={zone.zone_name}>
                  {zone.zone_name}
                </span>
                {/* ⚠️ Inject AI watermark badge */}
                {isEstimated && (
                  <span className="ml-1 text-[9px] bg-indigo-50 text-indigo-500 px-1 rounded border border-indigo-100" title={`AI Confidence: ${zone.confidence || 85}%`}>
                    ✨ AI
                  </span>
                )}
              </div>
              <div className="flex flex-col items-end shrink-0 ml-auto font-mono">
                <div className="flex items-center gap-1">
                  <strong className="text-slate-900 font-bold">{kw.toFixed(1)}</strong>
                  <span className="text-[10px] text-slate-400">kW</span>
                </div>
                {/* ⚠️ Inject confidence level */}
                {isEstimated && (
                  <span className="text-[8px] text-slate-400 leading-none mt-[1px]">Conf: {zone.confidence || 85}%</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}