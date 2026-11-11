"""Persistent scenario-resolution evidence used by reports and PDF exports.

Scenario drills are simulated in the Digital Twin, but their approval records
still need a server-side audit trail so reports do not depend on browser state.
"""

from __future__ import annotations

import json
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from threading import Lock
from typing import Any, Optional


_STORE_PATH = Path(__file__).with_name("scenario_interventions.json")
_LOCK = Lock()


def _read() -> list[dict[str, Any]]:
    if not _STORE_PATH.exists():
        return []
    try:
        value = json.loads(_STORE_PATH.read_text(encoding="utf-8"))
        return value if isinstance(value, list) else []
    except (OSError, json.JSONDecodeError):
        return []


def _write(items: list[dict[str, Any]]) -> None:
    _STORE_PATH.write_text(json.dumps(items[-1000:], ensure_ascii=False, indent=2), encoding="utf-8")


def _parse_time(value: Any) -> datetime:
    try:
        parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)
    except (TypeError, ValueError):
        return datetime.now(timezone.utc)


def _money(value: Any) -> float:
    text = str(value or "0").replace("RM", "").replace(",", "").replace("+", "").replace("−", "-").strip()
    try:
        return float(text)
    except ValueError:
        return 0.0


def record_intervention(payload: dict[str, Any]) -> dict[str, Any]:
    entry = dict(payload)
    entry["savedAt"] = _parse_time(entry.get("savedAt")).isoformat()
    entry["reportStatus"] = "READY_FOR_GREENRE_REVIEW"
    with _LOCK:
        items = _read()
        if any(str(item.get("id")) == str(entry.get("id")) for item in items):
            return next(item for item in items if str(item.get("id")) == str(entry.get("id")))
        items.append(entry)
        _write(items)
    return entry


def list_interventions(start: Optional[datetime] = None, end: Optional[datetime] = None) -> list[dict[str, Any]]:
    start = start.astimezone(timezone.utc) if start else None
    end = end.astimezone(timezone.utc) if end else None
    with _LOCK:
        items = _read()
    result = []
    for item in items:
        at = _parse_time(item.get("savedAt"))
        if start and at < start:
            continue
        if end and at > end:
            continue
        result.append(item)
    return sorted(result, key=lambda item: _parse_time(item.get("savedAt")), reverse=True)


def _bucket(items: list[dict[str, Any]], key_format: str, label: str) -> list[dict[str, Any]]:
    groups: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for item in items:
        groups[_parse_time(item.get("savedAt")).strftime(key_format)].append(item)
    rows = []
    for period, group in sorted(groups.items(), reverse=True):
        rows.append({
            "period": period,
            "label": label,
            "incidents": len(group),
            "avoided_value_myr": round(sum(_money(x.get("amount")) for x in group), 2),
            "energy_saved_kwh": round(sum(float(x.get("energySavedKwh") or 0) for x in group), 1),
            "carbon_avoided_kg": round(sum(float(x.get("carbonSavedKg") or 0) for x in group), 1),
            "scenarios": sorted({str(x.get("scenarioTitle") or x.get("scenarioId") or "Scenario") for x in group}),
        })
    return rows


def build_evidence_summary(start: Optional[datetime] = None, end: Optional[datetime] = None) -> dict[str, Any]:
    items = list_interventions(start, end)
    return {
        "available": bool(items),
        "total_incidents": len(items),
        "total_avoided_value_myr": round(sum(_money(x.get("amount")) for x in items), 2),
        "total_energy_saved_kwh": round(sum(float(x.get("energySavedKwh") or 0) for x in items), 1),
        "total_carbon_avoided_kg": round(sum(float(x.get("carbonSavedKg") or 0) for x in items), 1),
        "recent": items[:12],
        "daily": _bucket(items, "%Y-%m-%d", "Daily operational detail"),
        "monthly": _bucket(items, "%Y-%m", "Monthly executive roll-up"),
        "yearly": _bucket(items, "%Y", "Yearly portfolio roll-up"),
    }


def all_evidence_summary() -> dict[str, Any]:
    return build_evidence_summary()
