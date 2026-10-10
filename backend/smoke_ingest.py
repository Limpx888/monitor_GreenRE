"""One-shot ingest of a BDG2-shaped hour so aggregation APIs have data."""

from datetime import datetime, timezone

from database import SessionLocal
from ems_service import ingest_readings, zone_consumption
from schemas import TelemetryReading

SAMPLE = [
    ("B2", 24.0),
    ("B1", 24.0),
    ("LG", 24.0),
    ("GF", 80.0),
    ("L1", 80.0),
    ("L2", 80.0),
    ("L3", 80.0),
    ("L4", 35.0),
    ("L14", 45.2),
    ("L15", 28.0),
    ("L29", 20.0),
]


def main():
    db = SessionLocal()
    try:
        ts = datetime(2026, 10, 9, 8, 0, tzinfo=timezone.utc)
        items = [
            TelemetryReading(
                timestamp=ts,
                floor_id=code,
                meter_type="electricity",
                reading_kwh=kwh,
            )
            for code, kwh in SAMPLE
        ]
        count = ingest_readings(db, items)
        summary = zone_consumption(db)
        print(f"ingested={count} building_eei={summary.building_eei_kwh_m2_yr} status={summary.building_compliance_status}")
        for zone in summary.zones:
            print(
                f"  {zone.code} {zone.name}: {zone.energy_kwh} kWh "
                f"EEI={zone.eei_kwh_m2_yr} {zone.compliance_status}"
            )
    finally:
        db.close()


if __name__ == "__main__":
    main()
