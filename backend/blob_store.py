"""Tiny file store: Azure Blob Storage when configured, local folder otherwise.

Config (environment / Key Vault, never hardcoded):
  AZURE_STORAGE_CONNECTION_STRING   enables Blob Storage
  AZURE_STORAGE_REPORTS_CONTAINER   default "reports"
Files are always served back through the API, so containers stay private.
"""

from __future__ import annotations

import os
import re
from datetime import datetime, timezone
from pathlib import Path

LOCAL_ROOT = Path(__file__).parent / "data" / "files"
_SAFE = re.compile(r"^[A-Za-z0-9._-]{1,120}$")


def _check(name: str) -> str:
    if not _SAFE.match(name):
        raise ValueError("invalid file name")
    return name


class FileStore:
    def __init__(self, container: str):
        self.container = container
        self._client = None
        conn = os.getenv("AZURE_STORAGE_CONNECTION_STRING", "").strip()
        if conn:
            try:
                from azure.storage.blob import BlobServiceClient

                service = BlobServiceClient.from_connection_string(conn)
                client = service.get_container_client(container)
                if not client.exists():
                    client.create_container()
                self._client = client
            except Exception as exc:
                print(f"[FileStore] Blob Storage unavailable for '{container}', using local disk: {exc}")
        self._local = LOCAL_ROOT / container
        if self._client is None:
            self._local.mkdir(parents=True, exist_ok=True)

    @property
    def backend(self) -> str:
        return "azure-blob" if self._client is not None else "local"

    def put(self, name: str, data: bytes, content_type: str = "application/octet-stream") -> None:
        name = _check(name)
        if self._client is not None:
            from azure.storage.blob import ContentSettings

            self._client.upload_blob(name, data, overwrite=True, content_settings=ContentSettings(content_type=content_type))
        else:
            (self._local / name).write_bytes(data)

    def get(self, name: str) -> bytes:
        name = _check(name)
        if self._client is not None:
            return self._client.download_blob(name).readall()
        path = self._local / name
        if not path.is_file():
            raise FileNotFoundError(name)
        return path.read_bytes()

    def list(self, limit: int = 50) -> list[dict]:
        items = []
        if self._client is not None:
            for b in self._client.list_blobs():
                items.append({"name": b.name, "size": b.size, "created_at": b.last_modified.isoformat() if b.last_modified else None})
        else:
            for p in self._local.glob("*"):
                st = p.stat()
                items.append({"name": p.name, "size": st.st_size, "created_at": datetime.fromtimestamp(st.st_mtime, timezone.utc).isoformat()})
        items.sort(key=lambda x: x["created_at"] or "", reverse=True)
        return items[:limit]


_stores: dict[str, FileStore] = {}


def get_store(container: str) -> FileStore:
    if container not in _stores:
        _stores[container] = FileStore(container)
    return _stores[container]


def reports_store() -> FileStore:
    return get_store(os.getenv("AZURE_STORAGE_REPORTS_CONTAINER", "reports"))
