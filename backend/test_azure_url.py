"""Test various Azure OpenAI / AI Foundry URL formats to find what works."""
import httpx
import os
import json
from dotenv import load_dotenv

load_dotenv(".env")

endpoint = os.getenv("AZURE_OPENAI_ENDPOINT", "").strip().strip('"').rstrip("/")
key = os.getenv("AZURE_OPENAI_KEY", "").strip().strip('"')
deployment = os.getenv("AZURE_OPENAI_DEPLOYMENT", "gpt-4o-1").strip().strip('"')

print(f"Endpoint: {endpoint}")
print(f"Deployment: {deployment}")
print(f"Key: {key[:8]}...{key[-6:]}")
print()

headers = {"api-key": key, "Content-Type": "application/json"}
payload = {
    "model": deployment,
    "messages": [{"role": "user", "content": "Respond with JSON: {\"status\":\"ok\"}"}],
    "max_tokens": 30
}

# URL candidates to try
urls = [
    # AI Foundry /v1/responses style (original)
    f"{endpoint}",  # already has /responses in it
    # Remove /responses, use /chat/completions
    f"{endpoint.replace('/responses', '')}/chat/completions",
    # AI Foundry base -> chat completions
    f"{endpoint.replace('/openai/v1/responses', '')}/openai/v1/chat/completions",
    # Standard Azure OpenAI format
    f"{endpoint.replace('/api/projects/teamsixseven-1456/openai/v1/responses', '')}/openai/deployments/{deployment}/chat/completions?api-version=2024-12-01-preview",
]

for url in urls:
    print(f"--- Testing: {url[:100]}...")
    try:
        p = dict(payload)
        if "api-version" in url:
            p.pop("model", None)  # deployment-based URL doesn't need model in body
        res = httpx.post(url, headers=headers, json=p, timeout=12.0)
        print(f"  Status: {res.status_code}")
        print(f"  Response: {res.text[:300]}")
    except Exception as e:
        print(f"  Error: {e}")
    print()
