import sqlite3
import os

MIGRATIONS = [
    ('zones', 'cdd_coefficient', 'ALTER TABLE zones ADD COLUMN cdd_coefficient FLOAT NOT NULL DEFAULT 0.012'),
    ('zones', 'hdd_coefficient', 'ALTER TABLE zones ADD COLUMN hdd_coefficient FLOAT NOT NULL DEFAULT 0.004'),
    ('zones', 'contracted_hours', 'ALTER TABLE zones ADD COLUMN contracted_hours FLOAT NOT NULL DEFAULT 3640.0'),
    ('zones', 'demand_threshold_kw', 'ALTER TABLE zones ADD COLUMN demand_threshold_kw FLOAT'),
    ('meter_readings', 'demand_kw', 'ALTER TABLE meter_readings ADD COLUMN demand_kw FLOAT'),
    ('meter_readings', 'voltage_v', 'ALTER TABLE meter_readings ADD COLUMN voltage_v FLOAT'),
    ('meter_readings', 'current_a', 'ALTER TABLE meter_readings ADD COLUMN current_a FLOAT'),
    ('meter_readings', 'power_factor', 'ALTER TABLE meter_readings ADD COLUMN power_factor FLOAT'),
    ('meter_readings', 'reactive_kvar', 'ALTER TABLE meter_readings ADD COLUMN reactive_kvar FLOAT'),
    ('meter_readings', 'quality_status', "ALTER TABLE meter_readings ADD COLUMN quality_status VARCHAR(16) NOT NULL DEFAULT 'LIVE'"),
]

def run_migrations():
    project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    db_candidates = [
        os.path.join(project_root, "ems_local.db"),
        os.path.join(os.path.dirname(__file__), "ems_local.db"),
    ]
    for db_path in db_candidates:
        if not os.path.exists(db_path):
            continue
        print(f"[Migration] Checking {db_path}...")
        conn = sqlite3.connect(db_path)
        cur = conn.cursor()
        for table, col, alter_sql in MIGRATIONS:
            cur.execute(f"PRAGMA table_info({table})")
            existing_cols = [r[1] for r in cur.fetchall()]
            if col not in existing_cols:
                print(f"  + Adding {table}.{col}")
                cur.execute(alter_sql)
            else:
                print(f"  = {table}.{col} exists")
        try:
            cur.execute("CREATE INDEX IF NOT EXISTS ix_meter_readings_quality ON meter_readings(quality_status)")
        except Exception as e:
            print(f"Index notice: {e}")
        conn.commit()
        conn.close()
        print(f"[Migration] Completed for {db_path}")

if __name__ == "__main__":
    run_migrations()
