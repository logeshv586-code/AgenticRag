"""
Cross-Lingual Pipeline — True multilingual RAG with translation layers.
Pipeline: Query → Detect Language → Translate to English → Retriever → LLM → Translate Back → Response

Supports:
  - Local: langdetect + deep-translator (free, offline-capable)
  - API:   cloud translation services (Google, DeepL, etc.)
"""
import logging
from typing import Tuple, Optional

from haystack import Pipeline, Document
from haystack.components.builders import PromptBuilder
from haystack.components.retrievers.in_memory import InMemoryBM25Retriever
from haystack.document_stores.in_memory import InMemoryDocumentStore

logger = logging.getLogger(__name__)


# ═══════════════════════════════════════════════════════════
#  Language Detection
# ═══════════════════════════════════════════════════════════

def detect_language(text: str) -> str:
    """Detect the language of input text. Returns ISO 639-1 code."""
    try:
        from langdetect import detect
        lang = detect(text)
        logger.info(f"Detected language: {lang}")
        return lang
    except ImportError:
        logger.warning("langdetect not installed — assuming English")
        return "en"
    except Exception as e:
        logger.warning(f"Language detection failed: {e} — assuming English")
        return "en"


# ═══════════════════════════════════════════════════════════
#  Translation Service (Local + API dual support)
# ═══════════════════════════════════════════════════════════

class TranslationService:
    """
    Dual-mode translation: local (deep-translator) or API-based.
    Falls back gracefully if services are unavailable.
    """

    def __init__(self, mode: str = "local", api_key: Optional[str] = None):
        self.mode = mode
        self.api_key = api_key

    def translate(self, text: str, source_lang: str, target_lang: str) -> str:
        """Translate text between languages."""
        if source_lang == target_lang:
            return text

        if self.mode == "api" and self.api_key:
            return self._translate_api(text, source_lang, target_lang)
        return self._translate_local(text, source_lang, target_lang)

    def _translate_local(self, text: str, source_lang: str, target_lang: str) -> str:
        """Use deep-translator (free, no API key required)."""
        try:
            from deep_translator import GoogleTranslator
            result = GoogleTranslator(source=source_lang, target=target_lang).translate(text)
            return result or text
        except ImportError:
            logger.warning("deep-translator not installed — returning original text")
            return text
        except Exception as e:
            logger.warning(f"Local translation failed: {e}")
            return text

    def _translate_api(self, text: str, source_lang: str, target_lang: str) -> str:
        """Use cloud translation API (OpenAI or dedicated translation service)."""
        try:
            import requests
            # Use OpenAI as a translation API
            resp = requests.post(
                "https://api.openai.com/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": "gpt-4o-mini",
                    "messages": [
                        {"role": "system", "content": f"Translate the following text from {source_lang} to {target_lang}. Return only the translation."},
                        {"role": "user", "content": text},
                    ],
                    "max_tokens": 2048,
                },
                timeout=30,
            )
            if resp.status_code == 200:
                return resp.json()["choices"][0]["message"]["content"].strip()
            logger.warning(f"API translation failed ({resp.status_code}), falling back to local")
            return self._translate_local(text, source_lang, target_lang)
        except Exception as e:
            logger.warning(f"API translation error: {e}, falling back to local")
            return self._translate_local(text, source_lang, target_lang)


# ═══════════════════════════════════════════════════════════
#  Cross-Lingual Pipeline Builder
# ═══════════════════════════════════════════════════════════

def build_cross_lingual_pipeline(document_store, config: dict, retriever, generator) -> dict:
    """
    Build a cross-lingual RAG pipeline with actual translation layers.

    Pipeline flow:
        User Query → Detect Language → Translate to English →
        Retriever → Prompt → LLM → Translate Back → Response

    Returns a dict with the pipeline and execution hooks.
    """
    dynamic_cfg = config.get("dynamicConfig", {})
    source_lang = dynamic_cfg.get("sourceLanguage", "auto")
    target_lang = dynamic_cfg.get("targetLanguage", "en")
    supported_langs = dynamic_cfg.get("supportedLanguages", ["en", "es", "fr", "de", "zh", "ja", "ko", "hi", "ar", "pt"])
    auto_detect = dynamic_cfg.get("autoDetect", True)
    translation_mode = dynamic_cfg.get("translationMode", "local")  # "local" or "api"
    api_keys = config.get("apiKeys", {})

    translator = TranslationService(
        mode=translation_mode,
        api_key=api_keys.get("openai") or api_keys.get("translation"),
    )

    # Build the inner Haystack pipeline (English retrieval + generation)
    pipeline = Pipeline()
    pipeline.add_component("retriever", retriever)

    template = """You are a helpful AI assistant. Answer the question based on the provided context.
    Context:
    {% for document in documents %}
        {{ document.content }}
    {% endfor %}

    Question: {{ query }}
    Answer:"""

    prompt_builder = PromptBuilder(template=template)
    pipeline.add_component("prompt_builder", prompt_builder)
    pipeline.add_component("llm", generator)

    pipeline.connect("retriever.documents", "prompt_builder.documents")
    pipeline.connect("prompt_builder", "llm")

    return {
        "pipeline": pipeline,
        "pre_hooks": {
            "language_detector": detect_language if auto_detect else None,
            "pre_translator": translator,
        },
        "post_hooks": {
            "post_translator": translator,
        },
        "meta": {
            "source_lang": source_lang,
            "target_lang": target_lang,
            "supported_langs": supported_langs,
            "auto_detect": auto_detect,
            "translation_mode": translation_mode,
        },
    }


def execute_cross_lingual_query(pipeline_info: dict, query: str) -> str:
    """
    Execute a query through the cross-lingual pipeline with translation layers.
    """
    pre_hooks = pipeline_info.get("pre_hooks", {})
    post_hooks = pipeline_info.get("post_hooks", {})
    meta = pipeline_info.get("meta", {})
    pipeline = pipeline_info["pipeline"]

    # Step 1: Detect language
    user_lang = "en"
    detector = pre_hooks.get("language_detector")
    if detector:
        user_lang = detector(query)
        logger.info(f"Cross-lingual: Detected user language = {user_lang}")

    # Step 2: Translate query to English for retrieval
    translated_query = query
    pre_translator = pre_hooks.get("pre_translator")
    if pre_translator and user_lang != "en":
        translated_query = pre_translator.translate(query, source_lang=user_lang, target_lang="en")
        logger.info(f"Cross-lingual: Translated query to English: '{translated_query[:80]}...'")

    # Step 3: Run retrieval + LLM in English
    try:
        result = pipeline.run({
            "retriever": {"query": translated_query},
            "prompt_builder": {"query": translated_query},
        })
        answer = result.get("llm", {}).get("replies", ["No response generated."])[0]
    except Exception as e:
        logger.error(f"Cross-lingual pipeline error: {e}")
        answer = f"Error: {str(e)}"

    # Step 4: Translate response back to user's language
    post_translator = post_hooks.get("post_translator")
    if post_translator and user_lang != "en":
        answer = post_translator.translate(answer, source_lang="en", target_lang=user_lang)
        logger.info(f"Cross-lingual: Translated response back to {user_lang}")

    return answer


def get_cross_lingual_graph_nodes() -> dict:
    """Return visualization nodes specific to cross-lingual pipeline."""
    return {
        "extra_nodes": [
            {"id": "lang_detector", "label": "Language Detector", "type": "processor"},
            {"id": "pre_translator", "label": "Pre-Retrieval Translator", "type": "processor"},
            {"id": "post_translator", "label": "Post-Generation Translator", "type": "processor"},
        ],
        "extra_edges": [
            {"source": "ingestion", "target": "lang_detector"},
            {"source": "lang_detector", "target": "pre_translator"},
            {"source": "pre_translator", "target": "embedder"},
        ],
        "post_edges": [
            {"source": "llm", "target": "post_translator"},
            {"source": "post_translator", "target": "deployment"},
        ],
        "remove_edges": [
            {"source": "llm", "target": "deployment"},
        ],
    }
