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
from contextlib import asynccontextmanager

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

import time

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
    priority = ["mixtral", "qwen2.5", "llama3.1", "llama3", "gemma3", "gemma2", "mistral", "phi3", "llama2"]
    for preferred in priority:
        for m in models:
            if preferred in m.lower():
                return m
    return models[0] if models else "llama3.1:8b"

@asynccontextmanager
async def lifespan(app: FastAPI):
    status = check_ollama_status()
    if status["running"]:
        best = get_best_ollama_model(status["models"])
        logger.info(f"✅ Ollama running. Available models: {status['models']}")
        logger.info(f"🤖 Platform chatbot will use: {best}")
    else:
        logger.warning(f"⚠️  Ollama not detected: {status.get('error')}")
        logger.warning("   Install from https://ollama.ai and run: ollama serve")
    yield

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
    """Powers the site chatbot robot with full OmniRAG platform knowledge via local Ollama LLM."""
    system_prompt = """You are the Neural Assistant for OmniRAG Engine — an expert AI guide helping users build, understand, and deploy custom RAG (Retrieval Augmented Generation) systems.

You know everything about the OmniRAG platform:

## Platform Overview
OmniRAG Engine is an enterprise-grade platform that lets anyone build production-ready AI chatbots backed by custom knowledge bases. Users upload their data (documents, images, audio, websites), choose a RAG architecture, and deploy a live AI endpoint — all without writing code.

## 13 RAG Architecture Types You Can Build
1. **Universal Neural RAG** — Vector search for precise text retrieval. Best for FAQs, knowledge bases.
2. **Global Data Integration (Hybrid RAG)** — BM25 + dense vector search with Reciprocal Rank Fusion. Best for documentation, code search.
3. **Enterprise Cognitive RAG (Conversational)** — Maintains session history and memory. Best for customer support, AI tutors.
4. **Global Context RAG (Multimodal)** — Retrieve images, audio, and video alongside text. Best for media search, product catalogs.
5. **Structured Intelligence RAG** — Text-to-SQL for structured/tabular data. Best for data analysis, financial reports.
6. **Synaptic Graph RAG** — Reasoning across knowledge graphs and entity relationships. Best for legal, medical research.
7. **Autonomous Network (Agentic RAG)** — Multi-step planning agents with tool use. Best for complex research, data pipelines.
8. **Live Neural Stream (Realtime RAG)** — Streaming ingestion for fresh content. Best for news, ops alerts.
9. **Adaptive Persona RAG** — Personalized retrieval using user profiles. Best for portals, learning platforms.
10. **Universal Matrix (Multilingual RAG)** — Native support for 94+ languages. Best for global sites, multilingual support.
11. **Vocal Synthesis (Voice RAG)** — Voice in/out with speech-to-text and text-to-speech. Best for hotlines, kiosks.
12. **Verified Intelligence (Citation RAG)** — Always shows sources and references. Best for knowledge pages, audits.
13. **Policy Guard Architecture (Guardrails RAG)** — Topic restrictions and safety compliance. Best for healthcare, enterprise.

## How to Build a RAG (Step by Step)
1. Click **Start Building** or **Deploy Assistant** button on the homepage.
2. Choose a RAG type or assistant template.
3. Enter your data sources — upload files (PDF, DOCX, CSV, HTML, images, audio) or paste URLs to scrape.
4. Configure settings — chunk size, top-K retrieval, LLM model, embedding model, vector database.
5. Click **Deploy** — your RAG is live in seconds with a unique pipeline ID.
6. Test your RAG at the /chat/:pipelineId endpoint using the built-in chat interface.

## Supported File Types for RAG Creation
- **Documents**: PDF, DOCX, TXT, CSV, HTML, Markdown
- **Images**: JPG, PNG, WEBP, BMP, TIFF (described by AI vision model)
- **Audio**: MP3, WAV, M4A, OGG (transcribed by local Whisper AI)
- **Websites**: Any URL — we scrape and index the content
- **Multilingual**: Any language — auto-detected and translated for indexing

## LLM Models Supported
- **Local (your server)**: Ollama — LLaMA 3.1, Mixtral, Qwen2.5, LLaVA (vision), Gemma3
- **Cloud APIs**: OpenAI GPT-4o, Anthropic Claude 3.5, Google Gemini Pro
- Users can also provide their own API key when testing their deployed RAG

## Vector Databases Supported
- Local: ChromaDB, FAISS
- Cloud: Pinecone, Qdrant, Elasticsearch

## Key Features
- Agentic reasoning with multi-step planning
- Policy Guard for content compliance
- Hybrid retrieval (BM25 + semantic)
- Real-time streaming ingestion
- Built-in observability dashboard (metrics, logs)
- One-click deployment packaging (Docker/K8s)
- Session memory for conversational RAGs
- Citation mode (always shows sources)

Answer questions helpfully and concisely. If asked to build or choose a RAG, guide the user step by step. Always be encouraging and practical."""

    try:
        # Get available Ollama models and pick the best one
        status = check_ollama_status()
        if not status["running"]:
            return {"answer": "The local AI engine is starting up. Please try again in a moment. (Ollama not detected — ensure it's running on port 11434)"}

        best_model = get_best_ollama_model(status["models"])

        response = requests.post(
            f"{OLLAMA_BASE_URL}/v1/chat/completions",
            json={
                "model": best_model,
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": req.query}
                ],
                "temperature": 0.7,
                "max_tokens": 1024
            },
            timeout=120
        )
        response.raise_for_status()
        data = response.json()
        answer = data["choices"][0]["message"]["content"]
        return {"answer": answer, "model_used": best_model}
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
