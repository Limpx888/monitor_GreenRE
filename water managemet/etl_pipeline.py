import os
import gc
import sys
import pandas as pd
import duckdb

def find_file(filename, search_dirs):
    for d in search_dirs:
        candidate = os.path.join(d, filename)
        if os.path.exists(candidate):
            return candidate
    return None

def main():
    print("=" * 60)
    print("IJM Water Management ETL: Unifying 5 Wide CSVs -> DuckDB")
    print("=" * 60)

    # 1. Define files and meter types
    files = {
        "water_cleaned (1).csv": "general_water",
        "irrigation_cleaned.csv": "irrigation",
        "chilledwater_cleaned.csv": "chilled_water",
        "hotwater_cleaned.csv": "hot_water",
        "steam_cleaned (1).csv": "steam"
    }

    # Potential directories where raw CSVs may reside
    search_dirs = [
        ".",
        "water managemet",
        "../water managemet",
        os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "water managemet"),
        os.path.join(os.path.dirname(os.path.abspath(__file__)), "water managemet"),
        os.path.dirname(os.path.abspath(__file__))
    ]

    db_path = "water_management.duckdb"
    con = duckdb.connect(db_path)

    # Create table structure if not exists
    con.execute("""
        CREATE TABLE IF NOT EXISTS meter_readings (
            timestamp TIMESTAMP,
            site VARCHAR,
            space_usage VARCHAR,
            building_name VARCHAR,
            meter_type VARCHAR,
            consumption DOUBLE
        );
    """)

    # Check if table already has data
    existing_count = con.execute("SELECT COUNT(*) FROM meter_readings").fetchone()[0]
    if existing_count > 0:
        print(f"Table 'meter_readings' currently contains {existing_count:,} rows. Overwriting for clean ETL run...")
        con.execute("DELETE FROM meter_readings;")

    total_inserted = 0

    for filename, meter_type in files.items():
        filepath = find_file(filename, search_dirs)
        if not filepath:
            print(f"[WARN] File not found: {filename} (searched in {search_dirs})")
            continue

        file_size_mb = os.path.getsize(filepath) / (1024 * 1024)
        print(f"\nProcessing '{filename}' ({file_size_mb:.1f} MB) as meter_type='{meter_type}'...")
        
        # Read raw CSV
        df = pd.read_csv(filepath)
        raw_rows, raw_cols = df.shape
        print(f"  Loaded raw table: {raw_rows:,} timestamps x {raw_cols} columns")

        # Melt from wide to long format
        print("  Melting from wide to long format...")
        df_long = df.melt(id_vars=["timestamp"], var_name="column_header", value_name="consumption")
        del df
        gc.collect()

        # Drop NaN consumption rows
        before_drop = len(df_long)
        df_long = df_long.dropna(subset=["consumption"])
        print(f"  Cleaned NaN rows: {before_drop:,} -> {len(df_long):,} records")

        # Extract metadata from column header: {Site}_{SpaceUsage}_{BuildingName}
        print("  Extracting metadata (site, space_usage, building_name)...")
        meta = df_long['column_header'].str.split('_', n=2, expand=True)
        df_long['site'] = meta[0]
        df_long['space_usage'] = meta[1] if meta.shape[1] > 1 else 'unknown'
        df_long['building_name'] = meta[2] if meta.shape[1] > 2 else 'unknown'
        
        # Assign meter type
        df_long['meter_type'] = meter_type

        # Ensure timestamp is datetime
        df_long['timestamp'] = pd.to_datetime(df_long['timestamp'])

        # Keep strictly the table columns in order
        df_long = df_long[['timestamp', 'site', 'space_usage', 'building_name', 'meter_type', 'consumption']]

        # Insert directly into DuckDB
        print(f"  Inserting {len(df_long):,} rows into DuckDB...")
        con.execute("INSERT INTO meter_readings SELECT * FROM df_long")
        total_inserted += len(df_long)

        del df_long, meta
        gc.collect()

    print("\n" + "=" * 60)
    print("ETL Ingestion Complete! Building analytical indexes...")
    print("=" * 60)

    # Create analytical indexes for high performance querying
    con.execute("CREATE INDEX IF NOT EXISTS idx_meter_readings_timestamp ON meter_readings(timestamp);")
    con.execute("CREATE INDEX IF NOT EXISTS idx_meter_readings_type ON meter_readings(meter_type);")
    con.execute("CREATE INDEX IF NOT EXISTS idx_meter_readings_building ON meter_readings(building_name);")

    # Verification queries
    total_count = con.execute("SELECT COUNT(*) FROM meter_readings").fetchone()[0]
    print(f"\n[OK] Total records in 'meter_readings': {total_count:,}")

    summary = con.execute("""
        SELECT 
            meter_type, 
            COUNT(*) as record_count,
            COUNT(DISTINCT building_name) as unique_buildings,
            ROUND(AVG(consumption), 2) as avg_consumption,
            ROUND(SUM(consumption), 2) as total_consumption
        FROM meter_readings
        GROUP BY meter_type
        ORDER BY record_count DESC;
    """).fetchdf()

    print("\nSummary by Meter Type:")
    print(summary.to_string(index=False))

    time_range = con.execute("""
        SELECT 
            MIN(timestamp) as start_time, 
            MAX(timestamp) as end_time,
            COUNT(DISTINCT site) as total_sites,
            COUNT(DISTINCT building_name) as total_buildings
        FROM meter_readings;
    """).fetchdf()

    print("\nTime Range & Dimensions:")
    print(time_range.to_string(index=False))

    print("\nFirst 5 Records Preview:")
    preview = con.execute("SELECT * FROM meter_readings LIMIT 5").fetchdf()
    print(preview.to_string(index=False))

    con.close()
    db_size_mb = os.path.getsize(db_path) / (1024 * 1024)
    print(f"\n[SUCCESS] DuckDB file saved: '{os.path.abspath(db_path)}' ({db_size_mb:.2f} MB)")

if __name__ == "__main__":
    main()
