"""Quick verification script for Phase 1-3 modules."""
import sys
sys.path.insert(0, '.')

errors = []

# Phase 1: Pipeline Modules
try:
    from services.pipeline_modules import get_pipeline_builder, STANDARD_RAG_TYPES
    print(f"✓ pipeline_modules: Standard types = {STANDARD_RAG_TYPES}")
    
    # Check each specialized builder
    for rag in ["crosslingual", "voice", "agentic", "structured", "conversational"]:
        builder = get_pipeline_builder(rag)
        assert builder is not None, f"No builder for {rag}"
    print("✓ All 5 specialized pipeline builders registered")
except Exception as e:
    errors.append(f"pipeline_modules: {e}")
    print(f"✗ pipeline_modules: {e}")

try:
    from services.memory_manager import get_or_create_memory, BufferMemory, SummaryMemory
    mem = BufferMemory(window_size=5)
    mem.add_exchange("hello", "hi there")
    ctx = mem.get_context()
    assert "hello" in ctx
    print("✓ memory_manager: BufferMemory works")
except Exception as e:
    errors.append(f"memory_manager: {e}")
    print(f"✗ memory_manager: {e}")

# Phase 2: Database Layer
try:
    from services.multi_retriever import MultiRetrieverAggregator, min_max_normalize
    agg = MultiRetrieverAggregator(strategy="union", top_k=5)
    norm = min_max_normalize([1.0, 2.0, 3.0])
    assert len(norm) == 3
    print("✓ multi_retriever: Aggregator + normalization OK")
except Exception as e:
    errors.append(f"multi_retriever: {e}")
    print(f"✗ multi_retriever: {e}")

# Phase 3: Config & Models
try:
    from services.tuning_presets import apply_tuning_preset, list_presets, get_rag_defaults
    presets = list_presets()
    assert "balanced" in presets
    assert "fast" in presets
    assert "high_accuracy" in presets
    print(f"✓ tuning_presets: {len(presets)} presets available")
    
    defaults = get_rag_defaults("agentic")
    assert "dynamicConfig" in defaults
    print(f"✓ rag_defaults: Agentic defaults loaded")
    
    # Test preset application
    config = {"chunkSize": 999, "topK": 999, "tuningPreset": "balanced"}
    result = apply_tuning_preset(config)
    assert result["chunkSize"] == 800
    assert result["topK"] == 5
    print("✓ apply_tuning_preset: Balanced preset applied correctly")
except Exception as e:
    errors.append(f"tuning_presets: {e}")
    print(f"✗ tuning_presets: {e}")

try:
    from services.llm_service import list_available_models, detect_gpu_availability
    models = list_available_models()
    model_ids = [m["id"] for m in models]
    assert "ollama" in model_ids
    assert "llama3-local" in model_ids
    assert "deepseek-local" in model_ids
    print(f"✓ llm_service: {len(models)} models registered (incl. ollama, llama3, deepseek)")
    
    gpu = detect_gpu_availability()
    print(f"✓ gpu_detection: cuda={gpu['cuda_available']}, vram={gpu['vram_mb']}MB")
except Exception as e:
    errors.append(f"llm_service: {e}")
    print(f"✗ llm_service: {e}")

print("\n" + "=" * 50)
if errors:
    print(f"FAILED: {len(errors)} errors")
    for err in errors:
        print(f"  - {err}")
else:
    print("ALL PHASE 1-3 CHECKS PASSED ✓")
