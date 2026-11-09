"""Historical water data (20.6M rows) as Parquet, queried with DuckDB.

The source of truth is Azure Blob Storage (container WATER_HISTORY_CONTAINER,
default "water-history"), laid out as meter_type=<type>/year=<yyyy>/data.parquet.
On first use the files are synced to a local cache (WATER_HISTORY_DIR, default
backend/data/water_history) and exposed as a `meter_readings` view, so existing
SQL keeps working unchanged.

Fallback: if neither Blob nor a local cache is available, the legacy
water_management.duckdb file is used when present.
"""

from __future__ import annotations

import os
import threading
from pathlib import Path

import duckdb

HERE = Path(__file__).parent
CACHE_DIR = Path(os.getenv("WATER_HISTORY_DIR", HERE / "data" / "water_history"))
CONTAINER = os.getenv("WATER_HISTORY_CONTAINER", "water-history")
LEGACY_FILES = [
    HERE.parent / "water managemet" / "water_management.duckdb",
    HERE.parent / "ijm-water-ai" / "water_management.duckdb",
    HERE / "water_management.duckdb",
]

_lock = threading.Lock()
_conn: duckdb.DuckDBPyConnection | None = None
_source = "unavailable"


def _sync_from_blob() -> int:
    conn_str = os.getenv("AZURE_STORAGE_CONNECTION_STRING", "").strip()
    if not conn_str:
        return 0
    from azure.storage.blob import ContainerClient

    client = ContainerClient.from_connection_string(conn_str, CONTAINER)
    n = 0
    for blob in client.list_blobs():
        if not blob.name.endswith(".parquet"):
            continue
        dest = CACHE_DIR / blob.name
        if dest.exists() and dest.stat().st_size == blob.size:
            continue
        dest.parent.mkdir(parents=True, exist_ok=True)
        tmp = dest.with_suffix(".part")
        with open(tmp, "wb") as fh:
            client.download_blob(blob.name).readinto(fh)
        tmp.replace(dest)
        n += 1
    return n


def _local_files() -> bool:
    return CACHE_DIR.exists() and any(CACHE_DIR.rglob("*.parquet"))


def _open() -> duckdb.DuckDBPyConnection:
    global _source
    try:
        downloaded = _sync_from_blob()
        if downloaded:
            print(f"[WaterHistory] downloaded {downloaded} Parquet file(s) from Azure Blob '{CONTAINER}'")
    except Exception as exc:
        print(f"[WaterHistory] Blob sync failed, using local cache if present: {exc}")

    if _local_files():
        con = duckdb.connect()
        glob = (CACHE_DIR / "**" / "*.parquet").as_posix()
        con.execute(
            "CREATE VIEW meter_readings AS "
            f"SELECT timestamp, site, space_usage, building_name, meter_type, consumption "
            f"FROM read_parquet('{glob}', hive_partitioning = true)"
        )
        _source = "azure-blob-parquet" if os.getenv("AZURE_STORAGE_CONNECTION_STRING") else "local-parquet"
        return con

    for path in LEGACY_FILES:
        if path.exists():
            _source = "legacy-duckdb"
            return duckdb.connect(str(path), read_only=True)
    raise FileNotFoundError("No water history found (Azure Blob, Parquet cache or water_management.duckdb)")


def cursor() -> duckdb.DuckDBPyConnection:
    """A cursor on the shared connection; callers may close() it as before."""
    global _conn
    if _conn is None:
        with _lock:
            if _conn is None:
                _conn = _open()
    return _conn.cursor()


def source() -> str:
    return _source
