"""
Agentic Logic — Tool definitions and agentic pipeline builder.
Implements tool-calling RAG with reasoning capabilities.
"""
import logging
from typing import List, Optional

logger = logging.getLogger(__name__)

# ═══════════════════════════════════════════════════════════
#  Tool Definitions
# ═══════════════════════════════════════════════════════════

AVAILABLE_TOOLS = {
    "Web Search": {
        "description": "Search the web for current information",
        "function": "_tool_web_search",
    },
    "Calculator": {
        "description": "Perform mathematical calculations",
        "function": "_tool_calculator",
    },
    "Ticket System": {
        "description": "Create, read, update support tickets",
        "function": "_tool_ticket_system",
    },
    "Calendar": {
        "description": "Check dates, schedule events",
        "function": "_tool_calendar",
    },
    "Weather API": {
        "description": "Get current weather for a location",
        "function": "_tool_weather",
    },
    "MCP Discovery": {
        "description": "Discover and invoke MCP server tools",
        "function": "_tool_mcp_discovery",
    },
}


def _tool_web_search(query: str) -> str:
    """Perform a web search using DuckDuckGo."""
    try:
        import requests
        resp = requests.get(
            "https://api.duckduckgo.com/",
            params={"q": query, "format": "json", "no_redirect": 1},
            timeout=10,
        )
        data = resp.json()
        abstract = data.get("AbstractText", "")
        if abstract:
            return f"Search result: {abstract}"
        related = data.get("RelatedTopics", [])
        if related and isinstance(related[0], dict):
            return f"Search result: {related[0].get('Text', 'No results found')}"
        return "No search results found."
    except Exception as e:
        return f"Web search error: {str(e)}"


def _tool_calculator(expression: str) -> str:
    """Safely evaluate a mathematical expression."""
    try:
        # Only allow safe math operations
        allowed = set("0123456789+-*/.() ")
        if not all(c in allowed for c in expression):
            return "Invalid characters in expression"
        result = eval(expression)  # Safe due to character whitelist
        return f"Calculation result: {expression} = {result}"
    except Exception as e:
        return f"Calculation error: {str(e)}"


def _tool_ticket_system(action: str) -> str:
    """Mock ticket system interaction."""
    return f"Ticket system: {action} — (mock response: ticket #12345 updated)"


def _tool_calendar(query: str) -> str:
    """Return current date/time info."""
    from datetime import datetime
    now = datetime.now()
    return f"Calendar: Current date is {now.strftime('%A, %B %d, %Y')} at {now.strftime('%I:%M %p')}"


def _tool_weather(location: str) -> str:
    """Get weather info (mock)."""
    return f"Weather for {location}: 24°C, partly cloudy, humidity 65%"


def _tool_mcp_discovery(query: str) -> str:
    """MCP tool discovery placeholder."""
    return "MCP Discovery: Found 3 available servers — knowledge-base, code-search, data-pipeline"


def execute_tool(tool_name: str, input_text: str) -> str:
    """Execute a specific tool by name."""
    tool_map = {
        "Web Search": _tool_web_search,
        "Calculator": _tool_calculator,
        "Ticket System": _tool_ticket_system,
        "Calendar": _tool_calendar,
        "Weather API": _tool_weather,
        "MCP Discovery": _tool_mcp_discovery,
    }

    func = tool_map.get(tool_name)
    if func:
        return func(input_text)
    return f"Unknown tool: {tool_name}"


def get_tool_descriptions(enabled_tools: List[str]) -> str:
    """Generate tool description string for the prompt."""
    descs = []
    for name in enabled_tools:
        tool = AVAILABLE_TOOLS.get(name)
        if tool:
            descs.append(f"- {name}: {tool['description']}")
    return "\n".join(descs)


def build_agentic_pipeline(document_store, config: dict):
    """
    Creates an Agentic RAG pipeline configuration.
    Returns enhanced config with tool context.
    """
    tools = config.get("dynamicConfig", {}).get("tools", [])
    tool_context = get_tool_descriptions(tools)

    return {
        "tools": tools,
        "tool_descriptions": tool_context,
        "reasoning_enabled": True,
    }
