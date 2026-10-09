/**
 * API client for the Waste Management backend.
 * All calls go through Vite's proxy → FastAPI at :8000
 */

const BASE = '/api/v1';

async function request(path, options = {}) {
  const token = localStorage.getItem('waste_token');
  const headers = { ...options.headers };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(`${BASE}${path}`, { ...options, headers });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Request failed');
  }
  return res.json();
}

// ── Auth ──
export const authApi = {
  login: (email, password) =>
    request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  me: () => request('/auth/me'),
  sites: () => request('/auth/sites'),
  locations: (siteId) => request(`/auth/locations/${siteId}`),
};

// ── Detection ──
export const detectApi = {
  detect: (file, siteId, locationId, note, scanMode = 'upload') => {
    const form = new FormData();
    form.append('file', file);
    form.append('site_id', siteId);
    if (locationId) form.append('location_id', locationId);
    if (note) form.append('note', note);
    form.append('scan_mode', scanMode);
    return request('/detect', { method: 'POST', body: form });
  },
};

// ── Scans ──
export const scansApi = {
  list: (siteId, status, limit = 50, offset = 0) => {
    const params = new URLSearchParams({ site_id: siteId, limit, offset });
    if (status) params.set('status', status);
    return request(`/scans?${params}`);
  },
  get: (scanId) => request(`/scans/${scanId}`),
  updateDetection: (scanId, detectionId, data) =>
    request(`/scans/${scanId}/detections/${detectionId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  addDetection: (scanId, className, category) =>
    request(`/scans/${scanId}/detections?class_name=${encodeURIComponent(className)}${category ? `&category=${category}` : ''}`, {
      method: 'POST',
    }),
  confirm: (scanId) =>
    request(`/scans/${scanId}/confirm`, { method: 'PUT' }),
  exportYolo: (scanId) =>
    request(`/scans/${scanId}/export-yolo`),
};

// ── Analytics ──
export const analyticsApi = {
  get: (siteId, startDate, endDate, locationId, category) => {
    const params = new URLSearchParams({ site_id: siteId });
    if (startDate) params.set('start_date', startDate);
    if (endDate) params.set('end_date', endDate);
    if (locationId) params.set('location_id', locationId);
    if (category) params.set('category', category);
    return request(`/analytics?${params}`);
  },
};

// ── Waste Config ──
export const configApi = {
  list: (siteId) => {
    const params = siteId ? `?site_id=${siteId}` : '';
    return request(`/waste-config${params}`);
  },
  create: (data, siteId) =>
    request(`/waste-config${siteId ? `?site_id=${siteId}` : ''}`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  update: (configId, data) =>
    request(`/waste-config/${configId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  delete: (configId) =>
    request(`/waste-config/${configId}`, { method: 'DELETE' }),
};

// ── Actions ──
export const actionsApi = {
  list: (siteId, status, hierarchy) => {
    const params = new URLSearchParams({ site_id: siteId });
    if (status) params.set('status', status);
    if (hierarchy) params.set('hierarchy', hierarchy);
    return request(`/actions?${params}`);
  },
  generate: (siteId, days = 30) =>
    request(`/actions/generate?site_id=${siteId}&days=${days}`, { method: 'POST' }),
  create: (siteId, data) =>
    request(`/actions?site_id=${siteId}`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  update: (actionId, data) =>
    request(`/actions/${actionId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
};

// ── GreenRE ──
export const greenreApi = {
  list: (siteId, status) => {
    const params = new URLSearchParams({ site_id: siteId });
    if (status) params.set('status', status);
    return request(`/greenre?${params}`);
  },
  create: (siteId, data) =>
    request(`/greenre?site_id=${siteId}`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  update: (reqId, data) =>
    request(`/greenre/${reqId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  report: (siteId, period, startDate, endDate) => {
    const params = new URLSearchParams({ site_id: siteId, period });
    if (startDate) params.set('start_date', startDate);
    if (endDate) params.set('end_date', endDate);
    return request(`/greenre/report?${params}`);
  },
};

// ── Collections & Targets ──
export const collectionsApi = {
  list: (siteId) => request(`/collections?site_id=${siteId}`),
  create: (siteId, data) =>
    request(`/collections?site_id=${siteId}`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};

export const targetsApi = {
  list: (siteId) => request(`/targets?site_id=${siteId}`),
  create: (siteId, data) =>
    request(`/targets?site_id=${siteId}`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};

// ── Category Info ──
export const getCategoryInfo = () => request('/../api/v1/category-info');

// ── Health ──
export const healthCheck = () => fetch('/health').then(r => r.json());
