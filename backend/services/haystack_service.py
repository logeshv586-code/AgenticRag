"""
Haystack Service — Core pipeline builder for all RAG architectures.
Builds and manages Haystack 2.0 pipelines based on user configuration.
Routes specialized RAG types to dedicated pipeline modules.
"""
import os
import uuid
import logging
from typing import Optional, Tuple

from haystack import Pipeline, Document
from haystack.components.builders import PromptBuilder
from haystack.components.preprocessors import DocumentSplitter
from haystack.components.retrievers.in_memory import InMemoryBM25Retriever
from haystack.document_stores.in_memory import InMemoryDocumentStore
from haystack.document_stores.types import DuplicatePolicy

from .vector_store_manager import create_document_store, write_documents
from .embedding_service import get_document_embedder, get_text_embedder
from .llm_service import get_generator, get_model_display_name
from .pipeline_modules import get_pipeline_builder, STANDARD_RAG_TYPES
from .observability_service import track_query

logger = logging.getLogger(__name__)

# Active pipeline registry
active_pipelines = {}
pipeline_metadata = {}

# Specialized pipeline info (for modules that need custom query execution)
specialized_pipeline_info = {}


# ═══════════════════════════════════════════════════════════
#  Prompt Templates per RAG Type (Standard types only)
# ═══════════════════════════════════════════════════════════

def _get_prompt_template(rag_type: str, config: dict) -> str:
    """Build the prompt template based on RAG type and dynamic config."""
    dynamic_cfg = config.get("dynamicConfig", {})
    features = config.get("features", [])
    privacy_mode = config.get("privacyMode", False)
    explainability = config.get("explainability", False)

    # Base context block
    context_block = """
    Context:
    {% for document in documents %}
        {{ document.content }}
    {% endfor %}
    """

    # Feature strings
    feat_str = f"\nEnabled features: {', '.join(features)}." if features else ""
    privacy_str = "\nIMPORTANT: Do NOT include any personal identifiable information (names, emails, phone numbers, addresses) in your response. Redact if necessary." if privacy_mode else ""
    explain_str = "\nAfter your answer, provide a section called '### Why these results?' explaining which source documents were most relevant and why they were selected." if explainability else ""

    if rag_type == "basic":
        return f"""You are a helpful AI assistant. Answer the question based on the provided context.
        {context_block}
        {feat_str}{privacy_str}{explain_str}
        Question: {{{{query}}}}
        Answer:"""

    elif rag_type == "hybrid":
        return f"""You are a hybrid search AI assistant combining keyword and semantic search.
        The context below comes from both keyword-matching and vector-similarity retrieval.
        {context_block}
        {feat_str}{privacy_str}{explain_str}
        Question: {{{{query}}}}
        Answer:"""

    elif rag_type == "citation":
        style = dynamic_cfg.get("citationStyle", "inline")
        if style == "inline":
            cite_str = "Provide inline citations [1], [2], etc. for every factual claim. List all sources at the end."
        else:
            cite_str = "At the end of your response, provide a 'Sources' section listing all referenced documents."
        return f"""You are a citation-aware AI assistant.
        {cite_str}
        {context_block}
        {feat_str}{privacy_str}{explain_str}
        Question: {{{{query}}}}
        Answer (with citations):"""

    elif rag_type == "realtime":
        refresh = dynamic_cfg.get("refreshInterval", 60)
        return f"""You are a real-time AI assistant with access to frequently updated data (refresh: {refresh}s).
        Prioritize the most recent information in the context.
        {context_block}
        {feat_str}{privacy_str}{explain_str}
        Question: {{{{query}}}}
        Answer (prioritizing recent data):"""

    elif rag_type == "personalized":
        profile_fields = dynamic_cfg.get("profileFields", [])
        profile_str = f"User preferences: {', '.join(profile_fields)}." if profile_fields else ""
        return f"""You are a personalized AI assistant that adapts to user preferences.
        {profile_str}
        Tailor your response style and content to match the user's interests.
        {context_block}
        {feat_str}{privacy_str}{explain_str}
        Question: {{{{query}}}}
        Personalized Answer:"""

    elif rag_type == "multimodal":
        modalities = dynamic_cfg.get("modalities", ["text", "images"])
        return f"""You are a multimodal AI assistant capable of understanding: {', '.join(modalities)}.
        Process all types of content in the context to provide a comprehensive answer.
        {context_block}
        {feat_str}{privacy_str}{explain_str}
        Question: {{{{query}}}}
        Answer:"""

    # Fallback
    return f"""You are a helpful AI assistant.
    {context_block}
    {feat_str}{privacy_str}{explain_str}
    Question: {{{{query}}}}
    Answer:"""


# ═══════════════════════════════════════════════════════════
#  Pipeline Builder
# ═══════════════════════════════════════════════════════════

def build_and_deploy_pipeline(config: dict) -> Tuple[str, Pipeline]:
    """
    Builds and deploys a Haystack 2.0 pipeline based on the frontend configuration.
    Routes specialized RAG types to dedicated pipeline modules.
    Returns (pipeline_id, pipeline).
    """
    texts = config.get("extracted_texts", [])
    rag_type = config.get("ragType", "basic")
    top_k = config.get("topK", 5)
    chunk_size = config.get("chunkSize", 500)
    use_reranker = config.get("useReranker", False)
    llm_model = config.get("llmModel", "qwen-local")
    embedding_model = config.get("embeddingModel", "bge-local")
    api_keys = config.get("apiKeys", {})

    # ── 1. Create document store ─────────────────────────
    store = create_document_store(config)

    # Handle hybrid (tuple) — use primary store for pipeline
    primary_store = store
    secondary_store = None
    if isinstance(store, tuple):
        primary_store, secondary_store = store

    # ── 2. Process documents ─────────────────────────────
    documents = [Document(content=text) for text in texts if text.strip()]

    if documents:
        # Split documents by chunk size
        splitter = DocumentSplitter(
            split_by="word",
            split_length=chunk_size,
            split_overlap=int(chunk_size * 0.1),  # 10% overlap
        )
        split_result = splitter.run(documents=documents)
        split_docs = split_result.get("documents", documents)

        # 2. Embed documents (Required for FAISS/Vector search)
        from .embedding_service import get_document_embedder
        embedder = get_document_embedder(embedding_model, api_keys.get("openai"))
        if embedder:
            logger.info(f"Embedding {len(split_docs)} documents using {embedding_model}...")
            embedded_result = embedder.run(documents=split_docs)
            embedded_docs = embedded_result.get("documents", split_docs)
        else:
            embedded_docs = split_docs

        # 3. Write to primary store
        write_documents(primary_store, embedded_docs)

        # 4. Write to secondary store (hybrid mode)
        if secondary_store:
            write_documents(secondary_store, embedded_docs)

    # ── 3. Prepare shared components ─────────────────────
    # Retriever
    db_type = config.get("localDb", "chroma") if config.get("dbType") == "local" else config.get("cloudDb")
    
    if isinstance(primary_store, InMemoryDocumentStore):
        retriever = InMemoryBM25Retriever(document_store=primary_store, top_k=top_k)
    elif "ChromaDocumentStore" in str(type(primary_store)):
        from haystack_integrations.components.retrievers.chroma import ChromaEmbeddingRetriever
        retriever = ChromaEmbeddingRetriever(document_store=primary_store, top_k=top_k)
    elif "FAISSDocumentStore" in str(type(primary_store)):
        from haystack_integrations.components.retrievers.faiss import FAISSEmbeddingRetriever
        retriever = FAISSEmbeddingRetriever(document_store=primary_store, top_k=top_k)
    else:
        # Fallback to BM25 if no specialized retriever found
        try:
            retriever = InMemoryBM25Retriever(document_store=primary_store, top_k=top_k)
        except Exception:
            retriever = InMemoryBM25Retriever(document_store=InMemoryDocumentStore(), top_k=top_k)

    # LLM Generator
    llm_key = api_keys.get("openai") or api_keys.get("anthropic") or api_keys.get("mistral") or api_keys.get("gemini")
    generator = get_generator(llm_model, llm_key)

    # ── 4. Route to specialized or standard pipeline ─────
    pipeline_id = f"pipe_{uuid.uuid4().hex[:8]}"
    specialized_builder = get_pipeline_builder(rag_type)

    if specialized_builder:
        # ── SPECIALIZED pipeline (modular backend) ───────
        logger.info(f"Building SPECIALIZED pipeline for '{rag_type}'")
        pipeline_result = specialized_builder(primary_store, config, retriever, generator)
        pipeline = pipeline_result["pipeline"]

        # Store specialized info for custom query execution
        specialized_pipeline_info[pipeline_id] = {
            "rag_type": rag_type,
            **pipeline_result,
        }

        # For graph RAG, build the graph from documents
        if rag_type == "structured" and documents:
            try:
                graph_store = pipeline_result.get("graph_store")
                extractor = pipeline_result.get("extractor")
                if graph_store and extractor:
                    graph_store.build_from_documents(documents, extractor)
            except Exception as e:
                logger.warning(f"Graph building failed: {e}")

    else:
        # ── STANDARD pipeline (shared prompt-based) ──────
        logger.info(f"Building STANDARD pipeline for '{rag_type}'")
        pipeline = Pipeline()
        pipeline.add_component("retriever", retriever)

        # LLM
        pipeline.add_component("llm", generator)

        # Prompt builder
        template = _get_prompt_template(rag_type, config)
        prompt_builder = PromptBuilder(template=template)
        pipeline.add_component("prompt_builder", prompt_builder)

        # Optional reranker
        if use_reranker:
            try:
                from haystack.components.rankers import TransformersSimilarityRanker
                reranker = TransformersSimilarityRanker(
                    model="cross-encoder/ms-marco-MiniLM-L-6-v2",
                    top_k=top_k,
                )
                pipeline.add_component("reranker", reranker)
                logger.info("✅ Reranker added to pipeline")
            except Exception as e:
                logger.warning(f"Reranker initialization failed: {e} — skipping")
                use_reranker = False

        # ── 5. Connect Components (Haystack 2.x style) ────
        
        # Check if we need an embedder for the retriever
        is_embedding_retriever = any(x in str(type(retriever)) for x in ["EmbeddingRetriever", "ChromaEmbeddingRetriever", "FAISSEmbeddingRetriever"])
        logger.info(f"Retriever type: {type(retriever)}, is_embedding_retriever: {is_embedding_retriever}")
        
        if is_embedding_retriever:
            from .embedding_service import get_text_embedder
            query_embedder = get_text_embedder(embedding_model, api_keys.get("openai"))
            if query_embedder:
                pipeline.add_component("query_embedder", query_embedder)
                pipeline.connect("query_embedder.embedding", "retriever.query_embedding")
        
        if use_reranker:
            pipeline.connect("retriever.documents", "reranker.documents")
            pipeline.connect("reranker.documents", "prompt_builder.documents")
        else:
            pipeline.connect("retriever.documents", "prompt_builder.documents")

        pipeline.connect("prompt_builder.prompt", "llm.prompt")

    # ── 5. Register pipeline ─────────────────────────────
    active_pipelines[pipeline_id] = pipeline

    # Store metadata for visualization
    pipeline_metadata[pipeline_id] = {
        "rag_type": rag_type,
        "db_type": config.get("dbType", "local"),
        "cloud_db": config.get("cloudDb", ""),
        "local_db": config.get("localDb", "chroma"),
        "llm_model": llm_model,
        "llm_display": get_model_display_name(llm_model),
        "embedding_model": embedding_model,
        "chunk_size": chunk_size,
        "top_k": top_k,
        "use_reranker": use_reranker,
        "features": config.get("features", []),
        "explainability": config.get("explainability", False),
        "privacy_mode": config.get("privacyMode", False),
        "deployment_type": config.get("deploymentType", "api"),
        "scrape_mode": config.get("scrapeMode", "static"),
        "documents_count": len(documents),
        "is_specialized": specialized_builder is not None,
        "dynamic_config": config.get("dynamicConfig", {}),
    }

    logger.info(f"Pipeline {pipeline_id} built: {rag_type} | {llm_model} | {config.get('dbType')} | {'SPECIALIZED' if specialized_builder else 'STANDARD'}")
    return pipeline_id, pipeline


# ═══════════════════════════════════════════════════════════
#  Query Execution
# ═══════════════════════════════════════════════════════════

def query_pipeline(pipeline_id: str, query: str, audio_base64: str = None, llm_override: dict = None) -> dict:
    """
    Runs a query through the deployed pipeline.
    Routes to specialized query executors for modular pipelines.
    Returns a dict with at minimum {"answer": str}.
    
    llm_override: Optional dict {"model": str, "api_key": str, "base_url": str}
                  Lets users test with their own LLM instead of the platform default.
    """
    pipeline = active_pipelines.get(pipeline_id)
    if not pipeline and llm_override:
        # Build a fallback pipeline using the override LLM directly
        return _query_with_override_llm(query, llm_override)

    if not pipeline:
        return {"answer": "Error: Pipeline not found or has been stopped."}

    # If user provided an LLM override, swap the generator at query time
    if llm_override:
        try:
            override_model = llm_override.get("model", "")
            override_apikey = llm_override.get("api_key")
            override_baseurl = llm_override.get("base_url")
            new_generator = get_generator(override_model, api_key=override_apikey, base_url=override_baseurl)
            # Swap the LLM component if it exists
            if "llm" in [c[0] for c in pipeline.graph.nodes(data=True) if c]:
                pipeline.get_component("llm").update_model(new_generator)
        except Exception as e:
            logger.warning(f"LLM override failed, using default: {e}")

    meta = pipeline_metadata.get(pipeline_id, {})
    rag_type = meta.get("rag_type", "basic")
    model = meta.get("llm_model", "unknown")
    spec_info = specialized_pipeline_info.get(pipeline_id)

    try:
        with track_query(pipeline_id, query, rag_type, model) as ctx:
            # ── Specialized pipeline execution ───────────────
            if spec_info:
                if rag_type == "crosslingual":
                    from .pipeline_modules.cross_lingual_pipeline import execute_cross_lingual_query
                    answer = execute_cross_lingual_query(spec_info, query)
                    ctx.response = answer
                    return {"answer": answer}

                elif rag_type == "voice":
                    from .pipeline_modules.voice_pipeline import execute_voice_query
                    result = execute_voice_query(spec_info, query, audio_base64)
                    ctx.response = result["text_answer"]
                    return {
                        "answer": result["text_answer"],
                        "text_query": result["text_query"],
                        "audio_response": result.get("audio_response", ""),
                    }

                elif rag_type == "agentic":
                    from .pipeline_modules.agentic_pipeline import execute_agentic_query
                    answer = execute_agentic_query(spec_info, query)
                    ctx.response = answer
                    return {"answer": answer}

                elif rag_type == "structured":
                    from .pipeline_modules.graph_pipeline import execute_graph_query
                    answer = execute_graph_query(spec_info, query)
                    ctx.response = answer
                    return {"answer": answer}

                elif rag_type == "conversational":
                    from .pipeline_modules.conversational_pipeline import execute_conversational_query
                    answer = execute_conversational_query(spec_info, pipeline_id, query)
                    ctx.response = answer
                    return {"answer": answer}

            # ── Standard pipeline execution ──────────────────
            run_params = {
                "prompt_builder": {"query": query},
            }

            # Route query to embedder or retriever based on what the pipeline expects
            node_names = list(pipeline.graph.nodes)
            if "query_embedder" in node_names:
                run_params["query_embedder"] = {"text": query}
            elif "retriever" in node_names:
                run_params["retriever"] = {"query": query}

            if "reranker" in node_names:
                run_params["reranker"] = {"query": query}

            try:
                result = pipeline.run(run_params)
            except Exception as run_err:
                logger.error(f"Pipeline run error: {run_err}")
                return {"answer": "⚠️ Model temporarily unavailable. Try again."}

            replies = result.get("llm", {}).get("replies", [])
            if replies:
                ctx.response = replies[0]
                # Try to extract tokens if meta is available
                meta_list = result.get("llm", {}).get("meta", [])
                if meta_list and isinstance(meta_list[0], dict):
                    usage = meta_list[0].get("usage", {})
                    ctx.tokens = usage.get("total_tokens", 0)
                return {"answer": replies[0]}
                
            ctx.response = "No response generated."
            return {"answer": "No response generated."}

    except Exception as e:
        logger.error(f"Pipeline execution error: {e}")
        return {"answer": f"Error executing pipeline: {str(e)}"}


# ═══════════════════════════════════════════════════════════
#  Pipeline Visualization Data
# ═══════════════════════════════════════════════════════════

def get_pipeline_graph(pipeline_id: str) -> dict:
    """
    Generate full pipeline graph data for visualization.
    Dynamically adds nodes per RAG type.
    """
    meta = pipeline_metadata.get(pipeline_id, {})
    if not meta:
        return {"nodes": [], "edges": []}

    rag_type = meta.get("rag_type", "basic")
    nodes = []
    edges = []

    # ── Base pipeline nodes ──────────────────────────────

    # Data Source node
    nodes.append({
        "id": "ingestion",
        "label": f"Data Source ({meta.get('scrape_mode', 'static').title()})",
        "type": "ingestion",
        "details": f"{meta.get('documents_count', 0)} documents processed",
    })

    # Preprocessing node
    nodes.append({
        "id": "preprocessing",
        "label": f"Preprocessing (Chunk: {meta.get('chunk_size', 500)})",
        "type": "processor",
    })
    edges.append({"source": "ingestion", "target": "preprocessing"})

    # Embedding node
    nodes.append({
        "id": "embedder",
        "label": f"Embedder: {meta.get('embedding_model', 'bge-local')}",
        "type": "embedder",
    })
    edges.append({"source": "preprocessing", "target": "embedder"})

    # Vector Store node
    db_type = meta.get("db_type", "local")
    db_name = meta.get("local_db", "chroma") if db_type == "local" else meta.get("cloud_db", "pinecone")
    nodes.append({
        "id": "doc_store",
        "label": f"Vector Store: {db_name.title()} ({db_type})",
        "type": "database",
    })
    edges.append({"source": "embedder", "target": "doc_store"})

    # Retriever node
    nodes.append({
        "id": "retriever",
        "label": f"Retriever (Top-{meta.get('top_k', 5)})",
        "type": "retriever",
    })
    edges.append({"source": "doc_store", "target": "retriever"})

    # Reranker node (conditional)
    if meta.get("use_reranker"):
        nodes.append({
            "id": "reranker",
            "label": "Neural Reranker",
            "type": "reranker",
        })
        edges.append({"source": "retriever", "target": "reranker"})
        prev_node = "reranker"
    else:
        prev_node = "retriever"

    # ── Specialized nodes per RAG type ───────────────────
    spec_graph_fn = _get_specialized_graph_nodes(rag_type)
    if spec_graph_fn:
        spec_data = spec_graph_fn()

        # Add extra nodes
        for node in spec_data.get("extra_nodes", []):
            nodes.append(node)

        # Add extra edges
        for edge in spec_data.get("extra_edges", []):
            edges.append(edge)

        # Remove specified edges
        remove_set = {(e["source"], e["target"]) for e in spec_data.get("remove_edges", [])}
        edges = [e for e in edges if (e["source"], e["target"]) not in remove_set]

        # Memory node connects to retriever for conversational
        if rag_type == "conversational":
            prev_node = prev_node  # memory feeds into prompt alongside retriever

    # Prompt Builder node
    rag_names = {
        "basic": "Standard", "conversational": "Conversational", "agentic": "Agentic",
        "structured": "Graph", "multimodal": "Multimodal", "crosslingual": "Cross-Lingual",
        "citation": "Citation", "realtime": "Real-Time", "personalized": "Personalized",
        "voice": "Voice", "hybrid": "Hybrid",
    }
    nodes.append({
        "id": "prompt_builder",
        "label": f"Prompt: {rag_names.get(rag_type, 'Custom')} RAG",
        "type": "processor",
    })
    edges.append({"source": prev_node, "target": "prompt_builder"})

    # LLM node
    nodes.append({
        "id": "llm",
        "label": f"LLM: {meta.get('llm_display', 'Unknown')}",
        "type": "llm",
    })
    edges.append({"source": "prompt_builder", "target": "llm"})

    # Post-processing nodes from specialized pipeline
    if spec_graph_fn:
        spec_data = spec_graph_fn()
        for edge in spec_data.get("post_edges", []):
            edges.append(edge)

    # Feature nodes
    features = list(meta.get("features", []))
    if meta.get("explainability"):
        features.append("explainability")
    if meta.get("privacy_mode"):
        features.append("privacy-mode")

    last_node = "llm"
    if features:
        nodes.append({
            "id": "features",
            "label": f"Post-processing: {', '.join(features)}",
            "type": "features",
        })
        # Only add edge if no post_edges already go from llm
        has_post = any(e.get("source") == "llm" and e.get("target") != "features"
                       for e in spec_graph_fn().get("post_edges", [])) if spec_graph_fn else False
        if not has_post:
            edges.append({"source": "llm", "target": "features"})
        last_node = "features"

    # Response / Deployment node
    nodes.append({
        "id": "deployment",
        "label": f"Response ({meta.get('deployment_type', 'api').upper()})",
        "type": "deployment",
    })

    # Connect final node to deployment (if not already connected by post_edges)
    existing_to_deployment = any(e["target"] == "deployment" for e in edges)
    if not existing_to_deployment:
        edges.append({"source": last_node, "target": "deployment"})

    return {"nodes": nodes, "edges": edges}


def _get_specialized_graph_nodes(rag_type: str):
    """Return the graph node generator function for a specialized pipeline."""
    if rag_type == "crosslingual":
        from .pipeline_modules.cross_lingual_pipeline import get_cross_lingual_graph_nodes
        return get_cross_lingual_graph_nodes
    elif rag_type == "voice":
        from .pipeline_modules.voice_pipeline import get_voice_graph_nodes
        return get_voice_graph_nodes
    elif rag_type == "agentic":
        from .pipeline_modules.agentic_pipeline import get_agentic_graph_nodes
        return get_agentic_graph_nodes
    elif rag_type == "structured":
        from .pipeline_modules.graph_pipeline import get_graph_pipeline_nodes
        return get_graph_pipeline_nodes
    elif rag_type == "conversational":
        from .pipeline_modules.conversational_pipeline import get_conversational_graph_nodes
        return get_conversational_graph_nodes
    return None
