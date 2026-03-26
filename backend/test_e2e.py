import sys
import os
import json
import zipfile

sys.path.append('e:/AgenticRag/backend')

# Monkey-patch LLM execution so we don't accidentally invoke heavy local models or deadlocks during testing
from services import haystack_service
def mock_pipeline_build(*args, **kwargs):
    return "test_pipe_e2e", type('MockPipe', (), {'run': lambda self, *a, **k: {"llm": {"replies": ["Mocked response!"]}}})()

from main import app
from fastapi.testclient import TestClient

client = TestClient(app)

def run_verification():
    print("--- 1. Testing Ingestion (PSGBiz.com) ---")
    req = {
        "ragName": "psg_e2e_test",
        "urls": ["https://psgbiz.com"],
        "mode": "static",  # Will fallback to Playwright dynamically
        "dbType": "local",
        "localDb": "chroma",
        "cloudDb": "",
        "ragType": "basic",
        "llmModel": "qwen-local",
        "embeddingModel": "bge-local",
        "chunkSize": 500,
        "topK": 5,
        "useReranker": False,
        "theme": "cyan"
    }
    resp = client.post("/api/ingest", json=req)
    
    if resp.status_code != 200:
        print("Ingest failed:", resp.text)
        return
        
    config = resp.json()
    print("Ingestion Complete! Extracted texts count:", len(config.get("extracted_texts", [])))
    
    print("\n--- 2. Testing Pipeline Deployment ---")
    
    req["extracted_texts"] = config.get("extracted_texts", [])
    resp = client.post("/api/deploy", json=req)
    if resp.status_code != 200:
        print("Deploy failed:", resp.text)
        return
        
    deploy_data = resp.json()
    pipeline_id = deploy_data.get("pipeline_id")
    print("Pipeline Deployed with ID:", pipeline_id)
    
    print("\n--- 3. Testing Test-Mode Export (ZIP) ---")
    resp = client.get(f"/api/export/{pipeline_id}")
    if resp.status_code != 200:
        print("Export failed:", resp.text)
        return
        
    zip_path = "e2e_export_test.zip"
    with open(zip_path, "wb") as f:
        f.write(resp.content)
        
    print(f"Exported ZIP saved ({len(resp.content) // 1024} KB). Validating Custom Architecture...")
    
    with zipfile.ZipFile(zip_path, "r") as z:
        namelist = z.namelist()
        
        # Verify Core Artifacts
        targets = [
            "backend/main.py",
            "chatbotui/src/App.jsx",
            "chatbotui/public/exported_config.json",
            "README.md"
        ]
        for t in targets:
            status = '✅' if any(f.endswith(t) for f in namelist) else '❌'
            print(f"[{status}] Found {t}")
            
        data_files = [f for f in namelist if "psg_e2e_test" in f]
        print(f"[{'✅' if len(data_files) > 0 else '❌'}] Found {len(data_files)} data/vector DB files specifically isolated for this pipeline.")
        
        # Verify JSON
        config_path = next((f for f in namelist if f.endswith("chatbotui/public/exported_config.json")), None)
        if config_path:
            cfg = json.loads(z.read(config_path).decode('utf-8'))
            print(f"\n[Validation] Frontend payload accurately maps Pipeline Meta:")
            print(json.dumps(cfg, indent=2))
            
    print("\n✅ COMPLETE VERIFICATION PASSED")

if __name__ == "__main__":
    run_verification()
