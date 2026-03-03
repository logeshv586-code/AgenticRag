#!/usr/bin/env python3
"""
OmniRAG Ollama Setup Script
============================
Downloads and configures the best Ollama models for your 30-40GB server.
Run this once before starting the backend.

Usage:
    python ollama_setup.py --profile 30gb     # Best set for 30GB disk
    python ollama_setup.py --profile 40gb     # More models for 40GB disk
    python ollama_setup.py --list             # Show available profiles
    python ollama_setup.py --test             # Test the running models
    python ollama_setup.py --status           # Check Ollama status

Requirements:
    - Ollama installed (https://ollama.ai)
    - Ollama running: ollama serve
"""
import argparse
import subprocess
import sys
import time
import requests

OLLAMA_URL = "http://localhost:11434"

# Model profiles — optimized for 30-40GB servers
MODEL_PROFILES = {
    "30gb": {
        "description": "Best set for 30GB disk — text + vision + multilingual",
        "models": [
            {
                "name": "llama3.1:8b",
                "size": "~5GB",
                "purpose": "🔤 Primary text generation (fast, high quality)",
                "pull_cmd": "ollama pull llama3.1:8b",
            },
            {
                "name": "llava:13b",
                "size": "~8GB",
                "purpose": "🖼️  Vision + image understanding for Image RAG",
                "pull_cmd": "ollama pull llava:13b",
            },
            {
                "name": "qwen2.5:7b",
                "size": "~5GB",
                "purpose": "🌍 Multilingual excellence (94+ languages)",
                "pull_cmd": "ollama pull qwen2.5:7b",
            },
        ],
        "total": "~18GB",
    },
    "40gb": {
        "description": "High-quality set for 40GB disk — larger models",
        "models": [
            {
                "name": "mixtral:8x7b",
                "size": "~26GB",
                "purpose": "🔤 Best all-round reasoning (mixture of experts)",
                "pull_cmd": "ollama pull mixtral:8x7b",
            },
            {
                "name": "llava:13b",
                "size": "~8GB",
                "purpose": "🖼️  Vision + image understanding for Image RAG",
                "pull_cmd": "ollama pull llava:13b",
            },
        ],
        "total": "~34GB",
    },
    "minimal": {
        "description": "Minimal setup — single lightweight model (~5GB)",
        "models": [
            {
                "name": "llama3.1:8b",
                "size": "~5GB",
                "purpose": "🔤 General purpose text generation",
                "pull_cmd": "ollama pull llama3.1:8b",
            },
        ],
        "total": "~5GB",
    },
    "vision-focused": {
        "description": "For Image + Multimodal RAG — vision-capable models",
        "models": [
            {
                "name": "gemma3:27b",
                "size": "~17GB",
                "purpose": "🖼️  Gemma 3 multimodal (text + vision)",
                "pull_cmd": "ollama pull gemma3:27b",
            },
            {
                "name": "llava:13b",
                "size": "~8GB",
                "purpose": "🖼️  LLaVA vision model",
                "pull_cmd": "ollama pull llava:13b",
            },
        ],
        "total": "~25GB",
    },
}


def check_ollama() -> bool:
    """Check if Ollama is running."""
    try:
        resp = requests.get(f"{OLLAMA_URL}/api/tags", timeout=5)
        return resp.status_code == 200
    except Exception:
        return False


def list_installed_models() -> list:
    """List models currently installed in Ollama."""
    try:
        resp = requests.get(f"{OLLAMA_URL}/api/tags", timeout=5)
        if resp.status_code == 200:
            return [m["name"] for m in resp.json().get("models", [])]
    except Exception:
        pass
    return []


def pull_model(model_name: str) -> bool:
    """Pull a model using ollama pull command."""
    print(f"\n📥 Pulling {model_name}...")
    print("   This may take several minutes depending on your connection speed.")
    try:
        result = subprocess.run(
            ["ollama", "pull", model_name],
            capture_output=False,
            text=True,
            timeout=3600  # 1 hour max
        )
        return result.returncode == 0
    except subprocess.TimeoutExpired:
        print(f"   ⏱️  Timeout pulling {model_name}")
        return False
    except FileNotFoundError:
        print("   ❌ 'ollama' command not found. Please install Ollama from https://ollama.ai")
        return False
    except Exception as e:
        print(f"   ❌ Error: {e}")
        return False


def test_model(model_name: str) -> bool:
    """Test a model with a simple prompt."""
    print(f"\n🧪 Testing {model_name}...")
    try:
        resp = requests.post(
            f"{OLLAMA_URL}/api/generate",
            json={
                "model": model_name,
                "prompt": "Say 'OmniRAG ready!' in exactly 3 words.",
                "stream": False,
            },
            timeout=60
        )
        if resp.status_code == 200:
            response_text = resp.json().get("response", "")
            print(f"   ✅ Response: {response_text[:100]}")
            return True
        else:
            print(f"   ❌ HTTP {resp.status_code}")
            return False
    except Exception as e:
        print(f"   ❌ Error: {e}")
        return False


def show_status():
    """Show current Ollama status."""
    print("\n" + "="*60)
    print("  OmniRAG — Ollama Status")
    print("="*60)

    if not check_ollama():
        print("\n❌ Ollama is NOT running!")
        print("\nTo start Ollama:")
        print("  1. Install from: https://ollama.ai")
        print("  2. Run: ollama serve")
        return

    print("\n✅ Ollama is running at", OLLAMA_URL)
    models = list_installed_models()

    if not models:
        print("\n📦 No models installed yet.")
        print("   Run: python ollama_setup.py --profile 30gb")
    else:
        print(f"\n📦 Installed models ({len(models)}):")
        for m in models:
            print(f"   • {m}")

    print("\n🔗 Ollama API: http://localhost:11434")
    print("🔗 OmniRAG backend will use these models automatically\n")


def list_profiles():
    """List all available model profiles."""
    print("\n" + "="*60)
    print("  OmniRAG — Available Model Profiles")
    print("="*60)

    for profile_name, profile in MODEL_PROFILES.items():
        print(f"\n📦 --profile {profile_name}  ({profile['total']})")
        print(f"   {profile['description']}")
        for m in profile["models"]:
            print(f"   • {m['name']} ({m['size']}) — {m['purpose']}")

    print("\nExample:")
    print("  python ollama_setup.py --profile 30gb")
    print()


def setup_profile(profile_name: str):
    """Download all models in a profile."""
    if profile_name not in MODEL_PROFILES:
        print(f"❌ Unknown profile: {profile_name}")
        print(f"   Available: {', '.join(MODEL_PROFILES.keys())}")
        sys.exit(1)

    profile = MODEL_PROFILES[profile_name]

    print("\n" + "="*60)
    print(f"  OmniRAG — Setting up profile: {profile_name}")
    print("="*60)
    print(f"\n📋 {profile['description']}")
    print(f"📦 Total disk needed: {profile['total']}")

    # Check Ollama is running
    if not check_ollama():
        print("\n❌ Ollama is not running! Please start it first:")
        print("   ollama serve")
        sys.exit(1)

    installed = list_installed_models()
    print(f"\n✅ Ollama running. Currently installed: {len(installed)} models")

    # Pull each model
    succeeded = []
    failed = []

    for model_info in profile["models"]:
        model_name = model_info["name"]
        print(f"\n{'='*40}")
        print(f"{model_info['purpose']}")
        print(f"Model: {model_name} ({model_info['size']})")

        # Check if already installed
        if any(model_name in m for m in installed):
            print(f"   ✅ Already installed — skipping")
            succeeded.append(model_name)
            continue

        if pull_model(model_name):
            succeeded.append(model_name)
            print(f"   ✅ Successfully pulled {model_name}")
        else:
            failed.append(model_name)

    # Summary
    print("\n" + "="*60)
    print("  Setup Complete!")
    print("="*60)
    print(f"\n✅ Succeeded: {', '.join(succeeded) if succeeded else 'None'}")
    if failed:
        print(f"❌ Failed: {', '.join(failed)}")

    # Test the first model
    if succeeded:
        test_model(succeeded[0])

    print("\n🚀 Your OmniRAG backend will now use these models!")
    print("   Start the backend: uvicorn main:app --port 8010 --reload\n")


def run_tests():
    """Test all installed models."""
    print("\n" + "="*60)
    print("  OmniRAG — Model Tests")
    print("="*60)

    if not check_ollama():
        print("\n❌ Ollama is not running!")
        return

    models = list_installed_models()
    if not models:
        print("\n❌ No models installed.")
        return

    print(f"\n🧪 Testing {len(models)} models...")
    for model in models:
        test_model(model)
    print("\n✅ All tests complete!\n")


def main():
    parser = argparse.ArgumentParser(
        description="OmniRAG Ollama Setup — Download models for your local LLM server",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python ollama_setup.py --status              # Check Ollama status
  python ollama_setup.py --list               # List profiles
  python ollama_setup.py --profile 30gb       # Setup 30GB profile
  python ollama_setup.py --profile 40gb       # Setup 40GB profile
  python ollama_setup.py --test               # Test installed models
  python ollama_setup.py --pull llama3.1:8b   # Pull a specific model
        """
    )
    parser.add_argument("--profile", help="Setup a model profile (30gb, 40gb, minimal, vision-focused)")
    parser.add_argument("--list", action="store_true", help="List available profiles")
    parser.add_argument("--status", action="store_true", help="Show Ollama status")
    parser.add_argument("--test", action="store_true", help="Test installed models")
    parser.add_argument("--pull", metavar="MODEL", help="Pull a specific model")

    args = parser.parse_args()

    if args.list:
        list_profiles()
    elif args.status:
        show_status()
    elif args.test:
        run_tests()
    elif args.pull:
        if not check_ollama():
            print("❌ Ollama is not running! Start with: ollama serve")
            sys.exit(1)
        pull_model(args.pull)
        test_model(args.pull)
    elif args.profile:
        setup_profile(args.profile)
    else:
        # Default: show status
        show_status()
        print("Run with --help for all options.")
        print("Quick start: python ollama_setup.py --profile 30gb\n")


if __name__ == "__main__":
    main()
