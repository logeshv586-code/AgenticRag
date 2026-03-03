from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict
import os
import logging
from services.scraper import scrape_urls
from services.rag_builder import deploy_rag_system
from services.haystack_service import query_pipeline, get_pipeline_graph
from services.llm_service import validate_api_key, list_available_models, detect_gpu_availability, validate_model_capabilities
from services.tuning_presets import apply_tuning_preset, list_presets, get_rag_defaults
from services.security_middleware import SecurityMiddleware
from services.observability_service import get_metrics, get_logs
from services.deployment_manager import package_deployment
import subprocess
import requests
from contextlib import asynccontextmanager

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# --- Local LLM Server Management ---
MODEL_PATH = r"C:\Users\e629\Documents\AgenticRag\Qwen2.5-14B-Instruct-1M-Q3_K_L.gguf"
LLM_PORT = 8001
llm_process = None

def start_llm_server():
    global llm_process
    logger.info(f"Starting local LLM server on port {LLM_PORT}...")
    try:
        cmd = f'python -m llama_cpp.server --model "{MODEL_PATH}" --port {LLM_PORT} --host 0.0.0.0 --n_ctx 4096'
        llm_process = subprocess.Popen(
            cmd,
            shell=True,
            stdout=None,
            stderr=None,
            text=True
        )
        logger.info("LLM subprocess spawned.")
    except Exception as e:
        logger.error(f"Failed to start LLM server: {e}")

def stop_llm_server():
    global llm_process
    if llm_process:
        logger.info("Stopping local LLM server...")
        llm_process.terminate()
        llm_process.wait()

@asynccontextmanager
async def lifespan(app: FastAPI):
    start_llm_server()
    yield
    stop_llm_server()

app = FastAPI(title="Agentic RAG Creator API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Add Enterprise Security Middleware
# Note: require_auth=False for demo purposes. True would block all unauthenticated requests to non-bypass paths.
app.add_middleware(
    SecurityMiddleware,
    require_auth=False,
    bypass_paths=["/health", "/api/supported-formats", "/docs", "/openapi.json"]
)


# ═══════════════════════════════════════════════════════════
#  Request Models
# ═══════════════════════════════════════════════════════════

class ScrapeRequest(BaseModel):
    urls: List[str]
    mode: str = "static"  # "static" or "dynamic"

class ChatRequest(BaseModel):
    query: str
    pipeline_id: Optional[str] = None
    audio_base64: Optional[str] = None  # For Voice RAG pipeline

class DeployRequest(BaseModel):
    ragName: str
    extracted_texts: List[str]
    ragType: str
    dbType: str
    cloudDb: str
    localDb: str
    dynamicConfig: dict = {}
    llmModel: str
    embeddingModel: str
    chunkSize: int
    topK: int
    useReranker: bool
    theme: str
    features: Optional[List[str]] = []
    deploymentType: Optional[str] = "api"
    apiKeys: Optional[Dict[str, str]] = {}
    privacyMode: Optional[bool] = False
    explainability: Optional[bool] = False
    scrapeMode: Optional[str] = "static"
    tuningPreset: Optional[str] = None  # "balanced", "high_accuracy", "fast" (Simple mode)
    # New Phase 6 features
    hallucinationGuard: Optional[bool] = False
    toxicityFilter: Optional[bool] = False
    structuredOutput: Optional[bool] = False
    streamingResponse: Optional[bool] = False

class FeedbackRequest(BaseModel):
    chat_id: str
    rating: int
    comment: Optional[str] = None

class ValidateKeyRequest(BaseModel):
    provider: str
    api_key: str


# ═══════════════════════════════════════════════════════════
#  Data Processing Endpoints
# ═══════════════════════════════════════════════════════════

@app.post("/api/scrape")
async def api_scrape(req: ScrapeRequest):
    try:
        texts = scrape_urls(req.urls, mode=req.mode)
        return {"status": "success", "texts": texts, "mode": req.mode}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class IngestRequest(BaseModel):
    ragName: str
    urls: List[str]
    mode: str = "static"

@app.post("/api/ingest")
async def api_ingest(req: IngestRequest):
    """Scrapes URLs and saves the extracted texts to a specific RAG folder."""
    if not req.ragName:
        raise HTTPException(status_code=400, detail="ragName is required")
        
    try:
        # Create directory
        base_dir = os.path.join(os.path.dirname(__file__), "data", req.ragName)
        os.makedirs(base_dir, exist_ok=True)
        
        # Scrape
        texts = scrape_urls(req.urls, mode=req.mode)
        
        # Save raw data
        raw_file_path = os.path.join(base_dir, "scraped_data.txt")
        with open(raw_file_path, "w", encoding="utf-8") as f:
            for text in texts:
                f.write(text + "\n\n" + "="*50 + "\n\n")
                
        logger.info(f"Ingested {len(req.urls)} URLs for RAG: {req.ragName}")
        return {
            "status": "success", 
            "message": f"Successfully ingested data for {req.ragName}",
            "texts_count": len(texts),
            "data_dir": base_dir
        }
    except Exception as e:
        logger.error(f"Ingest error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/upload")
async def api_upload(ragName: str = Form(...), file: UploadFile = File(...)):
    temp_path = None
    try:
        # Create directory
        base_dir = os.path.join(os.path.dirname(__file__), "data", ragName)
        os.makedirs(base_dir, exist_ok=True)
        
        temp_path = os.path.join(base_dir, f"temp_{file.filename}")
        with open(temp_path, "wb") as buffer:
            content = await file.read()
            buffer.write(content)

        text = parse_document(temp_path)
        os.remove(temp_path)
        
        # Save parsed data alongside scraped data
        raw_file_path = os.path.join(base_dir, "scraped_data.txt")
        with open(raw_file_path, "a", encoding="utf-8") as f:
             f.write(f"Source: {file.filename}\n{text}\n\n" + "="*50 + "\n\n")

        return {"status": "success", "text": text}
    except Exception as e:
        if temp_path and os.path.exists(temp_path):
            os.remove(temp_path)
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/supported-formats")
async def api_supported_formats():
    """Return list of supported file extensions."""
    return {"formats": get_supported_extensions()}


# ═══════════════════════════════════════════════════════════
#  AI Interaction Endpoints
# ═══════════════════════════════════════════════════════════

@app.post("/api/chat")
async def api_chat(req: ChatRequest):
    """Uses the local Qwen model to chat with the user and guide them on RAG creation."""
    system_prompt = (
        "You are an expert AI architect guiding a user to build a Custom RAG system. "
        "Explain RAG concepts clearly and concisely. "
        "Recommend components like Pinecone, ChromaDB, Haystack pipelines, etc."
    )

    try:
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
        logger.warning(f"LLM Chat Error: {e}")
        return {"answer": "I am currently initializing my local reasoning engine. Please try asking again in a few moments."}


@app.post("/api/test-chat")
async def api_test_chat(req: ChatRequest):
    """Query endpoint for deployed RAG pipelines. Supports text and audio input."""
    if not req.pipeline_id:
        return {"answer": "Error: No pipeline_id provided."}

    logger.info(f"Executing test chat for pipeline {req.pipeline_id} with query: {req.query}")
    result = query_pipeline(req.pipeline_id, req.query, audio_base64=req.audio_base64)

    # result is now a dict: {"answer": str, optional: "audio_response", "text_query"}
    if isinstance(result, dict):
        return result
    # Backward compatibility
    return {"answer": result}


# ═══════════════════════════════════════════════════════════
#  RAG Management Endpoints
# ═══════════════════════════════════════════════════════════

@app.post("/api/deploy")
async def api_deploy(req: DeployRequest):
    try:
        config = req.model_dump()
        # Apply tuning preset if in Simple mode
        config = apply_tuning_preset(config)
        
        # Look up any previously ingested data for this RAG if extracted_texts is empty
        if not config.get("extracted_texts") and config.get("ragName"):
            rag_dir = os.path.join(os.path.dirname(__file__), "data", config["ragName"])
            scraped_file = os.path.join(rag_dir, "scraped_data.txt")
            if os.path.exists(scraped_file):
                # We optionally just pass the file path to haystack service, but for now we read it back 
                # to keep haystack_service.py untouched. If the file is huge, this might OOM, 
                # but it matches the previous flow exactly.
                with open(scraped_file, "r", encoding="utf-8") as f:
                     content = f.read()
                     # Split by our delimiter
                     parts = [p.strip() for p in content.split("="*50) if p.strip()]
                     config["extracted_texts"] = parts
                     logger.info(f"Loaded {len(parts)} local texts for {config['ragName']}")

        deployment_info = deploy_rag_system(config)
        pipeline_id = deployment_info.get("pipeline_id", "mock_pipeline_123")
        return {
            "status": "success",
            "message": "Agentic RAG deployed successfully.",
            "deployment_info": deployment_info,
            "theme": req.theme,
            "pipeline_id": pipeline_id
        }
    except Exception as e:
        logger.error(f"Deploy error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/visualize/{pipeline_id}")
async def api_visualize(pipeline_id: str):
    """Returns real pipeline graph data for visualization."""
    from services.haystack_service import pipeline_metadata
    graph = get_pipeline_graph(pipeline_id)
    meta = pipeline_metadata.get(pipeline_id, {})
    return {"status": "success", "metadata": meta, **graph}


# ═══════════════════════════════════════════════════════════
#  Utility Endpoints
# ═══════════════════════════════════════════════════════════

@app.post("/api/validate-key")
async def api_validate_key(req: ValidateKeyRequest):
    """Validate an API key for a given provider."""
    result = validate_api_key(req.provider, req.api_key)
    return result

@app.post("/api/feedback")
async def api_feedback(req: FeedbackRequest):
    logger.info(f"Received feedback for chat {req.chat_id}: {req.rating} stars - {req.comment}")
    return {"status": "success"}

@app.post("/api/demo/eratimbers")
async def api_demo_eratimbers():
    """Automated endpoint to scrape eratimbers.com and deploy a Hybrid RAG."""
    try:
        url = "https://eratimbers.com/"
        logger.info(f"Scraping {url} for demo...")
        texts = scrape_urls([url])

        logger.info("Deploying Hybrid RAG for Era Timbers...")
        deployment_info = deploy_rag_system({
            "extracted_texts": texts,
            "ragType": "hybrid",
            "dbType": "local",
            "localDb": "chroma",
            "cloudDb": "",
            "dynamicConfig": {},
            "llmModel": "qwen-local",
            "embeddingModel": "bge-local",
            "chunkSize": 500,
            "topK": 5,
            "useReranker": False,
            "theme": "emerald",
            "features": ["citations"],
            "apiKeys": {},
            "privacyMode": False,
            "explainability": False,
        })

        return {
            "status": "success",
            "message": "Era Timbers Demo RAG deployed successfully.",
            "deployment_info": deployment_info
        }
    except Exception as e:
        logger.error(f"Demo Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/health")
def health_check():
    return {"status": "ok"}


# ═══════════════════════════════════════════════════════════
#  Configuration & Capabilities Endpoints
# ═══════════════════════════════════════════════════════════

@app.get("/api/tuning-presets")
async def api_tuning_presets():
    """Return available tuning presets for Simple mode."""
    return {"presets": list_presets()}

@app.get("/api/models")
async def api_models():
    """Return all available LLM models with capabilities."""
    return {"models": list_available_models()}

@app.get("/api/gpu-info")
async def api_gpu_info():
    """Return GPU/hardware detection results."""
    return detect_gpu_availability()

@app.get("/api/rag-defaults/{rag_type}")
async def api_rag_defaults(rag_type: str):
    """Return default configuration for a specific RAG type."""
    return {"rag_type": rag_type, "defaults": get_rag_defaults(rag_type)}

@app.get("/api/model-validate/{model_id}")
async def api_model_validate(model_id: str):
    """Validate if a specific model is available and compatible."""
    return validate_model_capabilities(model_id)

# ═══════════════════════════════════════════════════════════
#  Enterprise Features (Deployment & Observability)
# ═══════════════════════════════════════════════════════════

@app.post("/api/package/{pipeline_id}")
async def api_package_deployment(pipeline_id: str, req: DeployRequest, format: str = "docker"):
    """Generate deployment package (Docker/K8s) for a pipeline."""
    result = package_deployment(pipeline_id, req.model_dump(), format)
    if result["status"] == "error":
        raise HTTPException(status_code=500, detail=result["message"])
    return result

@app.get("/api/metrics")
async def api_get_metrics():
    """Get system-wide RAG performance metrics."""
    return {"status": "success", "metrics": get_metrics()}

@app.get("/api/logs")
async def api_get_logs(limit: int = 50, pipeline_id: Optional[str] = None):
    """Get recent RAG query logs."""
    logs = get_logs(limit, pipeline_id)
    return {"status": "success", "count": len(logs), "logs": logs}
