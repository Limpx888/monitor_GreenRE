/**
 * API client for the Water Management module.
 * Proxied via Vite to backend port 5000: /api/water/*
 */

const BASE = '/api/water';

async function request(path, options = {}) {
  const headers = { ...options.headers, 'Content-Type': 'application/json' };
  const res = await fetch(`${BASE}${path}`, { ...options, headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Water API request failed');
  }
  return res.json();
}

export const waterApi = {
  // Get all monitored buildings
  getBuildings: (site, spaceUsage) => {
    const params = new URLSearchParams();
    if (site) params.set('site', site);
    if (spaceUsage) params.set('space_usage', spaceUsage);
    const qs = params.toString();
    return request(`/buildings${qs ? `?${qs}` : ''}`);
  },

  // Get time-series consumption for a specific building
  getConsumption: (buildingName, { limit = 60, meterType, granularity = 'daily' } = {}) => {
    const params = new URLSearchParams({ limit, granularity });
    if (meterType) params.set('meter_type', meterType);
    return request(`/consumption/${encodeURIComponent(buildingName)}?${params}`);
  },

  // Get portfolio-wide water totals & space benchmarks
  getPortfolioStats: () => request('/analytics/portfolio'),

  // Get GreenRE water rules knowledge base
  getGreenRERules: () => request('/greenre/rules'),

  // Run GreenRE compliance audit for a building
  getAudit: (buildingName) => request(`/greenre/audit/${encodeURIComponent(buildingName)}`),
};
