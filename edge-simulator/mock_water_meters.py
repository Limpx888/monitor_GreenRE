"""
EcoPulse Edge Simulator - Smart Water Flow Meters (MQTT)
========================================================

Simulates a building's water sub-metering network and publishes one JSON
reading per meter every ``--interval`` seconds to ``ecopulse/water/flow``.

All timestamps come from ``datetime.now()`` (live wall-clock time), never
from the historical BDG2 dataset.

Payload schema (one message per meter per tick):
    {
      "timestamp": "2026-11-08T14:03:12.481+08:00",
      "meter_id": "M-Chiller-01",
      "water_category": "Chilled/Cooling",
      "flow_rate_m3_per_hr": 1.734,
      "total_volume_m3": 18234.5521      # strictly increasing register
    }

Meter registers are persisted to ``.meter_state.json`` so that
``total_volume_m3`` keeps increasing across simulator restarts, the same
way a physical meter's register does.

Usage:
    python edge-simulator/mock_water_meters.py                 # localhost:1883
    python edge-simulator/mock_water_meters.py --host 10.0.0.5 --interval 2
    python edge-simulator/mock_water_meters.py --dry-run       # print only, no broker
    python edge-simulator/mock_water_meters.py --leak M-Irrigation   # inject a leak
"""

from __future__ import annotations

import argparse
import json
import math
import os
import random
import signal
import sys
import time
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path

DEFAULT_TOPIC = "ecopulse/water/flow"
STATE_FILE = Path(__file__).with_name(".meter_state.json")

VALID_CATEGORIES = ("General Water", "Chilled/Cooling", "Hot Water", "Irrigation", "Steam")


# ---------------------------------------------------------------------------
# Consumption profiles: hour-of-day (0-23) -> multiplier on the base flow
# ---------------------------------------------------------------------------
def _office_profile(hour: float) -> float:
    """Commercial occupancy curve: low overnight, peaks at ~10:00 and ~15:00."""
    if hour < 6 or hour >= 22:
        return 0.15
    morning = math.exp(-((hour - 10.0) ** 2) / 6.0)
    afternoon = math.exp(-((hour - 15.0) ** 2) / 8.0)
    return 0.3 + 0.9 * max(morning, afternoon)


def _cooling_profile(hour: float) -> float:
    """Cooling-tower make-up tracks the outdoor heat load, peaking mid-afternoon."""
    return 0.35 + 0.75 * max(0.0, math.sin(math.pi * (hour - 7.0) / 14.0))


def _irrigation_profile(hour: float) -> float:
    """Scheduled drip irrigation: 06:00-07:30 and 18:30-19:30, else near zero."""
    if 6.0 <= hour < 7.5 or 18.5 <= hour < 19.5:
        return 1.0
    return 0.01


def _hot_water_profile(hour: float) -> float:
    """Pantry/washroom hot water, with a lunch peak."""
    if hour < 6 or hour >= 22:
        return 0.1
    return 0.35 + 0.8 * math.exp(-((hour - 12.5) ** 2) / 3.0)


def _steam_profile(hour: float) -> float:
    """Boiler steam condensate make-up: fairly flat with an early-morning warm-up."""
    return 0.6 + 0.4 * math.exp(-((hour - 6.5) ** 2) / 2.0)


@dataclass
class Meter:
    meter_id: str
    water_category: str
    base_flow_m3_per_hr: float
    profile: callable
    noise: float = 0.08              # relative gaussian noise
    total_volume_m3: float = 0.0     # register value
    leak_m3_per_hr: float = 0.0      # injected continuous leak

    def step(self, now: datetime, dt_seconds: float) -> dict:
        hour = now.hour + now.minute / 60.0 + now.second / 3600.0
        expected = self.base_flow_m3_per_hr * self.profile(hour)
        flow = expected * (1.0 + random.gauss(0.0, self.noise)) + self.leak_m3_per_hr
        flow = max(flow, 0.0)

        # Integrate the flow into the register. Add a tiny floor so the counter
        # is strictly increasing even when the flow is ~0, the way a real
        # register creeps forward.
        self.total_volume_m3 += max(flow * dt_seconds / 3600.0, 1e-6)

        return {
            "timestamp": now.astimezone().isoformat(timespec="milliseconds"),
            "meter_id": self.meter_id,
            "water_category": self.water_category,
            "flow_rate_m3_per_hr": round(flow, 4),
            "total_volume_m3": round(self.total_volume_m3, 6),
        }


def build_meters() -> list[Meter]:
    """The building's sub-meter inventory, with realistic opening register values."""
    return [
        Meter("M-General-01", "General Water", 4.2, _office_profile, total_volume_m3=18_420.0),
        Meter("M-General-02", "General Water", 2.6, _office_profile, total_volume_m3=9_875.0),
        Meter("M-Chiller-01", "Chilled/Cooling", 1.6, _cooling_profile, total_volume_m3=6_310.0),
        Meter("M-HotWater-01", "Hot Water", 0.9, _hot_water_profile, total_volume_m3=2_145.0),
        Meter("M-Irrigation", "Irrigation", 1.8, _irrigation_profile, noise=0.04, total_volume_m3=3_560.0),
        Meter("M-Steam-01", "Steam", 0.45, _steam_profile, total_volume_m3=1_120.0),
    ]


# ---------------------------------------------------------------------------
# Register persistence (keeps total_volume_m3 strictly increasing across runs)
# ---------------------------------------------------------------------------
def load_state(meters: list[Meter]) -> None:
    if not STATE_FILE.exists():
        return
    try:
        saved = json.loads(STATE_FILE.read_text(encoding="utf-8"))
    except (OSError, ValueError) as exc:
        print(f"[sim] Ignoring unreadable state file: {exc}")
        return
    for m in meters:
        if m.meter_id in saved:
            m.total_volume_m3 = max(m.total_volume_m3, float(saved[m.meter_id]))


def save_state(meters: list[Meter]) -> None:
    tmp = STATE_FILE.with_suffix(".tmp")
    try:
        tmp.write_text(json.dumps({m.meter_id: m.total_volume_m3 for m in meters}, indent=2), encoding="utf-8")
        os.replace(tmp, STATE_FILE)
    except OSError as exc:
        print(f"[sim] Could not persist meter state: {exc}")


# ---------------------------------------------------------------------------
# MQTT
# ---------------------------------------------------------------------------
def make_client(host: str, port: int, client_id: str):
    import paho.mqtt.client as mqtt  # imported lazily so --dry-run works without paho

    client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id=client_id)

    def on_connect(_client, _userdata, _flags, reason_code, _properties):
        if reason_code == 0:
            print(f"[sim] Connected to MQTT broker {host}:{port}")
        else:
            print(f"[sim] Broker refused connection: {reason_code}")

    def on_disconnect(_client, _userdata, _flags, reason_code, _properties):
        if reason_code != 0:
            print(f"[sim] Lost broker connection ({reason_code}); paho will auto-reconnect")

    client.on_connect = on_connect
    client.on_disconnect = on_disconnect
    client.reconnect_delay_set(min_delay=1, max_delay=30)
    client.connect_async(host, port, keepalive=30)
    client.loop_start()
    return client


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="EcoPulse smart water meter MQTT simulator")
    p.add_argument("--host", default=os.getenv("MQTT_BROKER_HOST", "localhost"))
    p.add_argument("--port", type=int, default=int(os.getenv("MQTT_BROKER_PORT", "1883")))
    p.add_argument("--topic", default=os.getenv("WATER_MQTT_TOPIC", DEFAULT_TOPIC))
    p.add_argument("--interval", type=float, default=2.0, help="Seconds between ticks (default 2)")
    p.add_argument("--dry-run", action="store_true", help="Print payloads instead of publishing")
    p.add_argument("--ticks", type=int, default=0, help="Stop after N ticks (0 = run forever)")
    p.add_argument("--leak", metavar="METER_ID", help="Inject a continuous leak on this meter")
    p.add_argument("--leak-rate", type=float, default=1.5, help="Leak size in m3/hr (default 1.5)")
    p.add_argument("--quiet", action="store_true", help="Suppress periodic progress logs (used when the backend auto-starts it)")
    return p.parse_args()


def main() -> int:
    args = parse_args()
    meters = build_meters()
    load_state(meters)

    if args.leak:
        target = next((m for m in meters if m.meter_id == args.leak), None)
        if target is None:
            print(f"[sim] Unknown meter for --leak: {args.leak}. Options: {[m.meter_id for m in meters]}")
            return 2
        target.leak_m3_per_hr = args.leak_rate
        print(f"[sim] Leak injected on {target.meter_id}: +{args.leak_rate} m3/hr")

    client = None
    if not args.dry_run:
        try:
            client = make_client(args.host, args.port, f"ecopulse-edge-water-{os.getpid()}")
        except ImportError:
            print("[sim] paho-mqtt is not installed. Run: pip install 'paho-mqtt>=2.0'")
            return 1

    running = True

    def _stop(*_):
        nonlocal running
        running = False

    signal.signal(signal.SIGINT, _stop)
    signal.signal(signal.SIGTERM, _stop)

    print(f"[sim] Streaming {len(meters)} meters every {args.interval}s -> '{args.topic}'"
          f"{' (dry-run)' if args.dry_run else ''}. Ctrl+C to stop.")

    tick = 0
    last = time.monotonic()
    try:
        while running:
            now_mono = time.monotonic()
            dt = now_mono - last if tick else args.interval
            last = now_mono
            now = datetime.now()

            for meter in meters:
                payload = json.dumps(meter.step(now, dt))
                if client is None:
                    print(payload)
                else:
                    client.publish(args.topic, payload, qos=1)

            tick += 1
            # Persist every tick: on Windows the backend's terminate() is a hard
            # kill, so the finally-block save can't be relied on.
            save_state(meters)
            if tick % 5 == 0:
                if not args.quiet:
                    total = sum(m.total_volume_m3 for m in meters)
                    print(f"[sim] {now:%Y-%m-%d %H:%M:%S}  tick={tick}  building register={total:,.3f} m3")
            if args.ticks and tick >= args.ticks:
                break

            # Sleep until the next tick, but stay responsive to Ctrl+C
            deadline = now_mono + args.interval
            while running and time.monotonic() < deadline:
                time.sleep(min(0.2, max(0.0, deadline - time.monotonic())))
    finally:
        save_state(meters)
        if client is not None:
            client.loop_stop()
            client.disconnect()
        print("[sim] Stopped; meter registers saved.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
