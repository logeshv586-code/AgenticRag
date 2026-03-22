"""Quick verification script for Phase 7, 8, 9 modules."""
import sys
import os
import json
sys.path.insert(0, '.')

errors = []

# Phase 7: Deployment Packager
try:
    from services.deployment_manager import package_deployment
    config = {"ragType": "basic", "dbType": "local", "localDb": "chroma"}
    res = package_deployment("test_pipeline_001", config, format="docker")
    assert res["status"] == "success"
    assert os.path.exists(os.path.join(res["package_dir"], "Dockerfile"))
    assert os.path.exists(os.path.join(res["package_dir"], "docker-compose.yml"))
    print("✓ deployment_manager: Docker package created")
    
    res2 = package_deployment("test_pipeline_002", config, format="kubernetes")
    assert res2["status"] == "success"
    assert os.path.exists(os.path.join(res2["package_dir"], "k8s-deployment.yml"))
    print("✓ deployment_manager: Kubernetes package created")
except Exception as e:
    errors.append(f"deployment_manager: {e}")
    print(f"✗ deployment_manager: {e}")

# Phase 8: Observability
try:
    from services.observability_service import track_query, get_metrics, get_logs
    
    with track_query("pipe_123", "Hello world", "basic", "test-model") as ctx:
        ctx.response = "Response here"
        ctx.tokens = 42
        
    metrics = get_metrics()
    assert metrics["total_queries"] >= 1
    assert metrics["total_tokens"] >= 42
    
    logs = get_logs(limit=1)
    assert len(logs) == 1
    assert logs[0]["pipeline_id"] == "pipe_123"
    assert logs[0]["tokens"] == 42
    print("✓ observability_service: metrics and logs recorded correctly")
except Exception as e:
    errors.append(f"observability_service: {e}")
    print(f"✗ observability_service: {e}")

# Phase 9: Security Middleware
try:
    from services.security_middleware import SecurityMiddleware, _check_rate_limit, VALID_API_KEYS
    assert "rag_demo_admin_key_2026" in VALID_API_KEYS
    
    # Test rate limiter
    client = "test_ip_1"
    for _ in range(10):
        assert _check_rate_limit(client, "unauthenticated") is True
    # 11th should fail
    assert _check_rate_limit(client, "unauthenticated") is False
    print("✓ security_middleware: rate limiter enforces limits")
except Exception as e:
    errors.append(f"security_middleware: {e}")
    print(f"✗ security_middleware: {e}")

print("\n" + "=" * 50)
if errors:
    print(f"FAILED: {len(errors)} errors")
    for err in errors:
        print(f"  - {err}")
else:
    print("ALL PHASE 7-9 CHECKS PASSED ✓")
