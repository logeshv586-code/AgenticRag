"""
Tuning Presets — Simple/Expert mode abstraction layer.
Maps user-friendly labels to technical configuration parameters.
"""
import logging

logger = logging.getLogger(__name__)


# ═══════════════════════════════════════════════════════════
#  Simple Mode Presets
# ═══════════════════════════════════════════════════════════

TUNING_PRESETS = {
    "fast": {
        "label": "⚡ Fast",
        "description": "Optimized for speed. Less accurate but very responsive.",
        "chunkSize": 1200,
        "topK": 3,
        "useReranker": False,
        "splitOverlapRatio": 0.05,
        "maxTokens": 512,
    },
    "balanced": {
        "label": "⚖️ Balanced",
        "description": "Good balance between speed and accuracy.",
        "chunkSize": 800,
        "topK": 5,
        "useReranker": False,
        "splitOverlapRatio": 0.1,
        "maxTokens": 1024,
    },
    "high_accuracy": {
        "label": "🎯 High Accuracy",
        "description": "Maximum accuracy. Slower but more precise results.",
        "chunkSize": 400,
        "topK": 10,
        "useReranker": True,
        "splitOverlapRatio": 0.15,
        "maxTokens": 2048,
    },
    "deep_analysis": {
        "label": "🔬 Deep Analysis",
        "description": "Thorough analysis with maximum context. Best for research.",
        "chunkSize": 300,
        "topK": 15,
        "useReranker": True,
        "splitOverlapRatio": 0.2,
        "maxTokens": 4096,
    },
}

# ═══════════════════════════════════════════════════════════
#  Per-RAG-Type Default Configs
# ═══════════════════════════════════════════════════════════

RAG_TYPE_DEFAULTS = {
    "basic": {
        "chunkSize": 800,
        "topK": 5,
    },
    "hybrid": {
        "chunkSize": 600,
        "topK": 7,
        "useReranker": True,
    },
    "conversational": {
        "chunkSize": 800,
        "topK": 5,
        "dynamicConfig": {
            "memoryType": "buffer",
            "memoryWindowSize": 10,
        },
    },
    "agentic": {
        "chunkSize": 600,
        "topK": 5,
        "dynamicConfig": {
            "maxReasoningSteps": 5,
            "toolTimeout": 30,
        },
    },
    "structured": {  # Graph RAG
        "chunkSize": 400,
        "topK": 10,
        "dynamicConfig": {
            "entityTypes": ["PERSON", "ORG", "GPE", "CONCEPT"],
            "relationshipDepth": 2,
            "graphMode": "local",
        },
    },
    "crosslingual": {
        "chunkSize": 800,
        "topK": 5,
        "dynamicConfig": {
            "sourceLanguage": "auto",
            "targetLanguage": "en",
            "autoDetect": True,
            "translationMode": "local",
            "supportedLanguages": ["en", "es", "fr", "de", "zh", "ja", "ko", "hi", "ar", "pt"],
        },
    },
    "voice": {
        "chunkSize": 1000,
        "topK": 3,
        "dynamicConfig": {
            "voiceLanguage": "en",
            "sttMode": "local",
            "ttsMode": "local",
            "voiceName": "en-US-AriaNeural",
        },
    },
    "multimodal": {
        "chunkSize": 600,
        "topK": 5,
        "dynamicConfig": {
            "modalities": ["text", "images"],
            "enableImageEmbedding": False,
            "enableAudioEmbedding": False,
        },
    },
    "realtime": {
        "chunkSize": 800,
        "topK": 5,
        "dynamicConfig": {
            "refreshInterval": 60,
            "streamingEnabled": False,
            "apiPollingInterval": 30,
        },
    },
    "personalized": {
        "chunkSize": 800,
        "topK": 5,
        "dynamicConfig": {
            "profileFields": [],
        },
    },
    "citation": {
        "chunkSize": 400,
        "topK": 10,
        "useReranker": True,
        "dynamicConfig": {
            "citationStyle": "inline",
        },
    },
}


# ═══════════════════════════════════════════════════════════
#  Public API
# ═══════════════════════════════════════════════════════════

def apply_tuning_preset(config: dict) -> dict:
    """
    Apply a tuning preset to the configuration if one is specified.
    Simple mode overrides chunkSize, topK, useReranker with preset values.
    Expert mode (no preset) uses raw values from the frontend.
    """
    preset_name = config.get("tuningPreset")
    if not preset_name or preset_name not in TUNING_PRESETS:
        return config  # Expert mode — pass through unchanged

    preset = TUNING_PRESETS[preset_name]
    updated = dict(config)
    updated["chunkSize"] = preset["chunkSize"]
    updated["topK"] = preset["topK"]
    updated["useReranker"] = preset["useReranker"]

    logger.info(f"Applied tuning preset '{preset_name}': chunk={preset['chunkSize']}, topK={preset['topK']}, reranker={preset['useReranker']}")
    return updated


def get_rag_defaults(rag_type: str) -> dict:
    """Return default configuration for a given RAG type."""
    return RAG_TYPE_DEFAULTS.get(rag_type, RAG_TYPE_DEFAULTS["basic"])


def list_presets() -> dict:
    """Return all available presets (for the frontend Simple mode UI)."""
    return {
        name: {
            "label": p["label"],
            "description": p["description"],
            "chunkSize": p["chunkSize"],
            "topK": p["topK"],
            "useReranker": p["useReranker"],
        }
        for name, p in TUNING_PRESETS.items()
    }
