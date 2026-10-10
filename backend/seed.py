"""Idempotent seed of 5 GreenRE zones and Light Exchange floor bindings.

Floor-to-zone mapping lives in Postgres so reallocating L13 (or any floor)
is a zone_id update, not a code change.
"""

from db_models import Floor, Zone
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


if __name__ == "__main__":
    seed_physical_mapping()
