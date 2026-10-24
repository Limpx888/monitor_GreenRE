import os
import json
import httpx
from dotenv import load_dotenv

load_dotenv(".env")

endpoint = os.getenv("AZURE_OPENAI_ENDPOINT", "").strip().strip('"').rstrip("/")
key = os.getenv("AZURE_OPENAI_KEY", "").strip().strip('"')
deployment = os.getenv("AZURE_OPENAI_DEPLOYMENT", "gpt-4o").strip().strip('"')
api_ver = os.getenv("AZURE_OPENAI_API_VERSION", "2024-08-01-preview").strip().strip('"')

print(f"Testing Endpoint: {endpoint}")
print(f"Testing Deployment: {deployment}")
print(f"Testing Key: {key[:8]}...{key[-6:]}")

url = f"{endpoint}/openai/deployments/{deployment}/chat/completions?api-version={api_ver}"
headers = {"api-key": key, "Content-Type": "application/json"}
payload = {
    "messages": [
        {"role": "system", "content": "You are the GreenRE Cognitive AI Auditor. Output JSON only."},
        {"role": "user", "content": "Respond with a JSON object: {\"status\": \"azure_openai_online\", \"model_verified\": \"gpt-4o\", \"ping\": \"pong\"}"}
    ],
    "response_format": {"type": "json_object"},
    "temperature": 0.1
}

try:
    res = httpx.post(url, headers=headers, json=payload, timeout=12.0)
    print(f"\n>>> HTTP Status: {res.status_code}")
    if res.status_code == 200:
        data = res.json()
        print(">>> SUCCESS! Live Azure OpenAI Response:")
        print(json.dumps(data, indent=2))
        print("\nTokens Used:", data.get("usage", {}))
    else:
        print("Response Body:", res.text)
except Exception as e:
    print("Request exception:", e)
