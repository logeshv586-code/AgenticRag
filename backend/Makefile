# OmniRAG Backend Makefile

PYTHON = python
VENV = venv
VENV_BIN = $(VENV)\Scripts
UVICORN = $(VENV_BIN)\uvicorn
PIP = $(VENV_BIN)\pip
PORT = 8010
MODEL_PORT = 8011
OLLAMA_PORT = 11434

.PHONY: run setup model-status model-start clean help

help:
	@echo "OmniRAG Backend Management"
	@echo "--------------------------"
	@echo "make run          - Start the backend and model environment"
	@echo "make setup        - Install dependencies and prepare venv"
	@echo "make model-start  - Manually start the local GGUF server"
	@echo "make model-status - Check status of Ollama and GGUF servers"
	@echo "make clean        - Remove caches and temporary files"

setup:
	if not exist $(VENV) $(PYTHON) -m venv $(VENV)
	$(PIP) install -r requirements.txt
	@echo "✅ Setup complete. Dependencies installed."

run:
	@echo "🚀 Starting OmniRAG Backend..."
	@echo "Checking model status..."
	$(PYTHON) -c "import requests; try: r=requests.get('http://localhost:$(MODEL_PORT)/v1/models', timeout=2); print('✅ GGUF Server is already running.') if r.status_code==200 else exit(1); except: exit(1)" || (echo "Starting local model server..." && start /B $(PYTHON) -m llama_cpp.server --model E:\AgenticRag\Qwen3.5-9B-GGUF\Qwen2.5-1.5B-Instruct-Q4_K_M.gguf --port $(MODEL_PORT) --n_ctx 4096 --n_gpu_layers 0)
	$(UVICORN) main:app --port $(PORT) --reload --host 0.0.0.0

model-start:
	@echo "🚀 Starting local model server (Qwen 1.5B)..."
	start /B $(PYTHON) -m llama_cpp.server --model E:\AgenticRag\Qwen3.5-9B-GGUF\Qwen2.5-1.5B-Instruct-Q4_K_M.gguf --port $(MODEL_PORT) --n_ctx 4096 --n_gpu_layers 0

model-status:
	@echo "--- Model Status ---"
	@echo "Ollama (Port $(OLLAMA_PORT)):"
	-curl -s http://localhost:$(OLLAMA_PORT)/api/tags | findstr /R "name" || echo "❌ Ollama is not running."
	@echo ""
	@echo "GGUF Server (Port $(MODEL_PORT)):"
	-curl -s http://localhost:$(MODEL_PORT)/v1/models | findstr /R "id" || echo "❌ GGUF Server is not running."

clean:
	rmdir /s /q __pycache__ 2>nul || exit 0
	rmdir /s /q services\__pycache__ 2>nul || exit 0
	@echo "✨ Cleaned up pycache."
