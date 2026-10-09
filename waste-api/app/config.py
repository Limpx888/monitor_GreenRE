"""
Application configuration loaded from environment variables.
"""

import os
from pathlib import Path
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Model
    model_path: str = os.path.join(os.path.dirname(__file__), "..", "..", "best (4).pt")
    confidence_threshold: float = 0.4
    review_threshold: float = 0.25

    # Database
    database_url: str = "sqlite:///./waste.db"

    # JWT Auth
    secret_key: str = "change-me-in-production-use-openssl-rand-hex-32"
    access_token_expire_minutes: int = 480
    algorithm: str = "HS256"

    # Storage
    upload_dir: str = "./uploads"
    export_dir: str = "./exports"

    # Server
    host: str = "0.0.0.0"
    port: int = 8000
    cors_origins: str = "http://localhost:5173,http://localhost:3000"

    # Demo mode
    demo_mode: bool = True

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",")]


settings = Settings()

# Ensure directories exist
Path(settings.upload_dir).mkdir(parents=True, exist_ok=True)
Path(settings.export_dir).mkdir(parents=True, exist_ok=True)
