/**
 * useZoneConsumption -- Single Source of Truth
 *
 * Unified to /api/v1/dashboard/nilm-live so that UtilityMainMeter and
 * ZoneConsumptionCards share the EXACT same SWR cache key and always
 * display consistent numbers (fixes the 55.0 kWh vs 3094.5 kWh split-brain).
 *
 * The hook transforms disaggregated_loads into the zone-list shape that
 * ZoneConsumptionCards expects, preserving the UI contract.
 */
import useSWR from 'swr';

export const EMS_API = 'http://localhost:5000';

const fetcher = async (url) => {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`EMS API ${response.status}`);
  return response.json();
};

export function useZoneConsumption() {
  const { data: raw, error, isLoading } = useSWR(
    '/api/v1/dashboard/nilm-live',
    fetcher,
    { refreshInterval: 5000, revalidateOnFocus: true }
  );

  let data = null;
  if (raw) {
    const loads = raw.disaggregated_loads || [];
    const zones = loads.map((z) => ({
      code: z.zone_code || z.zone_name,
      name: z.zone_name,
      floors_label: '',
      area_m2: null,
      energy_kwh: z.reading_kwh,
      demand_kw: z.demand_kw != null ? z.demand_kw : (z.reading_kwh || 0) * 4,
      eei_kwh_m2_yr: null,
      eei_baseline_kwh_m2_yr: null,
      excess_kwh: 0,
      compliance_status: z.reading_kwh > 0 ? 'live' : 'insufficient_data',
      peak_demand_kw: z.demand_kw,
      avg_power_factor: z.avg_power_factor,
      color: z.color,
    }));
    data = {
      zones,
      total_energy_kwh: raw.total_main_meter_kwh,
      total_main_meter_kw: raw.total_main_meter_kw,
      building_eei_kwh_m2_yr: null,
      building_compliance_status: null,
      timestamp: raw.timestamp,
      window_start: raw.window_start,
    };
  }

  return { data, error, isLoading };
}

export async function downloadGreenReEvidence() {
  const response = await fetch(`${EMS_API}/api/v1/reports/greenre`);
  if (!response.ok) throw new Error(`Report generation failed (${response.status})`);
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'greenre-evidence.pdf';
  anchor.click();
  URL.revokeObjectURL(url);
}
