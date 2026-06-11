"""Dynatrace access for Keeper.

Two paths into the same Dynatrace MCP server:

1. A direct MCP client used for deterministic steps (detection query, sending
   events, posting to Slack, filing the postmortem notebook). These need
   predictable inputs and outputs, so we call the tools programmatically.
2. An ADK McpToolset, handed to the Gemini reasoning agents so they can explore
   Grail and Davis CoPilot freely while diagnosing.

Both talk to the official server: @dynatrace-oss/dynatrace-mcp-server.
"""

from __future__ import annotations

import asyncio
import json
import re
import shutil
import sys

from .config import settings

MCP_PACKAGE = "@dynatrace-oss/dynatrace-mcp-server@latest"


def _npx() -> str:
    exe = shutil.which("npx") or shutil.which("npx.cmd")
    if exe:
        return exe
    return "npx.cmd" if sys.platform.startswith("win") else "npx"


def _server_args() -> list[str]:
    return ["-y", MCP_PACKAGE]


# --------------------------------------------------------------------------
# Direct MCP client (deterministic tool calls)
# --------------------------------------------------------------------------

def _extract_text(result) -> str:
    """Flatten an MCP tool result into plain text."""
    parts: list[str] = []
    content = getattr(result, "content", None) or []
    for item in content:
        text = getattr(item, "text", None)
        if text:
            parts.append(text)
    return "\n".join(parts).strip()


async def call_tool(name: str, arguments: dict, timeout: float = 60.0) -> str:
    """Open a short-lived MCP session, call one tool, return its text output."""
    from mcp import ClientSession, StdioServerParameters
    from mcp.client.stdio import stdio_client

    params = StdioServerParameters(
        command=_npx(), args=_server_args(), env=settings.mcp_env()
    )
    async with stdio_client(params) as (read, write):
        async with ClientSession(read, write) as session:
            await session.initialize()
            result = await asyncio.wait_for(
                session.call_tool(name, arguments), timeout=timeout
            )
            return _extract_text(result)


def _extract_records(text: str) -> list[dict]:
    """The Dynatrace MCP wraps DQL results in a JSON block. Pull the records out."""
    fenced = re.search(r"```json\s*(\[.*?\])\s*```", text, re.DOTALL)
    fragment = fenced.group(1) if fenced else None
    if fragment is None:
        start, end = text.find("["), text.rfind("]")
        if start != -1 and end != -1 and end > start:
            fragment = text[start : end + 1]
    if not fragment:
        return []
    try:
        data = json.loads(fragment)
        return data if isinstance(data, list) else []
    except Exception:
        return []


def _num(value) -> float | None:
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


DETECTION_DQL = (
    'fetch logs, from: -5m\n'
    '| filter service.name == "{service}"\n'
    '| summarize p95 = percentile(duration_ms, 95), '
    'total = count(), '
    'errors = countIf(toLong(http.status_code) >= 500)\n'
    '| fieldsAdd error_rate = if(total > 0, toDouble(errors) / toDouble(total), else: 0.0)'
)


async def query_health(service: str) -> dict | None:
    """Run the detection DQL through MCP and parse p95 and error rate.

    Returns None if the query yields nothing usable, so the caller can fall
    back to another signal rather than guessing.
    """
    dql = DETECTION_DQL.format(service=service)
    try:
        text = await call_tool("execute_dql", {"dqlStatement": dql})
    except Exception:
        return None

    records = _extract_records(text)
    if not records:
        return None
    record = records[0]
    p95 = _num(record.get("p95"))
    error_rate = _num(record.get("error_rate"))
    total = _num(record.get("total"))
    if p95 is None and error_rate is None:
        return None
    return {
        "p95_ms": p95 or 0.0,
        "error_rate": error_rate or 0.0,
        "total": int(total or 0),
        "raw": text[:1500],
    }


async def send_event(title: str, description: str, properties: dict | None = None) -> bool:
    payload = {
        "eventType": "CUSTOM_INFO",
        "title": title,
        "properties": {"description": description, **(properties or {})},
    }
    try:
        await call_tool("send_event", payload, timeout=40)
        return True
    except Exception:
        return False


async def send_slack(message: str) -> bool:
    if not settings.slack_connection_id:
        return False
    args = {"connectionId": settings.slack_connection_id, "message": message}
    try:
        await call_tool("send_slack_message", args, timeout=40)
        return True
    except Exception:
        return False


async def create_notebook(title: str, markdown: str) -> str | None:
    """File the postmortem as a Dynatrace notebook. Returns a link if available."""
    args = {"name": title, "markdown": markdown, "content": markdown}
    try:
        text = await call_tool("create_dynatrace_notebook", args, timeout=60)
    except Exception:
        return None
    match = re.search(r"https?://\S+", text or "")
    return match.group(0) if match else (text[:200] if text else None)


# --------------------------------------------------------------------------
# ADK toolset (handed to the Gemini reasoning agents)
# --------------------------------------------------------------------------

def build_toolset():
    """Construct an ADK McpToolset bound to the Dynatrace MCP server."""
    from google.adk.tools.mcp_tool import McpToolset
    from google.adk.tools.mcp_tool.mcp_session_manager import StdioConnectionParams
    from mcp import StdioServerParameters

    return McpToolset(
        connection_params=StdioConnectionParams(
            server_params=StdioServerParameters(
                command=_npx(), args=_server_args(), env=settings.mcp_env()
            ),
            timeout=90,
        ),
    )
