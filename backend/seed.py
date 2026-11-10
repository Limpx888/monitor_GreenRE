"""Idempotent seed of 5 GreenRE zones, Light Exchange floor bindings,
TNB Schedule D TOU tariff rates, and zone demand thresholds.

Floor-to-zone mapping lives in Postgres so reallocating L13 (or any floor)
is a zone_id update, not a code change.
"""

from datetime import datetime, timedelta, timezone
import random
from sqlalchemy import func
from db_models import Floor, MeterReading, TouTariffRate, Zone
from database import SessionLocal, engine, Base
from ems_service import _aware


ZONES = [
    {
        "code": "zone-a",
        "name": "M&E Plant",
        "floors_label": "B2–LG",
        "area_m2": 4500.0,
        "eei_baseline_kwh_m2_yr": 300.0,
    },
    {
        "code": "zone-b",
        "name": "Podium Commercial & Public Area GF-L3",
        "floors_label": "GF–L3",
        "area_m2": 12000.0,
        "eei_baseline_kwh_m2_yr": 150.0,
    },
    {
        "code": "zone-c",
        "name": "Office Area",
        "floors_label": "L4–L12",
        "area_m2": 18000.0,
        "eei_baseline_kwh_m2_yr": 150.0,
    },
    {
        "code": "zone-d",
        "name": "Hyatt Hotel Guest Rooms",
        "floors_label": "L14–L28",
        "area_m2": 25000.0,
        "eei_baseline_kwh_m2_yr": 250.0,
    },
    {
        "code": "zone-e",
        "name": "Amenities",
        "floors_label": "L29–L31",
        "area_m2": 4000.0,
        "eei_baseline_kwh_m2_yr": 180.0,
    },
]


def _floor_rows():
    me = [("B2", "Basement 2 carpark / plant"), ("B1", "Basement 1 carpark"), ("LG", "Lower ground M&E / BOH")]
    podium = [
        ("GF", "Ground floor lobby"),
        ("L1", "Level 1 dining / retail link"),
        ("L2", "Level 2 ballroom / meeting"),
        ("L3", "Level 3 restaurant"),
    ]
    office = [(f"L{n}", f"Office floor L{n}") for n in range(4, 13)]
    transfer = [("L13", "M&E transfer floor")]
    hotel = [(f"L{n}", f"Hyatt guest rooms L{n}") for n in range(14, 29)]
    amenities = [
        ("L29", "Executive lounge & restaurant"),
        ("L30", "Pool / gym / spa"),
        ("L31", "Sky bar / plant"),
    ]
    return {
        "zone-a": me,
        "zone-b": podium,
        "zone-c": office + transfer,
        "zone-d": hotel,
        "zone-e": amenities,
    }


def seed_physical_mapping(db=None):
    own_session = db is None
    if own_session:
        Base.metadata.create_all(bind=engine)
        db = SessionLocal()
    try:
        existing_zones = {z.code: z for z in db.query(Zone).all()}
        code_to_zone = {}
        for spec in ZONES:
            zone = existing_zones.get(spec["code"])
            if zone is None:
                zone = Zone(**spec)
                db.add(zone)
                db.flush()
            else:
                zone.name = spec["name"]
                zone.floors_label = spec["floors_label"]
                zone.area_m2 = spec["area_m2"]
                zone.eei_baseline_kwh_m2_yr = spec["eei_baseline_kwh_m2_yr"]
            code_to_zone[spec["code"]] = zone

        db.flush()

        existing_floors = {f.code: f for f in db.query(Floor).all()}
        for zone_code, floors in _floor_rows().items():
            zone = code_to_zone[zone_code]
            for code, name in floors:
                floor = existing_floors.get(code)
                if floor is None:
                    db.add(Floor(code=code, name=name, zone_id=zone.id))
                else:
                    floor.name = name
                    # Preserve existing zone_id so ops can reallocate L13 without reseeding.
                    if floor.zone_id is None:
                        floor.zone_id = zone.id

        db.commit()
        print("[seed] Zones and floors ready (L4-L12 Office, L14-L28 Hyatt).")
    except Exception:
        db.rollback()
        raise
    finally:
        if own_session:
            db.close()


# ---------------------------------------------------------------------------
# TNB Malaysia Schedule D TOU Tariff Rates (approximate 2024)
# day_mask: Mon=1, Tue=2, Wed=4, Thu=8, Fri=16, Sat=32, Sun=64
# ---------------------------------------------------------------------------
_EPOCH = datetime(2024, 1, 1, tzinfo=timezone.utc)

TOU_RATES = [
    {
        "name": "Weekday Peak",
        "tariff_schedule": "TNB_ScheduleD",
        "day_mask": 31,          # Mon–Fri
        "hour_start": 8,
        "hour_end": 21,
        "rate_per_kwh": 0.337,
        "demand_charge_per_kw": 30.30,
        "currency": "MYR",
        "valid_from": _EPOCH,
        "valid_until": None,
        "is_active": True,
    },
    {
        "name": "Weekday Off-Peak",
        "tariff_schedule": "TNB_ScheduleD",
        "day_mask": 31,          # Mon–Fri
        "hour_start": 22,
        "hour_end": 7,
        "rate_per_kwh": 0.219,
        "demand_charge_per_kw": None,
        "currency": "MYR",
        "valid_from": _EPOCH,
        "valid_until": None,
        "is_active": True,
    },
    {
        "name": "Weekend / Public Holiday",
        "tariff_schedule": "TNB_ScheduleD",
        "day_mask": 96,          # Sat=32 + Sun=64
        "hour_start": 0,
        "hour_end": 23,
        "rate_per_kwh": 0.219,
        "demand_charge_per_kw": None,
        "currency": "MYR",
        "valid_from": _EPOCH,
        "valid_until": None,
        "is_active": True,
    },
]

# Per-zone demand thresholds (kW) — alert fires if 15-min demand exceeds this
_DEMAND_THRESHOLDS = {
    "zone-a": 200.0,   # M&E Plant
    "zone-b": 500.0,   # Podium
    "zone-c": 400.0,   # Offices
    "zone-d": 600.0,   # Hyatt Hotel
    "zone-e": 150.0,   # Amenities
}


def seed_tou_tariff(db=None):
    """Idempotently seed TNB Schedule D TOU rates."""
    own_session = db is None
    if own_session:
        db = SessionLocal()
    try:
        for spec in TOU_RATES:
            existing = (
                db.query(TouTariffRate)
                .filter(
                    TouTariffRate.name == spec["name"],
                    TouTariffRate.tariff_schedule == spec["tariff_schedule"],
                )
                .first()
            )
            if existing is None:
                db.add(TouTariffRate(**spec))
        db.commit()
        print("[seed] TNB Schedule D TOU tariff rates ready.")
    except Exception:
        db.rollback()
        raise
    finally:
        if own_session:
            db.close()


def seed_demand_thresholds(db=None):
    """Patch zone demand_threshold_kw values."""
    own_session = db is None
    if own_session:
        db = SessionLocal()
    try:
        for code, threshold in _DEMAND_THRESHOLDS.items():
            zone = db.query(Zone).filter(Zone.code == code).first()
            if zone and (zone.demand_threshold_kw is None or zone.demand_threshold_kw != threshold):
                zone.demand_threshold_kw = threshold
        db.commit()
        print("[seed] Zone demand thresholds patched.")
    except Exception:
        db.rollback()
        raise
    finally:
        if own_session:
            db.close()


def seed_meter_telemetry(db=None, force: bool = False):
    """Seed 24-48 hours of realistic electrical smart-meter telemetry for all 35 floors."""
    own_session = db is None
    if own_session:
        db = SessionLocal()
    try:
        now = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)
        # Check if we already have recent readings
        latest_ts = db.query(func.max(MeterReading.timestamp)).filter(MeterReading.meter_type == "electricity").scalar()
        if not force and latest_ts and (now - _aware(latest_ts)).total_seconds() < 3600 * 24:
            print("[seed] Electrical smart-meter telemetry is up-to-date.")
            return

        floors = db.query(Floor).all()
        if not floors:
            return

        base_kwh_by_zone = {
            1: 42.0,  # Zone 1 (B2-LG, 3 floors): ~1,000 kWh/day/floor -> EEI ~260 vs 300
            2: 45.0,  # Zone 2 (GF-L3, 4 floors): ~1,085 kWh/day/floor -> EEI ~140 vs 150
            3: 25.0,  # Zone 3 (L4-L13, 10 floors): ~610 kWh/day/floor -> EEI ~130 vs 150
            4: 40.0,  # Zone 4 (L14-L28, 15 floors): ~960 kWh/day/floor -> EEI ~225 vs 250
            5: 23.0,  # Zone 5 (L29-L31, 3 floors): ~555 kWh/day/floor -> EEI ~160 vs 180
        }

        diurnal = [
            0.65, 0.60, 0.58, 0.57, 0.60, 0.70, 0.85, 1.10,
            1.30, 1.40, 1.45, 1.48, 1.40, 1.38, 1.45, 1.42,
            1.35, 1.25, 1.10, 0.95, 0.85, 0.78, 0.72, 0.68
        ]

        readings = []
        for h in range(24):
            ts = now - timedelta(hours=(23 - h))
            mult = diurnal[ts.hour]
            for f in floors:
                exists = db.query(MeterReading.id).filter(
                    MeterReading.timestamp == ts,
                    MeterReading.floor_id == f.id,
                    MeterReading.meter_type == "electricity"
                ).first()
                if exists:
                    continue

                base = base_kwh_by_zone.get(f.zone_id, 30.0)
                kwh = round(base * mult * (0.95 + 0.1 * random.random()), 2)
                demand = round(kwh * 1.2, 2)
                pf = round(0.94 + 0.04 * random.random(), 3)
                readings.append(MeterReading(
                    timestamp=ts,
                    floor_id=f.id,
                    meter_type="electricity",
                    reading_kwh=kwh,
                    demand_kw=demand,
                    voltage_v=round(240.0 + random.uniform(-0.8, 0.8), 1),
                    current_a=round(demand * 1.4, 1),
                    power_factor=pf,
                    reactive_kvar=round(demand * 0.28, 1),
                    quality_status="LIVE"
                ))

        if readings:
            db.bulk_save_objects(readings)
            db.commit()
            print(f"[seed] Seeded {len(readings)} electrical meter readings for GreenRE EE compliance.")
    except Exception:
        db.rollback()
        raise
    finally:
        if own_session:
            db.close()


def seed_control_audit_logs(db=None):
    """Seed sample verified autonomous BACnet closed-loop operations logs."""
    from control_adapters import ControlAuditLog
    own_session = db is None
    if own_session:
        db = SessionLocal()
    try:
        count = db.query(ControlAuditLog).count()
        if count > 0:
            return

        now = datetime.now(timezone.utc)
        sample_logs = [
            ControlAuditLog(
                dispatched_at=now - timedelta(hours=2, minutes=15),
                command="hvac_damper_override",
                target_type="zone",
                target_id=4,
                requested_value="15% -> 50% fresh air damper",
                confirmed_value="50%",
                protocol="bacnet_ip",
                success=1,
                latency_ms=48.2,
                operator="Auto-Remediation (RAG Agent)",
                message="RAG engine localized AHU-14 damper stuck closed (15%), preventing continuous chiller reheat fighting. 8 hrs diagnosis saved @ RM 50/hr (+RM 400.00)"
            ),
            ControlAuditLog(
                dispatched_at=now - timedelta(days=2, hours=4),
                command="water_pressure_modulate",
                target_type="zone",
                target_id=2,
                requested_value="PRV-02 3.2 bar -> 2.6 bar",
                confirmed_value="2.6 bar",
                protocol="modbus_tcp",
                success=1,
                latency_ms=62.1,
                operator="Auto-Remediation (Water Sentinel)",
                message="Smart pressure differential identified micro-leak on Podium L2 riser before pipe burst. 35.4 m³ saved @ RM 2.27/m³ (+RM 80.50)"
            ),
            ControlAuditLog(
                dispatched_at=now - timedelta(days=4, hours=1),
                command="vav_static_pressure_setback",
                target_type="zone",
                target_id=3,
                requested_value="380 Pa -> 260 Pa",
                confirmed_value="260 Pa",
                protocol="bacnet_ip",
                success=1,
                latency_ms=39.5,
                operator="Auto-Remediation (Energy Dispatch)",
                message="Occupancy correlation lowered after-hours static pressure setpoint on L5-L8 commercial offices. 560 kWh saved @ RM 0.509/kWh (+RM 285.04)"
            ),
            ControlAuditLog(
                dispatched_at=now - timedelta(days=6, hours=8),
                command="compactor_schedule_optimize",
                target_type="device",
                target_id=1,
                requested_value="Fill threshold 94%",
                confirmed_value="94%",
                protocol="rest_api",
                success=1,
                latency_ms=115.0,
                operator="Auto-Remediation (Waste Loop)",
                message="Smart bin fill-level optimization dispatched compactors at 94% threshold, reducing haulage frequency. 2 haul trips avoided (+RM 420.00)"
            ),
            ControlAuditLog(
                dispatched_at=now - timedelta(days=10, hours=3),
                command="chiller_staged_setpoint",
                target_type="device",
                target_id=1,
                requested_value="CHW 6.8°C -> 7.8°C",
                confirmed_value="7.8°C",
                protocol="bacnet_ip",
                success=1,
                latency_ms=51.8,
                operator="Auto-Remediation (HVAC Optimizer)",
                message="Chiller plant sequencing lifted supply water setpoint by 1.0°C during high wet-bulb ambient condition. 1,200 kWh avoided during peak tariff (+RM 610.80)"
            ),
        ]
        db.add_all(sample_logs)
        db.commit()
        print(f"[seed] Seeded {len(sample_logs)} autonomous control audit logs.")
    except Exception as e:
        db.rollback()
        print(f"[seed] control audit seeding skipped: {e}")
    finally:
        if own_session:
            db.close()


if __name__ == "__main__":
    seed_physical_mapping()
    seed_tou_tariff()
    seed_demand_thresholds()
    seed_meter_telemetry()
