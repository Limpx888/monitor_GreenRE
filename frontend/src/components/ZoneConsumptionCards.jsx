import React from 'react';

export default function ZoneConsumptionCards({ payload, loading, error }) {
  const zones = payload?.zones || [];

  if (error) {
    return (
      <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
        Live EMS stream offline. Start FastAPI + the BDG2 streamer to populate Supabase.
      </div>
    );
  }

  return (
    <div className="mb-3">
      <div className="mb-1.5 flex items-center justify-between">
        <div className="text-[10px] font-extrabold uppercase tracking-wide text-slate-500">
          Live zone consumption (BDG2 → Postgres)
        </div>
        <div className="text-[10px] font-semibold text-slate-500">
          EEI {payload?.building_eei_kwh_m2_yr ?? '—'} · {payload?.building_compliance_status || (loading ? 'syncing' : '—')}
        </div>
      </div>
      <div className="grid grid-cols-1 gap-1.5">
        {zones.map((zone) => {
          const warning = zone.compliance_status === 'warning';
          const allowed = Math.max(zone.energy_kwh - zone.excess_kwh, 0);
          const total = zone.energy_kwh || 1;
          return (
            <div
              key={zone.code}
              className={`rounded-lg bg-white px-2.5 py-2 ${
                warning
                  ? 'border border-red-500 animate-pulse'
                  : 'border border-gray-200'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-[11px] font-bold text-slate-800">{zone.name}</div>
                  <div className="text-[10px] text-slate-400">{zone.floors_label}</div>
                </div>
                <div className="text-right">
                  <div className="text-[11px] font-extrabold text-slate-900">{zone.energy_kwh} kWh</div>
                  <div className={`text-[10px] font-bold ${warning ? 'text-red-600' : 'text-teal-700'}`}>
                    {zone.compliance_status}
                  </div>
                </div>
              </div>
              <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                <div className="flex h-full w-full">
                  <div className="h-full bg-teal-500" style={{ width: `${(allowed / total) * 100}%` }} />
                  {warning && zone.excess_kwh > 0 && (
                    <div className="h-full bg-red-500" style={{ width: `${(zone.excess_kwh / total) * 100}%` }} />
                  )}
                </div>
              </div>
              <div className="mt-1 text-[10px] text-slate-500">
                EEI {zone.eei_kwh_m2_yr} / baseline {zone.eei_baseline_kwh_m2_yr}
                {warning ? ` · gap ${zone.excess_kwh} kWh` : ''}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
