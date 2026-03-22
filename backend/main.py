from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
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
from services.document_parser import parse_document, get_supported_extensions
import requests
import asyncio
import uuid
from contextlib import asynccontextmanager

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

import time

# ═══════════════════════════════════════════════════════════
#  Session-Based RAG Isolation
# ═══════════════════════════════════════════════════════════

# Each user gets an isolated session mapping to their RAG pipeline
active_sessions = {}

def create_user_session(session_id: str, pipeline_id: str, analysis: str = "") -> dict:
    """Create a new isolated RAG session for a user."""
    session = {
        "pipeline_id": pipeline_id,
        "analysis": analysis,
        "created_at": time.time(),
        "expires_in": 180  # 3 minutes
    }
    active_sessions[session_id] = session
    logger.info(f"🔵 Session created: {session_id} → pipeline {pipeline_id} (TTL: 180s)")
    return session

def get_active_session(session_id: str) -> dict | None:
    """Get active session or None if expired/missing."""
    session = active_sessions.get(session_id)
    if not session:
        return None
    elapsed = time.time() - session["created_at"]
    if elapsed >= session["expires_in"]:
        del active_sessions[session_id]
        logger.info(f"⏱ Session expired and removed: {session_id}")
        return None
    return session

def cleanup_expired_sessions():
    """Remove all expired sessions."""
    now = time.time()
    expired = [
        sid for sid, s in active_sessions.items()
        if now - s["created_at"] >= s["expires_in"]
    ]
    for sid in expired:
        del active_sessions[sid]
    if expired:
        logger.info(f"🧹 Cleaned up {len(expired)} expired sessions")

# --- Local LLM Server Management (Ollama) ---
OLLAMA_PORT = 11434
OLLAMA_BASE_URL = f"http://localhost:{OLLAMA_PORT}"

def check_ollama_status() -> dict:
    """Check if Ollama is running and return available models."""
    try:
        resp = requests.get(f"{OLLAMA_BASE_URL}/api/tags", timeout=5)
        if resp.status_code == 200:
            models = resp.json().get("models", [])
            model_names = [m["name"] for m in models]
            return {"running": True, "models": model_names}
        return {"running": False, "models": [], "error": f"HTTP {resp.status_code}"}
    except Exception as e:
        return {"running": False, "models": [], "error": str(e)}

def get_best_ollama_model(models: list) -> str:
    """Pick the best available model for text generation."""
    # Add new GGUF model to top priority
    priority = ["qwen3.5-9b", "mixtral", "qwen2.5", "llama3.1", "llama3", "gemma3", "gemma2", "mistral", "phi3", "llama2"]
    for preferred in priority:
        for m in models:
            if preferred in m.lower():
                return m
    return models[0] if models else "llama3.1:8b"

@asynccontextmanager
async def lifespan(app: FastAPI):
    # 1. Check Ollama
    status = check_ollama_status()
    if status["running"]:
        best = get_best_ollama_model(status["models"])
        logger.info(f"✅ Ollama running on port {OLLAMA_PORT}. Models: {status['models']}")
        logger.info(f"🤖 Platform assistant using: {best}")
    else:
        # 2. Fallback to local Model API (llama_cpp)
        try:
            resp = requests.get("http://localhost:8001/v1/models", timeout=3)
            if resp.status_code == 200:
                logger.info("✅ Local Model API detected on port 8001.")
                logger.info("🤖 Platform assistant using: Local Direct API")
            else:
                logger.warning("⚠️  No local AI engine detected (Ollama on 11434 or local API on 8001).")
                logger.warning("   Start Ollama or your local .gguf server for chatbot functionality.")
        except Exception:
            logger.warning("⚠️  No local AI engine detected (Ollama on 11434 or local API on 8001).")
            logger.warning("   Start Ollama or your local .gguf server for chatbot functionality.")

    # 3. Start background session cleanup task
    async def session_cleanup_loop():
        while True:
            await asyncio.sleep(30)
            cleanup_expired_sessions()

    cleanup_task = asyncio.create_task(session_cleanup_loop())
    logger.info("🔁 Session cleanup background task started (every 30s)")

    yield

    # Shutdown: cancel cleanup task
    cleanup_task.cancel()

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
    session_id: Optional[str] = None  # For session-based RAG routing
    audio_base64: Optional[str] = None  # For Voice RAG pipeline
    llm_override: Optional[Dict[str, str]] = None  # {"model": "gpt-4o", "api_key": "sk-...", "base_url": "..."}

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
    """Unified chat endpoint with session-based routing.
    - If session_id has an active RAG session → route to RAG pipeline (Test Mode)
    - Otherwise → use Guide Mode (OmniRAG platform assistant)
    """

    # ── SESSION-AWARE ROUTING ──────────────────────────────────
    if req.session_id:
        session = get_active_session(req.session_id)
        if session:
            # ✅ Active RAG session → route to user's pipeline
            logger.info(f"🔵 Test Mode: routing query for session {req.session_id} → pipeline {session['pipeline_id']}")
            remaining = max(0, session["expires_in"] - (time.time() - session["created_at"]))
            try:
                result = query_pipeline(
                    session["pipeline_id"],
                    req.query,
                    audio_base64=req.audio_base64,
                    llm_override=req.llm_override
                )
                answer = result if isinstance(result, str) else result.get("answer", str(result))
                return {
                    "answer": answer,
                    "mode": "test",
                    "session_active": True,
                    "remaining_seconds": int(remaining),
                    "pipeline_id": session["pipeline_id"]
                }
            except Exception as e:
                logger.error(f"RAG pipeline error for session {req.session_id}: {e}")
                return {
                    "answer": f"Error querying your RAG pipeline: {str(e)}",
                    "mode": "test",
                    "session_active": True,
                    "remaining_seconds": int(remaining)
                }
        else:
            # Session expired or not found
            logger.info(f"⏱ Session {req.session_id} expired or not found → Guide Mode")
            # Fall through to guide mode, but flag session as expired
            guide_response = await _guide_mode_response(req.query)
            guide_response["session_expired"] = True
            guide_response["mode"] = "guide"
            return guide_response

    # ── GUIDE MODE (Default) ──────────────────────────────────
    response = await _guide_mode_response(req.query)
    response["mode"] = "guide"
    return response


async def _guide_mode_response(query: str) -> dict:
    """Generate a response using the OmniRAG Guide assistant (LLM + prompt)."""
    system_prompt = """You are 'OmniRAG', the Neural Platform Assistant — an expert AI guide for the Agentic RAG Platform.

### YOUR KNOWLEDGE & CAPABILITIES:
- **13 RAG Architectures**: You support Standard (Universal Neural), Conversational (Cognitive), Multimodal (Global Context), Agentic (Autonomous Node), Graph (Synaptic), Real-time (Live Stream), personalized, cross-lingual, voice, citation-verified, and guardrailed RAGs.
- **RAG Factory**: You have a 10-step guided 'Factory' to build custom pipelines.
- **Knowledge Base**: Answer questions about RAG concepts, the differences between architectures, and how the platform works.
- **Tone**: Futuristic, futuristic, but practical.

If asked 'Hi' or 'Hello', respond as a friendly AI assistant ready to explain the platform or RAG concepts. Only suggest the 'Custom RAG Factory' if it fits the user's explicit goal of creation."""

    try:
        # Attempt to use Ollama first
        status = check_ollama_status()
        base_url = f"{OLLAMA_BASE_URL}/v1/chat/completions"
        if status["running"]:
            model_name = get_best_ollama_model(status["models"])
        else:
            # Fallback to local llama_cpp instance (port 8001)
            try:
                resp = requests.get("http://localhost:8001/v1/models", timeout=3)
                if resp.status_code == 200:
                    models = resp.json().get("data", [])
                    model_name = models[0]["id"] if models else "qwen-local"
                    base_url = "http://localhost:8001/v1/chat/completions"
                else:
                    return {"answer": "No local AI engine detected. Please ensure Ollama (port 11434) or local llama_cpp (port 8001) is running.", "model_used": "none"}
            except Exception:
                return {"answer": "No local AI engine detected. Please ensure Ollama (port 11434) or local llama_cpp (port 8001) is running.", "model_used": "none"}

        response = requests.post(
            base_url,
            json={
                "model": model_name,
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": query}
                ],
                "temperature": 0.7,
                "max_tokens": 1024
            },
            timeout=120
        )
        response.raise_for_status()
        data = response.json()
        answer = data["choices"][0]["message"]["content"]
        return {"answer": answer, "model_used": model_name}
    except Exception as e:
        logger.warning(f"LLM Chat Error: {e}")
        return {"answer": "I am your OmniRAG Neural Assistant! I'm currently initializing. You can ask me about any of the 13 RAG types, how to build your first RAG, supported file types, or which architecture fits your use case. Please try again in a moment.", "model_used": "initializing"}


@app.get("/api/ollama/status")
async def api_ollama_status():
    """Check Ollama server status and list available models."""
    status = check_ollama_status()
    best = get_best_ollama_model(status["models"]) if status["running"] and status["models"] else None
    return {
        "status": "running" if status["running"] else "offline",
        "models": status.get("models", []),
        "best_model": best,
        "error": status.get("error"),
        "ollama_url": OLLAMA_BASE_URL
    }


@app.post("/api/ollama/pull")
async def api_ollama_pull(request: dict):
    """Trigger an Ollama model pull. Body: {"model": "llama3.1:8b"}"""
    import subprocess
    model = request.get("model", "llama3.1:8b")
    try:
        # Run ollama pull in background
        subprocess.Popen(["ollama", "pull", model], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        return {"status": "pulling", "model": model, "message": f"Started pulling {model}. Check ollama status for progress."}
    except Exception as e:
        return {"status": "error", "message": str(e)}


@app.post("/api/test-chat")
async def api_test_chat(req: ChatRequest):
    """Query endpoint for deployed RAG pipelines. Supports text, audio, and LLM override."""
    if not req.pipeline_id:
        return {"answer": "Error: No pipeline_id provided."}

    logger.info(f"Executing test chat for pipeline {req.pipeline_id} with query: {req.query}")
    result = query_pipeline(
        req.pipeline_id,
        req.query,
        audio_base64=req.audio_base64,
        llm_override=req.llm_override
    )

    if isinstance(result, dict):
        return result
    return {"answer": result}


@app.post("/transcribe")
async def api_transcribe(file: UploadFile = File(...)):
    """Transcribe an audio file to text using local Whisper (faster-whisper)."""
    temp_path = None
    try:
        import tempfile
        suffix = os.path.splitext(file.filename)[1] if file.filename else ".webm"
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            temp_path = tmp.name
            content = await file.read()
            tmp.write(content)

        from services.document_parser import _transcribe_audio
        text = _transcribe_audio(temp_path)
        return {"text": text, "filename": file.filename}
    except Exception as e:
        logger.error(f"Transcription error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if temp_path and os.path.exists(temp_path):
            os.remove(temp_path)


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
#  Session Management Endpoints
# ═══════════════════════════════════════════════════════════

class SessionCreateRequest(BaseModel):
    session_id: str
    pipeline_id: str
    analysis: Optional[str] = ""

@app.post("/api/session/create")
async def api_session_create(req: SessionCreateRequest):
    """Create a new isolated RAG session for a user after deployment."""
    session = create_user_session(req.session_id, req.pipeline_id, req.analysis)
    return {
        "status": "success",
        "session_id": req.session_id,
        "pipeline_id": req.pipeline_id,
        "expires_in": session["expires_in"],
        "expires_at": session["created_at"] + session["expires_in"]
    }

@app.get("/api/session/status")
async def api_session_status(session_id: str):
    """Check if a session is still active and how much time remains."""
    session = get_active_session(session_id)
    if session:
        remaining = max(0, session["expires_in"] - (time.time() - session["created_at"]))
        return {
            "active": True,
            "remaining_seconds": int(remaining),
            "pipeline_id": session["pipeline_id"]
        }
    return {"active": False, "remaining_seconds": 0}


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
