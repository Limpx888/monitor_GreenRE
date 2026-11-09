"""Overall analytics report: one JSON document covering every GoGreen module.

build_overview(db, start, end) gathers energy, carbon, indoor air, water, waste
and alarms for a date range. Each section is gathered independently, so a
failing data source marks only its own section as unavailable (it never makes
up numbers). The same dict feeds the /reports page and the PDF export.
"""

from __future__ import annotations

import json
import re
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

from sqlalchemy import func
from sqlalchemy.orm import Session

GRID_FACTOR = 0.585  # kg CO2e per kWh, Malaysia Peninsular grid 2023


def _aware(dt: datetime) -> datetime:
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def _section(fn, *args, **kwargs) -> dict:
    try:
        data = fn(*args, **kwargs)
        return {"available": True, **data}
    except Exception as exc:  # one broken source must not break the report
        print(f"[Report] {fn.__name__} unavailable: {exc}")
        return {"available": False, "reason": "source unavailable"}


# ── Sections ────────────────────────────────────────────────────────────────

def _energy(db: Session, start: datetime, end: datetime) -> dict:
    from db_models import MeterReading
    from ems_service import zone_consumption

    summary = zone_consumption(db, start, end)
    day = func.date(MeterReading.timestamp)
    rows = (
        db.query(day, func.sum(MeterReading.reading_kwh))
        .filter(MeterReading.meter_type == "electricity", MeterReading.timestamp >= start, MeterReading.timestamp <= end)
        .group_by(day)
        .order_by(day)
        .all()
    )
    kwh = float(summary.total_energy_kwh or 0)
    return {
        "total_kwh": round(kwh, 1),
        "total_cost_myr": round(float(summary.total_cost_myr or 0), 2),
        "carbon_kg": round(float(summary.total_carbon_kgco2e or kwh * GRID_FACTOR), 1),
        "peak_demand_kw": summary.peak_demand_kw,
        "building_eei": round(float(summary.building_eei_kwh_m2_yr or 0), 1),
        "compliance_status": summary.building_compliance_status,
        "window_hours": summary.window_hours,
        "zones": [
            {
                "name": z.name,
                "floors": z.floors_label,
                "kwh": round(z.energy_kwh, 1),
                "eei": round(z.eei_kwh_m2_yr, 1),
                "baseline_eei": z.eei_baseline_kwh_m2_yr,
                "status": z.compliance_status,
                "cost_myr": round(z.total_cost_myr or 0, 2),
            }
            for z in summary.zones
        ],
        "daily": [{"date": str(d), "kwh": round(float(v or 0), 1)} for d, v in rows],
    }


def _indoor(db: Session) -> dict:
    from ems_router import get_ieq_live_data

    data = get_ieq_live_data(db)
    floors = data.get("floors", [])
    if not floors:
        raise ValueError("no IEQ readings")
    return {
        "snapshot_at": data.get("timestamp"),
        "overall_status": data.get("overall_status"),
        "threshold_ppm": data.get("co2_threshold_ppm", 1000.0),
        "max_co2": data.get("max_co2"),
        "avg_co2": round(sum(f["co2"] for f in floors) / len(floors), 1),
        "avg_pm25": round(sum(f["pm25"] for f in floors) / len(floors), 1),
        "compliant_floors": sum(1 for f in floors if f["status"] == "NORMAL"),
        "total_floors": len(floors),
        "floors": [
            {"floor": f["floor_id"], "name": f["name"], "co2": f["co2"], "pm25": f["pm25"], "status": f["status"]}
            for f in floors
        ],
    }


def _water() -> dict:
    from water_live_db import get_store

    store = get_store()
    kpi = store.get_kpis()
    dist = store.get_live_fluid_distribution(24)
    if not kpi.get("active_meters") and not dist:
        raise ValueError("no live water meters reporting")
    return {
        "register_m3": kpi.get("total_volume_m3"),
        "flow_m3_per_hr": kpi.get("total_flow_m3_per_hr"),
        "active_meters": kpi.get("active_meters"),
        "distribution_24h": dist,
    }


def _waste(start: datetime, end: datetime) -> dict:
    from app.database import SessionLocal
    from app.models import Scan, Site
    from app.services.analytics_service import compute_analytics

    wdb = SessionLocal()
    try:
        # The site with the most scans is the one actually being monitored
        site = (
            wdb.query(Site).outerjoin(Scan, Scan.site_id == Site.id)
            .group_by(Site.id).order_by(func.count(Scan.id).desc(), Site.name).first()
        )
        if not site:
            raise ValueError("no waste site configured")
        a = compute_analytics(wdb, site.id, start_date=start, end_date=end)
    finally:
        wdb.close()
    return {
        "site": site.name,
        "total_kg": a["total_waste_kg"],
        "items": a["total_items"],
        "recycling_rate": a["recycling_rate"],
        "diversion_rate": a["diversion_rate"],
        "contamination_rate": a["contamination_rate"],
        "co2e_avoided_kg": a["co2e_avoided_kg"],
        "categories": a.get("category_breakdown", []),
        "daily": a.get("daily_trend", []),
    }


def _alarms(db: Session, start: datetime, end: datetime) -> dict:
    from db_models import Alarm

    q = db.query(Alarm).filter(Alarm.generated_at >= start, Alarm.generated_at <= end)
    rows = q.order_by(Alarm.generated_at.desc()).all()
    by_sev: dict[str, int] = {}
    for a in rows:
        by_sev[str(a.severity)] = by_sev.get(str(a.severity), 0) + 1
    return {
        "total": len(rows),
        "open": sum(1 for a in rows if str(a.state).upper().endswith("OPEN")),
        "by_severity": by_sev,
        "recent": [
            {"code": a.alarm_code, "severity": str(a.severity), "state": str(a.state), "at": a.generated_at.isoformat(), "description": a.description}
            for a in rows[:8]
        ],
    }


def _savings() -> dict:
    from pathlib import Path

    path = Path(__file__).parent / "experiments" / "results" / "sustainability_experiment_results.json"
    data = json.loads(path.read_text(encoding="utf-8"))
    return {
        "co2e_saved_kg": data.get("total_co2e_saved_kg"),
        "energy_saved_kwh": data.get("total_energy_saved_kwh"),
        "cost_saved_myr": data.get("total_cost_saved_myr"),
        "eei_before": data.get("greenre_eei_before"),
        "eei_after": data.get("greenre_eei_after"),
        "is_simulated": data.get("is_simulated", True),
    }


# ── Summary ─────────────────────────────────────────────────────────────────

def _highlights(r: dict) -> list[str]:
    out = []
    e, i, w, ws, al = r["energy"], r["indoor"], r["water"], r["waste"], r["alarms"]
    if e.get("available"):
        warn = [z["name"] for z in e["zones"] if z["status"] != "compliant"]
        out.append(f"Energy: {e['total_kwh']:,.0f} kWh, RM {e['total_cost_myr']:,.0f}, {e['carbon_kg'] / 1000:,.1f} t CO2e."
                   + (f" Zones above EEI baseline: {', '.join(warn)}." if warn else " All zones within EEI baseline."))
    if i.get("available"):
        out.append(f"Indoor air: {i['compliant_floors']}/{i['total_floors']} floors within the {i['threshold_ppm']:.0f} ppm CO2 limit (peak {i['max_co2']:.0f} ppm).")
    if w.get("available"):
        out.append(f"Water: {w['active_meters']} live meters, {w['flow_m3_per_hr']:.2f} m3/h current flow.")
    if ws.get("available"):
        out.append(f"Waste: {ws['total_kg']:,.1f} kg, recycling {ws['recycling_rate']}%, contamination {ws['contamination_rate']}%.")
    if al.get("available"):
        out.append(f"Alarms: {al['total']} raised, {al['open']} still open.")
    return out


def _ai_summary(report: dict) -> dict:
    """Azure OpenAI (or another configured LLM) writes the executive summary; deterministic text otherwise."""
    highlights = _highlights(report)
    fallback = {
        "source": "rules",
        "summary": " ".join(highlights) or "No module data was available for this period.",
        "actions": [],
    }
    try:
        from llm_client import llm_client

        provider = llm_client.get_active_provider_info().get("active_provider")
        if provider not in ("azure", "gemini", "openai"):
            return fallback
        compact = {("savings_from_simulated_experiment" if k == "savings" else k): {kk: vv for kk, vv in v.items() if kk not in ("daily", "floors", "zones", "recent", "categories", "distribution_24h")}
                   for k, v in report.items() if isinstance(v, dict)}
        text = llm_client.generate(
            prompt=(
                "You are a GreenRE sustainability analyst for The Light City Penang. Using ONLY the data below, "
                "write an executive summary (max 120 words) and the 3 most valuable next actions. "
                "Sections with available=false had no data; say so briefly. Savings come from a simulated experiment, not this period. "
                'Reply as JSON: {"summary": str, "actions": [str, str, str]}.\n\nDATA:\n' + json.dumps(compact, default=str)
            ),
            system_prompt="Be factual and concise. Never invent numbers that are not in the data.",
            json_mode=True,
            temperature=0.2,
        )
        match = re.search(r"\{.*\}", text, re.S)
        parsed = json.loads(match.group(0)) if match else {}
        if not parsed.get("summary"):
            return fallback
        return {"source": provider, "summary": str(parsed["summary"]), "actions": [str(a) for a in parsed.get("actions", [])][:3]}
    except Exception as exc:
        print(f"[Report] AI summary fell back to rules: {exc}")
        return fallback


# ── Entry point ─────────────────────────────────────────────────────────────

def resolve_range(start: Optional[datetime], end: Optional[datetime]) -> tuple[datetime, datetime]:
    end = _aware(end) if end else datetime.now(timezone.utc)
    start = _aware(start) if start else end - timedelta(days=30)
    if start >= end:
        raise ValueError("start must be before end")
    return start, end


def build_overview(db: Session, start: Optional[datetime] = None, end: Optional[datetime] = None, with_ai: bool = True) -> dict[str, Any]:
    start, end = resolve_range(start, end)
    report: dict[str, Any] = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "period": {"start": start.isoformat(), "end": end.isoformat()},
        "facility": "The Light City Penang",
        "energy": _section(_energy, db, start, end),
        "indoor": _section(_indoor, db),
        "water": _section(_water),
        "waste": _section(_waste, start, end),
        "alarms": _section(_alarms, db, start, end),
        "savings": _section(_savings),
    }
    report["highlights"] = _highlights(report)
    report["ai_summary"] = _ai_summary(report) if with_ai else None
    return report
