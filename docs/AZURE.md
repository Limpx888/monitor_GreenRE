# GoGreen on Microsoft Azure

**Live app:** https://gogreen-app.happymoss-3e890a69.southeastasia.azurecontainerapps.io

Everything runs in resource group **`greenre-rg`** (subscription *Hackaton Team -Six Seven*, region Southeast Asia unless noted).

## Architecture

```
Browser ──HTTPS──▶ Azure Container Apps: gogreen-app in env gogreen-env2-8mtsk (VNet)  (React UI + FastAPI + waste-api + MQTT simulator)
                     │  managed identity
                     ├──▶ Key Vault gogreen-kv2-8mtsk ........ all secrets (DB URLs, API keys)
                     ├──▶ PostgreSQL gogreen-pg-8mtsk ........ EMS + waste data   (private endpoint 10.40.2.4, VNet gogreen-vnet-8mtsk)
                     ├──▶ Storage greenrewaste7391 ........... water-history (Parquet), reports (PDFs), models (YOLO)
                     ├──▶ Azure OpenAI greenre-openai-svc ..... report summaries, diagnostics (East US)
                     ├──▶ AI Search gogreen-search-8mtsk ...... GreenRE standards index (Free tier)
                     ├──▶ Event Hubs greenre-eventhub-ns ...... telemetry ingestion (Basic)
                     └──▶ App Insights gogreen-insights-8mtsk / Log Analytics gogreen-logs-8mtsk
Image: Container Registry gogreenacr8mtsk (gogreen:vN)
```

| Data | Where it lives | Notes |
|---|---|---|
| EMS: zones, floors, meter readings, sensor telemetry, alarms… | PostgreSQL `greenre_ems` | 656,436 rows migrated from `ems_local.db` |
| Waste: scans, detections, collections, users… | PostgreSQL `greenre_waste` | 4,352 rows migrated from `waste-api/waste.db` |
| Water history (20.6M readings, 2016–2017) | Blob `water-history/meter_type=*/year=*/data.parquet` | 1.1 GB DuckDB → 62 MB Parquet; queried with DuckDB (`backend/water_history.py`) |
| Exported PDF reports | Blob `reports/` | listed at `/reports` → Past reports |
| Secrets | Key Vault | loaded at startup by `backend/keyvault_env.py` |

## Run locally against Azure

1. Install the Azure CLI (`winget install Microsoft.AzureCLI`), open a **new** terminal, and run `az login`.
2. `backend/.env` needs just one line for Azure: `AZURE_KEYVAULT_URL=https://gogreen-kv2-8mtsk.vault.azure.net/`.
   Key Vault values override the rest of `.env`; set `KEYVAULT_PREFER_ENV=true` to use `.env` values instead.
3. `npm run backend` and `npm run frontend` as usual. The backend log shows
   `[KeyVault] loaded 14 secret(s)` and `[EMS] Connected to Postgres via gogreen-pg-8mtsk…`.

The database firewall only admits allow-listed IPs. If your IP changes:
```powershell
az postgres flexible-server firewall-rule create -g greenre-rg --server-name gogreen-pg-8mtsk --name dev-<you> --start-ip-address <your-ip>
```
Teammates need *Get/List* on the vault: `az keyvault set-policy -n gogreen-kv2-8mtsk --upn <email> --secret-permissions get list`.

## Deploy a new version

```powershell
az acr build -r gogreenacr8mtsk -t gogreen:v3 --platform linux/amd64 . --no-logs
az containerapp update -g greenre-rg -n gogreen-app --image gogreenacr8mtsk.azurecr.io/gogreen:v3
```
The image never contains secrets or local databases (see `.dockerignore`). The app scales to zero when idle,
so the first request after a quiet period takes ~1 minute while the container starts.

## Re-run the data migration

```powershell
$env:MIGRATE_TARGET_URL = az keyvault secret show --vault-name gogreen-kv2-8mtsk -n database-url --query value -o tsv
py -3.13 backend/scripts/migrate_to_azure.py --target ems      # or --target waste with waste-database-url
```
Tables that already hold rows are skipped; add `--replace` to overwrite. Source and target row counts are printed.

## Cost guard-rails

* Budget **gogreen-monthly-100**: USD 100/month, emails at 50 / 80 / 100 % actual and 100 % forecast.
* AI Search moved from Basic (~USD 75/month) to Free.
* Estimated run-rate ≈ USD 40–60/month: PostgreSQL B1ms ~18, Event Hubs Basic ~11, private endpoint ~7,
  Container Registry ~5, Log Analytics / storage / OpenAI a few dollars, Container Apps ~0 when idle.

## Permissions note

The team account is **Contributor** (not Owner), so it cannot create Azure RBAC role assignments.
Key Vault therefore uses *access policies*, and the app pulls its image with the registry's admin credential.
