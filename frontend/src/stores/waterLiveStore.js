import { create } from 'zustand';

/**
 * Live water telemetry store.
 *
 * Owns a single WebSocket to /ws/water-metrics (proxied by Vite to the backend)
 * and keeps the latest snapshot pushed by the server every ~2 s:
 *   kpi          { total_volume_m3, total_flow_m3_per_hr, active_meters, last_reading_at, volume_window_m3 }
 *   distribution [{ meter_type, water_category, volume_m3, current_flow_m3_per_hr, register_m3 }]
 *   timeSeries   [{ timestamp, general_water, chilled_water, hot_water, irrigation, steam }]
 *   pipeline     MQTT ingest health from the backend
 *
 * Components call connect()/disconnect() on mount/unmount. The calls are
 * ref-counted, so React StrictMode double-mounts and multiple consumers share
 * one socket.
 */

const WS_PATH = '/ws/water-metrics';
const MAX_BACKOFF_MS = 15000;

let socket = null;
let refCount = 0;
let retryTimer = null;
let backoff = 1000;

function wsUrl(bucket) {
  const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
  return `${proto}://${window.location.host}${WS_PATH}?bucket=${bucket}`;
}

export const useWaterLiveStore = create((set, get) => {
  const open = () => {
    clearTimeout(retryTimer);
    set({ status: 'connecting' });
    const ws = new WebSocket(wsUrl(get().bucket));
    socket = ws;

    ws.onopen = () => {
      backoff = 1000;
      set({ status: 'open', error: null });
    };

    ws.onmessage = (event) => {
      let msg;
      try {
        msg = JSON.parse(event.data);
      } catch {
        return;
      }
      if (msg.type !== 'water_metrics') return;
      set({
        kpi: msg.kpi,
        distribution: msg.distribution || [],
        timeSeries: msg.time_series || [],
        pipeline: msg.pipeline || null,
        bucket: msg.bucket_minutes ?? get().bucket,
        windowHours: msg.window_hours,
        lastUpdate: msg.generated_at,
      });
    };

    ws.onerror = () => set({ error: 'WebSocket error' });

    ws.onclose = () => {
      if (socket !== ws) return; // superseded or intentionally closed
      socket = null;
      if (refCount > 0) {
        set({ status: 'reconnecting' });
        retryTimer = setTimeout(open, backoff);
        backoff = Math.min(backoff * 2, MAX_BACKOFF_MS);
      } else {
        set({ status: 'closed' });
      }
    };
  };

  return {
    status: 'idle', // idle | connecting | open | reconnecting | closed
    error: null,
    bucket: 1, // tumbling window size in minutes (1 or 5)
    windowHours: 24,
    kpi: null,
    distribution: [],
    timeSeries: [],
    pipeline: null,
    lastUpdate: null,

    connect: () => {
      refCount += 1;
      if (!socket && refCount === 1) open();
    },

    disconnect: () => {
      refCount = Math.max(0, refCount - 1);
      if (refCount === 0) {
        clearTimeout(retryTimer);
        const ws = socket;
        socket = null;
        ws?.close();
        set({ status: 'closed' });
      }
    },

    setBucket: (bucket) => {
      set({ bucket });
      if (socket?.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ bucket }));
      }
    },
  };
});
