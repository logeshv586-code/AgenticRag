import requests
import json
import sys

BASE_URL = "http://localhost:8010"

def test_chat():
    try:
        print("Testing /api/chat (Guide Mode) with question...")
        resp = requests.post(f"{BASE_URL}/api/chat", json={"query": "What is OmniRAG?"}, timeout=300)
        print(f"Status: {resp.status_code}")
        print(f"Response: {resp.json()}\n")
    except Exception as e:
        print(f"Chat Test Error: {e}")

def test_test_chat():
    try:
        print("Testing /api/test-chat (Test Mode)...")
        resp = requests.post(f"{BASE_URL}/api/test-chat", json={"query": "hello"}, timeout=10)
        print(f"Status: {resp.status_code}")
        print(f"Response: {resp.json()}\n")
    except Exception as e:
        print(f"Test-Chat Error: {e}")

if __name__ == "__main__":
    test_chat()
    test_test_chat()
