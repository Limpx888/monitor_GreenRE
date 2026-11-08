"""
YOLO model wrapper for waste detection.
Loads the model once at startup — downloads from Azure Blob Storage
on first run, then reuses the local cache.
"""

import logging
import io
import os
from pathlib import Path
from typing import Optional
from PIL import Image

logger = logging.getLogger(__name__)

# Singleton model holder
_model = None
_model_names = {}


def _download_model_from_azure(local_path: Path) -> None:
    """Download the YOLO weights file from Azure Blob Storage."""
    from app.config import settings

    conn_str = settings.azure_storage_connection_string
    container = settings.azure_storage_models_container
    blob_name = settings.waste_model_blob

    if not conn_str:
        raise EnvironmentError(
            "AZURE_STORAGE_CONNECTION_STRING is not set. "
            "Cannot download model from Azure Blob Storage."
        )

    logger.info(
        f"Downloading model from Azure Blob Storage: "
        f"container={container!r}, blob={blob_name!r} → {local_path}"
    )
    try:
        from azure.storage.blob import BlobServiceClient

        client = BlobServiceClient.from_connection_string(conn_str)
        blob_client = client.get_blob_client(container=container, blob=blob_name)

        local_path.parent.mkdir(parents=True, exist_ok=True)
        with open(local_path, "wb") as f:
            f.write(blob_client.download_blob().readall())

        size_mb = local_path.stat().st_size / (1024 * 1024)
        logger.info(f"✅ Model downloaded successfully ({size_mb:.1f} MB)")
    except Exception as e:
        # Clean up partial download
        if local_path.exists():
            local_path.unlink()
        logger.error(f"Failed to download model from Azure: {e}")
        raise


def load_model(model_path: str):
    """Load YOLO model at startup. Called once from main.py.

    If the weights file does not exist locally it is automatically
    downloaded from Azure Blob Storage (container/blob configured via
    AZURE_STORAGE_CONNECTION_STRING, AZURE_STORAGE_MODELS_CONTAINER,
    and WASTE_MODEL_BLOB environment variables).
    """
    global _model, _model_names

    resolved = Path(model_path).resolve()

    # ── Auto-download from Azure if local file is missing ──
    if not resolved.exists():
        logger.warning(f"Model not found locally at {resolved}. Attempting Azure Blob download...")
        _download_model_from_azure(resolved)

    logger.info(f"Loading YOLO model from {resolved}...")
    try:
        from ultralytics import YOLO
        _model = YOLO(str(resolved))
        _model_names = _model.names  # {0: "Aerosols", 1: "Aluminum can", ...}
        logger.info(f"Model loaded successfully. {len(_model_names)} classes: {list(_model_names.values())}")
        return _model_names
    except Exception as e:
        logger.error(f"Failed to load YOLO model: {e}")
        raise


def get_model():
    """Return loaded model. Raises if not loaded."""
    if _model is None:
        raise RuntimeError("YOLO model not loaded. Check MODEL_PATH configuration.")
    return _model


def get_model_names() -> dict:
    """Return class names dict from model."""
    return _model_names


def run_inference(
    image_bytes: bytes,
    confidence_threshold: float = 0.4,
    review_threshold: float = 0.25,
    generate_annotated: bool = True,
) -> dict:
    """
    Run YOLO inference on an image.

    Returns:
        {
            "detections": [
                {
                    "class_name": str,
                    "class_id": int,
                    "confidence": float,
                    "bbox": {"x1": float, "y1": float, "x2": float, "y2": float},
                    "needs_review": bool,
                },
                ...
            ],
            "annotated_image_bytes": bytes,  # JPEG bytes of annotated image
            "image_width": int,
            "image_height": int,
        }
    """
    model = get_model()

    # Open image
    image = Image.open(io.BytesIO(image_bytes))
    if image.mode != "RGB":
        image = image.convert("RGB")

    width, height = image.size

    # Run inference — use the lower threshold to catch "needs review" items too
    results = model(image, conf=review_threshold, verbose=False)

    detections = []
    if results and len(results) > 0:
        result = results[0]
        boxes = result.boxes

        if boxes is not None and len(boxes) > 0:
            for box in boxes:
                cls_id = int(box.cls[0].item())
                conf = float(box.conf[0].item())
                x1, y1, x2, y2 = box.xyxy[0].tolist()

                class_name = _model_names.get(cls_id, f"Unknown_{cls_id}")

                detections.append({
                    "class_name": class_name,
                    "class_id": cls_id,
                    "confidence": round(conf, 4),
                    "bbox": {
                        "x1": round(x1, 1),
                        "y1": round(y1, 1),
                        "x2": round(x2, 1),
                        "y2": round(y2, 1),
                    },
                    "needs_review": conf < confidence_threshold,
                })

    # Generate annotated image
    annotated_bytes = b""
    try:
        if generate_annotated and results and len(results) > 0:
            annotated = results[0].plot()
            from PIL import Image as PILImage
            import numpy as np
            annotated_rgb = annotated[:, :, ::-1]
            ann_img = PILImage.fromarray(annotated_rgb)
            buf = io.BytesIO()
            ann_img.save(buf, format="JPEG", quality=85)
            annotated_bytes = buf.getvalue()
    except Exception as e:
        logger.warning(f"Could not generate annotated image: {e}")

    return {
        "detections": detections,
        "annotated_image_bytes": annotated_bytes,
        "image_width": width,
        "image_height": height,
    }
