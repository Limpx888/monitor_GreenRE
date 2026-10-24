import httpx

keys = [
    ("New Key", "A0ibvfBWL3E73F0zvQpJIU56vMOLBcmETfAhtbavwiDtWwMggjQ0JQQJ99CJACMsfrFXJ3w3AAAAACOGXqV9"),
    ("Old Key", "6sn5q1HdyDOrA61yoN1rmZYpKUXFfP6ndqnGtCyhs0TjSy5I87FjJQQJ99CJACYeBjFXJ3w3AAABACOGmfuc"),
]

ep = "https://greenre-openai-svc.openai.azure.com"
url = f"{ep}/openai/deployments/gpt-4o/chat/completions?api-version=2024-08-01-preview"

for name, k in keys:
    res = httpx.post(url, headers={"api-key": k, "Content-Type": "application/json"}, json={"messages": [{"role":"user","content":"hi"}]})
    print(f"Key [{name}]: HTTP {res.status_code} -> {res.text[:120]}")
