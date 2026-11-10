"""
Live water metrics over WebSocket.

    WS  /ws/water-metrics?bucket=1|5     pushes a snapshot every BROADCAST_INTERVAL seconds
    GET /api/water/live/snapshot         the same payload, one-shot (debugging / first paint)
    GET /api/water/live/status           MQTT ingest health

A single broadcaster task runs the DuckDB queries once per tick for each
bucket size in use (not once per client) via ``asyncio.to_thread``, then fans
the result out to every subscribed socket. Clients can switch bucket size
by sending ``{"bucket": 5}``.
"""

from __future__ import annotations

import asyncio
import contextlib
import json
import os
import subprocess
import sys
import time
from datetime import datetime, timedelta

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect

from water_live_db import ALLOWED_BUCKETS, get_store
from water_mqtt import ingestor

BROADCAST_INTERVAL = float(os.getenv("WATER_WS_INTERVAL", "2.0"))
SEND_TIMEOUT = 5.0

router = APIRouter(tags=["Water Live"])


def _bucket(value) -> int:
    try:
        v = int(value)
    except (TypeError, ValueError):
        return 1
    return v if v in ALLOWED_BUCKETS else 1


async def _build_snapshot(bucket: int) -> dict:
    data = await asyncio.to_thread(get_store().snapshot, bucket)
    pipe_status = ingestor.status()
    # If native in-process streaming is active, report connected status
    if _in_process_stream_task and not _in_process_stream_task.done():
        pipe_status["connected"] = True
        pipe_status["broker"] = "In-Process Edge Streamer"
    data["pipeline"] = pipe_status
    return data


class WaterMetricsHub:
    def __init__(self):
        self.clients: dict[WebSocket, int] = {}
        self._task: asyncio.Task | None = None

    async def register(self, ws: WebSocket, bucket: int) -> None:
        self.clients[ws] = bucket
        await self._send(ws, json.dumps(await _build_snapshot(bucket), default=str))  # immediate first paint

    def unregister(self, ws: WebSocket) -> None:
        self.clients.pop(ws, None)

    async def _send(self, ws: WebSocket, text: str) -> None:
        try:
            await asyncio.wait_for(ws.send_text(text), timeout=SEND_TIMEOUT)
        except Exception:
            self.unregister(ws)

    async def _run(self) -> None:
        while True:
            await asyncio.sleep(BROADCAST_INTERVAL)
            if not self.clients:
                continue
            try:
                for bucket in set(self.clients.values()):
                    text = json.dumps(await _build_snapshot(bucket), default=str)
                    targets = [ws for ws, b in list(self.clients.items()) if b == bucket]
                    await asyncio.gather(*(self._send(ws, text) for ws in targets))
            except Exception as exc:  # keep broadcasting even if one tick fails
                print(f"[WaterWS] broadcast tick failed: {exc}")

    def start(self) -> None:
        if self._task is None or self._task.done():
            self._task = asyncio.create_task(self._run(), name="water-metrics-broadcaster")

    async def stop(self) -> None:
        if self._task:
            self._task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await self._task
            self._task = None


hub = WaterMetricsHub()


@router.websocket("/ws/water-metrics")
async def water_metrics_ws(websocket: WebSocket, bucket: int = 1):
    try:
        await websocket.accept()
        await hub.register(websocket, _bucket(bucket))
        while True:
            # The only client -> server message is a bucket change: {"bucket": 5}
            msg = await websocket.receive_text()
            try:
                new_bucket = _bucket(json.loads(msg).get("bucket"))
            except (ValueError, AttributeError):
                continue
            if websocket in hub.clients:
                hub.clients[websocket] = new_bucket
                await hub._send(websocket, json.dumps(await _build_snapshot(new_bucket), default=str))
    except (WebSocketDisconnect, Exception):
        pass
    finally:
        hub.unregister(websocket)


@router.get("/api/water/live/snapshot")
async def water_live_snapshot(bucket: int = Query(1)):
    return await _build_snapshot(_bucket(bucket))


@router.get("/api/water/live/status")
async def water_live_status():
    return ingestor.status()


# ---------------------------------------------------------------------------
# Edge simulator & Direct in-process telemetry generation
# ---------------------------------------------------------------------------
SIMULATOR_AUTOSTART = os.getenv("WATER_SIMULATOR_AUTOSTART", "true").lower() in {"1", "true", "yes"}
SIMULATOR_PATH = os.path.abspath(
    os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "edge-simulator", "mock_water_meters.py")
)
_simulator_proc: subprocess.Popen | None = None
_in_process_stream_task: asyncio.Task | None = None


def seed_historical_water_telemetry(hours: int = 24) -> None:
    """Pre-seed 24 hours of realistic water readings so the dashboard charts are immediately full on launch."""
    store = get_store()
    with store._lock:
        existing = store._con.execute(
            "SELECT count(*) FROM water_telemetry WHERE ts >= ?",
            [datetime.now() - timedelta(hours=hours)],
        ).fetchone()[0]

    if existing >= 50:
        return

    edge_sim_dir = os.path.abspath(
        os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "edge-simulator")
    )
    if edge_sim_dir not in sys.path:
        sys.path.insert(0, edge_sim_dir)

    try:
        import mock_water_meters as m
        meters = m.build_meters()
        now = datetime.now()
        # Seed 288 5-minute ticks over the past 24 hours
        for step in range(288, 0, -1):
            t = now - timedelta(minutes=step * 5)
            for meter in meters:
                reading = meter.step(t, 300.0)
                store.insert_reading(reading)
        print("✅ [WaterLive] Successfully seeded 24h of water telemetry into DuckDB.")
    except Exception as exc:
        print(f"⚠️ [WaterLive] Failed to pre-seed water telemetry: {exc}")


async def _run_in_process_water_stream() -> None:
    """Generates continuous live water readings every 2s directly into DuckDB without requiring an external MQTT broker."""
    edge_sim_dir = os.path.abspath(
        os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "edge-simulator")
    )
    if edge_sim_dir not in sys.path:
        sys.path.insert(0, edge_sim_dir)

    try:
        import mock_water_meters as m
        meters = m.build_meters()
    except Exception as exc:
        print(f"⚠️ [WaterLive] In-process meter loader error: {exc}")
        return

    store = get_store()
    interval = float(os.getenv("WATER_SIMULATOR_INTERVAL", "2.0"))
    last = time.monotonic()
    print("🚀 [WaterLive] In-process smart water meter streamer active (ticking every 2s).")

    while True:
        await asyncio.sleep(interval)
        now_mono = time.monotonic()
        dt = now_mono - last
        last = now_mono
        now = datetime.now()
        for meter in meters:
            try:
                reading = meter.step(now, dt)
                store.insert_reading(reading)
            except Exception:
                pass


def _start_simulator() -> None:
    global _simulator_proc
    if not os.path.exists(SIMULATOR_PATH):
        print(f"[WaterLive] Simulator not found: {SIMULATOR_PATH}")
        return
    cmd = [
        sys.executable, SIMULATOR_PATH, "--quiet",
        "--host", ingestor.host, "--port", str(ingestor.port), "--topic", ingestor.topic,
        "--interval", os.getenv("WATER_SIMULATOR_INTERVAL", "2"),
    ]
    try:
        _simulator_proc = subprocess.Popen(cmd)
        print(f"[WaterLive] Smart water meter simulator started (PID {_simulator_proc.pid}).")
    except Exception as exc:
        print(f"[WaterLive] Subprocess simulator launch skipped: {exc}")


def _stop_simulator() -> None:
    global _simulator_proc
    if _simulator_proc and _simulator_proc.poll() is None:
        _simulator_proc.terminate()
        try:
            _simulator_proc.wait(timeout=5)
        except subprocess.TimeoutExpired:
            _simulator_proc.kill()
        print("[WaterLive] Smart water meter simulator stopped.")
    _simulator_proc = None


async def start_water_live() -> None:
    """Called from main.py lifespan."""
    global _in_process_stream_task

    # 1. Pre-seed 24h historical telemetry if DuckDB is empty
    seed_historical_water_telemetry(hours=24)

    # 2. Try MQTT ingestor (for production MQTT brokers)
    try:
        ingestor.start()
    except Exception as exc:
        print(f"[WaterLive] MQTT ingest disabled: {exc}")

    # 3. Start WebSocket broadcaster
    hub.start()

    # 4. Start in-process simulator stream (guaranteed live data without external broker)
    if SIMULATOR_AUTOSTART:
        _in_process_stream_task = asyncio.create_task(_run_in_process_water_stream())


async def stop_water_live() -> None:
    global _in_process_stream_task
    if _in_process_stream_task:
        _in_process_stream_task.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await _in_process_stream_task
        _in_process_stream_task = None

    _stop_simulator()
    await hub.stop()
    ingestor.stop()
    from water_live_db import close_store
    close_store()
