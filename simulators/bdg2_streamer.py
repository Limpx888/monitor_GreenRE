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
import time
from datetime import datetime, timedelta, timezone
import httpx

DEFAULT_INGEST_URLS = [
    os.getenv("EMS_INGEST_URL", "http://localhost:5000/api/v1/telemetry/ingest"),
    "http://localhost:8000/api/v1/telemetry/ingest",
]

DEFAULT_SENSOR_INGEST_URLS = [
    os.getenv("EMS_SENSOR_INGEST_URL", "http://localhost:5000/api/v1/telemetry/ingest_sensor"),
    "http://localhost:8000/api/v1/telemetry/ingest_sensor",
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

OFFICE_VAV_ANOMALY_PROFILES = {
    "LG":  (15.0, 0.90),
    "GF":  (48.0, 0.93),
    "L5":  (145.0, 0.78),  # Office VAV damper stuck -> reheat runaway
    "L14": (45.2, 0.89),
    "L30": (18.1, 0.95),
}

PODIUM_LIGHTING_ANOMALY_PROFILES = {
    "LG":  (12.5, 0.91),
    "GF":  (115.0, 0.82),  # Concourse/Ballroom lights & AHU locked on past hours
    "L5":  (35.5, 0.92),
    "L14": (45.2, 0.89),
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
# IoT Sensor Telemetry Generator
# ---------------------------------------------------------------------------

IEQ_FLOORS = ["LG", "GF", "L2", "L5", "L8", "L14", "L30"]

def generate_iot_sensor_payload(current_mode: str = "nominal", now: datetime = None) -> list:
    """Generate fine-grained IoT sensor telemetry for each floor.

    Pushes:
    - CO2 (ppm) for each floor (surges to ~1500 ppm on L8 during ieq_co2_spike)
    - PM2.5 (ug/m3) for each floor
    - Occupancy, Water Flow, and Vibration on targeted zones
    """
    if now is None:
        now = datetime.now()
    current_hour = now.hour
    is_office_hours = 9 <= current_hour <= 18
    timestamp_str = now.isoformat()
    payload = []

    # Floor-specific base definitions
    floor_base_co2 = {
        "LG": 480.0,
        "GF": 750.0 if is_office_hours else 430.0,
        "L2": 720.0 if is_office_hours else 420.0,
        "L5": 680.0 if is_office_hours else 410.0,
        "L8": 760.0 if is_office_hours else 420.0,
        "L14": 640.0 if is_office_hours else 690.0,
        "L30": 550.0 if is_office_hours else 430.0,
    }

    floor_base_pm25 = {
        "LG": 18.0,
        "GF": 16.5,
        "L2": 14.0,
        "L5": 11.5,
        "L8": 12.0,
        "L14": 9.5,
        "L30": 8.0,
    }

    for f in IEQ_FLOORS:
        base_co2 = floor_base_co2.get(f, 600.0)
        base_pm25 = floor_base_pm25.get(f, 12.0)

        # Scenario Modifiers
        if current_mode == "ieq_co2_spike" and f == "L8":
            # 2 PM high-occupancy meeting with starved 15% fresh air damper
            co2_val = round(1500.0 + random.uniform(-25.0, 35.0), 1)
            pm25_val = round(24.0 + random.uniform(-1.5, 2.5), 1)
        elif current_mode in ("l8_anomaly", "office_vav_fault") and f == "L8":
            co2_val = round(1280.0 + random.uniform(-30.0, 40.0), 1)
            pm25_val = round(base_pm25 + random.uniform(3.0, 6.0), 1)
        elif current_mode == "tropical_heatwave":
            co2_val = round(base_co2 + random.uniform(-20.0, 50.0), 1)
            pm25_val = round(base_pm25 + random.uniform(8.0, 15.0), 1)  # external haze
        else:
            co2_val = round(base_co2 + random.uniform(-30.0, 40.0), 1)
            pm25_val = round(base_pm25 + random.uniform(-1.5, 2.0), 1)

        payload.append({"floor_id": f, "sensor_type": "CO2", "value": co2_val, "timestamp": timestamp_str})
        payload.append({"floor_id": f, "sensor_type": "PM2.5", "value": max(1.0, pm25_val), "timestamp": timestamp_str})

    # Occupancy - L2 Ballroom
    occupancy_value = 1.0 if (is_office_hours and random.random() > 0.3) else 0.0
    payload.append({"floor_id": "L2", "sensor_type": "OCCUPANCY", "value": occupancy_value, "timestamp": timestamp_str})

    # Water flow - L2 Podium
    water_flow = random.uniform(5.0, 15.0)
    if random.random() > 0.95:  # 5% probability of a leak surge
        water_flow = random.uniform(80.0, 120.0)
    payload.append({"floor_id": "L2", "sensor_type": "WATER_FLOW", "value": round(water_flow, 1), "timestamp": timestamp_str})

    # Mechanical vibration - LG M&E Chiller
    vibration_hz = 50.0 + math.sin(time.time() / 10.0) * 2.0 + random.uniform(-0.5, 0.5)
    if current_mode == "tropical_heatwave":
        vibration_hz += random.uniform(2.0, 4.0)
    payload.append({"floor_id": "LG", "sensor_type": "VIBRATION", "value": round(vibration_hz, 2), "timestamp": timestamp_str})

    return payload


# ---------------------------------------------------------------------------
# 24-hour warm-up
# ---------------------------------------------------------------------------

async def warmup_database(client: httpx.AsyncClient, ingest_url: str, fluctuate: bool = True):
    """Bulk-inject 24 hours of historical data with full PQ fields & sensor telemetry."""
    print("[WARMUP] Starting 24-hour historical data warm-up (with PQ & IEQ sensor fields)...")
    now = datetime.now(timezone.utc)
    warmup_payload = []
    sensor_warmup_payload = []

    for i in range(24, 0, -1):
        hist_dt = now - timedelta(hours=i)
        hist_time = hist_dt.isoformat().replace("+00:00", "Z")
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

        # Historical IoT sensor readings for all floors
        for f in IEQ_FLOORS:
            f_base_co2 = 720.0 if (is_daytime and f in ("L5", "L8", "GF", "L2")) else 420.0
            sensor_warmup_payload.append({
                "floor_id": f,
                "sensor_type": "CO2",
                "value": round(f_base_co2 + random.uniform(-30, 60), 1),
                "timestamp": hist_time
            })
            sensor_warmup_payload.append({
                "floor_id": f,
                "sensor_type": "PM2.5",
                "value": round(12.0 + random.uniform(-2, 4), 1),
                "timestamp": hist_time
            })

        sensor_warmup_payload.extend([
            {"floor_id": "L2", "sensor_type": "OCCUPANCY", "value": 1.0 if (is_daytime and random.random() > 0.4) else 0.0, "timestamp": hist_time},
            {"floor_id": "L2", "sensor_type": "WATER_FLOW", "value": round(random.uniform(5.0, 15.0), 1), "timestamp": hist_time},
            {"floor_id": "LG", "sensor_type": "VIBRATION", "value": round(50.0 + random.uniform(-0.6, 0.6), 2), "timestamp": hist_time},
        ])


    # Ingest meter readings
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

    # Ingest sensor readings
    sensor_url = ingest_url.replace("/telemetry/ingest", "/telemetry/ingest_sensor")
    try:
        s_resp = await client.post(sensor_url, json=sensor_warmup_payload, timeout=20.0)
        if s_resp.status_code == 200:
            s_data = s_resp.json()
            print(f"[WARMUP - OK] IoT Sensor telemetry warm-up complete ({s_data.get('inserted_count', len(sensor_warmup_payload))} records).")
    except Exception as exc:
        print(f"[WARMUP - WARN] IoT sensor warm-up skipped: {exc}")


# ---------------------------------------------------------------------------
# Live streaming loop
# ---------------------------------------------------------------------------

async def stream_data(url: str = None, interval: float = 5.0, fluctuate: bool = True):
    target_urls = [url] if url else DEFAULT_INGEST_URLS
    active_ingest_url = target_urls[0]

    scenario_urls = DEFAULT_SCENARIO_URLS

    print("[streamer] EMS IoT Simulator v2.0 — power-quality & IoT sensors enabled")
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
                mode_label = "[ALERT - L14 HOTEL ANOMALY (AHU damper bypass)]"
            elif current_mode in ("l8_anomaly", "office_vav_fault"):
                profiles = OFFICE_VAV_ANOMALY_PROFILES
                mode_label = "[ALERT - L8 OFFICE ANOMALY (VAV reheat runaway)]"
            elif current_mode in ("l2_anomaly", "podium_lighting_fault"):
                profiles = PODIUM_LIGHTING_ANOMALY_PROFILES
                mode_label = "[ALERT - L2 PODIUM ANOMALY (Lighting schedule override)]"
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

            # Generate fine-grained IoT sensor telemetry
            sensor_payload = generate_iot_sensor_payload(current_mode=current_mode)

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

                        # Post IoT sensor telemetry
                        sensor_url = u.replace("/telemetry/ingest", "/telemetry/ingest_sensor")
                        try:
                            s_resp = await client.post(sensor_url, json=sensor_payload, timeout=5.0)
                            if s_resp.status_code == 200:
                                co2_val = next((s["value"] for s in sensor_payload if s["sensor_type"] == "CO2"), 0)
                                vib_val = next((s["value"] for s in sensor_payload if s["sensor_type"] == "VIBRATION"), 0)
                                print(f"  └─ [IoT Telemetry] 4 sensors ingested | CO2: {co2_val} ppm | Vib: {vib_val} Hz")
                        except Exception as s_err:
                            print(f"  └─ [IoT Telemetry] Notice: {s_err}")

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
