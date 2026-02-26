from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import os

from services.scraper import scrape_urls
from services.document_parser import parse_document
from services.rag_builder import deploy_rag_system
import subprocess
import atexit
import time
import requests

app = FastAPI(title="Agentic RAG Creator API")

# --- Local LLM Server Management ---
MODEL_PATH = r"C:\Users\e629\Documents\AgenticRag\Qwen2.5-14B-Instruct-1M-Q3_K_L.gguf"
LLM_PORT = 8001
llm_process = None

def start_llm_server():
    global llm_process
    print(f"Starting local LLM server on port {LLM_PORT}...")
    try:
        # Start the llama_cpp.server as a subprocess
        llm_process = subprocess.Popen(
            ["python", "-m", "llama_cpp.server", "--model", MODEL_PATH, "--port", str(LLM_PORT), "--host", "0.0.0.0", "--n_ctx", "4096"],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL
        )
        # Give it a few seconds to initialize
        time.sleep(5)
        print("LLM server started.")
    except Exception as e:
        print(f"Failed to start LLM server: {e}")

def stop_llm_server():
    global llm_process
    if llm_process:
        print("Stopping local LLM server...")
        llm_process.terminate()
        llm_process.wait()

# Start the server when FastAPI starts
start_llm_server()
# Ensure it stops when FastAPI shuts down
atexit.register(stop_llm_server)
# -----------------------------------

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ScrapeRequest(BaseModel):
    urls: List[str]

class ChatRequest(BaseModel):
    query: str

class DeployRequest(BaseModel):
    extracted_texts: List[str]
    ragType: str
    useCase: str
    vectorDb: str
    theme: str
    features: Optional[List[str]] = []
    deploymentType: Optional[str] = "api"

class FeedbackRequest(BaseModel):
    chat_id: str
    rating: int
    comment: Optional[str] = None

@app.post("/api/scrape")
async def api_scrape(req: ScrapeRequest):
    try:
        texts = scrape_urls(req.urls)
        return {"status": "success", "texts": texts}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/upload")
async def api_upload(file: UploadFile = File(...)):
    try:
        # Save temp file
        temp_path = f"temp_{file.filename}"
        with open(temp_path, "wb") as buffer:
            content = await file.read()
            buffer.write(content)
        
        text = parse_document(temp_path)
        os.remove(temp_path)
        
        return {"status": "success", "text": text}
    except Exception as e:
        if os.path.exists(temp_path):
            os.remove(temp_path)
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/chat")
async def api_chat(req: ChatRequest):
    """
    Uses the local Qwen model to chat with the user and guide them on RAG creation.
    """
    system_prompt = (
        "You are an expert AI architect guiding a user to build a Custom RAG system. "
        "Explain RAG concepts clearly and concisely. "
        "Recommend components like Pinecone, ChromaDB, Haystack pipelines, etc."
    )
    
    try:
        # Call the local llama_cpp server
        response = requests.post(
            f"http://localhost:{LLM_PORT}/v1/chat/completions",
            json={
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": req.query}
                ],
                "temperature": 0.7,
                "max_tokens": 512
            },
            timeout=120
        )
        response.raise_for_status()
        data = response.json()
        answer = data["choices"][0]["message"]["content"]
        return {"answer": answer}
    except Exception as e:
        print(f"LLM Chat Error: {e}")
        # Fallback if model is still loading or unavailable
        return {"answer": "I am currently initializing my local reasoning engine. Please try asking again in a few moments."}

@app.post("/api/deploy")
async def api_deploy(req: DeployRequest):
    try:
        deployment_info = deploy_rag_system(
            texts=req.extracted_texts,
            rag_type=req.ragType,
            use_case=req.useCase,
            vector_db=req.vectorDb
        )
        return {
            "status": "success",
            "message": "Agentic RAG deployed successfully.",
            "deployment_info": deployment_info,
            "theme": req.theme,
            "pipeline_id": "mock_pipeline_123" # In reality, return the deployed pipeline string/ID
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/visualize/{pipeline_id}")
async def api_visualize(pipeline_id: str):
    # Mock visualization data. In a real Haystack setup, you can export the pipeline graph.
    return {
        "status": "success",
        "nodes": [
            {"id": "doc_store", "label": "Document Store", "type": "database"},
            {"id": "retriever", "label": "BM25 Retriever", "type": "retriever"},
            {"id": "prompt_builder", "label": "Prompt Builder", "type": "processor"},
            {"id": "llm", "label": "OpenAI Generator", "type": "llm"}
        ],
        "edges": [
            {"source": "doc_store", "target": "retriever"},
            {"source": "retriever", "target": "prompt_builder"},
            {"source": "prompt_builder", "target": "llm"}
        ]
    }

@app.post("/api/test-chat")
async def api_test_chat(req: ChatRequest):
    # This acts as the actual chat endpoint for the deployed RAG pipeline
    q = req.query.lower()
    return {
        "answer": f"Simulated response from the deployed Haystack pipeline for query: '{req.query}'"
    }

@app.post("/api/feedback")
async def api_feedback(req: FeedbackRequest):
    # Log feedback
    print(f"Received feedback for chat {req.chat_id}: {req.rating} stars - {req.comment}")
    return {"status": "success"}

@app.post("/api/demo/eratimbers")
async def api_demo_eratimbers():
    """
    Automated endpoint to scrape eratimbers.com and deploy a Hybrid RAG.
    """
    try:
        url = "https://eratimbers.com/"
        print(f"Scraping {url} for demo...")
        texts = scrape_urls([url])
        
        print("Deploying Hybrid RAG for Era Timbers...")
        deployment_info = deploy_rag_system(
            texts=texts,
            rag_type="hybrid",
            use_case="sales",
            vector_db="inmemory",
            features=["citations"]
        )
        
        return {
            "status": "success",
            "message": "Era Timbers Demo RAG deployed successfully.",
            "deployment_info": deployment_info
        }
    except Exception as e:
        print(f"Demo Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/health")
def health_check():
    return {"status": "ok"}
