"""BDG2 / IoT Telemetry Streamer for GreenRE Building EMS.

Features:
1. 24-Hour Instant Database Warm-Up on Boot (prevents blank/single-point charts)
2. Global Demo State Bus Polling (/api/v1/demo/scenario):
   - 'nominal': Standard GreenRE compliant baseline
   - 'l14_anomaly' (or 'cool_night_gap'): Spikes Floor L14 to 420.0 kWh (AHU Damper Fault)
   - 'tropical_heatwave': High weather-driven baseline
"""

import argparse
import asyncio
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


async def warmup_database(client: httpx.AsyncClient, ingest_url: str):
    """Instantly bulk-injects 24 hours of historical data into the database before live streaming."""
    print("[WARMUP] Starting 24-hour historical data warm-up...")
    now = datetime.now(timezone.utc)
    warmup_payload = []

    # Trace back 24 hours, generating data for 24 distinct hourly timestamps
    for i in range(24, 0, -1):
        hist_time = (now - timedelta(hours=i)).isoformat().replace("+00:00", "Z")

        # Diurnal load curve shaping for realistic historical replay
        hour = (now.hour - i) % 24
        is_daytime = 8 <= hour <= 18
        office_mult = 2.2 if is_daytime else 1.0

        warmup_payload.extend([
            {"timestamp": hist_time, "floor_id": "LG",  "meter_type": "electricity", "reading_kwh": round(12.0 + (i % 3) * 0.8, 2)},
            {"timestamp": hist_time, "floor_id": "GF",  "meter_type": "electricity", "reading_kwh": round(40.0 + (i % 6) * 1.5, 2)},
            {"timestamp": hist_time, "floor_id": "L5",  "meter_type": "electricity", "reading_kwh": round(30.0 * office_mult + (i % 4), 2)},
            {"timestamp": hist_time, "floor_id": "L14", "meter_type": "electricity", "reading_kwh": round(45.0 + (i % 5) * 1.2, 2)},
            {"timestamp": hist_time, "floor_id": "L30", "meter_type": "electricity", "reading_kwh": round(18.0 + (i % 3) * 0.5, 2)},
        ])

    try:
        response = await client.post(ingest_url, json=warmup_payload, timeout=20.0)
        if response.status_code == 200:
            print(f"[WARMUP - OK] 24-hour warm-up complete! Injected {len(warmup_payload)} records across 5 zones.")
        else:
            print(f"[WARMUP - WARN] Response {response.status_code}: {response.text}")
    except Exception as exc:
        print(f"[WARMUP - WARN] Warning: {exc}")


async def stream_data(url: str = None, interval: float = 5.0, fluctuate: bool = True):
    target_urls = [url] if url else DEFAULT_INGEST_URLS
    active_ingest_url = target_urls[0]

    scenario_urls = DEFAULT_SCENARIO_URLS
    active_scenario_url = scenario_urls[0]

    print(f"[streamer] Initializing 5-zone IoT simulator with State Bus remote control")
    print(f"[streamer] Ingest endpoint: {active_ingest_url} | Polling interval: {interval}s")

    async with httpx.AsyncClient(timeout=10.0) as client:
        # Step 1: Instant warm-up of past 24 hours
        await warmup_database(client, active_ingest_url)

        # Step 2: Continuous live streaming loop
        print(f"[STREAM] Entering real-time streaming mode ({interval}s ticks)...")
        while True:
            # 1. Query the current scenario state from FastAPI State Bus
            current_mode = "nominal"
            for s_url in scenario_urls:
                try:
                    s_resp = await client.get(s_url, timeout=2.5)
                    if s_resp.status_code == 200:
                        data = s_resp.json()
                        current_mode = data.get("current_mode") or data.get("mode", "nominal")
                        active_scenario_url = s_url
                        break
                except Exception:
                    continue

            # 2. Modulate power consumption based on active scenario
            # Dynamic jitter (+-3%) for live realism
            jitter = lambda base: round(base * (random.uniform(0.97, 1.03) if fluctuate else 1.0), 2)

            if current_mode in ("l14_anomaly", "cool_night_gap"):
                # Cool Night Anomaly: Floor L14 surges to 420 kWh due to damper bypass
                lg_kwh = jitter(12.5)
                gf_kwh = jitter(48.0)
                l5_kwh = jitter(35.5)
                l14_kwh = jitter(420.0)   # Anomalous fault spike
                l30_kwh = jitter(18.1)
                mode_label = "[ALERT - L14 ANOMALY FAULT (420.0 kWh)]"
            elif current_mode == "tropical_heatwave":
                # Tropical Heatwave: Weather-driven lift across cooling loads
                lg_kwh = jitter(16.0)
                gf_kwh = jitter(54.0)
                l5_kwh = jitter(45.0)
                l14_kwh = jitter(415.0)
                l30_kwh = jitter(22.0)
                mode_label = "[HEATWAVE - High Ambient Baseline]"
            else:
                # Nominal / Live baseline
                lg_kwh = jitter(12.5)
                gf_kwh = jitter(48.0)
                l5_kwh = jitter(35.5)
                l14_kwh = jitter(45.2)
                l30_kwh = jitter(18.1)
                mode_label = "[NOMINAL - Live Normal Stream]"

            current_time = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")

            batch_payload = [
                {"timestamp": current_time, "floor_id": "LG",  "meter_type": "electricity", "reading_kwh": lg_kwh},   # Zone 1
                {"timestamp": current_time, "floor_id": "GF",  "meter_type": "electricity", "reading_kwh": gf_kwh},   # Zone 2
                {"timestamp": current_time, "floor_id": "L5",  "meter_type": "electricity", "reading_kwh": l5_kwh},   # Zone 3
                {"timestamp": current_time, "floor_id": "L14", "meter_type": "electricity", "reading_kwh": l14_kwh},  # Zone 4
                {"timestamp": current_time, "floor_id": "L30", "meter_type": "electricity", "reading_kwh": l30_kwh},  # Zone 5
            ]

            total_batch = round(sum(p["reading_kwh"] for p in batch_payload), 1)

            # 3. Post telemetry batch to FastAPI
            sent = False
            for u in target_urls:
                try:
                    response = await client.post(u, json=batch_payload)
                    if response.status_code == 200:
                        print(f"[{current_time}] Mode: {mode_label} | Total: {total_batch} kWh -> {response.status_code}")
                        target_urls = [u]
                        sent = True
                        break
                except Exception:
                    continue

            if not sent:
                print(f"[{current_time}] Connection attempt failed to backend. Retrying in {interval}s...")

            await asyncio.sleep(interval)


def main():
    parser = argparse.ArgumentParser(description="GreenRE 5-Zone Batch Telemetry Streamer")
    parser.add_argument("--url", default=None, help="Backend ingestion endpoint")
    parser.add_argument("--interval", type=float, default=5.0, help="Stream interval in seconds (default: 5.0)")
    parser.add_argument("--no-jitter", action="store_true", help="Send fixed values without noise")
    args = parser.parse_args()

    asyncio.run(stream_data(url=args.url, interval=args.interval, fluctuate=not args.no_jitter))


if __name__ == "__main__":
    main()
