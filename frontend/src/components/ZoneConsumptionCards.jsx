import React from 'react';

/**
 * ZoneConsumptionCards
 *
 * Renders the "Live Zone Consumption" list driven by the nilm-live SWR hook
 * (same single source of truth as UtilityMainMeter). Each zone shows:
 *   - Coloured dot + name
 *   - reading_kwh (instantly consistent with the progress bar above)
 *   - demand_kw and avg_power_factor when available
 */
export default function ZoneConsumptionCards({ payload, loading, error }) {
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
              className="rounded-lg bg-white border border-slate-200 px-2.5 py-2 hover:shadow-sm transition-shadow"
            >
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

              {/* Proportional width bar */}
              <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${pct}%`, backgroundColor: zone.color || '#94a3b8' }}
                />
              </div>

              {/* Demand & PF metadata row */}
              <div className="mt-1 flex gap-2 text-[9.5px] text-slate-400">
                {zone.energy_kwh != null && (
                  <span>{zone.energy_kwh.toFixed(1)} kWh interval</span>
                )}
                {zone.avg_power_factor != null && (
                  <span>PF {zone.avg_power_factor.toFixed(2)}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
