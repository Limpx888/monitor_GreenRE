"""
Demo data seeder.
Creates 3 organizations (hotel, restaurant, office) with sites, locations, users,
and 3 months of realistic scan/detection data so dashboards look populated.
"""

import random
import uuid
from datetime import datetime, timedelta, timezone
from app.database import SessionLocal
from app.models import (
    Organization, Site, Location, User, Scan, Detection,
    Collection, ReductionTarget, Action, GreenRERequirement,
)
from app.auth import hash_password
from app.services.categorizer import DEFAULT_CLASS_MAP, get_tip_for_detection


def seed_demo_data():
    db = SessionLocal()
    try:
        _seed(db)
        db.commit()
        print("✅ Demo data seeded successfully!")
    except Exception as e:
        db.rollback()
        print(f"❌ Seed error: {e}")
        raise
    finally:
        db.close()


def _seed(db):
    # ── Organizations ──
    orgs_data = [
        {"name": "The Light Hotel Group", "slug": "light-hotel", "type": "hotel"},
        {"name": "Bamboo Kitchen Restaurant", "slug": "bamboo-kitchen", "type": "restaurant"},
        {"name": "Penang Tech Hub", "slug": "penang-tech", "type": "office"},
    ]

    orgs = []
    sites = []
    all_users = []

    for od in orgs_data:
        org = Organization(name=od["name"], slug=od["slug"])
        db.add(org)
        db.flush()

        site = Site(
            org_id=org.id,
            name=od["name"],
            site_type=od["type"],
            address="The Light City, Penang, Malaysia",
        )
        db.add(site)
        db.flush()

        # Create users
        admin = User(
            org_id=org.id,
            email=f"admin@{od['slug']}.demo",
            password_hash=hash_password("demo123"),
            full_name=f"{od['name']} Admin",
            role="admin",
            default_site_id=site.id,
        )
        staff = User(
            org_id=org.id,
            email=f"staff@{od['slug']}.demo",
            password_hash=hash_password("demo123"),
            full_name=f"{od['name']} Staff",
            role="staff",
            default_site_id=site.id,
        )
        db.add_all([admin, staff])
        db.flush()

        orgs.append(org)
        sites.append(site)
        all_users.append((admin, staff, site))

    # ── Locations per site type ──
    location_defs = {
        "hotel": [
            ("Lobby", "general", "Ground", "A"),
            ("Kitchen", "organic", "Ground", "B"),
            ("Restaurant", "general", "Ground", "B"),
            ("Housekeeping Store", "recycle", "L2", "C"),
            ("Guest Floor Bins", "recycle", "L5-L14", "D"),
            ("Pool Area", "general", "L3", "A"),
        ],
        "restaurant": [
            ("Kitchen Prep", "organic", "Ground", "Kitchen"),
            ("Kitchen Line", "organic", "Ground", "Kitchen"),
            ("Dining Area", "general", "Ground", "Front"),
            ("Bar", "recycle", "Ground", "Front"),
            ("Back Dock", "recycle", "Ground", "Back"),
            ("Office", "general", "L1", "Admin"),
        ],
        "office": [
            ("Pantry", "general", "L14", "D"),
            ("Open Office A", "recycle", "L14", "D"),
            ("Open Office B", "recycle", "L14", "D"),
            ("Meeting Rooms", "general", "L14", "D"),
            ("Mailroom", "recycle", "L14", "D"),
            ("Server Room", "general", "L14", "D"),
        ],
    }

    # Waste profiles per site type (which items appear more/less)
    waste_profiles = {
        "hotel": {
            "Plastic bottle": 25, "Glass bottle": 15, "Paper": 10,
            "Cardboard": 12, "Organic": 20, "Disposable tableware": 8,
            "Plastic bag": 10, "Paper cups": 8, "Foil": 5,
            "Textile": 3, "Tetra pack": 5, "Aluminum can": 8,
            "Plastic cup": 6, "Paper bag": 4, "Tin": 3,
        },
        "restaurant": {
            "Organic": 35, "Glass bottle": 12, "Plastic bottle": 8,
            "Cardboard": 15, "Foil": 10, "Paper cups": 5,
            "Disposable tableware": 12, "Stretch film": 8,
            "Aluminum can": 6, "Tin": 8, "Plastic bag": 5,
            "Paper": 3, "Tetra pack": 4, "Milk bottle": 3,
        },
        "office": {
            "Paper": 25, "Paper cups": 18, "Plastic bottle": 15,
            "Cardboard": 10, "Aluminum can": 8, "Plastic bag": 5,
            "Electronics": 2, "Postal packaging": 6, "Printing industry": 4,
            "Tetra pack": 5, "Plastic cup": 8, "Paper bag": 3,
            "Disposable tableware": 4, "Paper shavings": 3,
        },
    }

    site_locations = {}
    for i, (admin, staff, site) in enumerate(all_users):
        site_type = orgs_data[i]["type"]
        locs = []
        for loc_name, bin_type, floor, zone in location_defs.get(site_type, []):
            loc = Location(
                site_id=site.id,
                name=loc_name,
                bin_type=bin_type,
                floor=floor,
                zone=zone,
            )
            db.add(loc)
            db.flush()
            locs.append(loc)
        site_locations[site.id] = locs

    db.flush()

    # ── Generate 3 months of scan data ──
    now = datetime.now(timezone.utc)
    start_date = now - timedelta(days=90)

    for i, (admin, staff, site) in enumerate(all_users):
        site_type = orgs_data[i]["type"]
        profile = waste_profiles.get(site_type, waste_profiles["office"])
        locs = site_locations[site.id]
        users = [admin, staff]

        # Generate 2-5 scans per day
        current = start_date
        while current <= now:
            num_scans = random.randint(2, 5)
            for _ in range(num_scans):
                user = random.choice(users)
                loc = random.choice(locs) if locs else None
                scan_time = current + timedelta(
                    hours=random.randint(7, 18),
                    minutes=random.randint(0, 59),
                )

                scan = Scan(
                    user_id=user.id,
                    site_id=site.id,
                    location_id=loc.id if loc else None,
                    status="confirmed",
                    scan_mode=random.choice(["upload", "snapshot", "live"]),
                    note=None,
                    created_at=scan_time,
                )
                db.add(scan)
                db.flush()

                # Generate 1-6 detections per scan
                num_detections = random.randint(1, 6)
                items = random.choices(
                    list(profile.keys()),
                    weights=list(profile.values()),
                    k=num_detections,
                )

                for item_name in items:
                    config = DEFAULT_CLASS_MAP.get(item_name, {})
                    category = config.get("category", "GENERAL")
                    confidence = round(random.uniform(0.25, 0.95), 3)
                    avg_weight = config.get("avg_weight_kg", 0.05)
                    # Add some variance to weight
                    weight = round(avg_weight * random.uniform(0.5, 1.5), 4)

                    detection = Detection(
                        scan_id=scan.id,
                        class_name=item_name,
                        confidence=confidence,
                        bbox={
                            "x1": round(random.uniform(10, 300), 1),
                            "y1": round(random.uniform(10, 300), 1),
                            "x2": round(random.uniform(310, 600), 1),
                            "y2": round(random.uniform(310, 600), 1),
                        },
                        category=category,
                        material=config.get("material", "unknown"),
                        estimated_weight_kg=weight,
                        weight_source="ESTIMATED",
                        needs_review=confidence < 0.4,
                        tip=get_tip_for_detection(item_name, category),
                        created_at=scan_time,
                    )
                    db.add(detection)

            # Weekly collection events
            if current.weekday() == 0:  # Monday
                for waste_cat in ["RECYCLE", "GENERAL", "ORGANIC"]:
                    collection = Collection(
                        site_id=site.id,
                        location_id=random.choice(locs).id if locs else None,
                        measured_weight_kg=round(random.uniform(20, 200), 1),
                        waste_category=waste_cat,
                        contractor="GreenCycle Sdn Bhd" if waste_cat == "RECYCLE" else "Majlis Bandaraya",
                        receipt_ref=f"RC-{current.strftime('%Y%m%d')}-{waste_cat[:3]}",
                        collected_at=current + timedelta(hours=8),
                    )
                    db.add(collection)

            current += timedelta(days=1)

        # ── Reduction Targets ──
        for metric, target, baseline in [
            ("recycling_rate", 60.0, 35.0),
            ("diversion_rate", 75.0, 45.0),
        ]:
            rt = ReductionTarget(
                site_id=site.id,
                metric=metric,
                target_value=target,
                baseline_value=baseline,
                start_date=(now - timedelta(days=90)).date(),
                end_date=(now + timedelta(days=270)).date(),
            )
            db.add(rt)

        # ── Sample Actions ──
        actions_data = [
            {
                "title": "Install Water Refill Stations",
                "description": "Install 3 water refill stations to reduce plastic bottle waste by 70%.",
                "hierarchy_level": "REDUCE",
                "status": "in_progress",
                "effort_level": "medium",
                "estimated_saving_kg": 15.0,
                "estimated_saving_co2e": 40.5,
            },
            {
                "title": "Improve Bin Signage",
                "description": "Install clear visual signage on all bins showing accepted items.",
                "hierarchy_level": "RECYCLE",
                "status": "done",
                "effort_level": "low",
                "estimated_saving_kg": 5.0,
                "estimated_saving_co2e": 8.0,
                "completed_at": now - timedelta(days=15),
            },
            {
                "title": "Switch to Reusable Cups",
                "description": "Provide reusable cups and offer RM1 discount for BYO cups.",
                "hierarchy_level": "REDUCE",
                "status": "suggested",
                "effort_level": "low",
                "estimated_saving_kg": 3.0,
                "estimated_saving_co2e": 4.5,
            },
        ]
        for ad in actions_data:
            action = Action(site_id=site.id, owner_id=admin.id, **ad)
            db.add(action)

        # ── GreenRE Requirements ──
        greenre_data = [
            ("WM-1", "Waste Management Plan", "evidence_attached"),
            ("WM-2", "Construction Waste Management", "in_progress"),
            ("WM-3", "Operational Waste Reduction", "in_progress"),
            ("WM-4", "Recycling Program Implementation", "evidence_attached"),
            ("WM-5", "Hazardous Waste Management", "not_started"),
            ("WM-6", "Waste Monitoring and Reporting", "in_progress"),
            ("WM-7", "Organic Waste Diversion", "not_started"),
        ]
        for code, desc, status in greenre_data:
            gr = GreenRERequirement(
                site_id=site.id,
                requirement_code=code,
                requirement_description=desc,
                status=status,
                updated_by=admin.id,
            )
            db.add(gr)


if __name__ == "__main__":
    seed_demo_data()
