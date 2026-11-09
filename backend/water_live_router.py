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
    data["pipeline"] = ingestor.status()
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
    await websocket.accept()
    await hub.register(websocket, _bucket(bucket))
    try:
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
    except WebSocketDisconnect:
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
# Edge simulator auto-start (so local dev only needs a backend + frontend terminal)
# ---------------------------------------------------------------------------
SIMULATOR_AUTOSTART = os.getenv("WATER_SIMULATOR_AUTOSTART", "true").lower() in {"1", "true", "yes"}
SIMULATOR_PATH = os.path.abspath(
    os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "edge-simulator", "mock_water_meters.py")
)
_simulator_proc: subprocess.Popen | None = None


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
    _simulator_proc = subprocess.Popen(cmd)
    print(f"[WaterLive] Smart water meter simulator started (PID {_simulator_proc.pid}). "
          "Set WATER_SIMULATOR_AUTOSTART=false to use real meters instead.")


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
    try:
        ingestor.start()
    except Exception as exc:
        print(f"[WaterLive] MQTT ingest disabled: {exc}")
    hub.start()
    if SIMULATOR_AUTOSTART:
        try:
            _start_simulator()
        except Exception as exc:
            print(f"[WaterLive] Simulator auto-start failed: {exc}")


async def stop_water_live() -> None:
    _stop_simulator()
    await hub.stop()
    ingestor.stop()
    from water_live_db import close_store
    close_store()
