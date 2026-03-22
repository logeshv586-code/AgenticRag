"""
Vector Store Manager — Factory for creating and managing document stores.
Supports ChromaDB, FAISS, Qdrant, Elasticsearch, Pinecone, Weaviate,
Supabase, PGVector, Redis, and InMemory (fallback).
"""
import os
import json
import uuid
import logging
from typing import Optional, Tuple, Union, List

from haystack import Document
from haystack.document_stores.in_memory import InMemoryDocumentStore
from haystack.document_stores.types import DuplicatePolicy

logger = logging.getLogger(__name__)

# ── Persistence directory for local stores ──────────────────────────
STORES_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "stores")
os.makedirs(STORES_DIR, exist_ok=True)


# ═══════════════════════════════════════════════════════════
#  ChromaDB Integration
# ═══════════════════════════════════════════════════════════
def _create_chroma_store(collection_name: str):
    """Create a persistent ChromaDB document store."""
    try:
        from haystack_integrations.document_stores.chroma import ChromaDocumentStore
        persist_path = os.path.join(STORES_DIR, "chroma")
        os.makedirs(persist_path, exist_ok=True)
        store = ChromaDocumentStore(
            collection_name=collection_name,
            persist_path=persist_path,
        )
        logger.info(f"ChromaDB store created: collection={collection_name}")
        return store
    except ImportError:
        logger.warning("chroma-haystack not installed — falling back to InMemory")
        return None


# ═══════════════════════════════════════════════════════════
#  FAISS Integration
# ═══════════════════════════════════════════════════════════
def _create_faiss_store(collection_name: str):
    """Create a FAISS-backed document store."""
    try:
        from haystack_integrations.document_stores.faiss import FAISSDocumentStore
        # Haystack 2.x FAISSDocumentStore is typically in-memory and then saved/loaded.
        # It doesn't use sql_url for metadata by default in the same way 1.x did.
        store = FAISSDocumentStore(
            embedding_dim=384,
        )
        logger.info(f"FAISS store created: {collection_name} (dim=384)")
        return store
    except ImportError:
        logger.warning("faiss-haystack not installed — falling back to InMemory")
        return None


# ═══════════════════════════════════════════════════════════
#  Qdrant Integration (Cloud)
# ═══════════════════════════════════════════════════════════
def _create_qdrant_store(collection_name: str, api_key: Optional[str] = None,
                         url: str = "https://localhost:6333"):
    """Create a Qdrant cloud document store."""
    try:
        from haystack_integrations.document_stores.qdrant import QdrantDocumentStore
        store = QdrantDocumentStore(
            url=url,
            api_key=api_key,
            index=collection_name,
            embedding_dim=768,
            recreate_index=False,
        )
        logger.info(f"Qdrant store created: {collection_name}")
        return store
    except ImportError:
        logger.warning("qdrant-haystack not installed — falling back to InMemory")
        return None


# ═══════════════════════════════════════════════════════════
#  Elasticsearch Integration (Cloud)
# ═══════════════════════════════════════════════════════════
def _create_elasticsearch_store(index_name: str, api_key: Optional[str] = None,
                                host: str = "http://localhost:9200"):
    """Create an Elasticsearch document store."""
    try:
        from haystack_integrations.document_stores.elasticsearch import ElasticsearchDocumentStore
        store = ElasticsearchDocumentStore(
            hosts=[host],
            index=index_name,
        )
        logger.info(f"Elasticsearch store created: {index_name}")
        return store
    except ImportError:
        logger.warning("elasticsearch-haystack not installed — falling back to InMemory")
        return None


# ═══════════════════════════════════════════════════════════
#  Pinecone Integration (Cloud)
# ═══════════════════════════════════════════════════════════
def _create_pinecone_store(index_name: str, api_key: Optional[str] = None):
    """Create a Pinecone cloud document store."""
    try:
        from haystack_integrations.document_stores.pinecone import PineconeDocumentStore
        store = PineconeDocumentStore(
            api_key=api_key,
            index=index_name,
            dimension=768,
        )
        logger.info(f"Pinecone store created: {index_name}")
        return store
    except ImportError:
        logger.warning("pinecone-haystack not installed — falling back to InMemory")
        return None


# ═══════════════════════════════════════════════════════════
#  Weaviate Integration (Cloud)
# ═══════════════════════════════════════════════════════════
def _create_weaviate_store(collection_name: str, api_key: Optional[str] = None,
                           url: str = "http://localhost:8080"):
    """Create a Weaviate document store."""
    try:
        from haystack_integrations.document_stores.weaviate import WeaviateDocumentStore
        store = WeaviateDocumentStore(
            url=url,
            auth_client_secret=api_key,
            collection_settings={
                "class": collection_name,
            },
        )
        logger.info(f"Weaviate store created: {collection_name}")
        return store
    except ImportError:
        logger.warning("weaviate-haystack not installed — falling back to InMemory")
        return None


# ═══════════════════════════════════════════════════════════
#  Supabase Vector (pgvector via Supabase REST API)
# ═══════════════════════════════════════════════════════════
def _create_supabase_store(collection_name: str, api_key: Optional[str] = None,
                           url: Optional[str] = None):
    """
    Create a Supabase vector store.
    Uses the Supabase pgvector extension via REST API.
    Local fallback: InMemoryDocumentStore.
    """
    try:
        # Try Supabase-specific Haystack integration first
        from haystack_integrations.document_stores.pgvector import PgvectorDocumentStore

        # Supabase provides a PostgreSQL connection string
        connection_str = url or os.environ.get("SUPABASE_DB_URL", "")
        if not connection_str:
            logger.warning("Supabase DB URL not provided — falling back to InMemory")
            return None

        store = PgvectorDocumentStore(
            connection_string=connection_str,
            table_name=collection_name,
            embedding_dimension=768,
            recreate_table=False,
        )
        logger.info(f"Supabase (pgvector) store created: {collection_name}")
        return store
    except ImportError:
        logger.warning("pgvector-haystack not installed — falling back to InMemory")
        return None
    except Exception as e:
        logger.warning(f"Supabase store creation failed: {e}")
        return None


# ═══════════════════════════════════════════════════════════
#  PGVector Integration (Direct PostgreSQL)
# ═══════════════════════════════════════════════════════════
def _create_pgvector_store(collection_name: str, connection_string: Optional[str] = None):
    """
    Create a PGVector document store (direct PostgreSQL with pgvector extension).
    Local: requires PostgreSQL with pgvector installed locally.
    API: connect to a remote PostgreSQL instance.
    """
    try:
        from haystack_integrations.document_stores.pgvector import PgvectorDocumentStore

        conn_str = connection_string or os.environ.get(
            "PGVECTOR_CONNECTION_STRING",
            "postgresql://postgres:postgres@localhost:5432/ragdb"
        )

        store = PgvectorDocumentStore(
            connection_string=conn_str,
            table_name=collection_name,
            embedding_dimension=768,
            recreate_table=False,
        )
        logger.info(f"PGVector store created: {collection_name}")
        return store
    except ImportError:
        logger.warning("pgvector-haystack not installed — falling back to InMemory")
        return None
    except Exception as e:
        logger.warning(f"PGVector store creation failed: {e}")
        return None


# ═══════════════════════════════════════════════════════════
#  Redis Vector Integration
# ═══════════════════════════════════════════════════════════
def _create_redis_store(collection_name: str, api_key: Optional[str] = None,
                        url: str = "redis://localhost:6379"):
    """
    Create a Redis vector document store.
    Requires Redis Stack with the RediSearch module.
    """
    try:
        # Try Redis-specific Haystack integration
        from haystack_integrations.document_stores.redis import RedisDocumentStore

        redis_url = url or os.environ.get("REDIS_URL", "redis://localhost:6379")

        store = RedisDocumentStore(
            redis_url=redis_url,
            index_name=collection_name,
            embedding_dim=768,
        )
        logger.info(f"Redis vector store created: {collection_name}")
        return store
    except ImportError:
        logger.warning("redis-haystack not installed — falling back to InMemory")
        return None
    except Exception as e:
        logger.warning(f"Redis store creation failed: {e}")
        return None


# ═══════════════════════════════════════════════════════════
#  Factory
# ═══════════════════════════════════════════════════════════
def create_document_store(config: dict) -> Union[object, Tuple[object, object]]:
    """
    Factory: create the right document store(s) based on user config.

    Returns:
      - A single document store for cloud or local mode
      - A tuple (cloud_store, local_store) for hybrid mode
    """
    db_type = config.get("dbType", "local")
    cloud_db = config.get("cloudDb", "pinecone")
    local_db = config.get("localDb", "chroma")
    api_keys = config.get("apiKeys", {})
    collection = config.get("ragName") if config.get("ragName") else f"rag_{uuid.uuid4().hex[:8]}"

    cloud_store = None
    local_store = None

    # ── Cloud store ──────────────────────────────────────
    if db_type in ("cloud", "hybrid"):
        if cloud_db == "pinecone":
            cloud_store = _create_pinecone_store(collection, api_keys.get("pinecone"))
        elif cloud_db == "qdrant":
            cloud_store = _create_qdrant_store(collection, api_keys.get("qdrant"))
        elif cloud_db == "elasticsearch":
            cloud_store = _create_elasticsearch_store(collection, api_keys.get("elasticsearch"))
        elif cloud_db == "weaviate":
            cloud_store = _create_weaviate_store(collection, api_keys.get("weaviate"))
        elif cloud_db == "supabase":
            cloud_store = _create_supabase_store(
                collection,
                api_keys.get("supabase"),
                url=config.get("dynamicConfig", {}).get("supabaseUrl"),
            )
        elif cloud_db == "redis":
            cloud_store = _create_redis_store(
                collection,
                api_keys.get("redis"),
                url=config.get("dynamicConfig", {}).get("redisUrl", "redis://localhost:6379"),
            )

    # ── Local store ──────────────────────────────────────
    if db_type in ("local", "hybrid"):
        if local_db == "chroma":
            local_store = _create_chroma_store(collection)
        elif local_db == "faiss":
            local_store = _create_faiss_store(collection)
        elif local_db == "pgvector":
            local_store = _create_pgvector_store(
                collection,
                connection_string=config.get("dynamicConfig", {}).get("pgvectorUrl"),
            )

    # ── Resolve fallback ─────────────────────────────────
    if db_type == "hybrid":
        cloud_store = cloud_store or InMemoryDocumentStore()
        local_store = local_store or InMemoryDocumentStore()
        return cloud_store, local_store

    if db_type == "cloud":
        return cloud_store or InMemoryDocumentStore()

    # local or fallback
    return local_store or InMemoryDocumentStore()


def write_documents(store, documents: List[Document]):
    """Write documents to any Haystack-compatible store."""
    try:
        store.write_documents(documents, policy=DuplicatePolicy.OVERWRITE)
        logger.info(f"Wrote {len(documents)} documents to store")
    except Exception as e:
        logger.error(f"Error writing documents: {e}")
        raise
