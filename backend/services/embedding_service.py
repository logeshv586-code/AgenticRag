"""
Embedding Service — Factory for creating embedding models.
Supports local BGE-m3, OpenAI Ada, and Mistral embeddings.
"""
import logging
from typing import Optional

logger = logging.getLogger(__name__)


def get_document_embedder(model_id: str, api_key: Optional[str] = None):
    """
    Returns a Haystack DocumentEmbedder component for indexing documents.
    """
    if model_id == "bge-local":
        return _local_bge_doc_embedder()
    elif model_id == "openai-ada":
        return _openai_doc_embedder(api_key)
    elif model_id == "mistral-embed":
        return _mistral_doc_embedder(api_key)
    else:
        logger.warning(f"Unknown embedding model '{model_id}', falling back to BGE-local")
        return _local_bge_doc_embedder()


def get_text_embedder(model_id: str, api_key: Optional[str] = None):
    """
    Returns a Haystack TextEmbedder component for embedding queries at runtime.
    """
    if model_id == "bge-local":
        return _local_bge_text_embedder()
    elif model_id == "openai-ada":
        return _openai_text_embedder(api_key)
    elif model_id == "mistral-embed":
        return _mistral_text_embedder(api_key)
    else:
        logger.warning(f"Unknown embedding model '{model_id}', falling back to BGE-local")
        return _local_bge_text_embedder()


# ── Local BGE-m3 (sentence-transformers) ──────────────────
def _local_bge_doc_embedder():
    try:
        from haystack.components.embedders import SentenceTransformersDocumentEmbedder
        return SentenceTransformersDocumentEmbedder(model="BAAI/bge-small-en-v1.5")
    except ImportError:
        logger.error("sentence-transformers not installed")
        return None


def _local_bge_text_embedder():
    try:
        from haystack.components.embedders import SentenceTransformersTextEmbedder
        return SentenceTransformersTextEmbedder(model="BAAI/bge-small-en-v1.5")
    except ImportError:
        logger.error("sentence-transformers not installed")
        return None


# ── OpenAI Ada ────────────────────────────────────────────
def _openai_doc_embedder(api_key: Optional[str] = None):
    try:
        from haystack.components.embedders import OpenAIDocumentEmbedder
        from haystack.utils import Secret
        key = Secret.from_token(api_key) if api_key else Secret.from_env_var("OPENAI_API_KEY")
        return OpenAIDocumentEmbedder(
            api_key=key,
            model="text-embedding-ada-002",
        )
    except ImportError:
        logger.error("openai embedder not available")
        return None


def _openai_text_embedder(api_key: Optional[str] = None):
    try:
        from haystack.components.embedders import OpenAITextEmbedder
        from haystack.utils import Secret
        key = Secret.from_token(api_key) if api_key else Secret.from_env_var("OPENAI_API_KEY")
        return OpenAITextEmbedder(
            api_key=key,
            model="text-embedding-ada-002",
        )
    except ImportError:
        logger.error("openai embedder not available")
        return None


# ── Mistral Embeddings ────────────────────────────────────
def _mistral_doc_embedder(api_key: Optional[str] = None):
    try:
        from haystack.components.embedders import OpenAIDocumentEmbedder
        from haystack.utils import Secret
        key = Secret.from_token(api_key) if api_key else Secret.from_env_var("MISTRAL_API_KEY")
        return OpenAIDocumentEmbedder(
            api_key=key,
            model="mistral-embed",
            api_base_url="https://api.mistral.ai/v1",
        )
    except ImportError:
        logger.error("mistral embedder not available")
        return None


def _mistral_text_embedder(api_key: Optional[str] = None):
    try:
        from haystack.components.embedders import OpenAITextEmbedder
        from haystack.utils import Secret
        key = Secret.from_token(api_key) if api_key else Secret.from_env_var("MISTRAL_API_KEY")
        return OpenAITextEmbedder(
            api_key=key,
            model="mistral-embed",
            api_base_url="https://api.mistral.ai/v1",
        )
    except ImportError:
        logger.error("mistral embedder not available")
        return None
