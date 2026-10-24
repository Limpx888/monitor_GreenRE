import os
import httpx
from dotenv import load_dotenv

load_dotenv(".env")

aoai_ep = os.getenv("AZURE_OPENAI_ENDPOINT", "").strip().strip('"').rstrip("/")
aoai_key = os.getenv("AZURE_OPENAI_KEY", "").strip().strip('"')

print("--- Testing Azure OpenAI Deployments ---")
for d in ['gpt-4o', 'gpt-4', 'gpt4o', 'gpt-4o-mini', 'gpt-35-turbo', 'chat', 'greenre-gpt4o', 'greenre-model']:
    url = f"{aoai_ep}/openai/deployments/{d}/chat/completions?api-version=2024-08-01-preview"
    try:
        r = httpx.post(url, headers={"api-key": aoai_key}, json={"messages": [{"role":"user","content":"ping"}]}, timeout=4.0)
        print(f"Deployment '{d}': HTTP {r.status_code} -> {r.text[:120]}")
        if r.status_code == 200:
            print(f">>> FOUND ACTIVE DEPLOYMENT: {d} <<<")
            break
    except Exception as e:
        print(f"Deployment '{d}' error: {e}")
