"""BDG2 / IoT Telemetry Streamer for GreenRE Building EMS — v2.0

New in v2.0
-----------
* Emits full power-quality payload: voltage_v, current_a, power_factor,
  reactive_kvar, and demand_kw alongside reading_kwh.
* Power-quality values are physically realistic for a Malaysian commercial
  building (415 V, 50 Hz, lagging PF 0.85–0.97).
* Warm-up batch also populates PQ fields so charts have history on boot.

Features
--------
1. 24-Hour Instant Database Warm-Up on Boot (prevents blank/single-point charts)
2. Global Demo State Bus Polling (/api/v1/demo/scenario):
   - 'nominal':        Standard GreenRE compliant baseline
   - 'l14_anomaly'     (or 'cool_night_gap'): Spikes Floor L14 (AHU Damper Fault)
   - 'tropical_heatwave': High weather-driven baseline + low PF
"""

import argparse
import asyncio
import math
import os
import random
from datetime import datetime, timedelta, timezone
import httpx

DEFAULT_INGEST_URLS = [
    os.getenv("EMS_INGEST_URL", "http://localhost:5000/api/v1/telemetry/ingest"),
    "http://localhost:8000/api/v1/telemetry/ingest",
]

DEFAULT_SCENARIO_URLS = [
    "http://localhost:5000/api/v1/demo/scenario",
    "http://localhost:8000/api/v1/demo/scenario",
]

# ---------------------------------------------------------------------------
# Physical constants (Light Exchange @ 415 V, 50 Hz, 3-phase)
# ---------------------------------------------------------------------------
NOMINAL_VOLTAGE = 415.0    # line-to-line RMS, V
PHASE_VOLTAGE   = NOMINAL_VOLTAGE / math.sqrt(3)   # ≈ 239.6 V L-N
INTERVAL_MINUTES = 15.0    # BDG2 native interval — kW = kWh * (60 / interval)


def _pq_reading(
    kwh: float,
    pf: float,
    jitter: callable,
    interval_minutes: float = INTERVAL_MINUTES,
) -> dict:
    """Derive a physically consistent PQ record from energy and PF.

    Parameters
    ----------
    kwh : float         Interval energy (kWh)
    pf  : float         Target displacement power factor
    jitter : callable   Noise function
    interval_minutes    Measurement window (default 15 min)

    Returns dict with all six new fields.
    """
    # Demand (average kW over the interval)
    demand_kw = round(kwh * (60.0 / interval_minutes), 2)

    # Voltage: nominal ± 2 % (within Malaysian TNB ± 6 % tolerance)
    v = round(jitter(PHASE_VOLTAGE, pct=0.02), 1)

    # Current I = P / (V × PF)   (single-phase equivalent of 3-phase)
    if pf > 0 and v > 0:
        current_a = round(demand_kw * 1000.0 / (v * pf * math.sqrt(3)), 2)
    else:
        current_a = 0.0

    # Reactive power Q = P × tan(θ)
    theta = math.acos(max(0.01, min(pf, 1.0)))
    kvar = round(demand_kw * math.tan(theta), 2)

    return {
        "demand_kw":     demand_kw,
        "voltage_v":     v,
        "current_a":     current_a,
        "power_factor":  round(pf, 4),
        "reactive_kvar": kvar,
    }


def _jitter(base: float, pct: float = 0.03, enabled: bool = True) -> float:
    """Apply ±pct% random noise to base value."""
    if not enabled:
        return round(base, 2)
    return round(base * random.uniform(1.0 - pct, 1.0 + pct), 2)


# ---------------------------------------------------------------------------
# Floor profiles: floor_id -> (base_kwh, nominal_pf)
#
# IMPORTANT: Each floor_id must exist in the PostgreSQL floors table.
# DB mapping (from seed.py):
#   zone-a (M&E Plant):  B2, B1, LG
#   zone-b (Podium):     GF, L1, L2, L3
#   zone-c (Office):     L4-L12, L13
#   zone-d (Hyatt):      L14-L28
#   zone-e (Amenities):  L29, L30, L31
# ---------------------------------------------------------------------------
FLOOR_PROFILES = {
    # zone-a M&E Plant
    "LG":  (12.5, 0.91),   # Lower ground M&E / BOH
    # zone-b Podium
    "GF":  (48.0, 0.93),   # Ground floor lobby + retail
    # zone-c Office
    "L5":  (35.5, 0.92),   # Representative office floor
    # zone-d Hyatt Hotel
    "L14": (45.2, 0.89),   # Hyatt guest rooms
    # zone-e Amenities
    "L30": (18.1, 0.95),   # Pool / gym / spa
}

ANOMALY_PROFILES = {
    # floor_id: (anomaly_kwh, anomaly_pf)
    "LG":  (12.5, 0.91),
    "GF":  (48.0, 0.93),
    "L5":  (35.5, 0.92),
    "L14": (420.0, 0.72),  # Damper bypass -> chiller fights -> very low PF
    "L30": (18.1, 0.95),
}

HEATWAVE_PROFILES = {
    "LG":  (16.0, 0.90),
    "GF":  (54.0, 0.91),
    "L5":  (45.0, 0.90),
    "L14": (415.0, 0.74),  # Still low PF under heat stress
    "L30": (22.0, 0.93),
}



def _build_reading(
    floor_id: str,
    timestamp: str,
    kwh: float,
    pf: float,
    fluctuate: bool = True,
) -> dict:
    def j(base, pct=0.03):
        return _jitter(base, pct=pct, enabled=fluctuate)

    noisy_kwh = j(kwh)
    noisy_pf  = min(1.0, j(pf, pct=0.01))  # PF jitter is smaller

    pq = _pq_reading(noisy_kwh, noisy_pf, j)

    return {
        "timestamp":  timestamp,
        "floor_id":   floor_id,
        "meter_type": "electricity",
        "reading_kwh": noisy_kwh,
        **pq,
    }


# ---------------------------------------------------------------------------
# 24-hour warm-up
# ---------------------------------------------------------------------------

async def warmup_database(client: httpx.AsyncClient, ingest_url: str, fluctuate: bool = True):
    """Bulk-inject 24 hours of historical data with full PQ fields."""
    print("[WARMUP] Starting 24-hour historical data warm-up (with PQ fields)...")
    now = datetime.now(timezone.utc)
    warmup_payload = []

    for i in range(24, 0, -1):
        hist_time = (now - timedelta(hours=i)).isoformat().replace("+00:00", "Z")
        hour = (now.hour - i) % 24
        is_daytime = 8 <= hour <= 18
        office_mult = 2.2 if is_daytime else 1.0

        base_kwh = {
            "LG":  12.0 + (i % 3) * 0.8,
            "GF":  40.0 + (i % 6) * 1.5,
            "L5":  30.0 * office_mult + (i % 4),
            "L14": 45.0 + (i % 5) * 1.2,
            "L30": 18.0 + (i % 3) * 0.5,
        }

        for floor_id, kwh in base_kwh.items():
            nominal_pf = FLOOR_PROFILES[floor_id][1]
            warmup_payload.append(
                _build_reading(floor_id, hist_time, kwh, nominal_pf, fluctuate)
            )

    try:
        response = await client.post(ingest_url, json=warmup_payload, timeout=20.0)
        if response.status_code == 200:
            data = response.json()
            inserted = data.get("inserted_count", len(warmup_payload))
            rejected = data.get("rejected_count", 0)
            print(
                f"[WARMUP - OK] 24-hour warm-up complete! "
                f"Inserted {inserted} / Rejected {rejected} records (5 floors × 24 hours)."
            )
        else:
            print(f"[WARMUP - WARN] Response {response.status_code}: {response.text}")
    except Exception as exc:
        print(f"[WARMUP - WARN] Warning: {exc}")


# ---------------------------------------------------------------------------
# Live streaming loop
# ---------------------------------------------------------------------------

async def stream_data(url: str = None, interval: float = 5.0, fluctuate: bool = True):
    target_urls = [url] if url else DEFAULT_INGEST_URLS
    active_ingest_url = target_urls[0]

    scenario_urls = DEFAULT_SCENARIO_URLS

    print("[streamer] EMS IoT Simulator v2.0 — power-quality enabled")
    print(f"[streamer] Ingest: {active_ingest_url} | Interval: {interval}s")

    async with httpx.AsyncClient(timeout=10.0) as client:
        # Step 1: Warm-up
        await warmup_database(client, active_ingest_url, fluctuate)

        # Step 2: Live loop
        print(f"[STREAM] Entering real-time streaming mode ({interval}s ticks)...")
        while True:
            # Query current scenario
            current_mode = "nominal"
            for s_url in scenario_urls:
                try:
                    s_resp = await client.get(s_url, timeout=2.5)
                    if s_resp.status_code == 200:
                        data = s_resp.json()
                        current_mode = data.get("current_mode") or data.get("mode", "nominal")
                        break
                except Exception:
                    continue

            # Select profile set
            if current_mode in ("l14_anomaly", "cool_night_gap"):
                profiles = ANOMALY_PROFILES
                mode_label = "[ALERT - L14 ANOMALY FAULT (AHU damper bypass)]"
            elif current_mode == "tropical_heatwave":
                profiles = HEATWAVE_PROFILES
                mode_label = "[HEATWAVE - High ambient, low PF chiller stress]"
            else:
                profiles = FLOOR_PROFILES
                mode_label = "[NOMINAL - Live normal stream]"

            current_time = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
            batch_payload = []
            total_kwh = 0.0
            total_kw = 0.0

            for floor_id, (base_kwh, base_pf) in profiles.items():
                kwh_value = base_kwh
                reading = _build_reading(floor_id, current_time, kwh_value, base_pf, fluctuate)
                # Demand is derived in _pq_reading: kW = kWh * (60 / 15 min)
                batch_payload.append(reading)
                total_kwh += reading["reading_kwh"]
                total_kw += reading["demand_kw"]

            total_kwh = round(total_kwh, 1)
            total_kw = round(total_kw, 1)

            # Post telemetry
            sent = False
            for u in target_urls:
                try:
                    response = await client.post(u, json=batch_payload)
                    if response.status_code == 200:
                        data = response.json()
                        alarms = data.get("alarm_count", 0)
                        alarm_tag = f" | ⚠ {alarms} alarm(s)" if alarms else ""
                        print(
                            f"[{current_time}] {mode_label} | "
                            f"Demand: {total_kw} kW | Energy: {total_kwh} kWh | "
                            f"PF range: {min(r['power_factor'] for r in batch_payload):.3f}–"
                            f"{max(r['power_factor'] for r in batch_payload):.3f}"
                            f"{alarm_tag}"
                        )
                        target_urls = [u]
                        sent = True
                        break
                except Exception:
                    continue

            if not sent:
                print(f"[{current_time}] Connection failed. Retrying in {interval}s...")

            await asyncio.sleep(interval)


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description="GreenRE 5-Zone PQ Telemetry Streamer v2.0")
    parser.add_argument("--url", default=None, help="Backend ingestion endpoint")
    parser.add_argument("--interval", type=float, default=5.0,
                        help="Stream interval in seconds (default: 5.0)")
    parser.add_argument("--no-jitter", action="store_true",
                        help="Send fixed values without noise")
    args = parser.parse_args()

    asyncio.run(stream_data(url=args.url, interval=args.interval, fluctuate=not args.no_jitter))


if __name__ == "__main__":
    main()
