"""Production Agentic RAG: retrieval-first, LLM planning, safe tool execution, verification."""
from __future__ import annotations

import json
import logging
import re
from typing import List

from haystack import Pipeline
from haystack.components.builders import PromptBuilder

from ..agentic_logic import execute_tool, get_tool_readiness, get_tool_descriptions

logger = logging.getLogger(__name__)
_JSON_RE = re.compile(r"\{.*\}", re.DOTALL)


def _generator_reply(generator, prompt: str) -> str:
    try:
        result = generator.run(prompt=prompt)
        replies = result.get("replies", [])
        return str(replies[0]).strip() if replies else ""
    except Exception as exc:
        logger.warning("Agentic planner generator failed: %s", exc)
        return ""


def _retrieve(retriever, query: str, top_k: int = 6):
    try:
        result = retriever.run(query=query)
        return list(result.get("documents", []))[:top_k]
    except Exception:
        return []


class LLMPlanner:
    def __init__(self, generator, enabled_tools: List[str], runtime_config: dict, max_steps: int = 5):
        self.generator = generator
        self.enabled_tools = enabled_tools
        self.runtime_config = runtime_config
        self.max_steps = max(1, min(int(max_steps), 8))

    def _fallback_plan(self, query: str) -> dict:
        q = query.lower()
        calls = []
        if "Calculator" in self.enabled_tools and any(x in q for x in ("calculate", "compute", "+", "-", "*", "/", "total")):
            calls.append({"tool": "Calculator", "input": query})
        if "Calendar" in self.enabled_tools and any(x in q for x in ("today", "date", "time", "when", "calendar")):
            calls.append({"tool": "Calendar", "input": query})
        if "Web Search" in self.enabled_tools and any(x in q for x in ("latest", "current", "news", "search the web", "online")):
            calls.append({"tool": "Web Search", "input": query})
        return {"goal": query, "tool_calls": calls[: self.max_steps], "reason": "Deterministic safe fallback plan."}

    def create_plan(self, query: str, evidence_preview: str) -> dict:
        readiness = get_tool_readiness(self.enabled_tools, self.runtime_config)
        ready = [item["name"] for item in readiness if item.get("ready")]
        prompt = f"""You are the planning layer of a retrieval-first enterprise RAG.
Use tools only when retrieved evidence is insufficient or computation/current external information is truly needed.
Return JSON only in this schema:
{{"goal":"...","tool_calls":[{{"tool":"Calculator","input":"..."}}],"reason":"..."}}
Maximum tool calls: {self.max_steps}
Allowed ready tools: {ready}
Retrieved evidence preview:
{evidence_preview[:5000]}
User request: {query}
"""
        raw = _generator_reply(self.generator, prompt)
        try:
            match = _JSON_RE.search(raw)
            parsed = json.loads(match.group(0) if match else raw)
            calls = []
            for call in parsed.get("tool_calls", [])[: self.max_steps]:
                tool = str(call.get("tool", ""))
                if tool in ready:
                    calls.append({"tool": tool, "input": str(call.get("input") or query)})
            return {"goal": parsed.get("goal") or query, "tool_calls": calls, "reason": parsed.get("reason", "LLM plan")}
        except Exception:
            return self._fallback_plan(query)


class SafeActionExecutor:
    def __init__(self, runtime_config: dict):
        self.runtime_config = runtime_config

    def execute(self, calls: List[dict]) -> List[dict]:
        out = []
        readiness = {x["name"]: x for x in get_tool_readiness([c["tool"] for c in calls], self.runtime_config)}
        confirmed = set(self.runtime_config.get("confirmedSideEffectTools", []) or [])
        for call in calls:
            tool = call["tool"]
            ready = readiness.get(tool, {})
            if not ready.get("ready"):
                out.append({"tool": tool, "success": False, "output": "Tool is not configured; no action was performed."})
                continue
            if ready.get("side_effect") and tool not in confirmed:
                out.append({"tool": tool, "success": False, "output": "Side-effect tool requires explicit confirmation; no action was performed."})
                continue
            text = execute_tool(tool, call.get("input", ""), self.runtime_config)
            success = "No action was performed" not in text and "not configured" not in text.lower()
            out.append({"tool": tool, "success": success, "output": text})
        return out


def build_agentic_pipeline(document_store, config: dict, retriever, generator) -> dict:
    dynamic = config.get("dynamicConfig", {}) or {}
    requested = dynamic.get("tools", ["Calculator", "Calendar"]) or []
    readiness = get_tool_readiness(requested, dynamic)
    enabled = [x["name"] for x in readiness if x.get("ready")]
    planner = LLMPlanner(generator, enabled, dynamic, dynamic.get("maxReasoningSteps", 5))
    executor = SafeActionExecutor(dynamic)

    pipeline = Pipeline()
    pipeline.add_component("retriever", retriever)
    template = """You are an evidence-first agentic assistant.
Retrieved knowledge:
{% for document in documents %}
{{ document.content }}
{% endfor %}

Verified tool results:
{{ tool_results }}

Question: {{ query }}
Answer only with claims supported by retrieved knowledge or successful tool results. If evidence is insufficient, say so. Do not claim an action happened when a tool result says it did not.
Answer:"""
    pipeline.add_component("prompt_builder", PromptBuilder(template=template))
    pipeline.add_component("llm", generator)
    pipeline.connect("retriever.documents", "prompt_builder.documents")
    pipeline.connect("prompt_builder.prompt", "llm.prompt")

    return {
        "pipeline": pipeline,
        "planner": planner,
        "executor": executor,
        "retriever": retriever,
        "generator": generator,
        "runtime_config": dynamic,
        "meta": {
            "requested_tools": requested,
            "ready_tools": enabled,
            "blocked_tools": [x for x in readiness if not x.get("ready")],
            "tool_descriptions": get_tool_descriptions(requested, dynamic),
            "planning": "llm-with-deterministic-fallback",
            "retrieve_before_plan": True,
            "verify_after_generate": True,
        },
    }


def execute_agentic_query(pipeline_info: dict, query: str) -> str:
    retriever = pipeline_info["retriever"]
    generator = pipeline_info["generator"]
    docs = _retrieve(retriever, query, top_k=8)
    evidence = "\n\n".join((getattr(d, "content", "") or "") for d in docs)
    plan = pipeline_info["planner"].create_plan(query, evidence)
    tool_results = pipeline_info["executor"].execute(plan.get("tool_calls", []))
    tool_text = "\n".join(f"- {r['tool']} ({'ok' if r['success'] else 'blocked/failed'}): {r['output']}" for r in tool_results) or "No tools were needed."

    answer = ""
    try:
        result = pipeline_info["pipeline"].run({
            "retriever": {"query": query},
            "prompt_builder": {"query": query, "tool_results": tool_text},
        })
        replies = result.get("llm", {}).get("replies", [])
        answer = str(replies[0]).strip() if replies else ""
    except Exception:
        answer = _generator_reply(generator, f"""Retrieved evidence:\n{evidence[:10000]}\n\nTool results:\n{tool_text}\n\nQuestion: {query}\nGive a grounded answer. If evidence is insufficient, say so.""")

    verification = _generator_reply(generator, f"""Act as a strict verifier. Check whether every factual claim in the candidate answer is supported by the supplied evidence or successful tool results. If unsupported, rewrite the answer removing unsupported claims. Return only the verified answer.
Evidence:\n{evidence[:9000]}\nTool results:\n{tool_text}\nCandidate answer:\n{answer}""")
    return verification or answer or "No grounded answer could be generated."


def get_agentic_graph_nodes() -> dict:
    return {
        "extra_nodes": [
            {"id": "planner", "label": "LLM Planner", "type": "processor"},
            {"id": "tool_registry", "label": "Truthful Tool Registry", "type": "tool"},
            {"id": "verifier", "label": "Grounding Verifier", "type": "processor"},
        ],
        "extra_edges": [
            {"source": "retriever", "target": "planner"},
            {"source": "planner", "target": "tool_registry"},
            {"source": "tool_registry", "target": "llm"},
            {"source": "llm", "target": "verifier"},
        ],
        "remove_edges": [],
    }
