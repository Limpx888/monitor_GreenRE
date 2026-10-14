"""Idempotent seed of 5 GreenRE zones, Light Exchange floor bindings,
TNB Schedule D TOU tariff rates, and zone demand thresholds.

Floor-to-zone mapping lives in Postgres so reallocating L13 (or any floor)
is a zone_id update, not a code change.
"""

from datetime import datetime, timezone
from db_models import Floor, TouTariffRate, Zone
from database import SessionLocal, engine, Base


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


if __name__ == "__main__":
    seed_physical_mapping()
    seed_tou_tariff()
    seed_demand_thresholds()
