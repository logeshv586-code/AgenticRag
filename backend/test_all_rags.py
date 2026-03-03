import requests
import json
import time

BASE_URL = "http://localhost:8010"
URLS = ["https://eratimbers.com/"]
DB_TYPE = "local"
LOCAL_DB = "chroma"
LLM = "qwen-local"

RAG_TYPES = [
    "basic",
    "conversational",
    "multimodal",
    "structured",
    "agentic",
    "realtime",
    "personalized",
    "crosslingual",
    "voice",
    "citation"
]

def log(msg):
    print(msg)

def test_ingest(rag_name):
    res = requests.post(f"{BASE_URL}/api/ingest", json={
        "ragName": rag_name,
        "urls": URLS,
        "mode": "static"
    })
    res.raise_for_status()
    return res.json()

def test_deploy(rag_type, rag_name):
    config = {
        "ragName": rag_name,
        "extracted_texts": [],
        "ragType": rag_type,
        "dbType": DB_TYPE,
        "cloudDb": "",
        "localDb": LOCAL_DB,
        "llmModel": LLM,
        "embeddingModel": "bge-local",
        "chunkSize": 500,
        "topK": 3,
        "useReranker": False,
        "theme": "cyan",
        "dynamicConfig": {
            "sourceLanguage": "auto",
            "targetLanguage": "English",
            "voiceLanguage": "en-US",
            "historyLength": 5,
            "modalities": ["text", "images"],
            "entityTypes": ["Organization", "Product"],
            "relationshipDepth": 2,
            "refreshInterval": 60,
            "profileFields": ["Role"],
            "citationStyle": "inline"
        }
    }
    res = requests.post(f"{BASE_URL}/api/deploy", json=config)
    res.raise_for_status()
    return res.json().get('pipeline_id')

def test_chat(pipeline_id, rag_type):
    query = "What kind of products does Era Timbers offer?"
    payload = {
        "pipeline_id": pipeline_id,
        "query": query
    }
    # Provide a dummy 1-byte base64 audio string just in case voice strictly requires it
    # But usually speech/text should gracefully fallback to query if audio isn't provided.
    if rag_type == "voice":
        payload["audio_base64"] = "" 
        
    res = requests.post(f"{BASE_URL}/api/test-chat", json=payload)
    res.raise_for_status()
    return res.json()

def main():
    rag_name_base = "EraTimbersTest"
    
    with open("test_all_rags_output.txt", "w", encoding="utf-8") as f:
        f.write("=== RAG TYPES TEST ===\n")
        
    log("\n--- Executing Base Ingest ---")
    try:
        test_ingest(rag_name_base)
        log("Ingest OK")
    except Exception as e:
        log(f"Ingest Failed: {e}")
        return

    for r_type in RAG_TYPES:
        log(f"\n--- Testing {r_type.upper()} ---")
        
        try:
            pid = test_deploy(r_type, rag_name_base)
            if not pid:
                raise Exception("Deployment returned missing info.")
            log(f"Deploy OK -> {pid}")
        except Exception as e:
            err = str(e)
            if hasattr(e, 'response') and e.response is not None:
                err += f" | {e.response.text}"
            log(f"Deploy Failed: {err}")
            with open("test_all_rags_output.txt", "a", encoding="utf-8") as f:
                f.write(f"[{r_type.upper()}] DEPLOY FAILED: {err}\n\n")
            continue
            
        try:
            resp = test_chat(pid, r_type)
            ans = str(resp.get('answer'))[:200].replace('\n', ' ')
            log(f"Chat OK -> {ans}...")
            with open("test_all_rags_output.txt", "a", encoding="utf-8") as f:
                f.write(f"[{r_type.upper()}] SUCCESS:\n{resp.get('answer')}\n\n")
        except Exception as e:
            log(f"Chat Failed: {e}")
            with open("test_all_rags_output.txt", "a", encoding="utf-8") as f:
                f.write(f"[{r_type.upper()}] CHAT FAILED: {e}\n\n")

if __name__ == '__main__':
    main()
