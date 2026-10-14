"""EMS v2.0 -- ALTER TABLE migration for Postgres (Supabase).

Adds new columns to existing tables using IF NOT EXISTS guards.
ASCII-only output for Windows cp1252 compatibility.

Run:  python migrate_v2.py
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from database import engine
from sqlalchemy import text, inspect

print("=" * 60)
print("EMS v2.0 -- Postgres ALTER TABLE Migration")
print("=" * 60)

MIGRATIONS = [
    # (table, column, ALTER SQL)
    # -- zones --
    ("zones", "cdd_coefficient",
     "ALTER TABLE zones ADD COLUMN IF NOT EXISTS cdd_coefficient DOUBLE PRECISION NOT NULL DEFAULT 0.012"),
    ("zones", "hdd_coefficient",
     "ALTER TABLE zones ADD COLUMN IF NOT EXISTS hdd_coefficient DOUBLE PRECISION NOT NULL DEFAULT 0.004"),
    ("zones", "contracted_hours",
     "ALTER TABLE zones ADD COLUMN IF NOT EXISTS contracted_hours DOUBLE PRECISION NOT NULL DEFAULT 3640.0"),
    ("zones", "demand_threshold_kw",
     "ALTER TABLE zones ADD COLUMN IF NOT EXISTS demand_threshold_kw DOUBLE PRECISION"),
    # -- meter_readings --
    ("meter_readings", "demand_kw",
     "ALTER TABLE meter_readings ADD COLUMN IF NOT EXISTS demand_kw DOUBLE PRECISION"),
    ("meter_readings", "voltage_v",
     "ALTER TABLE meter_readings ADD COLUMN IF NOT EXISTS voltage_v DOUBLE PRECISION"),
    ("meter_readings", "current_a",
     "ALTER TABLE meter_readings ADD COLUMN IF NOT EXISTS current_a DOUBLE PRECISION"),
    ("meter_readings", "power_factor",
     "ALTER TABLE meter_readings ADD COLUMN IF NOT EXISTS power_factor DOUBLE PRECISION"),
    ("meter_readings", "reactive_kvar",
     "ALTER TABLE meter_readings ADD COLUMN IF NOT EXISTS reactive_kvar DOUBLE PRECISION"),
    ("meter_readings", "quality_status",
     "ALTER TABLE meter_readings ADD COLUMN IF NOT EXISTS quality_status VARCHAR(16) NOT NULL DEFAULT 'LIVE'"),
]

print("\n[1/3] Running ALTER TABLE statements...")
with engine.begin() as conn:
    for table, col, sql in MIGRATIONS:
        try:
            conn.execute(text(sql))
            print(f"  OK  {table}.{col}")
        except Exception as e:
            print(f"  !! {table}.{col}: {e}")

print("\n[2/3] Creating new tables (alarms, tou_tariff_rates, control_audit_log)...")
# Import models AFTER ALTER TABLE so ORM mapping works on the updated schema
from database import Base
from db_models import Zone, Floor, MeterReading, TouTariffRate, Alarm
from control_adapters import ControlAuditLog

Base.metadata.create_all(bind=engine)
print("  OK  create_all() complete")

print("\n[3/3] Seeding reference data...")
from seed import seed_physical_mapping, seed_tou_tariff, seed_demand_thresholds
try:
    seed_physical_mapping()
    print("  OK  Zones & floors seeded")
except Exception as e:
    print(f"  !! Zone/floor seed: {e}")

try:
    seed_tou_tariff()
    print("  OK  TNB Schedule D TOU rates seeded")
except Exception as e:
    print(f"  !! TOU seed: {e}")

try:
    seed_demand_thresholds()
    print("  OK  Zone demand thresholds patched")
except Exception as e:
    print(f"  !! Demand threshold seed: {e}")

print("\n[Verify] Current table columns:")
insp = inspect(engine)
for tbl in sorted(insp.get_table_names()):
    cols = [c['name'] for c in insp.get_columns(tbl)]
    print(f"  [{tbl}]: {', '.join(cols)}")

print("\nMigration complete.")
