"""Keeper: an autonomous Site Reliability Engineer.

Keeper watches a live service through Dynatrace, detects incidents, finds the
root cause, measures business impact, proposes a fix for a human to approve,
executes it, verifies recovery, and writes the postmortem. Reasoning runs on
Gemini 3.1 Pro through Google ADK. Observation and action run through the
Dynatrace MCP server.
"""

try:
    from dotenv import load_dotenv

    load_dotenv()
except Exception:
    pass

__version__ = "1.0.0"
