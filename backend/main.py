from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import os
import zipfile
from pathlib import Path
import os
import logging
from services.scraper import scrape_urls
from services.rag_builder import deploy_rag_system
from services.haystack_service import query_pipeline, get_pipeline_graph
from services.local_llm import chat as local_llm_chat, guide_chat as local_guide_chat, test_chat as local_test_chat, is_model_ready, get_model_info
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

# ═══════════════════════════════════════════════════════════
#  Session-Based RAG Isolation
# ═══════════════════════════════════════════════════════════

active_sessions: Dict[str, Dict[str, Any]] = {}

def create_user_session(session_id: str, pipeline_id: str, analysis: str = "", expires_in: int = 180) -> dict:
    """Create a new isolated session mapping session_id -> RAG pipeline."""
    session = {
        "pipeline_id": pipeline_id,
        "analysis": analysis,
        "created_at": time.time(),
        "expires_in": expires_in
    }
    active_sessions[session_id] = session
    logger.info(f"📌 Session created: {session_id[:8]}... -> pipeline {pipeline_id} (TTL={expires_in}s)")
    return session

def get_active_session(session_id: str) -> Optional[dict]:
    """Return active session or None if expired/missing."""
    session = active_sessions.get(session_id)
    if not session:
        return None
    elapsed = time.time() - session["created_at"]
    if elapsed >= session["expires_in"]:
        del active_sessions[session_id]
        logger.info(f"⏰ Session expired: {session_id[:8]}...")
        return None
    return session

def cleanup_expired_sessions():
    """Remove all expired sessions."""
    now = time.time()
    expired = [sid for sid, s in active_sessions.items() if now - s["created_at"] >= s["expires_in"]]
    for sid in expired:
        del active_sessions[sid]
        logger.info(f"🗑️ Cleaned up expired session: {sid[:8]}...")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Mount GGUF Server on 8010
    _mount_gguf_server(app)
    
    # Check if local AI is running (Ollama default 11434)
    ollama_status = check_ollama_status()

    if ollama_status["running"]:
        best = get_best_ollama_model(ollama_status["models"])
        logger.info(f"✅ Ollama running. Available models: {ollama_status['models']}")
        logger.info(f"🤖 Platform chatbot capable of using: {best}")
    else:
        logger.info("ℹ️  No Ollama detected (running native GGUF on 8010).")

    async def session_cleanup_loop():
        while True:
            await asyncio.sleep(30)
            cleanup_expired_sessions()

    cleanup_task = asyncio.create_task(session_cleanup_loop())
    logger.info("🔁 Session cleanup background task started (every 30s)")

    yield

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
    session_id: Optional[str] = None  # For session-based RAG routing
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
#  GGUF Model Server Auto-Start
# ═══════════════════════════════════════════════════════════

# ═══════════════════════════════════════════════════════════
#  GGUF Model Server Direct Mounting (Unifies Ports on 8010)
# ═══════════════════════════════════════════════════════════

def _mount_gguf_server(fastapi_app: FastAPI):
    """Mounts llama_cpp.server directly onto the main FastAPI instance under /v1."""
    base_dir = os.path.dirname(os.path.abspath(__file__))
    model_paths = [
        os.path.join(base_dir, "Qwen3.5-9B-GGUF", "Qwen2.5-1.5B-Instruct-Q4_K_M.gguf"),
        os.path.join(base_dir, "Qwen3.5-9B-GGUF", "Qwen3.5-9B-Q4_K_M.gguf"),
    ]
    
    selected_model = None
    for p in model_paths:
        if os.path.exists(p):
            selected_model = p
            break
            
    if not selected_model:
        logger.error("❌ No GGUF models found in backend/Qwen3.5-9B-GGUF")
        return

    try:
        import llama_cpp.server.settings
        from llama_cpp.server.app import create_app
        
        logger.info(f"🚀 Mounting local GGUF model: {selected_model}")
        
        # We don't need network settings since it's mounted, but we must provide them
        server_settings = llama_cpp.server.settings.ServerSettings(host='0.0.0.0', port=8010)
        
        # Configure model settings
        model_settings = [
            llama_cpp.server.settings.ModelSettings(
                model=selected_model,
                n_ctx=4096,
                n_gpu_layers=0  # CPU only for stability
            )
        ]
        
        # Create the sub-application
        gguf_app = create_app(
            server_settings=server_settings,
            model_settings=model_settings
        )
        
        # Mount the sub-app on / so endpoints like /v1/chat/completions work locally
        # (llama_cpp already prefixes its routes with /v1 internally)
        fastapi_app.mount("/", gguf_app)
        logger.info("✅ GGUF model mounted successfully")
        
    except Exception as e:
        logger.error(f"❌ Failed to mount GGUF server: {e}")


# ═══════════════════════════════════════════════════════════
#  AI Interaction Endpoints
# ═══════════════════════════════════════════════════════════

import re

def _clean_markdown(text: str) -> str:
    """Removes ** and ## from the LLM responses for cleaner display."""
    if not text:
        return ""
    text = re.sub(r'\*\*(.*?)\*\*', r'\1', text)  # Remove bold tags, keep text
    text = re.sub(r'##\s*(.*)', r'\n\1', text)      # Remove header tags, keep text
    return text.strip()

@app.post("/api/chat")
def api_chat(req: ChatRequest):
    """Session-aware chat: routes to local LLM (Test Mode) or Guide LLM."""
    
    # --- 1. Fast Greeting Check ---
    greetings = ["hi", "hello", "hey", "hola", "namaste", "good morning", "good afternoon"]
    if req.query.lower().strip().rstrip('?') in greetings:
        return {
            "answer": "Hello! I am your OmniRAG Assistant. How can I help you build or query your RAG system today?",
            "mode": "greeting",
            "session_active": False
        }

    # --- 2. Session-aware routing (Test Mode — via direct LLM, but will be refactored to pass through Haystack) ---
    if req.session_id:
        session = get_active_session(req.session_id)
        if session:
            try:
                remaining = max(0, int(session["expires_in"] - (time.time() - session["created_at"])))
                
                # We revert to Haystack query_pipeline to utilize the 13 RAG architectures!
                overrides = req.llm_override or {"model": "qwen-local"}
                result = query_pipeline(session["pipeline_id"], req.query, llm_override=overrides)
                answer = _clean_markdown(result.get("answer", "No answer found."))
                
                return {
                    "answer": answer,
                    "mode": "test",
                    "session_active": True,
                    "remaining_seconds": remaining,
                    "pipeline_id": session["pipeline_id"]
                }
            except Exception as e:
                logger.warning(f"Test chat error for session {req.session_id[:8]}...: {e}")
                return {
                    "answer": "⚠️ Model temporarily unavailable. Please try again.",
                    "mode": "test",
                    "session_active": True,
                    "remaining_seconds": 0
                }
        else:
            pass  # Session expired — fall through to Guide Mode

    # --- 3. Guide Mode (default — direct local LLM) ---
    guide_resp = _guide_mode_response(req.query)
    guide_resp["answer"] = _clean_markdown(guide_resp.get("answer", ""))
    return guide_resp


PLATFORM_KNOWLEDGE = """You are the Neural Assistant for OmniRAG Engine — an expert AI guide helping users build, understand, and deploy custom RAG (Retrieval Augmented Generation) systems.

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

Answer questions helpfully and concisely. If asked to build or choose a RAG, guide the user step by step. Always be encouraging and practical. Use your retrieval context to provide specific details about OmniRAG features like FAISS, ChromaDB, and Agentic RAG.

## Advanced Technical Details
- **Vector Stores**: We use ChromaDB and FAISS for local storage. FAISS is recommended for large datasets (1M+ vectors), while ChromaDB is best for metadata-heavy filtering.
- **Models**: We prefer Qwen 2.5 and Llama 3.1 for local inference. Qwen 2.5 1.5B is our ultra-fast lightweight model.
- **Architecture**: Our 13 RAG types cover every enterprise need from simple FAQ (Basic) to complex planning (Agentic)."""

# ═══════════════════════════════════════════════════════════
#  Direct Local LLM Chat Functions (No Haystack Pipeline)
# ═══════════════════════════════════════════════════════════

# Map pipeline_id -> ragName for loading stored documents
_pipeline_rag_map: Dict[str, str] = {}

def _load_rag_context(pipeline_id: str, max_chars: int = 3000) -> str:
    """Load stored documents for a deployed RAG to use as LLM context."""
    rag_name = _pipeline_rag_map.get(pipeline_id, "")
    if not rag_name:
        return "No documents loaded for this pipeline."
    
    data_file = os.path.join(os.path.dirname(__file__), "data", rag_name, "scraped_data.txt")
    if not os.path.exists(data_file):
        return "No documents found."
    
    try:
        with open(data_file, "r", encoding="utf-8") as f:
            content = f.read()
        # Truncate to fit in context window
        if len(content) > max_chars:
            content = content[:max_chars] + "\n... [truncated]"
        return content
    except Exception as e:
        logger.warning(f"Failed to load context for {rag_name}: {e}")
        return "Error loading documents."


def _static_guide_response(query: str) -> str:
    """Static fallback when LLM is unavailable."""
    q = query.lower()
    if any(w in q for w in ["rag", "type", "architecture", "build"]):
        return ("OmniRAG supports 13 RAG architectures: Universal Neural, Hybrid, Conversational, "
                "Multimodal, Structured Intelligence, Graph, Agentic, Realtime, Personalized, "
                "Multilingual, Voice, Citation, and Guardrails RAG. "
                "Click 'Start Building' to create one!")
    if any(w in q for w in ["file", "upload", "format", "document"]):
        return ("You can upload PDF, DOCX, TXT, CSV, HTML, Markdown, images (JPG/PNG/WEBP), "
                "and audio (MP3/WAV/M4A). We also scrape websites by URL.")
    if any(w in q for w in ["model", "llm", "local", "ollama"]):
        return ("OmniRAG supports local models (Qwen 2.5, LLaMA 3.1, Mixtral via Ollama or GGUF) "
                "and cloud APIs (OpenAI GPT-4o, Anthropic Claude, Google Gemini).")
    return ("Welcome to OmniRAG Engine! I can help you build production-ready AI chatbots "
            "backed by custom knowledge bases. Upload your data, choose a RAG architecture, "
            "and deploy a live AI endpoint — all without writing code. What would you like to build?")


def _guide_mode_response(query: str) -> dict:
    """Guide Mode: direct call to local GGUF model with platform knowledge."""
    if not is_model_ready():
        logger.warning("Guide Mode: local GGUF model not ready, using static fallback")
        return {"answer": _static_guide_response(query), "mode": "guide", "session_active": False, "model_used": "static-fallback"}
    
    try:
        answer = local_guide_chat(query, PLATFORM_KNOWLEDGE)
        if answer and "⚠️" not in answer:
            model_info = get_model_info()
            return {"answer": answer, "mode": "guide", "session_active": False, "model_used": model_info.get("id", "local-gguf")}
        raise ValueError("LLM returned error")
    except Exception as e:
        logger.warning(f"Guide Mode direct LLM failed ({e}), using static fallback")
        return {"answer": _static_guide_response(query), "mode": "guide", "session_active": False, "model_used": "static-fallback"}


# ═══════════════════════════════════════════════════════════
#  Session Endpoints
# ═══════════════════════════════════════════════════════════

class SessionCreateRequest(BaseModel):
    session_id: str
    pipeline_id: str
    analysis: Optional[str] = ""

@app.post("/api/session/create")
async def api_session_create(req: SessionCreateRequest):
    """Create a new isolated RAG session for Test Mode."""
    session = create_user_session(
        session_id=req.session_id,
        pipeline_id=req.pipeline_id,
        analysis=req.analysis or ""
    )
    return {
        "status": "created",
        "session_id": req.session_id,
        "pipeline_id": req.pipeline_id,
        "expires_in": session["expires_in"],
        "message": f"Session active for {session['expires_in']}s"
    }

@app.get("/api/session/status")
async def api_session_status(session_id: str):
    """Check if a session is still active and return remaining time."""
    session = get_active_session(session_id)
    if session:
        remaining = max(0, int(session["expires_in"] - (time.time() - session["created_at"])))
        return {"active": True, "remaining_seconds": remaining, "pipeline_id": session["pipeline_id"]}
    return {"active": False, "remaining_seconds": 0}


@app.delete("/api/memory/{pipeline_id}/clear")
async def api_memory_clear(pipeline_id: str):
    """Clear memory for an active RAG session."""
    try:
        from services.memory_manager import clear_memory
        clear_memory(pipeline_id)
        return {"status": "success", "message": "Memory cleared."}
    except Exception as e:
        logger.error(f"Error clearing memory: {e}")
        raise HTTPException(status_code=500, detail="Failed to clear memory")


@app.get("/api/export/{pipeline_id}")
async def api_export_rag(pipeline_id: str):
    """Export the deployed pipeline configuration and basic frontend into a standalone ZIP."""
    rag_name = _pipeline_rag_map.get(pipeline_id)
    if not rag_name:
        raise HTTPException(status_code=404, detail="Pipeline data not mapped or found.")
        
    rag_dir = Path(__file__).parent / "data" / rag_name
    if not rag_dir.exists():
        raise HTTPException(status_code=404, detail=f"Data directory {rag_name} not found.")

    export_dir = Path(__file__).parent / "exports"
    export_dir.mkdir(exist_ok=True)
    
    zip_filename = export_dir / f"{rag_name}_export.zip"
    
    html_content = f"""<!DOCTYPE html>
<html>
<head>
    <title>Chat with RAG: {rag_name}</title>
    <style>
        body {{ font-family: system-ui, sans-serif; max-width: 600px; margin: 40px auto; background: #f4f4f5; }}
        #chat {{ height: 400px; overflow-y: auto; background: white; border-radius: 8px; padding: 20px; margin-bottom: 20px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }}
        .msg {{ margin-bottom: 12px; padding: 12px; border-radius: 8px; }}
        .user {{ background: #3b82f6; color: white; margin-left: 40px; }}
        .bot {{ background: #e4e4e7; color: black; margin-right: 40px; }}
        .controls {{ display: flex; gap: 10px; }}
        input {{ flex: 1; padding: 12px; border: 1px solid #d4d4d8; border-radius: 8px; }}
        button {{ padding: 12px 24px; background: #10b981; color: white; border: none; border-radius: 8px; cursor: pointer; }}
    </style>
</head>
<body>
    <h2>Chat: {rag_name}</h2>
    <div id="chat"></div>
    <div class="controls">
        <input type="text" id="query" placeholder="Ask a question..." onkeypress="if(event.key === 'Enter') send()" />
        <button onclick="send()">Send</button>
    </div>
    <script>
        async function send() {{
            const query = document.getElementById('query').value;
            if(!query) return;
            const chat = document.getElementById('chat');
            chat.innerHTML += `<div class='msg user'>${{query}}</div>`;
            document.getElementById('query').value = '';
            try {{
                const res = await fetch('http://localhost:8010/api/test-chat', {{
                    method: 'POST',
                    headers: {{'Content-Type': 'application/json'}},
                    body: JSON.stringify({{ query: query, pipeline_id: '{pipeline_id}' }})
                }});
                const data = await res.json();
                chat.innerHTML += `<div class='msg bot'>${{data.answer}}</div>`;
            }} catch(e) {{
                chat.innerHTML += `<div class='msg bot' style='color:red'>Error connecting to backend</div>`;
            }}
            chat.scrollTop = chat.scrollHeight;
        }}
    </script>
</body>
</html>
"""

    with zipfile.ZipFile(zip_filename, 'w', zipfile.ZIP_DEFLATED) as zipf:
        zipf.writestr("index.html", html_content)
        for root, _, files in os.walk(rag_dir):
            for file in files:
                file_path = os.path.join(root, file)
                arcname = os.path.relpath(file_path, rag_dir)
                zipf.write(file_path, f"data/{{arcname}}")
                
    return FileResponse(zip_filename, filename=f"{rag_name}_export.zip", media_type="application/zip")


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
def api_test_chat(req: ChatRequest):
    """Query endpoint for deployed RAGs — uses direct local LLM with document context."""
    if not req.pipeline_id:
        return {"answer": "Please create a RAG first before testing."}

    # --- Fast Greeting Check ---
    greetings = ["hi", "hello", "hey", "hola", "namaste"]
    if req.query.lower().strip().rstrip('?') in greetings:
        return {"answer": "Hi there! I'm ready to answer questions about your data. What would you like to know?"}

    logger.info(f"Test chat for pipeline {req.pipeline_id}: {req.query}")
    
    try:
        # Define overrides for query_pipeline
        overrides = req.llm_override or {"model": "qwen-local"}

        # Use Haystack query pipeline to route through 13 RAG types deployed locally
        result = query_pipeline(
            req.pipeline_id,
            req.query,
            audio_base64=req.audio_base64,
            llm_override=overrides
        )
        
        if isinstance(result, dict):
            if "answer" in result:
                result["answer"] = _clean_markdown(result["answer"])
            return result
            
        return {"answer": _clean_markdown(result)}
    except Exception as e:
        logger.error(f"Test chat error: {e}")
        return {"answer": "⚠️ Model temporarily unavailable. Please try again in a moment."}


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
        
        # Store pipeline → ragName mapping for direct LLM test chat
        _pipeline_rag_map[pipeline_id] = config.get("ragName", "")
        logger.info(f"📌 Mapped pipeline {pipeline_id} → {config.get('ragName', '')}")
        
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

@app.post("/api/index-site")
async def api_index_site(base_url: str = Body(..., embed=True), mode: str = "dynamic"):
    """Crawl and index the entire site into the Global Guide RAG for fast responses."""
    try:
        from services.scraper import scrape_urls
        logger.info(f"🌐 Indexing entire site: {base_url}")
        texts = scrape_urls([base_url], mode=mode, max_pages=100)
        
        config = {
            "ragName": "OmniRAG_Global_Guide",
            "extracted_texts": texts,
            "ragType": "basic",
            "dbType": "local",
            "localDb": "faiss",
            "llmModel": "qwen-local",
            "embeddingModel": "bge-local",
            "chunkSize": 500,
            "topK": 5,
            "useReranker": True
        }
        
        from services.rag_builder import deploy_rag_system
        deploy_rag_system(config)
        
        return {
            "status": "success",
            "message": f"Site {base_url} indexed into Global Guide.",
            "pages_count": len(texts)
        }
    except Exception as e:
        logger.error(f"Global Indexing Error: {e}")
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

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8010, reload=True)
