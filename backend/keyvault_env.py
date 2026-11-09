"""Load secrets from Azure Key Vault into the process environment at startup.

Set AZURE_KEYVAULT_URL (e.g. https://gogreen-kv2-8mtsk.vault.azure.net/) and the
backend reads the secrets below with DefaultAzureCredential:
  * locally: your `az login` session
  * on Azure Container Apps: the app's managed identity
When Key Vault is configured its values win over .env (set KEYVAULT_PREFER_ENV=true
to keep .env values instead). If Key Vault can't be reached the app keeps using
the environment / .env values. Secret values are never logged.
"""

from __future__ import annotations

import os

# environment variable -> Key Vault secret name
SECRETS = {
    "DATABASE_URL": "database-url",
    "WASTE_DATABASE_URL": "waste-database-url",
    "AZURE_STORAGE_CONNECTION_STRING": "storage-connection-string",
    "AZURE_OPENAI_ENDPOINT": "azure-openai-endpoint",
    "AZURE_OPENAI_KEY": "azure-openai-key",
    "AZURE_OPENAI_DEPLOYMENT": "azure-openai-deployment",
    "AZURE_SEARCH_ENDPOINT": "azure-search-endpoint",
    "AZURE_SEARCH_API_KEY": "azure-search-api-key",
    "AZURE_SEARCH_INDEX": "azure-search-index",
    "AZURE_EVENTHUB_CONNECTION_STRING": "eventhub-connection-string",
    "AZURE_EVENTHUB_NAME": "eventhub-name",
    "APPLICATIONINSIGHTS_CONNECTION_STRING": "appinsights-connection-string",
    "JWT_SECRET": "jwt-secret",
    "WASTE_SECRET_KEY": "waste-secret-key",
}

_loaded = False
status = {"enabled": False, "loaded": [], "error": None}


def load() -> dict:
    """Idempotent: safe to call from every entry point."""
    global _loaded
    if _loaded:
        return status
    _loaded = True
    url = os.getenv("AZURE_KEYVAULT_URL", "").strip()
    if not url:
        return status
    status["enabled"] = True
    override = os.getenv("KEYVAULT_PREFER_ENV", "false").lower() != "true"
    try:
        from azure.identity import DefaultAzureCredential
        from azure.keyvault.secrets import SecretClient

        client = SecretClient(vault_url=url, credential=DefaultAzureCredential(exclude_interactive_browser_credential=True))
        available = {p.name for p in client.list_properties_of_secrets() if p.enabled}
        for env, name in SECRETS.items():
            if name not in available or (os.getenv(env) and not override):
                continue
            os.environ[env] = client.get_secret(name).value
            status["loaded"].append(env)
        print(f"[KeyVault] loaded {len(status['loaded'])} secret(s) from {url}: {', '.join(status['loaded']) or 'none'}")
    except Exception as exc:  # fall back to .env values
        status["error"] = exc.__class__.__name__
        print(f"[KeyVault] unavailable ({exc.__class__.__name__}); using environment / .env values")
    return status
