import React from 'react';
import { useNavigate } from 'react-router-dom'; // 1. Import useNavigate

export default function ZoneConsumptionCards({ payload, loading, error }) {
  const navigate = useNavigate(); // 2. Initialize navigate
  const zones = payload?.zones || [];

  if (error) {
    return (
      <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
        Live EMS stream offline. Start FastAPI + the BDG2 streamer to populate Supabase.
      </div>
    );
  }

  if (loading && !payload) {
    return (
      <div className="mb-3 animate-pulse space-y-1.5">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-10 rounded-lg bg-slate-100" />
        ))}
      </div>
    );
  }

  const total = payload?.total_main_meter_kw
    || payload?.zones?.reduce((sum, zone) => sum + (zone.demand_kw || zone.peak_demand_kw || 0), 0)
    || 0;
  const ts = payload?.timestamp;

  return (
    <div className="mb-3">
      {/* ... Retain original header ... */}
      <div className="mb-1.5 flex items-center justify-between">
        <div className="text-[10px] font-extrabold uppercase tracking-wide text-slate-500">
          Live Zone Consumption
        </div>
        <div className="text-[10px] font-semibold text-slate-400">
          {ts ? new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : (loading ? 'syncing…' : '—')}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-1.5">
        {zones.map((zone) => {
          const kw = zone.demand_kw ?? zone.peak_demand_kw ?? ((zone.energy_kwh || 0) * 4);
          const pct = total > 0 ? (kw / total) * 100 : 0;
          const isLive = zone.compliance_status === 'live';
          
          return (
            <div
              key={zone.code}
              onClick={() => navigate(`/zone/${zone.code || zone.id}`)} // 3. Add click navigation logic
              className="rounded-lg bg-white border border-slate-200 px-2.5 py-2 hover:shadow-md transition-shadow cursor-pointer" // Add cursor-pointer
            >
              {/* ... Card inner code remains as is ... */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span
                    className="inline-block w-2.5 h-2.5 rounded-full shrink-0 shadow-sm"
                    style={{ backgroundColor: zone.color || '#94a3b8' }}
                  />
                  <span className="text-[11px] font-bold text-slate-800 truncate" title={zone.name}>
                    {zone.name}
                  </span>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-[12px] font-extrabold text-slate-900 font-mono">
                    {kw.toFixed(1)} kW
                  </div>
                  <div className={`text-[10px] font-bold ${isLive ? 'text-emerald-600' : 'text-slate-400'}`}>
                    {isLive ? '● LIVE' : zone.compliance_status}
                  </div>
                </div>
              </div>
              
              <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${pct}%`, backgroundColor: zone.color || '#94a3b8' }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}