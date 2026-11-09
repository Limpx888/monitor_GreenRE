"""
Live water telemetry store (DuckDB).

Uses its own database file (``backend/data/water_live.duckdb``), separate from
the read-only historical BDG2 database that ``water_router.py`` opens per
request. DuckDB allows only one writer process per file, and keeping the files
apart means the live writer never collides with those read-only connections.

Design notes:
* One process-wide connection guarded by a lock. The MQTT thread writes and the
  WebSocket broadcaster reads through ``asyncio.to_thread``, so the event loop
  never blocks on DuckDB.
* Each insert stores ``volume_delta_m3`` (current register minus the meter's
  previous register), computed at ingest time. Both analytics queries then
  become plain filtered ``SUM``/``GROUP BY`` scans over a time-ordered table,
  which DuckDB's zone maps prune well, with no window functions per tick.
"""

from __future__ import annotations

import math
import os
import threading
from datetime import datetime, timedelta

import duckdb

DB_PATH = os.getenv(
    "WATER_LIVE_DB_PATH",
    os.path.join(os.path.dirname(os.path.abspath(__file__)), "data", "water_live.duckdb"),
)
RETENTION_HOURS = int(os.getenv("WATER_LIVE_RETENTION_HOURS", "48"))

# Simulator category -> frontend series key (matches METER_COLORS in WaterDashboardPage.jsx)
CATEGORY_KEYS: dict[str, str] = {
    "General Water": "general_water",
    "Chilled/Cooling": "chilled_water",
    "Hot Water": "hot_water",
    "Irrigation": "irrigation",
    "Steam": "steam",
}
ALLOWED_BUCKETS = {1, 5}  # minutes

_SCHEMA = """
CREATE TABLE IF NOT EXISTS water_telemetry (
    ts                  TIMESTAMP NOT NULL,   -- local wall-clock time of the reading
    meter_id            VARCHAR   NOT NULL,
    water_category      VARCHAR   NOT NULL,
    flow_rate_m3_per_hr DOUBLE    NOT NULL,
    total_volume_m3     DOUBLE    NOT NULL,   -- meter register (cumulative)
    volume_delta_m3     DOUBLE    NOT NULL    -- consumption since this meter's previous reading
);
"""


def _to_local_naive(ts: str) -> datetime:
    """Parse ISO-8601 and normalise to naive local time (what the dashboard displays)."""
    dt = datetime.fromisoformat(ts.replace("Z", "+00:00"))
    if dt.tzinfo is not None:
        dt = dt.astimezone().replace(tzinfo=None)
    return dt


class WaterLiveStore:
    def __init__(self, path: str = DB_PATH):
        os.makedirs(os.path.dirname(path), exist_ok=True)
        self._con = duckdb.connect(path)
        self._lock = threading.Lock()
        self._last_register: dict[str, float] = {}
        self._last_prune = datetime.min
        with self._lock:
            self._con.execute(_SCHEMA)
            # Seed the delta baseline so a backend restart doesn't record each
            # meter's whole register as one giant delta.
            for meter_id, register in self._con.execute(
                "SELECT meter_id, arg_max(total_volume_m3, ts) FROM water_telemetry GROUP BY meter_id"
            ).fetchall():
                self._last_register[meter_id] = register

    # ------------------------------------------------------------------ ingest
    def insert_reading(self, payload: dict) -> bool:
        """Validate and insert one simulator payload. Returns False if rejected."""
        try:
            ts = _to_local_naive(str(payload["timestamp"]))
            meter_id = str(payload["meter_id"])[:64]
            category = str(payload["water_category"])
            flow = float(payload["flow_rate_m3_per_hr"])
            register = float(payload["total_volume_m3"])
        except (KeyError, TypeError, ValueError):
            return False
        if category not in CATEGORY_KEYS or not (math.isfinite(flow) and math.isfinite(register)) or flow < 0:
            return False

        with self._lock:
            previous = self._last_register.get(meter_id)
            # First sighting, or a register rollback (meter swap/reset): count no consumption.
            delta = register - previous if previous is not None and register >= previous else 0.0
            self._last_register[meter_id] = register
            self._con.execute(
                "INSERT INTO water_telemetry VALUES (?, ?, ?, ?, ?, ?)",
                [ts, meter_id, category, flow, register, delta],
            )
            self._maybe_prune_locked()
        return True

    def _maybe_prune_locked(self) -> None:
        now = datetime.now()
        if now - self._last_prune < timedelta(minutes=10):
            return
        self._last_prune = now
        self._con.execute(
            "DELETE FROM water_telemetry WHERE ts < ?", [now - timedelta(hours=RETENTION_HOURS)]
        )

    # ----------------------------------------------------------------- queries
    def get_live_fluid_distribution(self, hours: int = 24) -> list[dict]:
        """Volume consumed per water_category over the window, plus current flow and register."""
        since = datetime.now() - timedelta(hours=hours)
        sql = """
            WITH latest AS (
                SELECT meter_id,
                       water_category,
                       arg_max(flow_rate_m3_per_hr, ts) AS flow_now,
                       arg_max(total_volume_m3, ts)     AS register_m3
                FROM water_telemetry
                WHERE ts >= ?
                GROUP BY meter_id, water_category
            ),
            used AS (
                SELECT water_category, sum(volume_delta_m3) AS volume_m3
                FROM water_telemetry
                WHERE ts >= ?
                GROUP BY water_category
            )
            SELECT l.water_category,
                   coalesce(any_value(u.volume_m3), 0) AS volume_m3,
                   sum(l.flow_now)                     AS flow_now,
                   sum(l.register_m3)                  AS register_m3,
                   count(*)                            AS meters
            FROM latest l LEFT JOIN used u USING (water_category)
            GROUP BY l.water_category
            ORDER BY volume_m3 DESC
        """
        with self._lock:
            rows = self._con.execute(sql, [since, since]).fetchall()
        return [
            {
                "meter_type": CATEGORY_KEYS.get(cat, cat),
                "water_category": cat,
                "volume_m3": round(vol or 0.0, 4),
                "current_flow_m3_per_hr": round(flow or 0.0, 4),
                "register_m3": round(reg or 0.0, 4),
                "meters": meters,
            }
            for cat, vol, flow, reg, meters in rows
        ]

    def get_live_time_series(self, bucket_minutes: int = 1, hours: int = 24) -> list[dict]:
        """Tumbling-window (1 or 5 min) consumption per category, pivoted wide for the area chart."""
        if bucket_minutes not in ALLOWED_BUCKETS:
            bucket_minutes = 1
        since = datetime.now() - timedelta(hours=hours)
        # bucket_minutes is whitelisted above, so the literal interval is safe to inline.
        pivots = ",\n".join(
            f"round(coalesce(sum(volume_delta_m3) FILTER (WHERE water_category = '{cat}'), 0), 5) AS {key}"
            for cat, key in CATEGORY_KEYS.items()
        )
        sql = f"""
            SELECT time_bucket(INTERVAL '{bucket_minutes} minutes', ts) AS bucket,
                   {pivots}
            FROM water_telemetry
            WHERE ts >= ?
            GROUP BY bucket
            ORDER BY bucket
        """
        with self._lock:
            cur = self._con.execute(sql, [since])
            cols = [d[0] for d in cur.description]
            rows = cur.fetchall()
        out = []
        for row in rows:
            rec = dict(zip(cols, row))
            rec["timestamp"] = rec.pop("bucket").isoformat(timespec="seconds")
            out.append(rec)
        return out

    def get_kpis(self, stale_after_minutes: int = 10) -> dict:
        """Building-wide register total (the ticking KPI) from each meter's latest reading."""
        since = datetime.now() - timedelta(minutes=stale_after_minutes)
        sql = """
            WITH latest AS (
                SELECT meter_id,
                       arg_max(total_volume_m3, ts)     AS register_m3,
                       arg_max(flow_rate_m3_per_hr, ts) AS flow_now,
                       max(ts)                          AS last_ts
                FROM water_telemetry
                WHERE ts >= ?
                GROUP BY meter_id
            )
            SELECT coalesce(sum(register_m3), 0), coalesce(sum(flow_now), 0), count(*), max(last_ts)
            FROM latest
        """
        with self._lock:
            register, flow, meters, last_ts = self._con.execute(sql, [since]).fetchone()
        return {
            "total_volume_m3": round(register, 4),
            "total_flow_m3_per_hr": round(flow, 4),
            "active_meters": meters,
            "last_reading_at": last_ts.isoformat(timespec="seconds") if last_ts else None,
        }

    def snapshot(self, bucket_minutes: int = 1, hours: int = 24) -> dict:
        """Everything the dashboard needs in one call. Blocking, so run it via asyncio.to_thread."""
        distribution = self.get_live_fluid_distribution(hours)
        return {
            "type": "water_metrics",
            "generated_at": datetime.now().isoformat(timespec="seconds"),
            "bucket_minutes": bucket_minutes if bucket_minutes in ALLOWED_BUCKETS else 1,
            "window_hours": hours,
            "kpi": {
                **self.get_kpis(),
                "volume_window_m3": round(sum(d["volume_m3"] for d in distribution), 4),
            },
            "distribution": distribution,
            "time_series": self.get_live_time_series(bucket_minutes, hours),
        }

    def close(self) -> None:
        with self._lock:
            self._con.close()


_store: WaterLiveStore | None = None
_store_lock = threading.Lock()


def get_store() -> WaterLiveStore:
    global _store
    with _store_lock:
        if _store is None:
            _store = WaterLiveStore()
        return _store


def close_store() -> None:
    global _store
    with _store_lock:
        if _store is not None:
            _store.close()
            _store = None
