"""
FastAPI application entry point.
Loads the YOLO model at startup, creates database tables,
seeds default waste class configs, and mounts all routers.
"""

import os
import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse

from app.config import settings
from app.database import init_db, SessionLocal
from app.models import WasteClassConfig
from app.services.categorizer import DEFAULT_CLASS_MAP

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events."""
    await initialize_waste_api()
    yield
    logger.info("🔴 Shutting down Waste Management API...")


async def initialize_waste_api():
    """Initialize waste database, model, and demo data for an embedded app."""
    # ── STARTUP ──
    logger.info("🚀 Starting Waste Management API...")

    # 1. Create database tables
    init_db()
    logger.info("✅ Database tables created.")

    # 2. Load YOLO model
    model_names = {}
    try:
        from app.services.detector import load_model
        model_names = load_model(settings.model_path)
        logger.info(f"✅ YOLO model loaded with {len(model_names)} classes.")
    except FileNotFoundError:
        logger.warning(
            f"⚠️  Model file not found at '{settings.model_path}'. "
            "Detection endpoint will return an error until a valid model is provided. "
            "Set MODEL_PATH in your .env file."
        )
    except Exception as e:
        logger.warning(f"⚠️  Failed to load model: {e}. Detection endpoint will be unavailable.")

    # 3. Sync model classes with waste_class_config table
    db = SessionLocal()
    try:
        existing_classes = {c.class_name for c in db.query(WasteClassConfig).filter(WasteClassConfig.site_id == None).all()}

        # Seed from DEFAULT_CLASS_MAP for classes not yet in DB
        for class_name, config in DEFAULT_CLASS_MAP.items():
            if class_name not in existing_classes:
                wc = WasteClassConfig(
                    site_id=None,
                    class_name=class_name,
                    category=config["category"],
                    material=config["material"],
                    avg_weight_kg=config["avg_weight_kg"],
                    emission_factor_kgco2e=config["emission_factor_kgco2e"],
                    recyclable_locally=config.get("recyclable_locally", False),
                    tip_reduce=config.get("tip_reduce"),
                    tip_reuse=config.get("tip_reuse"),
                    tip_recycle=config.get("tip_recycle"),
                )
                db.add(wc)
                logger.info(f"  Seeded config: {class_name} → {config['category']}")

        # Auto-create any model class not in DEFAULT_CLASS_MAP with category=REVIEW
        for cls_id, cls_name in model_names.items():
            if cls_name not in existing_classes and cls_name not in DEFAULT_CLASS_MAP:
                wc = WasteClassConfig(
                    site_id=None,
                    class_name=cls_name,
                    category="REVIEW",
                    material="unknown",
                    avg_weight_kg=0.05,
                    emission_factor_kgco2e=1.0,
                )
                db.add(wc)
                logger.info(f"  Auto-created config for unknown class: {cls_name} → REVIEW")

        db.commit()
        logger.info("✅ Waste class configs synced.")
    except Exception as e:
        logger.error(f"Error syncing waste configs: {e}")
        db.rollback()
    finally:
        db.close()

    # 4. Run seed if demo mode and no users exist
    if settings.demo_mode:
        db = SessionLocal()
        from app.models import User
        user_count = db.query(User).count()
        db.close()
        if user_count == 0:
            logger.info("📦 Demo mode: Seeding demo data...")
            from app.seed import seed_demo_data
            seed_demo_data()
            logger.info("✅ Demo data seeded.")

    logger.info(f"🟢 API ready at http://{settings.host}:{settings.port}")
    logger.info(f"📖 Docs at http://{settings.host}:{settings.port}/docs")


# ── Create FastAPI App ──
app = FastAPI(
    title="AI Waste Management API",
    description=(
        "AI-powered waste detection, classification, and analytics platform "
        "supporting GreenRE certification and 3R (Reduce, Reuse, Recycle) action plans."
    ),
    version="1.0.0",
    lifespan=lifespan,
)

# ── CORS ──
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Mount static files for uploaded images ──
uploads_path = Path(settings.upload_dir).resolve()
uploads_path.mkdir(parents=True, exist_ok=True)
app.mount("/api/v1/uploads", StaticFiles(directory=str(uploads_path)), name="uploads")

# ── Register Routers ──
from app.routers.auth_router import router as auth_router
from app.routers.detect_router import router as detect_router
from app.routers.scans_router import router as scans_router
from app.routers.analytics_router import router as analytics_router
from app.routers.config_router import router as config_router
from app.routers.actions_router import router as actions_router
from app.routers.greenre_router import router as greenre_router
from app.routers.collections_router import router as collections_router

app.include_router(auth_router)
app.include_router(detect_router)
app.include_router(scans_router)
app.include_router(analytics_router)
app.include_router(config_router)
app.include_router(actions_router)
app.include_router(greenre_router)
app.include_router(collections_router)


# ── Health Check ──
@app.get("/health")
def health_check():
    """Health check endpoint."""
    from app.services.detector import get_model_names
    model_loaded = len(get_model_names()) > 0
    return {
        "status": "healthy",
        "model_loaded": model_loaded,
        "model_classes": len(get_model_names()),
        "demo_mode": settings.demo_mode,
    }


@app.get("/api/v1/category-info")
def get_category_info():
    """Return category display metadata for the frontend."""
    from app.services.categorizer import CATEGORY_INFO
    return CATEGORY_INFO


# ── Global Error Handler ──
@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    logger.error(f"Unhandled error: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error. Please try again."},
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host=settings.host,
        port=settings.port,
        reload=True,
    )
