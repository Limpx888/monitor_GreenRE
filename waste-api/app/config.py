"""
Application configuration loaded from environment variables.
"""

import os
from pathlib import Path
from pydantic import Field, AliasChoices
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_dir: Path = Path(__file__).resolve().parent.parent

    # Model
    model_path: str = str(Path(__file__).resolve().parents[2] / "best (4).pt")
    confidence_threshold: float = 0.4
    review_threshold: float = 0.25

    # Azure Blob Storage — model download
    azure_storage_connection_string: str = Field(
        "",
        validation_alias=AliasChoices(
            "AZURE_STORAGE_CONNECTION_STRING",
            "WASTE_AZURE_STORAGE_CONNECTION_STRING",
            "azure_storage_connection_string",
        ),
    )
    azure_storage_models_container: str = Field(
        "models",
        validation_alias=AliasChoices(
            "AZURE_STORAGE_MODELS_CONTAINER",
            "WASTE_AZURE_STORAGE_MODELS_CONTAINER",
            "azure_storage_models_container",
        ),
    )
    waste_model_blob: str = Field(
        "best (4).pt",
        validation_alias=AliasChoices(
            "WASTE_MODEL_BLOB",
            "waste_model_blob",
        ),
    )

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
        "env_file": [
            str(Path(__file__).resolve().parent.parent / ".env"),
            str(Path(__file__).resolve().parents[2] / "backend" / ".env"),
        ],
        "env_file_encoding": "utf-8",
        "env_prefix": "WASTE_",
        "extra": "ignore",
    }

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",")]


settings = Settings()

# Ensure directories exist
Path(settings.upload_dir).mkdir(parents=True, exist_ok=True)
Path(settings.export_dir).mkdir(parents=True, exist_ok=True)
