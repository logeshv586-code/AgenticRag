"""
Agentic Logic — production-oriented tool registry and planning helpers.

The old implementation returned mock success responses for integrations that were
not configured. That is dangerous in customer deployments because the model can
claim it created a ticket, checked weather, or discovered an MCP server when it
actually did not. This module now exposes explicit capability/readiness metadata
and refuses unavailable tool execution.
"""
from __future__ import annotations

import ast
import logging
import operator
from datetime import datetime
from typing import Dict, List

logger = logging.getLogger(__name__)

AVAILABLE_TOOLS: Dict[str, dict] = {
    "Web Search": {
        "description": "Search the public web for current information",
        "function": "_tool_web_search",
        "status": "available",
        "requires": [],
        "side_effect": False,
    },
    "Calculator": {
        "description": "Perform safe arithmetic calculations",
        "function": "_tool_calculator",
        "status": "available",
        "requires": [],
        "side_effect": False,
    },
    "Calendar": {
        "description": "Read current date and time context",
        "function": "_tool_calendar",
        "status": "available",
        "requires": [],
        "side_effect": False,
    },
    "Ticket System": {
        "description": "Create, read or update support tickets through a configured connector",
        "function": None,
        "status": "requires_configuration",
        "requires": ["ticket_connector"],
        "side_effect": True,
    },
    "Weather API": {
        "description": "Read live weather through a configured provider",
        "function": None,
        "status": "requires_configuration",
        "requires": ["weather_provider"],
        "side_effect": False,
    },
    "MCP Discovery": {
        "description": "Discover and invoke tools exposed by configured MCP servers",
        "function": None,
        "status": "requires_configuration",
        "requires": ["mcp_servers"],
        "side_effect": True,
    },
}


def _tool_web_search(query: str) -> str:
    """Perform a lightweight DuckDuckGo instant-answer lookup."""
    try:
        import requests
        resp = requests.get(
            "https://api.duckduckgo.com/",
            params={"q": query, "format": "json", "no_redirect": 1, "no_html": 1},
            timeout=10,
        )
        resp.raise_for_status()
        data = resp.json()
        abstract = (data.get("AbstractText") or "").strip()
        if abstract:
            return abstract
        for item in data.get("RelatedTopics", []):
            if isinstance(item, dict) and item.get("Text"):
                return item["Text"]
        return "No useful instant-answer result was found."
    except Exception as exc:
        logger.warning("Web search failed: %s", exc)
        return "Web search is temporarily unavailable."


_ALLOWED_BINOPS = {
    ast.Add: operator.add,
    ast.Sub: operator.sub,
    ast.Mult: operator.mul,
    ast.Div: operator.truediv,
    ast.FloorDiv: operator.floordiv,
    ast.Mod: operator.mod,
    ast.Pow: operator.pow,
}
_ALLOWED_UNARY = {ast.UAdd: operator.pos, ast.USub: operator.neg}


def _eval_math(node):
    if isinstance(node, ast.Expression):
        return _eval_math(node.body)
    if isinstance(node, ast.Constant) and isinstance(node.value, (int, float)):
        return node.value
    if isinstance(node, ast.BinOp) and type(node.op) in _ALLOWED_BINOPS:
        left, right = _eval_math(node.left), _eval_math(node.right)
        if isinstance(node.op, ast.Pow) and abs(right) > 12:
            raise ValueError("Exponent too large")
        return _ALLOWED_BINOPS[type(node.op)](left, right)
    if isinstance(node, ast.UnaryOp) and type(node.op) in _ALLOWED_UNARY:
        return _ALLOWED_UNARY[type(node.op)](_eval_math(node.operand))
    raise ValueError("Unsupported expression")


def _tool_calculator(expression: str) -> str:
    """Evaluate arithmetic without eval()."""
    try:
        tree = ast.parse(expression, mode="eval")
        result = _eval_math(tree)
        return f"{expression} = {result}"
    except Exception as exc:
        return f"Calculation could not be completed: {exc}"


def _tool_calendar(_: str) -> str:
    now = datetime.now().astimezone()
    return now.isoformat(timespec="seconds")


def get_tool_readiness(enabled_tools: List[str], runtime_config: dict | None = None) -> List[dict]:
    """Return truthful readiness for every requested tool."""
    runtime_config = runtime_config or {}
    configured = runtime_config.get("configuredCapabilities", {})
    results = []
    for name in enabled_tools:
        spec = AVAILABLE_TOOLS.get(name)
        if not spec:
            results.append({"name": name, "status": "unknown", "ready": False, "reason": "Tool is not registered"})
            continue
        missing = [req for req in spec.get("requires", []) if not configured.get(req)]
        ready = spec["status"] == "available" or not missing
        results.append({
            "name": name,
            "status": "ready" if ready else "requires_configuration",
            "ready": ready,
            "requires": spec.get("requires", []),
            "missing": missing,
            "side_effect": bool(spec.get("side_effect")),
            "description": spec["description"],
        })
    return results


def execute_tool(tool_name: str, input_text: str, runtime_config: dict | None = None) -> str:
    """Execute only tools that are genuinely available/configured."""
    readiness = get_tool_readiness([tool_name], runtime_config)[0]
    if not readiness["ready"]:
        missing = ", ".join(readiness.get("missing", [])) or "required connector"
        return f"Tool '{tool_name}' is not configured. Missing: {missing}. No action was performed."

    tool_map = {
        "Web Search": _tool_web_search,
        "Calculator": _tool_calculator,
        "Calendar": _tool_calendar,
    }
    func = tool_map.get(tool_name)
    if not func:
        return f"Tool '{tool_name}' requires an external connector executor. No action was performed."
    return func(input_text)


def get_tool_descriptions(enabled_tools: List[str], runtime_config: dict | None = None) -> str:
    readiness = {item["name"]: item for item in get_tool_readiness(enabled_tools, runtime_config)}
    lines = []
    for name in enabled_tools:
        spec = AVAILABLE_TOOLS.get(name)
        if spec:
            state = readiness[name]["status"]
            lines.append(f"- {name} [{state}]: {spec['description']}")
    return "\n".join(lines)


def build_agentic_pipeline(document_store, config: dict):
    """Create truthful agentic execution metadata consumed by the RAG pipeline."""
    dynamic = config.get("dynamicConfig", {}) or {}
    tools = dynamic.get("tools", []) or []
    readiness = get_tool_readiness(tools, dynamic)
    ready_tools = [x["name"] for x in readiness if x["ready"]]
    blocked_tools = [x for x in readiness if not x["ready"]]

    return {
        "tools": ready_tools,
        "requested_tools": tools,
        "blocked_tools": blocked_tools,
        "tool_descriptions": get_tool_descriptions(tools, dynamic),
        "reasoning_enabled": True,
        "planning_policy": {
            "retrieve_before_generate": True,
            "require_evidence_for_factual_claims": True,
            "allow_unconfigured_tool_fallback": False,
            "side_effect_tools_require_confirmation": True,
            "max_tool_steps": int(dynamic.get("maxToolSteps", 5)),
            "stop_when_answer_supported": True,
        },
    }
