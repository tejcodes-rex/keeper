"""Dynatrace telemetry for the World Cup Fan Gateway.

Reads configuration from the environment:
  DT_INGEST_BASE  e.g. https://abc12345.live.dynatrace.com
  DT_API_TOKEN    a Dynatrace API token with log and event ingest scope

If either is missing the module runs in OFFLINE mode. Every telemetry call
becomes a no-op that logs locally instead of hitting the network. Telemetry
failures are always swallowed so they can never crash or slow the service.
"""

from __future__ import annotations

import logging
import os
from datetime import datetime, timezone
from typing import Any, Optional

import httpx

logger = logging.getLogger("worldcup.telemetry")

SERVICE_NAME = "worldcup-fan-gateway"

DT_INGEST_BASE = os.getenv("DT_INGEST_BASE", "").rstrip("/")
DT_API_TOKEN = os.getenv("DT_API_TOKEN", "")

# Offline mode is on whenever we are missing either piece of config.
OFFLINE = not (DT_INGEST_BASE and DT_API_TOKEN)

# Short timeout so telemetry never stalls a request or a deploy.
_TIMEOUT = httpx.Timeout(2.0)

# A single shared async client, created lazily on first use.
_client: Optional[httpx.AsyncClient] = None


def is_offline() -> bool:
    """True when no Dynatrace config is present."""
    return OFFLINE


def _now_iso() -> str:
    """Current time as an ISO 8601 string with timezone."""
    return datetime.now(timezone.utc).isoformat()


def _get_client() -> httpx.AsyncClient:
    global _client
    if _client is None:
        _client = httpx.AsyncClient(timeout=_TIMEOUT)
    return _client


async def aclose() -> None:
    """Close the shared client. Safe to call on shutdown."""
    global _client
    if _client is not None:
        try:
            await _client.aclose()
        except Exception:  # pragma: no cover - defensive
            pass
        _client = None


def _headers() -> dict[str, str]:
    return {
        "Authorization": f"Api-Token {DT_API_TOKEN}",
        "Content-Type": "application/json",
    }


async def send_log(
    *,
    endpoint: str,
    status_code: int,
    duration_ms: float,
    version: str,
    level: str,
    message: Optional[str] = None,
) -> None:
    """Fire-and-forget a single structured log line to Dynatrace.

    Designed to be scheduled as a background task. Never raises.
    """
    duration_ms = round(float(duration_ms), 2)
    content = message or (
        f"{SERVICE_NAME} {endpoint} -> {status_code} in {duration_ms}ms "
        f"(version={version})"
    )
    record: dict[str, Any] = {
        "content": content,
        "service.name": SERVICE_NAME,
        "endpoint": endpoint,
        "http.status_code": status_code,
        "duration_ms": duration_ms,
        "deploy.version": version,
        "log.level": level,
        "timestamp": _now_iso(),
    }

    if OFFLINE:
        logger.info("[offline log] %s", content)
        return

    try:
        client = _get_client()
        resp = await client.post(
            f"{DT_INGEST_BASE}/api/v2/logs/ingest",
            headers=_headers(),
            json=[record],
        )
        if resp.status_code >= 400:
            logger.warning(
                "log ingest returned %s: %s", resp.status_code, resp.text[:200]
            )
    except Exception as exc:  # swallow everything
        logger.warning("log ingest failed: %s", exc)


async def send_event(
    *,
    title: str,
    version: str,
    faulty: bool,
    deployment_name: str,
    entity_selector: Optional[str] = None,
) -> None:
    """Emit a deployment or info event to Dynatrace. Never raises.

    When no entity selector is supplied we fall back to CUSTOM_INFO so the
    event still lands without referencing an unknown entity.
    """
    properties: dict[str, Any] = {
        "deploy.version": version,
        "faulty": str(faulty).lower(),
        "dt.event.deployment.name": deployment_name,
    }

    if entity_selector:
        body: dict[str, Any] = {
            "eventType": "CUSTOM_DEPLOYMENT",
            "title": title,
            "entitySelector": entity_selector,
            "properties": properties,
        }
    else:
        body = {
            "eventType": "CUSTOM_INFO",
            "title": title,
            "properties": properties,
        }

    if OFFLINE:
        logger.info("[offline event] %s | %s", title, properties)
        return

    try:
        client = _get_client()
        resp = await client.post(
            f"{DT_INGEST_BASE}/api/v2/events/ingest",
            headers=_headers(),
            json=body,
        )
        if resp.status_code >= 400:
            logger.warning(
                "event ingest returned %s: %s", resp.status_code, resp.text[:200]
            )
    except Exception as exc:  # swallow everything
        logger.warning("event ingest failed: %s", exc)
