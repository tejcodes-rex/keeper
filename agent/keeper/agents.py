"""Gemini reasoning agents built on Google ADK.

The reasoning-heavy phases (diagnosis, strategy, postmortem) run as ADK
LlmAgents on Gemini 3.1 Pro. The diagnosis agent also carries the Dynatrace
MCP toolset so it can explore Grail and Davis CoPilot while it thinks.
"""

from __future__ import annotations

import json
import re

from .config import settings


def parse_json(text: str, default: dict) -> dict:
    """Lenient JSON extraction from a model response."""
    if not text:
        return default
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```[a-zA-Z]*", "", cleaned).strip()
        cleaned = cleaned.rstrip("`").strip()
    start = cleaned.find("{")
    end = cleaned.rfind("}")
    if start != -1 and end != -1 and end > start:
        try:
            return json.loads(cleaned[start : end + 1])
        except Exception:
            pass
    return default


async def run_agent(name: str, instruction: str, with_tools: bool = False) -> str:
    """Run a single ADK agent to completion and return its final text.

    The task is carried in the agent instruction; the kickoff message just
    tells it to begin. The Dynatrace toolset, when attached, is closed cleanly
    on the way out so the MCP process does not leak.
    """
    from google.adk.agents import LlmAgent
    from google.adk.runners import Runner
    from google.adk.sessions import InMemorySessionService
    from google.genai import types

    toolset = None
    tools: list = []
    if with_tools:
        from .dynatrace import build_toolset

        toolset = build_toolset()
        tools = [toolset]

    agent = LlmAgent(
        model=settings.model,
        name=name,
        instruction=instruction,
        tools=tools,
    )
    session_service = InMemorySessionService()
    session = await session_service.create_session(
        state={}, app_name="keeper", user_id="keeper"
    )
    runner = Runner(
        app_name="keeper", agent=agent, session_service=session_service
    )

    final_parts: list[str] = []
    try:
        async for event in runner.run_async(
            session_id=session.id,
            user_id=session.user_id,
            new_message=types.Content(
                role="user", parts=[types.Part(text="Begin your task now.")]
            ),
        ):
            is_final = getattr(event, "is_final_response", None)
            if callable(is_final) and event.is_final_response():
                content = getattr(event, "content", None)
                if content and getattr(content, "parts", None):
                    for part in content.parts:
                        if getattr(part, "text", None):
                            final_parts.append(part.text)
    finally:
        if toolset is not None:
            try:
                await toolset.close()
            except Exception:
                pass

    return "".join(final_parts).strip()
