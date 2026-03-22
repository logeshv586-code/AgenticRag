import requests
import json
import time
import sys

BASE_URL = "http://localhost:8010"

def log(msg):
    print(f"[*] {msg}")

def test_ingest(rag_name, urls):
    log(f"Ingesting into {rag_name}...")
    try:
        res = requests.post(f"{BASE_URL}/api/ingest", json={
            "ragName": rag_name,
            "urls": urls,
            "mode": "static"
        })
        res.raise_for_status()
        log(f"Ingest Success: {res.json()}")
        return res.json()
    except Exception as e:
        log(f"Ingest Failed: {e}")
        if 'res' in locals() and hasattr(res, 'text'):
            log(f"Response: {res.text}")
        return None

def test_deploy(config):
    log(f"Deploying {config['ragName']} ({config['ragType']}) using {config['dbType']} DB ...")
    try:
        res = requests.post(f"{BASE_URL}/api/deploy", json=config)
        res.raise_for_status()
        data = res.json()
        log(f"Deploy Success. Pipeline ID: {data.get('pipeline_id')}")
        return data.get('pipeline_id')
    except Exception as e:
        log(f"Deploy Failed: {e}")
        if 'res' in locals() and hasattr(res, 'text'):
            log(f"Response: {res.text}")
        return None

def test_chat(pipeline_id, query):
    log(f"Chatting with {pipeline_id}...")
    try:
        res = requests.post(f"{BASE_URL}/api/test-chat", json={
            "pipeline_id": pipeline_id,
            "query": query
        })
        res.raise_for_status()
        log(f"Chat Response: {res.json()}")
    except Exception as e:
        log(f"Chat Failed: {e}")
        if 'res' in locals() and hasattr(res, 'text'):
            log(f"Response: {res.text}")

def main():
    urls = [
        "https://fastapi.tiangolo.com/",
        "https://www.python.org/doc/essays/blurb/",
        "https://react.dev/blog/2023/03/16/introducing-react-dev"
    ]
    
    # 1. Test Local Basic Fast
    rag_name_local = "TestLocalBasic"
    if not test_ingest(rag_name_local, urls): return
    
    config_local = {
        "ragName": rag_name_local,
        "extracted_texts": [],
        "ragType": "basic",
        "dbType": "local",
        "cloudDb": "",
        "localDb": "chroma",
        "llmModel": "qwen-local",
        "embeddingModel": "bge-local",
        "chunkSize": 500,
        "topK": 3,
        "useReranker": False,
        "theme": "cyan"
    }
    pid_local = test_deploy(config_local)
    if pid_local:
        test_chat(pid_local, "What is FastAPI?")
        
    # 2. Test Cloud DB (we'll just test pipeline creation since we don't have pinecone keys, but deploy should handle if Pinecone works or mock it? 
    # Let's see what happens.
    rag_name_cloud = "TestCloudBasic"
    if not test_ingest(rag_name_cloud, urls[:1]): return
    
    config_cloud = {
        "ragName": rag_name_cloud,
        "extracted_texts": [],
        "ragType": "basic",
        "dbType": "cloud",
        "cloudDb": "pinecone",
        "localDb": "chroma",
        "llmModel": "qwen-local",
        "embeddingModel": "bge-local",
        "chunkSize": 500,
        "topK": 3,
        "useReranker": False,
        "theme": "cyan"
    }
    pid_cloud = test_deploy(config_cloud)
    
    # 3. Test Hybrid DB configuration
    rag_name_hybrid = "TestHybridBasic"
    config_hybrid = {
        "ragName": rag_name_hybrid,
        "extracted_texts": [],
        "ragType": "hybrid",
        "dbType": "hybrid",
        "cloudDb": "pinecone",
        "localDb": "chroma",
        "llmModel": "qwen-local",
        "embeddingModel": "bge-local",
        "chunkSize": 500,
        "topK": 3,
        "useReranker": False,
        "theme": "cyan"
    }
    pid_hybrid = test_deploy(config_hybrid)

if __name__ == "__main__":
    main()
