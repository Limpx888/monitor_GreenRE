import os
import json
import httpx
from dotenv import load_dotenv

load_dotenv(".env")

raw_ep = os.getenv("AZURE_OPENAI_ENDPOINT", "").strip().strip('"').rstrip("/")
key = os.getenv("AZURE_OPENAI_KEY", "").strip().strip('"')
deployment = os.getenv("AZURE_OPENAI_DEPLOYMENT", "gpt-4o-1").strip().strip('"')

# Possible candidate endpoints based on Azure AI Foundry project structure
candidates = [
    # 1. Direct path as pasted by user
    raw_ep,
    # 2. chat/completions on user path
    raw_ep.replace("/responses", "/chat/completions"),
    # 3. Azure OpenAI standard style on the foundry resource
    f"https://teamsixseven-1456-resource.openai.azure.com/openai/deployments/{deployment}/chat/completions?api-version=2024-08-01-preview",
    # 4. Azure AI Foundry models endpoint
    f"https://teamsixseven-1456-resource.services.ai.azure.com/models/chat/completions?api-version=2024-05-01-preview",
    # 5. Azure AI Foundry project models endpoint
    f"https://teamsixseven-1456-resource.services.ai.azure.com/api/projects/teamsixseven-1456/models/chat/completions?api-version=2024-05-01-preview",
    # 6. Azure OpenAI on project path
    f"https://teamsixseven-1456-resource.services.ai.azure.com/api/projects/teamsixseven-1456/openai/deployments/{deployment}/chat/completions?api-version=2024-08-01-preview",
]

payload = {
    "model": deployment,
    "messages": [{"role": "user", "content": "Respond with OK"}],
    "max_tokens": 10
}

for i, url in enumerate(candidates, 1):
    print(f"\n--- Candidate #{i} ---")
    print("URL:", url)
    for auth_style in [("api-key", key), ("Authorization", f"Bearer {key}")]:
        h = {"Content-Type": "application/json", auth_style[0]: auth_style[1]}
        try:
            r = httpx.post(url, headers=h, json=payload, timeout=6.0)
            print(f"Header '{auth_style[0]}' -> HTTP {r.status_code}")
            if r.status_code in [200, 201]:
                print(">>> SUCCESS! <<<")
                print("Response:", r.text[:200])
                break
            else:
                print("Error body:", r.text[:140])
        except Exception as e:
            print(f"Exception with {auth_style[0]}: {e}")
