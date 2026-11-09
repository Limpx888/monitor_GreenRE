# GoGreen: one container serving the React frontend, the FastAPI backend (EMS,
# water, reports), the embedded waste-api and a local MQTT broker for the live
# water simulator. Secrets come from Azure Key Vault at runtime (AZURE_KEYVAULT_URL),
# never from the image.

# ── 1. Frontend build ────────────────────────────────────────────────────────
FROM node:22-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci --no-audit --no-fund
COPY frontend/ ./
RUN npm run build

# ── 2. Runtime ───────────────────────────────────────────────────────────────
FROM python:3.12-slim AS production
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
        curl mosquitto libgl1 libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# CPU-only PyTorch first, so ultralytics / sentence-transformers don't pull CUDA (~5 GB)
RUN pip install --no-cache-dir torch torchvision --index-url https://download.pytorch.org/whl/cpu

COPY backend/requirements.txt ./backend/requirements.txt
COPY waste-api/requirements.txt ./waste-api/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt -r waste-api/requirements.txt

COPY backend/ ./backend/
COPY waste-api/ ./waste-api/
COPY edge-simulator/ ./edge-simulator/
COPY manuals/ ./manuals/
COPY chroma_db/ ./chroma_db/
COPY ["best (4).pt", "./"]
COPY scripts/docker-entrypoint.sh ./docker-entrypoint.sh
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

RUN chmod +x ./docker-entrypoint.sh && mkdir -p waste-api/uploads waste-api/exports

ENV PYTHONUNBUFFERED=1 \
    DEMO_MODE=false \
    CONTROL_MODE=simulated \
    AUTO_START_SIMULATOR=false \
    MQTT_BROKER_HOST=127.0.0.1 \
    MQTT_BROKER_PORT=1883 \
    HF_HOME=/app/.cache/huggingface \
    PORT=5000

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=5s --start-period=120s --retries=3 \
    CMD curl -fs http://localhost:5000/api/v1/reports/history > /dev/null || exit 1

ENTRYPOINT ["./docker-entrypoint.sh"]
