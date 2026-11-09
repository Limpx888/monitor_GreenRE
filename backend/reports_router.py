"""Overall analytics report endpoints.

GET /api/v1/reports/overview?start=&end=      JSON for the /reports page
GET /api/v1/reports/overview.pdf?start=&end=  PDF download; a copy is archived (Azure Blob or local disk)
GET /api/v1/reports/history                   archived PDFs, newest first
GET /api/v1/reports/files/{name}              download an archived PDF
"""

from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from sqlalchemy.orm import Session

from blob_store import reports_store
from database import get_db
from overview_pdf import build_overview_pdf
from report_service import build_overview

router = APIRouter(prefix="/api/v1/reports", tags=["Reports"])


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
