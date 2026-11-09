import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Small fetch hook: { data, error, loading, reload }.
 * `intervalMs` polls in the background; a failed poll keeps the last good data.
 */
function useJson(url, { intervalMs = 0, select = (d) => d } = {}) {
  const [state, setState] = useState({ data: null, error: null, loading: true });
  const selectRef = useRef(select);
  useEffect(() => { selectRef.current = select; });

  const load = useCallback(async (signal) => {
    try {
      const res = await fetch(url, { signal });
      if (!res.ok) throw new Error(`Server responded ${res.status}`);
      const json = await res.json();
      setState({ data: selectRef.current(json), error: null, loading: false });
    } catch (err) {
      if (err.name === 'AbortError') return;
      setState((s) => ({ data: s.data, error: s.data ? null : err.message || 'Request failed', loading: false }));
    }
  }, [url]);

  useEffect(() => {
    const ctrl = new AbortController();
    load(ctrl.signal);
    const timer = intervalMs ? setInterval(() => load(ctrl.signal), intervalMs) : null;
    return () => { ctrl.abort(); if (timer) clearInterval(timer); };
  }, [load, intervalMs]);

  const reload = useCallback(() => {
    setState((s) => ({ ...s, loading: true, error: null }));
    load();
  }, [load]);

  return { ...state, reload };
}

/** Live indoor air quality per floor (CO₂ ppm, PM2.5), polled every 4 s. */
export function useIeqLive(intervalMs = 4000) {
  return useJson('/api/v1/dashboard/ieq-live', {
    intervalMs,
    select: (d) => (d?.status === 'success' ? d : null),
  });
}

/** Controlled sustainability experiment: energy, CO₂e, water and audit savings. */
export function useSustainability() {
  return useJson('/api/v1/sustainability/experiment', { select: (d) => d?.data ?? null });
}

export const IEQ_TONE = { NORMAL: 'success', WARNING: 'warning', CRITICAL: 'danger' };
