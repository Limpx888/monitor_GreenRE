"""Data Quality (DQ) Monitoring & Production Ingestion Service.

Implements rigorous checks:
1. Anti-replay timestamp validation (future/stale rejection).
2. Event deduplication via event_id and (asset_tag, point_code, timestamp).
3. Statistical sensor anomaly detection:
   - Flatline detection (sensor frozen on identical value)
   - Abnormal gradient jumps (unrealistic rate of change)
   - Clock drift detection (|device_ts - server_ts| > drift_threshold)
   - Out-of-bounds physical range enforcement
4. Dead-Letter Queue (DLQ) persistence for rejected frames.
"""

import os
import json
import time
from datetime import datetime, timezone, timedelta
from typing import Dict, List, Optional, Set, Tuple
from sqlalchemy.orm import Session

from canonical_schema import (
    CanonicalTelemetryRecord,
    CanonicalBatchIngestRequest,
    CanonicalIngestResponse,
    PartialIngestFailure,
    DataQualityTag,
)
from spatial_models import DeadLetterQueue
from storage_interface import get_telemetry_store
from database import SessionLocal

# Physical operational bounds and gradient limits per point code
PHYSICAL_POINT_SPECS = {
    "OUTDOOR_AIR_DAMPER": {"min": 0.0, "max": 100.0, "unit": "%", "max_jump": 60.0},
    "DAMPER_POS": {"min": 0.0, "max": 100.0, "unit": "%", "max_jump": 60.0},
    "SUPPLY_FAN_SPEED": {"min": 0.0, "max": 100.0, "unit": "Hz", "max_jump": 30.0},
    "CHW_VALVE_POS": {"min": 0.0, "max": 100.0, "unit": "%", "max_jump": 50.0},
    "SUPPLY_AIR_TEMP": {"min": 8.0, "max": 35.0, "unit": "°C", "max_jump": 8.0},
    "ROOM_TEMP": {"min": 15.0, "max": 38.0, "unit": "°C", "max_jump": 5.0},
    "ZONE_CO2": {"min": 300.0, "max": 5000.0, "unit": "ppm", "max_jump": 800.0},
    "RETURN_AIR_CO2": {"min": 300.0, "max": 5000.0, "unit": "ppm", "max_jump": 800.0},
    "CHW_SUPPLY_TEMP": {"min": 3.0, "max": 20.0, "unit": "°C", "max_jump": 4.0},
    "CHILLER_POWER": {"min": 0.0, "max": 2000.0, "unit": "kW", "max_jump": 500.0},
    "TOTAL_DEMAND": {"min": 0.0, "max": 5000.0, "unit": "kW", "max_jump": 1000.0},
    "FLOW_RATE": {"min": 0.0, "max": 500.0, "unit": "m³/h", "max_jump": 50.0},
    "BIN_FILL_LEVEL": {"min": 0.0, "max": 100.0, "unit": "%", "max_jump": 70.0},
}


class DataQualityMonitor:
    def __init__(self):
        self._seen_events: Set[str] = set()
        self._point_history: Dict[str, List[Tuple[datetime, float]]] = {}
        self._max_cache_size = 50000

    def evaluate_dq(
        self,
        record: CanonicalTelemetryRecord,
        is_historical: bool = False
    ) -> Tuple[DataQualityTag, List[str], Optional[str]]:
        """Evaluates data quality, returns (tag, flags, fatal_rejection_error)."""
        now = datetime.now(timezone.utc)
        flags: List[str] = []

        # 1. Anti-Replay Timestamp Validation
        ts = record.timestamp
        if ts > now + timedelta(minutes=5):
            return DataQualityTag.INVALID, ["TIMESTAMP_IN_FUTURE"], "Anti-replay check failed: timestamp is in the future (>5m)"

        if not is_historical and ts < now - timedelta(days=7):
            return DataQualityTag.INVALID, ["TIMESTAMP_TOO_OLD"], "Anti-replay check failed: timestamp exceeds 7-day ingestion horizon"

        # 2. Clock Drift Detection (|ts - server_now| > 3m)
        drift_seconds = abs((now - ts).total_seconds())
        if drift_seconds > 180 and not is_historical:
            flags.append(f"CLOCK_DRIFT_{int(drift_seconds)}S")

        # 3. Deduplication Check
        dedup_tuple = f"{record.asset_tag}::{record.point_code}::{record.timestamp.isoformat()}"
        if record.event_id in self._seen_events or dedup_tuple in self._seen_events:
            return DataQualityTag.INVALID, ["DUPLICATE_EVENT"], f"Duplicate telemetry event detected for {record.event_id}"

        # 4. Physical Operational Bounds Enforcement
        spec = PHYSICAL_POINT_SPECS.get(record.point_code)
        if spec:
            if record.value < spec["min"] or record.value > spec["max"]:
                flags.append(f"OUT_OF_BOUNDS_{record.value}_{spec['unit']}")

        # 5. Flatline & Jump Detection against Point History
        hist_key = f"{record.asset_tag}::{record.point_code}"
        history = self._point_history.setdefault(hist_key, [])

        if spec and history:
            last_ts, last_val = history[-1]
            delta_val = abs(record.value - last_val)
            max_jump = spec.get("max_jump", 100.0)

            # Abnormal rate of change
            if delta_val > max_jump:
                flags.append(f"ABNORMAL_JUMP_DELTA_{delta_val:.1f}")

            # Flatline detection (consecutive identical values >= 5)
            if len(history) >= 4 and all(v == record.value for _, v in history[-4:]):
                flags.append("SENSOR_FLATLINE")

        # Update cache
        self._seen_events.add(record.event_id)
        self._seen_events.add(dedup_tuple)
        if len(self._seen_events) > self._max_cache_size:
            # Drop older entries
            self._seen_events.clear()

        history.append((ts, record.value))
        if len(history) > 20:
            history.pop(0)

        # Determine Final Quality Status Tag
        if any("OUT_OF_BOUNDS" in f for f in flags):
            return DataQualityTag.DEGRADED, flags, None
        if "SENSOR_FLATLINE" in flags:
            return DataQualityTag.FLATLINE, flags, None
        if any("ABNORMAL_JUMP" in f for f in flags):
            return DataQualityTag.JUMP, flags, None
        if any("CLOCK_DRIFT" in f for f in flags):
            return DataQualityTag.DRIFT, flags, None

        return DataQualityTag.VALID, flags, None


# Global singleton instance
dq_monitor = DataQualityMonitor()


async def ingest_canonical_batch(batch_req: CanonicalBatchIngestRequest) -> CanonicalIngestResponse:
    """Production-grade ingestion pipeline with partial failures and DLQ persistence."""
    start_time = time.time()
    db: Session = SessionLocal()
    trace_id = f"tr-ingest-{int(time.time())}"
    
    valid_records: List[CanonicalTelemetryRecord] = []
    failures: List[PartialIngestFailure] = []
    dlq_records_to_insert: List[DeadLetterQueue] = []

    try:
        for idx, rec in enumerate(batch_req.records):
            status_tag, flags, fatal_error = dq_monitor.evaluate_dq(
                rec, is_historical=batch_req.is_historical_backfill
            )

            if fatal_error:
                # Fatal rejection -> route to Dead-Letter Queue (DLQ)
                failures.append(
                    PartialIngestFailure(
                        index=idx,
                        event_id=rec.event_id,
                        asset_tag=rec.asset_tag,
                        point_code=rec.point_code,
                        code="VALIDATION_FATAL",
                        error=fatal_error,
                    )
                )
                dlq_records_to_insert.append(
                    DeadLetterQueue(
                        event_id=rec.event_id,
                        trace_id=rec.trace_id,
                        rejection_reason=fatal_error,
                        error_code="VALIDATION_FATAL",
                        raw_payload=json.dumps(rec.model_dump(mode="json")),
                    )
                )
            else:
                # Enriched record with evaluated DQ status and flags
                rec.quality_status = status_tag
                rec.quality_flags = flags
                valid_records.append(rec)

        # Persist DLQ entries
        if dlq_records_to_insert:
            db.bulk_save_objects(dlq_records_to_insert)
            db.commit()

        # Persist valid records to Storage Interface
        store = get_telemetry_store()
        if valid_records:
            await store.store_batch(valid_records)

        duration_ms = round((time.time() - start_time) * 1000, 2)
        total_rec = len(batch_req.records)
        succ_rec = len(valid_records)
        fail_rec = len(failures)

        status_str = "SUCCESS" if fail_rec == 0 else ("PARTIAL_SUCCESS" if succ_rec > 0 else "FAILED")

        return CanonicalIngestResponse(
            status=status_str,
            total_received=total_rec,
            success_count=succ_rec,
            failure_count=fail_rec,
            failures=failures,
            dlq_persisted_count=len(dlq_records_to_insert),
            trace_id=trace_id,
            processing_time_ms=duration_ms,
        )

    finally:
        db.close()

