# AgenticRAG

**AgenticRAG is a chat-first RAG factory that builds, validates and continuously updates production retrieval systems from customer data.**

A customer describes the outcome in plain language, adds websites/files/server folders, and the backend selects or validates one of **11 real RAG architectures**. The same workflow then deploys the pipeline, runs a grounded validation query and can keep monitored knowledge fresh through **RAG Autopilot**.

> The project separates **source/build certification** from **live runtime certification**. CI does not fake model, embedding or vector-store services.

## Current verified release status

The lightweight production pass is certified by GitHub Actions **RAG Validation Matrix run #52**:

- backend production modules compile successfully;
- all 11 RAG catalog contracts pass;
- all self-developing/Autopilot contracts pass;
- secret and vector-store safety contracts pass;
- production npm audit reports **0 vulnerabilities**;
- customer and analytics lint passes with **0 warnings**;
- Plotly is absent from runtime dependencies;
- the complete Vite frontend builds successfully;
- the former ~4.65 MB Plotly bundle is removed;
- the native React/SVG analytics chunk is about **12.81 kB**;
- the largest generated JavaScript chunk is about **242 KiB**, below the enforced **700 KiB** limit;
- the final `PR source + build certified` gate passes.

The real 11/11 model/vector runtime matrix remains a separate deployment certificate because it must execute against the target environment's actual model, embeddings and vector-store services.

## What the product does

```text
Customer request
      ↓
Chat-first RAG Studio
      ↓
AI/backend architecture selection
      ↓
Website · files · customer folders
      ↓
Ingestion + embeddings + vector/graph storage
      ↓
Real RAG pipeline build
      ↓
Grounded validation query
      ↓
RAG Autopilot monitors knowledge changes
      ↓
Blue/green rebuild → verify → safe swap
```

The default customer route is `/`. The original detailed builder remains available at `/advanced`, and the guided starter experience is available at `/starter`.

## 11 supported RAG architectures

| Architecture | Production behavior |
| --- | --- |
| `basic` | Dense-first retrieval with lexical fallback |
| `hybrid` | BM25 + dense retrieval with reciprocal-rank fusion |
| `citation` | Retrieved source IDs + citation-constrained generation |
| `realtime` | Freshness-aware retrieval + monitored re-ingestion |
| `personalized` | Profile-aware query expansion without overriding source truth |
| `multimodal` | Text + OCR/vision + audio transcript evidence |
| `conversational` | Grounded conversation memory for follow-up questions |
| `agentic` | Retrieval-first planning, safe tools, confirmation and verification |
| `structured` | Entity extraction + graph traversal + retrieval |
| `crosslingual` | Detect → translate → retrieve → answer → translate back |
| `voice` | Speech-to-text → RAG → text-to-speech |

Unsupported marketing-only labels are rejected instead of silently building a different pipeline.

## RAG Autopilot

Autopilot turns a one-time RAG into a maintained knowledge system.

- monitors static/dynamic websites and customer-server folders;
- can render full pages and use the existing OCR/vision parser for visual changes;
- fingerprints source content with SHA-256 so unchanged data is not reindexed;
- detects additions, edits and removals;
- rebuilds into a versioned blue/green pipeline;
- swaps the stable customer pipeline only after the new generation succeeds;
- keeps the last-known-good RAG live when a refresh fails;
- rehydrates persisted monitored deployments after backend restart;
- exposes generation, source count, last update and error state in the customer UI;
- can safely evolve eligible Basic deployments toward Realtime/Multimodal behavior as monitored data changes.

## Lightweight frontend

The customer frontend is React + Vite and is intentionally kept lightweight.

The previous analytics route loaded Plotly as a ~4.65 MB JavaScript chunk. It has been replaced with **native React/SVG architecture visualizations**, and Plotly is no longer a runtime dependency. CI enforces:

- zero-warning lint for the customer and analytics routes;
- no Plotly runtime dependency;
- no high-severity production npm audit findings;
- a maximum JavaScript chunk size of **700 KiB**;
- a complete production Vite build.

The architecture comparison UI also avoids presenting synthetic design scores as measured benchmark accuracy/latency. Real runtime quality belongs to the runtime certification matrix.

## Model and vector-store runtime

AgenticRAG supports customer-controlled local and cloud model paths.

### Local model options

- **Ollama**: default endpoint `http://localhost:11434/v1`
- **OpenAI-compatible local GGUF service**: default endpoint `http://127.0.0.1:8080/v1`
- Override the GGUF endpoint with `LOCAL_LLM_BASE_URL`.
- Override Ollama's port with `OLLAMA_PORT`.

The FastAPI backend runs on port **8010**, deliberately separate from the local LLM endpoint.

### Vector stores

The backend includes local/cloud integrations such as Chroma, FAISS and Qdrant. A requested store must initialize successfully; it is not silently replaced with an empty in-memory database.

## Security and truthfulness

- provider credentials come from the current request or environment;
- cloud provider secrets are not embedded in source;
- deployment metadata/customer exports intentionally drop API keys;
- agentic side-effect tools require explicit confirmation;
- unavailable tools fail truthfully instead of returning fake success;
- failed Autopilot rebuilds preserve the last-known-good deployment;
- runtime certification requires real services instead of mocks.

## Certification

### 1. Pull-request source/build certificate

`.github/workflows/rag-validation.yml` validates:

1. production Python module compilation;
2. exact 11-type RAG catalog contracts;
3. self-developing RAG/Autopilot contracts;
4. provider-secret and vector-store safety contracts;
5. production npm security audit;
6. zero-warning customer/analytics lint;
7. lightweight bundle budget;
8. complete Vite production build.

The final CI gate is named **`PR source + build certified`**.

### 2. Real 11/11 deployment certificate

`backend/test_all_rags.py` builds and queries every supported RAG against a running backend and real runtime services.

It validates a known fixture fact (the AX-10 two-year warranty) instead of treating any non-empty model response as success. Citation RAG also receives an additional source/citation check.

Runtime settings are configurable:

```bash
RAG_TEST_BASE_URL=http://localhost:8010
RAG_TEST_LLM_MODEL=ollama-auto
RAG_TEST_EMBEDDING_MODEL=bge-local
RAG_TEST_LOCAL_DB=chroma
python backend/test_all_rags.py
```

A successful run writes:

```text
backend/test_all_rags_output.json
```

GitHub Actions also exposes a manual **Live 11/11 runtime certification** job for a prepared self-hosted runner. This is intentionally separate from ordinary hosted PR CI.

## Quick start

### Backend

```bash
cd backend
python -m venv .venv
# Windows: .venv\Scripts\activate
# Linux/macOS: source .venv/bin/activate
pip install -r requirements.txt
python main.py
```

Backend health:

```text
http://localhost:8010/health
```

### Frontend

```bash
cd chatbotui
npm ci
npm run dev
```

For production verification:

```bash
npm run audit:prod
npm run build
```

## Repository structure

```text
AgenticRag/
├── .github/workflows/rag-validation.yml
├── backend/
│   ├── main.py
│   ├── requirements.txt
│   ├── test_all_rags.py
│   ├── test_rag_catalog.py
│   ├── test_self_developing_rag.py
│   ├── test_security_contract.py
│   └── services/
│       ├── rag_builder.py
│       ├── rag_autopilot.py
│       ├── rag_autopilot_runtime.py
│       ├── vector_store_manager.py
│       ├── llm_service.py
│       └── pipeline_modules/
└── chatbotui/
    ├── src/ChatRagStudio.jsx
    ├── src/CustomerRagStudio.jsx
    ├── src/App.jsx
    └── src/components/RagAnalyticsDashboard.jsx
```

## Production release rule

A branch can be described as **source/build certified** only when the GitHub CI certificate passes. A deployment can be described as **runtime certified** only when the real `test_all_rags.py` matrix passes in that target model/embedding/vector environment.

No universal accuracy or profitability-style claim is inferred from architecture labels or UI profile values.

## License

MIT License. See `LICENSE` for details.

## Contributing

Issues and pull requests are welcome. For changes to production RAG behavior, include or update the relevant contract test and keep the certification distinction above intact.
