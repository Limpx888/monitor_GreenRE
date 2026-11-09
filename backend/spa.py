"""Serve the built React frontend (frontend/dist) from the API process.

Used by the single-container deployment: one origin for the UI, the REST API
and the /ws WebSocket. Client-side routes (/indoor, /reports, …) fall back to
index.html. API, WebSocket and docs paths are never shadowed because this
catch-all is registered after every router.
"""

from __future__ import annotations

import os
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse

RESERVED = ("api/", "ws/", "docs", "redoc", "openapi.json")


def mount_spa(app: FastAPI) -> bool:
    dist = Path(os.getenv("FRONTEND_DIST", Path(__file__).resolve().parent.parent / "frontend" / "dist"))
    index = dist / "index.html"
    if not index.is_file():
        return False
    root = dist.resolve()

    @app.get("/{full_path:path}", include_in_schema=False)
    def spa(full_path: str):
        if full_path.startswith(RESERVED):
            raise HTTPException(status_code=404)
        candidate = (dist / full_path).resolve()
        if full_path and candidate.is_file() and root in candidate.parents:
            # Hashed build assets can be cached for a year; everything else revalidates
            cache = "public, max-age=31536000, immutable" if full_path.startswith("assets/") else "no-cache"
            return FileResponse(candidate, headers={"Cache-Control": cache})
        return FileResponse(index, headers={"Cache-Control": "no-cache"})

    print(f"[SPA] serving frontend from {dist}")
    return True
