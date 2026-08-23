"""Authoritative RAG catalog and deterministic fallback classifier.

The UI may ask the local guide model to classify a customer's request first. This
module is the backend safety net: every requested type is normalized against the
pipeline registry contract before deployment, and `auto::<request>` is converted
into a supported architecture when model classification is unavailable.
"""
from __future__ import annotations

from copy import deepcopy
from typing import Dict, Iterable, Tuple

SUPPORTED_RAG_TYPES = (
    "basic",
    "hybrid",
    "citation",
    "realtime",
    "personalized",
    "multimodal",
    "conversational",
    "agentic",
    "structured",
    "crosslingual",
    "voice",
)

RAG_CATALOG: Dict[str, dict] = {
    "basic": {
        "label": "Universal RAG",
        "summary": "Reliable semantic retrieval for FAQs and general knowledge assistants.",
        "signals": ("faq", "knowledge base", "documents", "manual", "simple", "general"),
        "features": ["citations", "hallucinationGuard"],
        "preset": "balanced",
    },
    "hybrid": {
        "label": "Hybrid Search RAG",
        "summary": "Combines exact keyword matching with semantic retrieval for technical content.",
        "signals": ("hybrid", "keyword", "exact match", "part number", "code search", "technical docs"),
        "features": ["citations", "hallucinationGuard", "explainability"],
        "preset": "high_accuracy",
    },
    "citation": {
        "label": "Verified Citation RAG",
        "summary": "Evidence-first answering with source references for policies, SOPs and audits.",
        "signals": ("citation", "cite", "source", "evidence", "audit", "policy", "sop", "compliance"),
        "features": ["citations", "hallucinationGuard", "explainability"],
        "preset": "high_accuracy",
    },
    "realtime": {
        "label": "Realtime RAG",
        "summary": "Prioritizes frequently refreshed information such as operations, alerts and live feeds.",
        "signals": ("real time", "realtime", "live", "latest", "news", "alert", "stream", "fresh"),
        "features": ["citations", "streamingResponse"],
        "preset": "balanced",
    },
    "personalized": {
        "label": "Personalized RAG",
        "summary": "Adapts retrieval and responses to user profile, role or preferences.",
        "signals": ("personalized", "personalised", "profile", "role based", "preferences", "adaptive"),
        "features": ["citations", "hallucinationGuard"],
        "preset": "balanced",
    },
    "multimodal": {
        "label": "Multimodal RAG",
        "summary": "Builds assistants over text plus images, audio or other rich content.",
        "signals": ("image", "images", "photo", "audio", "video", "multimodal", "media"),
        "features": ["citations", "hallucinationGuard"],
        "preset": "high_accuracy",
    },
    "conversational": {
        "label": "Conversational RAG",
        "summary": "Maintains conversation context for support, tutoring and guided interactions.",
        "signals": ("customer support", "support bot", "chatbot", "conversation", "follow up", "tutor", "helpdesk"),
        "features": ["citations", "hallucinationGuard", "streamingResponse"],
        "preset": "high_accuracy",
    },
    "agentic": {
        "label": "Agentic RAG",
        "summary": "Plans multi-step work and can invoke approved tools after retrieving evidence.",
        "signals": ("agent", "agentic", "research", "reason", "multi step", "tool", "workflow", "autonomous", "action"),
        "features": ["citations", "hallucinationGuard", "explainability"],
        "preset": "high_accuracy",
    },
    "structured": {
        "label": "Graph / Structured RAG",
        "summary": "Reasons over entities and relationships for connected or structured knowledge.",
        "signals": ("graph", "relationship", "entity", "structured", "sql", "table", "financial data", "knowledge graph"),
        "features": ["citations", "explainability", "hallucinationGuard"],
        "preset": "high_accuracy",
    },
    "crosslingual": {
        "label": "Cross-lingual RAG",
        "summary": "Retrieves and answers across languages for global support and knowledge access.",
        "signals": ("multilingual", "multi language", "translate", "translation", "language", "global support", "tamil", "hindi"),
        "features": ["multilingual", "citations", "hallucinationGuard"],
        "preset": "balanced",
    },
    "voice": {
        "label": "Voice RAG",
        "summary": "Adds speech input/output to grounded retrieval for voice assistants and kiosks.",
        "signals": ("voice", "speech", "speak", "spoken", "call", "hotline", "microphone", "audio assistant"),
        "features": ["voice", "citations", "hallucinationGuard"],
        "preset": "balanced",
    },
}

# More specific architectures win ties over generic ones.
_CLASSIFICATION_PRIORITY = (
    "voice", "crosslingual", "multimodal", "realtime", "structured", "agentic",
    "conversational", "citation", "personalized", "hybrid", "basic",
)


def classify_customer_request(request: str) -> Tuple[str, str, float]:
    """Classify plain customer intent into a real backend RAG type.

    This is deliberately deterministic and dependency-free so it remains a safe
    fallback when the local/cloud model is unavailable.
    """
    text = (request or "").strip().lower()
    if not text:
        return "basic", "No customer intent was supplied; using the safest general RAG baseline.", 0.35

    scores = {rag_type: 0 for rag_type in SUPPORTED_RAG_TYPES}
    hits = {rag_type: [] for rag_type in SUPPORTED_RAG_TYPES}
    for rag_type, meta in RAG_CATALOG.items():
        for signal in meta["signals"]:
            if signal in text:
                weight = 3 if " " in signal else 2
                scores[rag_type] += weight
                hits[rag_type].append(signal)

    best = max(_CLASSIFICATION_PRIORITY, key=lambda key: (scores[key], -_CLASSIFICATION_PRIORITY.index(key)))
    if scores[best] <= 0:
        best = "basic"
        return best, "The request is general, so Universal RAG is the safest starting architecture.", 0.55

    matched = ", ".join(hits[best][:3])
    confidence = min(0.97, 0.62 + 0.07 * scores[best])
    return best, f"Detected {RAG_CATALOG[best]['label']} from request signals: {matched}.", confidence


def normalize_rag_type(value: str) -> Tuple[str, dict]:
    """Normalize explicit or `auto::<customer request>` RAG selections."""
    raw = (value or "basic").strip()
    lowered = raw.lower()
    if lowered.startswith("auto::"):
        request = raw.split("::", 1)[1]
        rag_type, reason, confidence = classify_customer_request(request)
        return rag_type, {
            "mode": "backend-auto",
            "customer_request": request,
            "reason": reason,
            "confidence": confidence,
        }
    if lowered == "auto":
        return "basic", {
            "mode": "backend-auto",
            "customer_request": "",
            "reason": "No request was included with auto selection; using Universal RAG.",
            "confidence": 0.35,
        }
    if lowered not in SUPPORTED_RAG_TYPES:
        raise ValueError(
            f"Unsupported RAG type '{raw}'. Supported types: {', '.join(SUPPORTED_RAG_TYPES)}"
        )
    return lowered, {"mode": "explicit", "confidence": 1.0, "reason": "Customer or model selected this supported architecture."}


def recommended_profile(rag_type: str) -> dict:
    rag_type, _ = normalize_rag_type(rag_type)
    meta = deepcopy(RAG_CATALOG[rag_type])
    dynamic = {
        "citationStyle": "inline",
        "historyLength": 8,
        "refreshInterval": 60,
        "modalities": ["text", "images"],
        "sourceLanguage": "auto",
        "targetLanguage": "English",
        "voiceLanguage": "en-US",
        "profileFields": ["Role"],
        "entityTypes": ["Organization", "Product", "Person", "Process"],
        "relationshipDepth": 2,
    }
    if rag_type == "agentic":
        dynamic["tools"] = ["Calculator", "Calendar"]
    return {
        "ragType": rag_type,
        "label": meta["label"],
        "summary": meta["summary"],
        "tuningPreset": meta["preset"],
        "features": meta["features"],
        "dynamicConfig": dynamic,
        "chunkSize": 700 if rag_type not in ("structured", "multimodal") else 500,
        "topK": 6,
        "useReranker": rag_type not in ("realtime", "voice"),
        "hallucinationGuard": "hallucinationGuard" in meta["features"],
        "explainability": "explainability" in meta["features"],
        "streamingResponse": "streamingResponse" in meta["features"],
    }


def validate_deploy_config(config: dict) -> dict:
    """Validate the customer-created deploy config before the pipeline is built."""
    rag_type, selection = normalize_rag_type(config.get("ragType", "basic"))
    errors = []
    warnings = []
    if not config.get("ragName"):
        errors.append("ragName is required")
    if int(config.get("chunkSize", 0) or 0) < 100:
        warnings.append("chunkSize below 100 can reduce answer context")
    if int(config.get("topK", 0) or 0) < 1:
        errors.append("topK must be at least 1")
    if rag_type == "agentic" and not config.get("dynamicConfig", {}).get("tools"):
        warnings.append("Agentic RAG has no tools enabled; it will operate as a reasoning/retrieval agent only")
    if rag_type == "voice" and "voice" not in config.get("features", []):
        warnings.append("Voice RAG selected without the voice feature flag")
    return {
        "valid": not errors,
        "rag_type": rag_type,
        "selection": selection,
        "errors": errors,
        "warnings": warnings,
    }


def catalog_payload() -> Iterable[dict]:
    for rag_type in SUPPORTED_RAG_TYPES:
        meta = RAG_CATALOG[rag_type]
        yield {"id": rag_type, "label": meta["label"], "summary": meta["summary"]}
