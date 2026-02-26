import os
from haystack import Pipeline, Document
from haystack.components.builders import PromptBuilder
from haystack.components.generators import OpenAIGenerator
from haystack.components.retrievers.in_memory import InMemoryBM25Retriever
from haystack.document_stores.in_memory import InMemoryDocumentStore

# Demo document store
in_memory_store = InMemoryDocumentStore()

def build_and_deploy_pipeline(texts, rag_type, use_case, vector_db, features):
    """
    Builds and deploys a Haystack 2.0 pipeline based on the frontend configuration.
    """
    # Create Document objects
    documents = [Document(content=text) for text in texts]
    if documents:
        # Depending on vector_db, you would initialize ChromaDocumentStore or PineconeDocumentStore
        # Here we use InMemory for demonstration
        in_memory_store.write_documents(documents)
        
    pipeline = Pipeline()
    
    # In a real app, logic branches here based on `rag_type`
    # E.g., if rag_type == "hybrid": add both dense and sparse retrievers
    # if rag_type == "agentic": use FunctionCalling / Tool components
    
    retriever = InMemoryBM25Retriever(document_store=in_memory_store)
    
    template = f"""
    You are an AI assistant designed for the '{use_case}' persona.
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
    
    # Configure generator to point to local llama_cpp server
    generator = OpenAIGenerator(
        api_key="sk-no-key-required",
        api_base_url="http://localhost:8001/v1",
        model="Qwen2.5-14B-Instruct-1M-Q3_K_L.gguf" # Name doesn't strongly matter for llama.cpp, but good for logs
    )
    
    pipeline.add_component("retriever", retriever)
    pipeline.add_component("prompt_builder", prompt_builder)
    pipeline.add_component("llm", generator)
    
    pipeline.connect("retriever", "prompt_builder.documents")
    pipeline.connect("prompt_builder", "llm")
    
    # Generate a unique pipeline ID
    import uuid
    pipeline_id = f"pipe_{str(uuid.uuid4())[:8]}"
    
    # Store it in memory (or redis)
    # mock_pipeline_registry[pipeline_id] = pipeline
    
    return pipeline_id, pipeline
