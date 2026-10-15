"""SQLAlchemy engine/session bound to the existing Supabase Postgres URL."""

import os
from urllib.parse import quote_plus

from dotenv import load_dotenv
from sqlalchemy import create_engine, text
from sqlalchemy.orm import declarative_base, sessionmaker

load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env"))

Base = declarative_base()

POOLER_HOSTS = [
    os.getenv("SUPABASE_POOLER_HOST", "").strip(),
    "aws-0-ap-southeast-2.pooler.supabase.com",
    "aws-1-ap-southeast-1.pooler.supabase.com",
    "aws-0-ap-southeast-1.pooler.supabase.com",
]


def _split_dsn(raw: str):
    if not raw:
        raise RuntimeError("DATABASE_URL is not set in backend/.env")
    if raw.startswith("postgresql+"):
        return None
    if not raw.startswith("postgresql://"):
        return None
    rest = raw[len("postgresql://") :]
    at = rest.rfind("@")
    if at == -1:
        raise RuntimeError("DATABASE_URL is missing host separator")
    userinfo, hostpart = rest[:at], rest[at + 1 :]
    user, _, password = userinfo.partition(":")
    host = hostpart.split("/")[0].split(":")[0]
    dbname = hostpart.split("/", 1)[1].split("?", 1)[0] if "/" in hostpart else "postgres"
    return user, password, host, dbname, hostpart


def candidate_database_urls(raw: str) -> list[str]:
    parsed = _split_dsn(raw)
    if parsed is None:
        url = raw
        if "sslmode=" not in url:
            url += ("&" if "?" in url else "?") + "sslmode=require"
        return [url]

    user, password, host, dbname, hostpart = parsed
    encoded = quote_plus(password)
    urls = []

    if host.startswith("db.") and host.endswith(".supabase.co"):
        project_ref = host.split(".")[1]
        seen = set()
        for pooler_host in POOLER_HOSTS:
            if not pooler_host or pooler_host in seen:
                continue
            seen.add(pooler_host)
            urls.append(
                f"postgresql+pg8000://postgres.{project_ref}:{encoded}"
                f"@{pooler_host}:5432/{dbname}"
            )
        urls.append(f"postgresql+pg8000://{user}:{encoded}@{hostpart.split('?')[0]}")
        return urls

    return [f"postgresql+pg8000://{user}:{encoded}@{hostpart.split('?')[0]}"]


def _try_engine(url: str):
    connect_args = {"timeout": 8}
    if url.startswith("postgresql+pg8000"):
        connect_args["ssl_context"] = True
    engine = create_engine(
        url,
        pool_pre_ping=True,
        pool_size=5,
        max_overflow=10,
        connect_args=connect_args,
    )
    with engine.connect() as connection:
        connection.execute(text("SELECT 1"))
    return engine


def build_engine():
    raw = os.getenv("DATABASE_URL", "").strip()
    last_error = None
    if raw:
        try:
            for url in candidate_database_urls(raw):
                host = url.split("@")[-1].split("/")[0]
                try:
                    engine = _try_engine(url)
                    print(f"[EMS] Connected to Postgres via {host}")
                    return engine
                except Exception as error:
                    last_error = error
                    print(f"[EMS] Postgres candidate failed ({host}): {error.__class__.__name__}")
        except Exception as err:
            last_error = err

    fallback = os.getenv("EMS_SQLITE_FALLBACK", "sqlite:///./ems_local.db")
    print(f"[EMS] Remote Postgres not configured or unreachable; using local SQLite {fallback}")
    if last_error:
        print(f"[EMS] Last Postgres error: {last_error.__class__.__name__}")
    return create_engine(fallback, pool_pre_ping=True)


engine = build_engine()
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
