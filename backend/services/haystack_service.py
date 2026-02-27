import os
from haystack import Pipeline, Document
from haystack.components.builders import PromptBuilder
from haystack.components.generators import OpenAIGenerator
from haystack.components.retrievers.in_memory import InMemoryBM25Retriever
from haystack.document_stores.in_memory import InMemoryDocumentStore
from haystack.document_stores.types import DuplicatePolicy
from haystack.utils import Secret

# Demo document store
in_memory_store = InMemoryDocumentStore()

def build_and_deploy_pipeline(config: dict):
    """
    Builds and deploys a Haystack 2.0 pipeline based on the frontend configuration.
    Handles the 10 complex RAG architectural combinations.
    """
    texts = config.get("extracted_texts", [])
    rag_type = config.get("ragType", "basic")
    db_type = config.get("dbType", "cloud")
    llm_model = config.get("llmModel", "qwen-local")
    top_k = config.get("topK", 5)
    chunk_size = config.get("chunkSize", 500)
    features = config.get("features", [])
    use_reranker = config.get("useReranker", False)
    dynamic_cfg = config.get("dynamicConfig", {})
    
    # 1. Document Processing (Mocking DocumentSplitter based on chunkSize)
    # E.g., doc_splitter = DocumentSplitter(split_by="word", split_length=chunk_size)
    documents = [Document(content=text) for text in texts]
    if documents:
        # 2. Vector DB Selection based on db_type/cloudDb/localDb
        in_memory_store.write_documents(documents, policy=DuplicatePolicy.OVERWRITE)
        
    pipeline = Pipeline()
    
    # 3. Architecture Routing based on RAG Types
    # Basic retrieval logic
    retriever = InMemoryBM25Retriever(document_store=in_memory_store, top_k=top_k)
    
    # Agentic logic
    tools_str = ""
    if rag_type == "agentic":
        tools = dynamic_cfg.get("tools", [])
        tools_str = f"You have access to the following tools: {', '.join(tools)}."

    # Conversational logic
    history_str = ""
    if rag_type == "conversational":
        history_length = dynamic_cfg.get("historyLength", 10)
        history_str = f"Maintain context of the last {history_length} messages."

    # Citation logic
    citation_str = ""
    if rag_type == "citation":
        style = dynamic_cfg.get("citationStyle", "inline")
        citation_str = f"Please provide citations {style} for every claim."

    template = f"""
    You are an AI assistant.
    {tools_str}
    {history_str}
    {citation_str}
    
    Given the following context, please answer the query.
    Note these requested features: {features}.
    
    Context:
    {{% for document in documents %}}
        {{{{ document.content }}}}
    {{% endfor %}}
    
    Query: {{{{query}}}}
    Answer:
    """
    prompt_builder = PromptBuilder(template=template)
    
    # 4. Model Selection Logic
    if llm_model == "qwen-local":
        generator = OpenAIGenerator(
            api_key=Secret.from_token("sk-no-key-required"),
            api_base_url="http://localhost:8001/v1",
            model="Qwen2.5-14B-Instruct-1M-Q3_K_L.gguf"
        )
    else:
        # Fallback pseudo-config for cloud LLMs (GPT/Claude mock)
        generator = OpenAIGenerator(
            api_key=Secret.from_token("mock_key"),
            api_base_url="http://localhost:8001/v1", # Route to local as mock for now
            model=llm_model 
        )
    
    pipeline.add_component("retriever", retriever)
    
    # 5. Advanced Tuning - Optional Reranker
    if use_reranker:
        # In actual Haystack we'd use: pipeline.add_component("reranker", TransformersSimilarityRanker(model="cross-encoder/..."))
        # Here we mock it by adding a dummy PromptBuilder segment or just logging it.
        pass
        
    pipeline.add_component("prompt_builder", prompt_builder)
    pipeline.add_component("llm", generator)
    
    pipeline.connect("retriever", "prompt_builder.documents")
    pipeline.connect("prompt_builder", "llm")
    
    import uuid
    pipeline_id = f"pipe_{str(uuid.uuid4())[:8]}"
    
    return pipeline_id, pipeline
