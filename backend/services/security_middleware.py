"""
Security Middleware — API Key Auth, Rate Limiting, and Audit Logging.
Enterprise-grade security wrapper for FastAPI RAG endpoints.
"""
import time
import logging
from typing import Callable
from fastapi import Request, Response, HTTPException
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

logger = logging.getLogger(__name__)

# ═══════════════════════════════════════════════════════════
#  Configuration
# ═══════════════════════════════════════════════════════════

# In production, these would be loaded from a secure vault or DB
VALID_API_KEYS = {
    "rag_demo_admin_key_2026": {"role": "admin", "tier": "enterprise"},
    "rag_demo_user_key_2026":  {"role": "user",  "tier": "basic"},
}

# Rate Limits (requests per minute)
RATE_LIMITS = {
    "enterprise": 600,  # 10 req/s
    "basic": 60,        # 1 req/s
    "unauthenticated": 10
}

# In-memory tracking (use Redis in prod)
_request_counts = {}  # type: dict[str, list[float]]


# ═══════════════════════════════════════════════════════════
#  Audit Logger
# ═══════════════════════════════════════════════════════════

def _audit_log(request: Request, key_id: str, role: str, status: int):
    """Log security-relevant events for audit compliance."""
    # Mask the key for logs but keep an identifier prefix
    safe_key = f"{key_id[:8]}***" if len(key_id) > 8 else "none"
    
    audit_data = {
        "timestamp": time.time(),
        "ip": request.client.host if request.client else "unknown",
        "method": request.method,
        "path": request.url.path,
        "key_prefix": safe_key,
        "role": role,
        "status": status,
        "user_agent": request.headers.get("user-agent", "unknown")
    }
    
    # In production, send to Splunk/Datadog/ELK
    logger.info(f"AUDIT | {audit_data['ip']} | {audit_data['method']} {audit_data['path']} "
                f"| role: {audit_data['role']} | status: {audit_data['status']}")


# ═══════════════════════════════════════════════════════════
#  Rate Limiter Logic
# ═══════════════════════════════════════════════════════════

def _check_rate_limit(client_id: str, tier: str) -> bool:
    """Check if the client has exceeded their tier's rate limit."""
    now = time.time()
    limit = RATE_LIMITS.get(tier, RATE_LIMITS["unauthenticated"])
    
    # Initialize history list if new client
    if client_id not in _request_counts:
        _request_counts[client_id] = []
        
    history = _request_counts[client_id]
    
    # Remove timestamps older than 60 seconds
    while history and history[0] < now - 60:
        history.pop(0)
        
    # Check if within limit
    if len(history) >= limit:
        return False
        
    # Add new request timestamp
    history.append(now)
    return True


# ═══════════════════════════════════════════════════════════
#  FastAPI Middleware
# ═══════════════════════════════════════════════════════════

class SecurityMiddleware(BaseHTTPMiddleware):
    """
    FastAPI middleware for Enterprise Security.
    Handles API key validation, role extraction, rate limiting, and audit logging.
    """
    
    def __init__(self, app, bypass_paths=None, require_auth=False):
        super().__init__(app)
        self.bypass_paths = bypass_paths or ["/health", "/api/supported-formats", "/docs", "/openapi.json"]
        self.require_auth = require_auth  # If False, auth is optional but rate limits differ
        
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        
        # 1. Bypass checks for specified paths
        if any(request.url.path.startswith(p) for p in self.bypass_paths):
            return await call_next(request)
            
        # Extract client identifier (IP or API Key)
        api_key = request.headers.get("X-API-Key")
        client_ip = request.client.host if request.client else "unknown"
        
        # Determine Identity and Role
        role = "guest"
        tier = "unauthenticated"
        client_id = client_ip
        
        if api_key:
            auth_info = VALID_API_KEYS.get(api_key)
            if not auth_info:
                _audit_log(request, api_key, "invalid_key", 401)
                return JSONResponse(
                    status_code=401, 
                    content={"detail": "Invalid API Key."}
                )
            
            role = auth_info["role"]
            tier = auth_info["tier"]
            client_id = api_key  # track limits by key, not IP, for authenticated users
        
        elif self.require_auth:
            _audit_log(request, "missing", "unauthorized", 401)
            return JSONResponse(
                status_code=401, 
                content={"detail": "Authentication credentials were not provided (X-API-Key)."}
            )
            
        # 2. Enforce Rate Limiting
        if not _check_rate_limit(client_id, tier):
            _audit_log(request, client_id, role, 429)
            return JSONResponse(
                status_code=429, 
                content={"detail": f"Rate limit exceeded for tier '{tier}'. Please try again later."}
            )
            
        # Provide downstream endpoints with role info (via request.state)
        request.state.user_role = role
        request.state.user_tier = tier
        
        # 3. Process Request
        try:
            response = await call_next(request)
            _audit_log(request, client_id, role, response.status_code)
            
            # Inject security headers
            response.headers["X-Content-Type-Options"] = "nosniff"
            response.headers["X-Frame-Options"] = "DENY"
            response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
            
            return response
            
        except Exception as e:
            logger.error(f"Endpoint Error: {e}", exc_info=True)
            _audit_log(request, client_id, role, 500)
            return JSONResponse(
                status_code=500, 
                content={"detail": "Internal Server Error"}
            )
