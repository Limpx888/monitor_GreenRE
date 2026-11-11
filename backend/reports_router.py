"""Overall analytics report endpoints.

GET /api/v1/reports/overview?start=&end=      JSON for the /reports page
GET /api/v1/reports/overview.pdf?start=&end=  PDF download; a copy is archived (Azure Blob or local disk)
GET /api/v1/reports/full.pdf?start=&end=      one-click export: overview + GreenRE audit dossier in one PDF (archived)
GET /api/v1/reports/history                   archived PDFs, newest first
GET /api/v1/reports/files/{name}              download an archived PDF
"""

from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from typing import Any, Optional

from fastapi import APIRouter, Body, Depends, HTTPException, Query
from fastapi.responses import Response
from sqlalchemy.orm import Session

from blob_store import reports_store
from database import get_db
from overview_pdf import build_overview_pdf
from report_service import build_overview
from scenario_evidence import build_evidence_summary, record_intervention

router = APIRouter(prefix="/api/v1/reports", tags=["Reports"])


@router.post("/scenario-interventions")
async def scenario_intervention(payload: dict[str, Any] = Body(...)):
    """Persist a Digital Twin approval for future reports and PDF evidence."""
    required = ("id", "scenarioId", "scenarioTitle", "savedAt", "amount")
    missing = [key for key in required if not payload.get(key)]
    if missing:
        raise HTTPException(status_code=422, detail=f"Missing scenario evidence fields: {', '.join(missing)}")
    return await asyncio.to_thread(record_intervention, payload)


@router.get("/scenario-evidence")
async def scenario_evidence(
    start: Optional[datetime] = Query(None),
    end: Optional[datetime] = Query(None),
):
    return await asyncio.to_thread(build_evidence_summary, start, end)


def _report(db: Session, start: Optional[datetime], end: Optional[datetime], with_ai: bool) -> dict:
    try:
        return build_overview(db, start, end, with_ai=with_ai)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.get("/overview")
async def overview(
    start: Optional[datetime] = Query(None, description="ISO date/time; default 30 days before end"),
    end: Optional[datetime] = Query(None, description="ISO date/time; default now"),
    ai: bool = Query(True, description="Include the AI executive summary"),
    db: Session = Depends(get_db),
):
    return await asyncio.to_thread(_report, db, start, end, ai)


@router.get("/overview.pdf")
async def overview_pdf(
    start: Optional[datetime] = Query(None),
    end: Optional[datetime] = Query(None),
    db: Session = Depends(get_db),
):
    data = await asyncio.to_thread(_report, db, start, end, True)
    pdf = await asyncio.to_thread(build_overview_pdf, data)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
    name = f"gogreen-report-{data['period']['start'][:10]}_{data['period']['end'][:10]}-{stamp}.pdf"
    archived = True
    try:
        await asyncio.to_thread(reports_store().put, name, pdf, "application/pdf")
    except Exception as exc:  # the download still works if archiving fails
        print(f"[Reports] archive failed: {exc}")
        archived = False
    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{name}"',
            "X-Report-Archived": "true" if archived else "false",
            "X-Report-Store": reports_store().backend,
            "Access-Control-Expose-Headers": "Content-Disposition, X-Report-Archived, X-Report-Store",
        },
    )


def _merge_pdfs(parts: list[tuple[str, bytes]]) -> bytes:
    """Concatenate PDFs into one file with a top-level bookmark per part."""
    from io import BytesIO

    from pypdf import PdfReader, PdfWriter

    writer = PdfWriter()
    for title, data in parts:
        start = len(writer.pages)
        writer.append(PdfReader(BytesIO(data)))
        writer.add_outline_item(title, start)
    writer.add_metadata({"/Title": "GoGreen full sustainability report", "/Author": "GoGreen"})
    out = BytesIO()
    writer.write(out)
    return out.getvalue()


def _build_full_report(db: Session, start: Optional[datetime], end: Optional[datetime]) -> tuple[dict, bytes]:
    # One thread, one session: the two builders run sequentially on the same db session
    from reports import build_greenre_pdf

    data = _report(db, start, end, True)
    overview = build_overview_pdf(data)
    dossier = build_greenre_pdf(db)
    merged = _merge_pdfs([
        ("Part 1: Sustainability overview", overview),
        ("Part 2: GreenRE compliance audit dossier", dossier),
    ])
    return data, merged


@router.get("/full.pdf")
async def full_report_pdf(
    start: Optional[datetime] = Query(None),
    end: Optional[datetime] = Query(None),
    db: Session = Depends(get_db),
):
    """One-click export: the sustainability overview for the period followed by the GreenRE audit dossier."""
    try:
        data, pdf = await asyncio.to_thread(_build_full_report, db, start, end)
    except HTTPException:
        raise
    except Exception as exc:
        print(f"[Reports] full report build failed: {exc}")
        raise HTTPException(status_code=500, detail=f"Full report generation failed: {exc}") from exc
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
    name = f"gogreen-full-report-{data['period']['start'][:10]}_{data['period']['end'][:10]}-{stamp}.pdf"
    archived = True
    try:
        await asyncio.to_thread(reports_store().put, name, pdf, "application/pdf")
    except Exception as exc:  # the download still works if archiving fails
        print(f"[Reports] archive failed: {exc}")
        archived = False
    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{name}"',
            "X-Report-Archived": "true" if archived else "false",
            "X-Report-Store": reports_store().backend,
            "Access-Control-Expose-Headers": "Content-Disposition, X-Report-Archived, X-Report-Store",
        },
    )


@router.get("/history")
async def history(limit: int = Query(30, ge=1, le=200)):
    store = reports_store()
    items = await asyncio.to_thread(store.list, limit)
    return {"store": store.backend, "reports": [i for i in items if i["name"].endswith(".pdf")]}


@router.get("/files/{name}")
async def download(name: str):
    try:
        data = await asyncio.to_thread(reports_store().get, name)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="invalid file name") from exc
    except Exception as exc:
        raise HTTPException(status_code=404, detail="report not found") from exc
    return Response(content=data, media_type="application/pdf", headers={"Content-Disposition": f'attachment; filename="{name}"'})
