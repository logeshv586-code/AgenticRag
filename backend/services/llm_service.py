"""
LLM Service — Factory for creating LLM generator components.
Supports local (Qwen, Mistral, Llama 3, DeepSeek via llama_cpp),
Ollama integration, and cloud (OpenAI, Anthropic, Gemini).
Includes model capability validation, GPU detection, and automatic fallback.
"""
import logging
import os
import shutil
from typing import Optional, Dict, List

from haystack.utils import Secret

logger = logging.getLogger(__name__)

LLM_PORT = 8001  # local llama_cpp server port


# ═══════════════════════════════════════════════════════════
#  GPU & Capability Detection
# ═══════════════════════════════════════════════════════════

def detect_gpu_availability() -> dict:
    """
    Detect GPU availability for local model inference.
    Returns dict with cuda, rocm, metal, and vram info.
    """
    result = {
        "cuda_available": False,
        "rocm_available": False,
        "metal_available": False,
        "gpu_name": None,
        "vram_mb": 0,
        "recommended_quantization": "Q4_K_M",
    }

    # Check CUDA (NVIDIA)
    try:
        import torch
        if torch.cuda.is_available():
            result["cuda_available"] = True
            result["gpu_name"] = torch.cuda.get_device_name(0)
            result["vram_mb"] = torch.cuda.get_device_properties(0).total_mem // (1024 * 1024)
            if result["vram_mb"] >= 16000:
                result["recommended_quantization"] = "Q6_K"
            elif result["vram_mb"] >= 8000:
                result["recommended_quantization"] = "Q4_K_M"
            else:
                result["recommended_quantization"] = "Q3_K_L"
    except ImportError:
        pass

    # Check Metal (Apple Silicon)
    try:
        import platform
        if platform.system() == "Darwin" and platform.machine() == "arm64":
            result["metal_available"] = True
            if not result["gpu_name"]:
                result["gpu_name"] = "Apple Silicon"
    except Exception:
        pass

    return result


# ═══════════════════════════════════════════════════════════
#  Model Capability Validation
# ═══════════════════════════════════════════════════════════

MODEL_CAPABILITIES = {
    # ─── Local via Ollama (30-40GB server models) ──────────────────────────
    "ollama-auto": {
        "display_name": "Ollama Auto (Best Available)",
        "type": "local",
        "supports_tools": True,
        "supports_vision": True,
        "context_window": 32768,
        "requires_gpu": False,
        "min_vram_mb": 0,
        "model_size": "auto",
    },
    "mixtral:8x7b": {
        "display_name": "Mixtral 8x7B (26GB) — Best All-Round",
        "type": "local",
        "supports_tools": True,
        "supports_vision": False,
        "context_window": 32768,
        "requires_gpu": False,
        "min_vram_mb": 0,
        "model_size": "26GB",
    },
    "qwen2.5:72b": {
        "display_name": "Qwen 2.5 72B (44GB) — Best Multilingual",
        "type": "local",
        "supports_tools": True,
        "supports_vision": False,
        "context_window": 32768,
        "requires_gpu": False,
        "min_vram_mb": 0,
        "model_size": "44GB",
    },
    "llama3.1:70b": {
        "display_name": "LLaMA 3.1 70B Q2 (26GB) — Deep Reasoning",
        "type": "local",
        "supports_tools": True,
        "supports_vision": False,
        "context_window": 131072,
        "requires_gpu": False,
        "min_vram_mb": 0,
        "model_size": "26GB",
    },
    "llava:34b": {
        "display_name": "LLaVA 34B (20GB) — Vision + Text",
        "type": "local",
        "supports_tools": False,
        "supports_vision": True,
        "context_window": 8192,
        "requires_gpu": False,
        "min_vram_mb": 0,
        "model_size": "20GB",
    },
    "gemma3:27b": {
        "display_name": "Gemma 3 27B (17GB) — Multimodal",
        "type": "local",
        "supports_tools": False,
        "supports_vision": True,
        "context_window": 8192,
        "requires_gpu": False,
        "min_vram_mb": 0,
        "model_size": "17GB",
    },
    "llama3.1:8b": {
        "display_name": "LLaMA 3.1 8B (5GB) — Fast / Lightweight",
        "type": "local",
        "supports_tools": True,
        "supports_vision": False,
        "context_window": 131072,
        "requires_gpu": False,
        "min_vram_mb": 0,
        "model_size": "5GB",
    },
    # ─── Legacy llama_cpp local models (kept for backward compatibility) ───
    "qwen-local": {
        "display_name": "Qwen 2.5 14B (local .gguf)",
        "type": "local",
        "supports_tools": False,
        "supports_vision": False,
        "context_window": 4096,
        "requires_gpu": False,
        "min_vram_mb": 6000,
        "model_size": "8GB",
    },
    "mistral-local": {
        "display_name": "Mistral 7B (local .gguf)",
        "type": "local",
        "supports_tools": False,
        "supports_vision": False,
        "context_window": 4096,
        "requires_gpu": False,
        "min_vram_mb": 4000,
        "model_size": "4GB",
    },
    "ollama": {
        "display_name": "Ollama (Auto-detect)",
        "type": "local",
        "supports_tools": True,
        "supports_vision": True,
        "context_window": 8192,
        "requires_gpu": False,
        "min_vram_mb": 0,
        "model_size": "auto",
    },
    # ─── Cloud Models ──────────────────────────────────────────────────────
    "gpt4o": {
        "display_name": "OpenAI GPT-4o",
        "type": "cloud",
        "supports_tools": True,
        "supports_vision": True,
        "context_window": 128000,
        "requires_gpu": False,
        "min_vram_mb": 0,
    },
    "claude35": {
        "display_name": "Anthropic Claude 3.5",
        "type": "cloud",
        "supports_tools": True,
        "supports_vision": True,
        "context_window": 200000,
        "requires_gpu": False,
        "min_vram_mb": 0,
    },
    "gemini": {
        "display_name": "Google Gemini Pro",
        "type": "cloud",
        "supports_tools": True,
        "supports_vision": True,
        "context_window": 1000000,
        "requires_gpu": False,
        "min_vram_mb": 0,
    },
}


def validate_model_capabilities(model_id: str) -> dict:
    """
    Check if a model is available and compatible with the system.
    Returns {available: bool, capabilities: dict, warnings: list}.
    """
    caps = MODEL_CAPABILITIES.get(model_id)
    if not caps:
        return {"available": False, "capabilities": {}, "warnings": [f"Unknown model: {model_id}"]}

    warnings = []
    available = True

    if caps["type"] == "local":
        gpu = detect_gpu_availability()
        if caps["min_vram_mb"] > 0 and gpu["vram_mb"] < caps["min_vram_mb"]:
            warnings.append(
                f"Model needs ~{caps['min_vram_mb']}MB VRAM. "
                f"Detected {gpu['vram_mb']}MB. Performance may be slow (CPU mode)."
            )

        if model_id == "ollama":
            # Check if Ollama is running
            available, msg = _check_ollama_running()
            if not available:
                warnings.append(msg)

    return {
        "available": available,
        "capabilities": caps,
        "warnings": warnings,
    }


# ═══════════════════════════════════════════════════════════
#  Automatic Fallback Chain
# ═══════════════════════════════════════════════════════════

FALLBACK_CHAIN = {
    "qwen-local": ["ollama", "gpt4o"],
    "mistral-local": ["ollama", "gpt4o"],
    "llama3-local": ["ollama", "gpt4o"],
    "deepseek-local": ["ollama", "gpt4o"],
    "ollama": ["qwen-local", "gpt4o"],
    "gpt4o": ["claude35", "gemini", "qwen-local"],
    "claude35": ["gpt4o", "gemini", "qwen-local"],
    "gemini": ["gpt4o", "claude35", "qwen-local"],
}


def get_fallback_model(model_id: str) -> Optional[str]:
    """Get the next fallback model if the primary is unavailable."""
    chain = FALLBACK_CHAIN.get(model_id, ["qwen-local"])
    for fallback in chain:
        validation = validate_model_capabilities(fallback)
        if validation["available"]:
            return fallback
    return "qwen-local"  # Ultimate fallback


# ═══════════════════════════════════════════════════════════
#  Generator Factory
# ═══════════════════════════════════════════════════════════

def get_generator(model_id: str, api_key: Optional[str] = None, base_url: Optional[str] = None):
    """
    Factory: return the right Haystack generator based on user selection.
    Supports llm_override via api_key + base_url for user-provided LLMs.
    """
    # If user provided a custom base_url, route to that OpenAI-compatible endpoint
    if base_url:
        from haystack.components.generators import OpenAIGenerator
        key = Secret.from_token(api_key) if api_key else Secret.from_token("sk-no-key")
        return OpenAIGenerator(
            api_key=key,
            api_base_url=base_url,
            model=model_id,
            generation_kwargs={"max_tokens": 1024, "temperature": 0.7},
            timeout=300.0,
        )

    # Ollama-managed models (30-40GB range)
    ollama_models = ["mixtral", "qwen2.5", "llama3.1", "llava", "gemma3", "llama3", "mistral", "phi3"]
    is_ollama = any(m in model_id.lower() for m in ollama_models) or ":" in model_id

    if model_id in ("ollama", "ollama-auto") or is_ollama:
        return _ollama_generator(api_key, preferred_model=model_id if ":" in model_id else None)
    elif model_id == "qwen-local":
        return _ollama_generator(api_key, preferred_model="qwen2.5")
    elif model_id in ("mistral-local",):
        return _ollama_generator(api_key, preferred_model="mistral")
    elif model_id in ("llama3-local",):
        return _ollama_generator(api_key, preferred_model="llama3")
    elif model_id in ("deepseek-local",):
        return _ollama_generator(api_key, preferred_model="deepseek")
    elif model_id == "gpt4o":
        return _openai_generator(api_key)
    elif model_id == "claude35":
        return _anthropic_generator(api_key)
    elif model_id == "gemini":
        return _gemini_generator(api_key)
    else:
        logger.warning(f"Unknown LLM model '{model_id}', falling back to Ollama auto")
        return _ollama_generator(api_key)


def get_model_display_name(model_id: str) -> str:
    """Human-readable model name for visualization."""
    caps = MODEL_CAPABILITIES.get(model_id)
    if caps:
        return caps["display_name"]
    return model_id


def list_available_models() -> List[dict]:
    """Return list of all available models with their capabilities."""
    return [
        {"id": k, **v}
        for k, v in MODEL_CAPABILITIES.items()
    ]


# ═══════════════════════════════════════════════════════════
#  Local Model Generators (via llama_cpp)
# ═══════════════════════════════════════════════════════════

def _local_qwen_generator():
    from haystack.components.generators import OpenAIGenerator
    return OpenAIGenerator(
        api_key=Secret.from_token("sk-no-key-required"),
        api_base_url=f"http://localhost:{LLM_PORT}/v1",
        model="Qwen2.5-14B-Instruct-1M-Q3_K_L.gguf",
        generation_kwargs={"max_tokens": 1024, "temperature": 0.7},
        timeout=300.0,
    )


def _local_mistral_generator():
    from haystack.components.generators import OpenAIGenerator
    return OpenAIGenerator(
        api_key=Secret.from_token("sk-no-key-required"),
        api_base_url=f"http://localhost:{LLM_PORT}/v1",
        model="mistral",
        generation_kwargs={"max_tokens": 1024, "temperature": 0.7},
        timeout=300.0,
    )


def _local_llama3_generator():
    """Llama 3 via llama_cpp — same OpenAI-compatible interface."""
    from haystack.components.generators import OpenAIGenerator
    return OpenAIGenerator(
        api_key=Secret.from_token("sk-no-key-required"),
        api_base_url=f"http://localhost:{LLM_PORT}/v1",
        model="llama3",
        generation_kwargs={"max_tokens": 1024, "temperature": 0.7},
        timeout=300.0,
    )


def _local_deepseek_generator():
    """DeepSeek R1 via llama_cpp — same OpenAI-compatible interface."""
    from haystack.components.generators import OpenAIGenerator
    return OpenAIGenerator(
        api_key=Secret.from_token("sk-no-key-required"),
        api_base_url=f"http://localhost:{LLM_PORT}/v1",
        model="deepseek",
        generation_kwargs={"max_tokens": 1024, "temperature": 0.7},
        timeout=300.0,
    )


# ═══════════════════════════════════════════════════════════
#  Ollama Integration
# ═══════════════════════════════════════════════════════════

OLLAMA_PORT = 11434  # Default Ollama port


def _check_ollama_running() -> tuple:
    """Check if Ollama server is running and accessible."""
    try:
        import requests
        resp = requests.get(f"http://localhost:{OLLAMA_PORT}/api/tags", timeout=3)
        if resp.status_code == 200:
            models = resp.json().get("models", [])
            model_names = [m["name"] for m in models]
            return True, f"Ollama running with models: {', '.join(model_names)}"
        return False, "Ollama server returned non-200 status"
    except Exception:
        return False, "Ollama is not running. Start with: ollama serve"


def _ollama_generator(api_key: Optional[str] = None, preferred_model: Optional[str] = None):
    """
    Ollama integration via OpenAI-compatible API.
    Auto-selects the best available model from the running Ollama instance.
    Prefers large models (mixtral, qwen2.5, llama3.1) when available.
    """
    from haystack.components.generators import OpenAIGenerator

    # Priority order: largest/best models first
    model_priority = ["mixtral", "qwen2.5", "llama3.1", "llama3", "gemma3", "gemma2", "mistral", "phi3", "llama2", "deepseek"]

    model_name = preferred_model or "llama3.1:8b"  # default fallback
    try:
        import requests
        resp = requests.get(f"http://localhost:{OLLAMA_PORT}/api/tags", timeout=3)
        if resp.status_code == 200:
            models = resp.json().get("models", [])
            if models:
                model_names = [m["name"] for m in models]

                # If specific model requested, use it if available
                if preferred_model and ":" in preferred_model:
                    if any(preferred_model in n for n in model_names):
                        model_name = preferred_model
                    else:
                        # Fall through to priority selection
                        preferred_model = None

                if not preferred_model or ":" not in str(preferred_model):
                    # Auto-select best model by priority
                    for preferred in (model_priority if not preferred_model else [preferred_model] + model_priority):
                        matching = [n for n in model_names if preferred in n.lower()]
                        if matching:
                            model_name = matching[0]
                            break
                    else:
                        model_name = model_names[0]

            logger.info(f"Ollama: Using model '{model_name}'")
    except Exception:
        logger.warning(f"Could not query Ollama, using default '{model_name}'")

    return OpenAIGenerator(
        api_key=Secret.from_token("ollama"),
        api_base_url=f"http://localhost:{OLLAMA_PORT}/v1",
        model=model_name,
        generation_kwargs={"max_tokens": 1024, "temperature": 0.7},
        timeout=300.0,
    )


# ═══════════════════════════════════════════════════════════
#  Cloud Model Generators
# ═══════════════════════════════════════════════════════════

def _openai_generator(api_key: Optional[str] = None):
    from haystack.components.generators import OpenAIGenerator
    key = Secret.from_token(api_key) if api_key else Secret.from_env_var("OPENAI_API_KEY")
    return OpenAIGenerator(
        api_key=key,
        model="gpt-4o",
        generation_kwargs={"max_tokens": 1024, "temperature": 0.7},
    )


def _anthropic_generator(api_key: Optional[str] = None):
    try:
        from haystack_integrations.components.generators.anthropic import AnthropicGenerator
        key = Secret.from_token(api_key) if api_key else Secret.from_env_var("ANTHROPIC_API_KEY")
        return AnthropicGenerator(
            api_key=key,
            model="claude-3-5-sonnet-20241022",
            generation_kwargs={"max_tokens": 1024, "temperature": 0.7},
        )
    except ImportError:
        logger.warning("anthropic-haystack not installed — using OpenAI-compatible fallback")
        from haystack.components.generators import OpenAIGenerator
        key = Secret.from_token(api_key) if api_key else Secret.from_env_var("ANTHROPIC_API_KEY")
        return OpenAIGenerator(
            api_key=key,
            api_base_url="https://api.anthropic.com/v1",
            model="claude-3-5-sonnet-20241022",
            generation_kwargs={"max_tokens": 1024, "temperature": 0.7},
        )


def _gemini_generator(api_key: Optional[str] = None):
    try:
        from haystack_integrations.components.generators.google_ai import GoogleAIGeminiGenerator
        key = Secret.from_token(api_key) if api_key else Secret.from_env_var("GOOGLE_API_KEY")
        return GoogleAIGeminiGenerator(
            api_key=key,
            model="gemini-pro",
            generation_kwargs={"max_output_tokens": 1024, "temperature": 0.7},
        )
    except ImportError:
        logger.warning("google-ai-haystack not installed — falling back to local Qwen")
        return _local_qwen_generator()


# ═══════════════════════════════════════════════════════════
#  API Key Validation
# ═══════════════════════════════════════════════════════════

def validate_api_key(provider: str, api_key: str) -> dict:
    """
    Validate an API key by making a lightweight request.
    Returns {"valid": bool, "message": str}
    """
    import requests

    try:
        if provider == "openai":
            resp = requests.get(
                "https://api.openai.com/v1/models",
                headers={"Authorization": f"Bearer {api_key}"},
                timeout=10,
            )
            if resp.status_code == 200:
                return {"valid": True, "message": "OpenAI key is valid"}
            return {"valid": False, "message": f"OpenAI returned {resp.status_code}"}

        elif provider == "anthropic":
            resp = requests.get(
                "https://api.anthropic.com/v1/models",
                headers={
                    "x-api-key": api_key,
                    "anthropic-version": "2023-06-01",
                },
                timeout=10,
            )
            if resp.status_code in (200, 403):
                return {"valid": True, "message": "Anthropic key recognized"}
            return {"valid": False, "message": f"Anthropic returned {resp.status_code}"}

        elif provider == "mistral":
            resp = requests.get(
                "https://api.mistral.ai/v1/models",
                headers={"Authorization": f"Bearer {api_key}"},
                timeout=10,
            )
            if resp.status_code == 200:
                return {"valid": True, "message": "Mistral key is valid"}
            return {"valid": False, "message": f"Mistral returned {resp.status_code}"}

        elif provider == "gemini":
            resp = requests.get(
                f"https://generativelanguage.googleapis.com/v1/models?key={api_key}",
                timeout=10,
            )
            if resp.status_code == 200:
                return {"valid": True, "message": "Google API key is valid"}
            return {"valid": False, "message": f"Google returned {resp.status_code}"}

        elif provider == "ollama":
            running, msg = _check_ollama_running()
            return {"valid": running, "message": msg}

        else:
            return {"valid": False, "message": f"Unknown provider: {provider}"}

    except Exception as e:
        return {"valid": False, "message": f"Connection error: {str(e)}"}
