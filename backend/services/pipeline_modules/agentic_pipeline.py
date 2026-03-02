"""
Agentic Pipeline — Tool-calling RAG with planning, tool execution, and reasoning.
Pipeline: Query → Planner → Tool Selection → Tool Execution → Retriever → LLM → Response

Features:
  - Tool registry with configurable enabled tools
  - Multi-step reasoning loop with max step limit
  - Planner component that decides whether to use tools
  - Action executor that runs tools and feeds results into context
"""
import logging
from typing import List, Optional

from haystack import Pipeline
from haystack.components.builders import PromptBuilder

from ..agentic_logic import AVAILABLE_TOOLS, execute_tool, get_tool_descriptions

logger = logging.getLogger(__name__)


# ═══════════════════════════════════════════════════════════
#  Planner Component
# ═══════════════════════════════════════════════════════════

class PlannerComponent:
    """
    Analyzes the query and decides which tools to use.
    Returns a structured plan with tool calls.
    """

    def __init__(self, enabled_tools: List[str], max_steps: int = 5):
        self.enabled_tools = enabled_tools
        self.max_steps = max_steps

    def create_plan(self, query: str) -> dict:
        """Analyze the query and decide on tool usage."""
        plan = {
            "query": query,
            "requires_tools": False,
            "tool_calls": [],
            "reasoning": "",
        }

        query_lower = query.lower()

        # Rule-based planning (can be upgraded to LLM-based planning)
        for tool_name in self.enabled_tools:
            if tool_name == "Web Search" and any(kw in query_lower for kw in
                ["search", "find", "latest", "current", "news", "what is", "who is"]):
                plan["tool_calls"].append({"tool": "Web Search", "input": query})
                plan["requires_tools"] = True

            elif tool_name == "Calculator" and any(kw in query_lower for kw in
                ["calculate", "compute", "math", "sum", "total", "+", "-", "*", "/"]):
                # Extract math expression
                plan["tool_calls"].append({"tool": "Calculator", "input": query})
                plan["requires_tools"] = True

            elif tool_name == "Calendar" and any(kw in query_lower for kw in
                ["date", "time", "today", "schedule", "calendar", "when"]):
                plan["tool_calls"].append({"tool": "Calendar", "input": query})
                plan["requires_tools"] = True

            elif tool_name == "Weather API" and any(kw in query_lower for kw in
                ["weather", "temperature", "forecast", "rain", "climate"]):
                plan["tool_calls"].append({"tool": "Weather API", "input": query})
                plan["requires_tools"] = True

            elif tool_name == "Ticket System" and any(kw in query_lower for kw in
                ["ticket", "issue", "bug", "support", "request"]):
                plan["tool_calls"].append({"tool": "Ticket System", "input": query})
                plan["requires_tools"] = True

            elif tool_name == "MCP Discovery" and any(kw in query_lower for kw in
                ["mcp", "discover", "server", "available tools"]):
                plan["tool_calls"].append({"tool": "MCP Discovery", "input": query})
                plan["requires_tools"] = True

        if plan["requires_tools"]:
            tools_used = [tc["tool"] for tc in plan["tool_calls"]]
            plan["reasoning"] = f"Query analysis suggests using: {', '.join(tools_used)}"
        else:
            plan["reasoning"] = "No tools needed — using retrieval-only approach."

        return plan


# ═══════════════════════════════════════════════════════════
#  Action Executor
# ═══════════════════════════════════════════════════════════

class ActionExecutor:
    """Executes tool calls from the planner and collects results."""

    def __init__(self, timeout: int = 30):
        self.timeout = timeout

    def execute_plan(self, plan: dict) -> List[dict]:
        """Execute all tool calls in the plan and return results."""
        results = []
        for call in plan.get("tool_calls", []):
            tool_name = call["tool"]
            input_text = call["input"]
            try:
                output = execute_tool(tool_name, input_text)
                results.append({
                    "tool": tool_name,
                    "input": input_text,
                    "output": output,
                    "success": True,
                })
                logger.info(f"Agentic: Tool '{tool_name}' executed successfully")
            except Exception as e:
                results.append({
                    "tool": tool_name,
                    "input": input_text,
                    "output": f"Error: {str(e)}",
                    "success": False,
                })
                logger.error(f"Agentic: Tool '{tool_name}' failed: {e}")
        return results


# ═══════════════════════════════════════════════════════════
#  Agentic Pipeline Builder
# ═══════════════════════════════════════════════════════════

def build_agentic_pipeline(document_store, config: dict, retriever, generator) -> dict:
    """
    Build an agentic RAG pipeline with planning and tool execution.

    Pipeline flow:
        Query → Planner → Tool Execution → Retriever → LLM (with tool context) → Response
    """
    dynamic_cfg = config.get("dynamicConfig", {})
    enabled_tools = dynamic_cfg.get("tools", list(AVAILABLE_TOOLS.keys()))
    max_steps = dynamic_cfg.get("maxReasoningSteps", 5)
    tool_timeout = dynamic_cfg.get("toolTimeout", 30)

    planner = PlannerComponent(enabled_tools=enabled_tools, max_steps=max_steps)
    executor = ActionExecutor(timeout=tool_timeout)

    # Build the inner retrieval + generation pipeline
    pipeline = Pipeline()
    pipeline.add_component("retriever", retriever)

    tool_descs = get_tool_descriptions(enabled_tools)
    template = f"""You are an intelligent AI agent that can reason, plan, and use tools.

Available tools:
{tool_descs}

Tool execution results (if any):
{{{{ tool_results }}}}

Context from knowledge base:
{{% for document in documents %}}
    {{{{ document.content }}}}
{{% endfor %}}

Think step-by-step about how to answer this query. Incorporate tool results if available.

Question: {{{{ query }}}}
Reasoning and Answer:"""

    prompt_builder = PromptBuilder(template=template)
    pipeline.add_component("prompt_builder", prompt_builder)
    pipeline.add_component("llm", generator)

    pipeline.connect("retriever.documents", "prompt_builder.documents")
    pipeline.connect("prompt_builder", "llm")

    return {
        "pipeline": pipeline,
        "planner": planner,
        "executor": executor,
        "meta": {
            "enabled_tools": enabled_tools,
            "max_steps": max_steps,
            "tool_timeout": tool_timeout,
        },
    }


def execute_agentic_query(pipeline_info: dict, query: str) -> str:
    """
    Execute a query through the agentic pipeline with planning and tool execution.
    """
    planner = pipeline_info["planner"]
    executor = pipeline_info["executor"]
    pipeline = pipeline_info["pipeline"]

    # Step 1: Plan
    plan = planner.create_plan(query)
    logger.info(f"Agentic: Plan created — {plan['reasoning']}")

    # Step 2: Execute tools
    tool_results_text = "No tools were used."
    if plan["requires_tools"]:
        results = executor.execute_plan(plan)
        tool_lines = []
        for r in results:
            status = "✓" if r["success"] else "✗"
            tool_lines.append(f"[{status}] {r['tool']}: {r['output']}")
        tool_results_text = "\n".join(tool_lines)

    # Step 3: Run RAG pipeline with tool context
    try:
        result = pipeline.run({
            "retriever": {"query": query},
            "prompt_builder": {
                "query": query,
                "tool_results": tool_results_text,
            },
        })
        answer = result.get("llm", {}).get("replies", ["No response generated."])[0]
    except Exception as e:
        logger.error(f"Agentic pipeline error: {e}")
        answer = f"Error: {str(e)}"

    return answer


def get_agentic_graph_nodes() -> dict:
    """Return visualization nodes specific to agentic pipeline."""
    return {
        "extra_nodes": [
            {"id": "planner", "label": "Query Planner", "type": "processor"},
            {"id": "tool_registry", "label": "Tool Registry", "type": "tool"},
            {"id": "action_executor", "label": "Action Executor", "type": "tool"},
        ],
        "extra_edges": [
            {"source": "ingestion", "target": "planner"},
            {"source": "planner", "target": "tool_registry"},
            {"source": "tool_registry", "target": "action_executor"},
            {"source": "action_executor", "target": "embedder"},
        ],
        "remove_edges": [
            {"source": "ingestion", "target": "embedder"},
        ],
    }
