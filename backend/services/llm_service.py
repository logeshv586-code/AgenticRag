"""Secure LLM generator factory for OmniRAG.

Provider credentials are accepted from the current request or environment only.
No production credential is embedded in source code and unavailable providers fail
clearly rather than silently claiming a cloud fallback worked.
"""
from __future__ import annotations

import logging
import os
from typing import Dict, List, Optional

import requests
from haystack.utils import Secret

logger = logging.getLogger(__name__)
LLM_PORT = 8010
OLLAMA_PORT = 11434

MODEL_CAPABILITIES: Dict[str, dict] = {
    "qwen-local": {"display_name": "Qwen local GGUF", "type": "local", "supports_tools": False, "supports_vision": False, "context_window": 4096, "requires_gpu": False, "min_vram_mb": 0},
    "mistral-local": {"display_name": "Mistral local GGUF", "type": "local", "supports_tools": False, "supports_vision": False, "context_window": 4096, "requires_gpu": False, "min_vram_mb": 0},
    "llama3-local": {"display_name": "Llama 3 local GGUF", "type": "local", "supports_tools": True, "supports_vision": False, "context_window": 8192, "requires_gpu": False, "min_vram_mb": 0},
    "deepseek-local": {"display_name": "DeepSeek local GGUF", "type": "local", "supports_tools": True, "supports_vision": False, "context_window": 8192, "requires_gpu": False, "min_vram_mb": 0},
    "ollama": {"display_name": "Ollama Auto", "type": "local", "supports_tools": True, "supports_vision": True, "context_window": 32768, "requires_gpu": False, "min_vram_mb": 0},
    "ollama-auto": {"display_name": "Ollama Auto", "type": "local", "supports_tools": True, "supports_vision": True, "context_window": 32768, "requires_gpu": False, "min_vram_mb": 0},
    "llama3.1:8b": {"display_name": "Llama 3.1 8B via Ollama", "type": "local", "supports_tools": True, "supports_vision": False, "context_window": 131072, "requires_gpu": False, "min_vram_mb": 0},
    "qwen2.5:7b": {"display_name": "Qwen 2.5 7B via Ollama", "type": "local", "supports_tools": True, "supports_vision": False, "context_window": 32768, "requires_gpu": False, "min_vram_mb": 0},
    "llava:13b": {"display_name": "LLaVA via Ollama", "type": "local", "supports_tools": False, "supports_vision": True, "context_window": 8192, "requires_gpu": False, "min_vram_mb": 0},
    "gemma3:27b": {"display_name": "Gemma 3 via Ollama", "type": "local", "supports_tools": False, "supports_vision": True, "context_window": 8192, "requires_gpu": False, "min_vram_mb": 0},
    "gpt4o": {"display_name": "OpenAI GPT-4o", "type": "cloud", "supports_tools": True, "supports_vision": True, "context_window": 128000, "requires_gpu": False, "min_vram_mb": 0},
    "claude35": {"display_name": "Anthropic Claude 3.5 Sonnet", "type": "cloud", "supports_tools": True, "supports_vision": True, "context_window": 200000, "requires_gpu": False, "min_vram_mb": 0},
    "gemini": {"display_name": "Google Gemini 3.7 Flash", "type": "cloud", "supports_tools": True, "supports_vision": True, "context_window": 1000000, "requires_gpu": False, "min_vram_mb": 0},
    "mistral-online": {"display_name": "Mistral API", "type": "cloud", "supports_tools": True, "supports_vision": False, "context_window": 32768, "requires_gpu": False, "min_vram_mb": 0},
    "nemotron-online": {"display_name": "NVIDIA Nemotron", "type": "cloud", "supports_tools": True, "supports_vision": False, "context_window": 32768, "requires_gpu": False, "min_vram_mb": 0},
}


def detect_gpu_availability() -> dict:
    result = {
        "cuda_available": False,
        "rocm_available": False,
        "metal_available": False,
        "gpu_name": None,
        "vram_mb": 0,
        "recommended_quantization": "Q4_K_M",
    }
    try:
        import torch
        if torch.cuda.is_available():
            result["cuda_available"] = True
            result["gpu_name"] = torch.cuda.get_device_name(0)
            result["vram_mb"] = torch.cuda.get_device_properties(0).total_memory // (1024 * 1024)
            if result["vram_mb"] >= 16000:
                result["recommended_quantization"] = "Q6_K"
            elif result["vram_mb"] < 8000:
                result["recommended_quantization"] = "Q3_K_L"
    except Exception:
        pass
    try:
        import platform
        if platform.system() == "Darwin" and platform.machine() == "arm64":
            result["metal_available"] = True
            result["gpu_name"] = result["gpu_name"] or "Apple Silicon"
    except Exception:
        pass
    return result


def _check_ollama_running() -> tuple[bool, str]:
    try:
        response = requests.get(f"http://localhost:{OLLAMA_PORT}/api/tags", timeout=3)
        response.raise_for_status()
        names = [m.get("name", "") for m in response.json().get("models", [])]
        return True, f"Ollama running with {len(names)} model(s)"
    except Exception as exc:
        return False, f"Ollama unavailable: {exc}"


def validate_model_capabilities(model_id: str) -> dict:
    caps = MODEL_CAPABILITIES.get(model_id)
    if not caps and (":" in model_id or any(x in model_id.lower() for x in ("llama", "qwen", "mistral", "gemma", "llava", "phi", "deepseek"))):
        caps = {"display_name": model_id, "type": "local", "supports_tools": True, "supports_vision": False, "context_window": 8192, "requires_gpu": False, "min_vram_mb": 0}
    if not caps:
        return {"available": False, "capabilities": {}, "warnings": [f"Unknown model: {model_id}"]}
    warnings = []
    available = True
    if model_id in ("ollama", "ollama-auto") or ":" in model_id:
        available, message = _check_ollama_running()
        if not available:
            warnings.append(message)
    if caps["type"] == "cloud":
        env_map = {
            "gpt4o": "OPENAI_API_KEY",
            "claude35": "ANTHROPIC_API_KEY",
            "gemini": "GOOGLE_API_KEY",
            "mistral-online": "MISTRAL_API_KEY",
            "nemotron-online": "NVIDIA_API_KEY",
        }
        env_name = env_map.get(model_id)
        if env_name and not os.getenv(env_name):
            warnings.append(f"{env_name} is not configured; provide a request key or environment secret before use.")
    return {"available": available, "capabilities": caps, "warnings": warnings}


def get_fallback_model(model_id: str) -> Optional[str]:
    """Prefer a customer-controlled local provider; no hidden paid-provider fallback."""
    if model_id != "ollama-auto":
        running, _ = _check_ollama_running()
        if running:
            return "ollama-auto"
    return "qwen-local"


def _openai_compatible(model: str, api_base_url: str, token: str, max_tokens: int = 1024, temperature: float = 0.3):
    from haystack.components.generators import OpenAIGenerator
    if not token:
        raise RuntimeError(f"An API credential is required for {api_base_url}")
    return OpenAIGenerator(
        api_key=Secret.from_token(token),
        api_base_url=api_base_url,
        model=model,
        generation_kwargs={"max_tokens": max_tokens, "temperature": temperature},
        timeout=300.0,
    )


def _local_gguf_generator(model: str):
    return _openai_compatible(model, f"http://localhost:{LLM_PORT}/v1", "sk-no-key-required", max_tokens=1024)


def _best_ollama_model(preferred: Optional[str] = None) -> str:
    fallback = preferred or "llama3.1:8b"
    try:
        response = requests.get(f"http://localhost:{OLLAMA_PORT}/api/tags", timeout=3)
        response.raise_for_status()
        names = [m.get("name", "") for m in response.json().get("models", []) if m.get("name")]
        if preferred and any(preferred == name or preferred in name for name in names):
            return next(name for name in names if preferred == name or preferred in name)
        for family in ("qwen2.5", "llama3.1", "llama3", "gemma3", "mistral", "deepseek", "phi3"):
            for name in names:
                if family in name.lower():
                    return name
        if names:
            return names[0]
    except Exception:
        pass
    return fallback


def _ollama_generator(preferred: Optional[str] = None):
    model = _best_ollama_model(preferred)
    return _openai_compatible(model, f"http://localhost:{OLLAMA_PORT}/v1", "ollama", max_tokens=1024, temperature=0.4)


def _anthropic_generator(api_key: Optional[str]):
    try:
        from haystack_integrations.components.generators.anthropic import AnthropicGenerator
    except ImportError as exc:
        raise RuntimeError("Anthropic selected but anthropic-haystack is not installed") from exc
    token = api_key or os.getenv("ANTHROPIC_API_KEY")
    if not token:
        raise RuntimeError("ANTHROPIC_API_KEY is required")
    return AnthropicGenerator(
        api_key=Secret.from_token(token),
        model="claude-3-5-sonnet-20241022",
        generation_kwargs={"max_tokens": 1024, "temperature": 0.3},
    )


def get_generator(model_id: str, api_key: Optional[str] = None, base_url: Optional[str] = None):
    """Return a generator or raise a truthful configuration error."""
    if base_url:
        return _openai_compatible(model_id, base_url, api_key or "")
    if model_id == "qwen-local":
        return _local_gguf_generator("Qwen2.5-1.5B-Instruct-Q4_K_M.gguf")
    if model_id == "mistral-local":
        return _local_gguf_generator("mistral")
    if model_id == "llama3-local":
        return _local_gguf_generator("llama3")
    if model_id == "deepseek-local":
        return _local_gguf_generator("deepseek")
    if model_id in ("ollama", "ollama-auto"):
        return _ollama_generator()
    if ":" in model_id or any(x in model_id.lower() for x in ("llama3.1", "qwen2.5", "llava", "gemma3", "phi3")):
        return _ollama_generator(model_id)
    if model_id == "gpt4o":
        token = api_key or os.getenv("OPENAI_API_KEY")
        return _openai_compatible("gpt-4o", "https://api.openai.com/v1", token or "")
    if model_id == "claude35":
        return _anthropic_generator(api_key)
    if model_id == "gemini":
        token = api_key or os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY")
        return _openai_compatible("gemini-3.7-flash", "https://generativelanguage.googleapis.com/v1beta/openai/", token or "")
    if model_id == "mistral-online":
        token = api_key or os.getenv("MISTRAL_API_KEY")
        return _openai_compatible("mistral-small-latest", "https://api.mistral.ai/v1", token or "")
    if model_id == "nemotron-online":
        token = api_key or os.getenv("NVIDIA_API_KEY")
        return _openai_compatible("nvidia/llama-3.1-nemotron-ultra-253b-v1", "https://integrate.api.nvidia.com/v1", token or "", max_tokens=2048)
    raise ValueError(f"Unsupported LLM model '{model_id}'")


def get_model_display_name(model_id: str) -> str:
    return MODEL_CAPABILITIES.get(model_id, {}).get("display_name", model_id)


def list_available_models() -> List[dict]:
    return [{"id": key, **value} for key, value in MODEL_CAPABILITIES.items()]


def validate_api_key(provider: str, api_key: str) -> dict:
    if not api_key and provider != "ollama":
        return {"valid": False, "message": "API key is required"}
    try:
        if provider == "openai":
            response = requests.get("https://api.openai.com/v1/models", headers={"Authorization": f"Bearer {api_key}"}, timeout=10)
        elif provider == "anthropic":
            response = requests.get("https://api.anthropic.com/v1/models", headers={"x-api-key": api_key, "anthropic-version": "2023-06-01"}, timeout=10)
        elif provider == "mistral":
            response = requests.get("https://api.mistral.ai/v1/models", headers={"Authorization": f"Bearer {api_key}"}, timeout=10)
        elif provider == "gemini":
            response = requests.get("https://generativelanguage.googleapis.com/v1beta/models", params={"key": api_key}, timeout=10)
        elif provider == "nvidia":
            response = requests.get("https://integrate.api.nvidia.com/v1/models", headers={"Authorization": f"Bearer {api_key}"}, timeout=10)
        elif provider == "ollama":
            running, message = _check_ollama_running()
            return {"valid": running, "message": message}
        else:
            return {"valid": False, "message": f"Unknown provider: {provider}"}
        if response.status_code == 200:
            return {"valid": True, "message": f"{provider} credential is valid"}
        return {"valid": False, "message": f"{provider} returned HTTP {response.status_code}"}
    except Exception as exc:
        return {"valid": False, "message": f"Connection error: {exc}"}
