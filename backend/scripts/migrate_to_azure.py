"""Copy the local SQLite databases into Azure Database for PostgreSQL.

    py -3.13 backend/scripts/migrate_to_azure.py --target ems   --to "$EMS_URL"
    py -3.13 backend/scripts/migrate_to_azure.py --target waste --to "$WASTE_URL"

* Tables are created from the SQLAlchemy models (same schema the app uses).
* Rows are copied in foreign-key order, in batches; only columns present in
  both source and model are copied.
* Idempotent: a table that already holds rows is skipped unless --replace.
* Integer id sequences are advanced past the copied ids.
* Prints source and target row counts for every table.

Connection URLs come from the command line or environment; nothing is hardcoded.
"""

from __future__ import annotations

import argparse
import os
import sys
import time
from pathlib import Path

from sqlalchemy import Integer, create_engine, func, inspect, select, text

ROOT = Path(__file__).resolve().parents[2]
sys.path[:0] = [str(ROOT / "backend"), str(ROOT / "waste-api")]

BATCH = 5000


def load_metadata(target: str):
    if target == "ems":
        import control_adapters  # noqa: F401  (registers control_audit_log)
        import db_models  # noqa: F401
        import spatial_models  # noqa: F401
        from database import Base

        return Base.metadata, f"sqlite:///{ROOT / 'ems_local.db'}"
    if target == "waste":
        import app.models  # noqa: F401
        from app.database import Base

        return Base.metadata, f"sqlite:///{ROOT / 'waste-api' / 'waste.db'}"
    raise SystemExit(f"unknown target {target}")


def pg_url(url: str) -> str:
    """Use psycopg 3 for the copy: its executemany is pipelined, so rows are
    streamed in batches instead of one network round trip per row (pg8000)."""
    for prefix in ("postgresql+pg8000://", "postgresql+psycopg2://", "postgresql://"):
        if url.startswith(prefix):
            return "postgresql+psycopg://" + url[len(prefix):]
    return url


def connect_args(url: str) -> dict:
    return {"sslmode": "require"} if url.startswith("postgresql+psycopg") else {}


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--target", choices=["ems", "waste"], required=True)
    ap.add_argument("--from", dest="src", help="source URL (default: the local SQLite file)")
    ap.add_argument("--to", dest="dst", default=os.getenv("MIGRATE_TARGET_URL"), help="target Postgres URL")
    ap.add_argument("--replace", action="store_true", help="truncate target tables that already have rows")
    args = ap.parse_args()
    if not args.dst:
        raise SystemExit("--to or MIGRATE_TARGET_URL is required")

    metadata, default_src = load_metadata(args.target)
    src = create_engine(args.src or default_src)
    dst_url = pg_url(args.dst)
    dst = create_engine(dst_url, connect_args=connect_args(dst_url), pool_pre_ping=True)

    metadata.create_all(dst)
    src_tables = set(inspect(src).get_table_names())
    print(f"{'table':<34}{'source':>12}{'target':>12}  note")
    totals = [0, 0]

    for table in metadata.sorted_tables:
        name = table.name
        if name not in src_tables:
            print(f"{name:<34}{'-':>12}{'-':>12}  not in source")
            continue
        src_cols = {c["name"] for c in inspect(src).get_columns(name)}
        cols = [c for c in table.columns if c.name in src_cols]
        with src.connect() as s:
            n_src = s.execute(select(func.count()).select_from(text(f'"{name}"'))).scalar()
        with dst.begin() as d:
            n_dst = d.execute(select(func.count()).select_from(table)).scalar()
            if n_dst and not args.replace:
                print(f"{name:<34}{n_src:>12,}{n_dst:>12,}  skipped (target has rows)")
                totals[0] += n_src
                totals[1] += n_dst
                continue
            if n_dst:
                d.execute(text(f'TRUNCATE TABLE "{name}" CASCADE'))

        started = time.time()
        copied = 0
        with src.connect() as s:
            result = s.execution_options(stream_results=True).execute(select(*cols))
            while True:
                rows = result.fetchmany(BATCH)
                if not rows:
                    break
                with dst.begin() as d:
                    d.execute(table.insert(), [dict(r._mapping) for r in rows])
                copied += len(rows)
                if copied % (BATCH * 10) == 0:
                    print(f"  … {name}: {copied:,} rows", flush=True)

        # Move id sequences past the copied ids
        with dst.begin() as d:
            for c in table.primary_key.columns:
                if isinstance(c.type, Integer) and c.autoincrement in (True, "auto"):
                    seq = d.execute(text("SELECT pg_get_serial_sequence(:t, :c)"), {"t": name, "c": c.name}).scalar()
                    if seq:
                        d.execute(text(f'SELECT setval(:s, COALESCE((SELECT MAX("{c.name}") FROM "{name}"), 0) + 1, false)'), {"s": seq})
            n_dst = d.execute(select(func.count()).select_from(table)).scalar()

        ok = "ok" if n_dst == n_src else "MISMATCH"
        print(f"{name:<34}{n_src:>12,}{n_dst:>12,}  {ok} ({time.time() - started:.1f}s)", flush=True)
        totals[0] += n_src
        totals[1] += n_dst

    print(f"{'TOTAL':<34}{totals[0]:>12,}{totals[1]:>12,}")
    if totals[0] != totals[1]:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
