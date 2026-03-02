# Agentic RAG System - Project Overview

This document provides a comprehensive summary of the features and technical implementation of the Agentic RAG project, covering both the UI and Backend components.

## **UI (Frontend) - Chatbot UI**

The frontend is a modern, futuristic web application built with **React**, **Vite**, and **Tailwind CSS**. It provides an intuitive interface for users to build, deploy, and interact with custom RAG (Retrieval-Augmented Generation) systems.

### **Core Features**
- **Futuristic UI/UX**: Implements a high-tech "glassmorphism" aesthetic with neon themes, animated 3D/2D robots, and interactive background elements like floating lines and grid scans.
- **RAG Factory (10-Step Wizard)**: A comprehensive modal-based wizard that guides users through creating a custom RAG system:
  1. **Data Ingestion**: Support for both web URLs and local file uploads (PDFs, etc.).
  2. **Database Selection**: Options for Cloud (Pinecone, Weaviate, Milvus), Local (ChromaDB, FAISS), or Hybrid storage.
  3. **Architecture Routing**: Support for 13+ RAG types, including:
     - **Standard RAG**: Precise text retrieval.
     - **Hybrid RAG**: Combined keyword and vector search.
     - **Conversational RAG**: Long-term chat history and memory.
     - **Agentic RAG**: Models that can plan and use tools.
     - **Graph RAG**: Deep reasoning across knowledge graphs.
     - **Multimodal RAG**: Handling text, images, and audio.
     - **Real-time, Personalized, Cross-lingual, Voice, Citation, and Guardrailed RAGs**.
  4. **Dynamic Configuration**: Context-sensitive settings based on the chosen RAG type (e.g., tool selection for Agentic RAG, history length for Conversational RAG).
  5. **Model Selection**: Choice between a **Local Qwen 2.5 14B** model (for privacy/offline use) or cloud models (GPT-4o, Claude 3.5).
  6. **Advanced Tuning**: Control over chunk size, Top-K retrieval, and the use of re-rankers.
  7. **Feature & Theme Customization**: Toggle features like multi-lingual support, source citations, and sentiment analysis. Choose from themes like Cyber Cyan, Neon Pink, and Emerald.
  8. **Deployment**: Integrated deployment flow that communicates with the backend to build and host the RAG pipeline.
- **Interactive Chat Interface**:
  - **Guide Mode**: Chat with a local AI assistant to learn about RAG concepts and get guidance on building a system.
  - **Tester Mode**: Immediately test a newly deployed RAG pipeline within the same interface.
  - **Voice Input**: Integrated voice-to-text using the Web Speech API.
  - **Suggestions**: Quick-action buttons for common tasks (e.g., "Build a Custom RAG", "Explain RAG Types").
- **Pipeline Visualization**: A dedicated visualizer component that shows the architecture of the RAG pipeline (nodes and edges).

---

## **Backend - FastAPI Service**

The backend is a robust Python service built with **FastAPI** and **Haystack 2.0**, designed to handle complex RAG orchestration and local model hosting.

### **Core Components**
- **Local LLM Server**: Manages a local `llama_cpp.server` instance hosting the **Qwen2.5-14B-Instruct-1M** model. This allows for fully private, offline inference.
- **Haystack 2.0 Orchestration**: Uses the modern Haystack framework to dynamically build RAG pipelines based on user configurations.
- **Specialized Services**:
  - `scraper.py`: Extracts clean text from web URLs.
  - `document_parser.py`: Handles parsing and text extraction from various document formats.
  - `haystack_service.py`: The core logic for assembling Haystack components (Retrievers, PromptBuilders, Generators, etc.) into functional pipelines.
  - `rag_builder.py`: Orchestrates the deployment and metadata management of created RAG systems.

### **API Endpoints**
- **Data Processing**:
  - `POST /api/scrape`: Processes a list of URLs and returns extracted text.
  - `POST /api/upload`: Handles file uploads and returns parsed text.
- **AI Interactions**:
  - `POST /api/chat`: General interaction endpoint for the local LLM "Guide".
  - `POST /api/test-chat`: Query endpoint for specifically deployed RAG pipelines using `pipeline_id`.
- **RAG Management**:
  - `POST /api/deploy`: Accepts a full RAG configuration, builds the Haystack pipeline, and returns deployment details (including a unique `pipeline_id`).
  - `GET /api/visualize/{pipeline_id}`: Provides structural data for the frontend visualization of a pipeline.
- **Utilities**:
  - `POST /api/feedback`: Collects user ratings and comments on chat interactions.
  - `POST /api/demo/eratimbers`: A one-click demo endpoint that scrapes a specific site and deploys a pre-configured Hybrid RAG.

---

## **Technical Stack Summary**
- **Frontend**: React, Vite, Tailwind CSS, Lucide React, Web Speech API.
- **Backend**: Python, FastAPI, Haystack 2.0, llama-cpp-python.
- **Models**: Qwen 2.5 14B (Local), Support for OpenAI & Anthropic (Cloud).
- **Data Stores**: InMemoryDocumentStore (Demo/Default), with logic for Pinecone, ChromaDB, etc.

---

## **Full System Flow: From Configuration to Deployment**

The following trace outlines the end-to-end execution flow of the Agentic RAG system.

### **1. Data Ingestion & Pre-processing**
- **Frontend Trigger**: In the "Data Ingestion" step of the RAG Factory, users provide URLs or upload files.
- **Backend Processing**:
  - `POST /api/scrape`: Uses `scraper.py` to extract text from static or dynamic web pages.
  - `POST /api/upload`: Uses `document_parser.py` to parse PDFs, DOCX files, and even perform OCR on images.
- **Result**: Extracted text is returned to the frontend and stored temporarily in the wizard's state.

### **2. Pipeline Orchestration & Deployment**
- **Frontend Trigger**: Upon clicking "Initialize Deployment" (Step 9), the frontend sends a comprehensive configuration object to `POST /api/deploy`.
- **Backend Logic (`rag_builder.py`)**:
  - **Storage Setup**: `vector_store_manager.py` creates the requested DocumentStore (e.g., ChromaDB for local, Pinecone for cloud).
  - **Document Indexing**: `haystack_service.py` splits the text into chunks (via `DocumentSplitter`) and writes them to the store.
  - **Pipeline Assembly**: `haystack_service.py` builds a Haystack 2.0 `Pipeline` by connecting:
    - **Retriever**: Fetches relevant chunks (BM25 or Embedding-based).
    - **Reranker (Optional)**: Refines results using a neural cross-encoder.
    - **PromptBuilder**: Applies a specialized template based on the chosen RAG type (e.g., Agentic, Citation, Cross-lingual).
    - **Generator**: Connects to the selected LLM (Local Qwen or Cloud provider) via `llm_service.py`.
- **Result**: The pipeline is registered in-memory with a unique `pipeline_id`, and a deployment metadata JSON is saved to `data/deployments/`.

### **3. Interactive Chat & Query Execution**
- **Frontend Trigger**: Users interact with the "Tester Mode" or a standalone chat page.
- **Backend Logic (`haystack_service.py`)**:
  - `POST /api/test-chat`: Receives the `pipeline_id` and user `query`.
  - **Execution**: The active pipeline is retrieved from the registry and executed.
  - **Flow**: Query → Retriever → (Reranker) → PromptBuilder → LLM Generator → Answer.
- **Result**: The LLM's response is returned to the UI.

### **4. Pipeline Visualization**
- **Frontend Trigger**: The `RagVisualizer` component is rendered after deployment.
- **Backend Logic (`haystack_service.py`)**:
  - `GET /api/visualize/{pipeline_id}`: Inspects the pipeline's metadata and generates a graph structure (Nodes and Edges).
- **Result**: The frontend renders a futuristic node-link diagram showing exactly how data flows through the custom RAG architecture.
