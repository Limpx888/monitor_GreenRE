"""
Application configuration loaded from environment variables.
"""

import os
from pathlib import Path
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_dir: Path = Path(__file__).resolve().parent.parent

    # Model
    model_path: str = str(Path(__file__).resolve().parents[2] / "best (4).pt")
    confidence_threshold: float = 0.4
    review_threshold: float = 0.25

    # Database
    database_url: str = f"sqlite:///{Path(__file__).resolve().parent.parent / 'waste.db'}"

    # JWT Auth
    secret_key: str = "change-me-in-production-use-openssl-rand-hex-32"
    access_token_expire_minutes: int = 480
    algorithm: str = "HS256"

    # Storage
    upload_dir: str = str(Path(__file__).resolve().parent.parent / "uploads")
    export_dir: str = str(Path(__file__).resolve().parent.parent / "exports")

    # Server
    host: str = "0.0.0.0"
    port: int = 5000
    cors_origins: str = "http://localhost:5173,http://localhost:3000"

    # Demo mode
    demo_mode: bool = True

    model_config = {
        "env_file": str(Path(__file__).resolve().parent.parent / ".env"),
        "env_file_encoding": "utf-8",
        "env_prefix": "WASTE_",
    }

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",")]


settings = Settings()

# Ensure directories exist
Path(settings.upload_dir).mkdir(parents=True, exist_ok=True)
Path(settings.export_dir).mkdir(parents=True, exist_ok=True)
