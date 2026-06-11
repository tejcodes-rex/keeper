"""Client for the protected service (the World Cup fan gateway).

Keeper reads the gateway health as a ground-truth fallback for detection, and
calls its rollback endpoint as the remediation action.
"""

from __future__ import annotations

import httpx

from .config import settings


async def get_state() -> dict | None:
    if not settings.victim_base_url:
        return None
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.get(f"{settings.victim_base_url}/api/health")
            resp.raise_for_status()
            return resp.json()
    except Exception:
        return None


async def rollback() -> dict | None:
    if not settings.victim_base_url:
        return None
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(f"{settings.victim_base_url}/admin/rollback")
            resp.raise_for_status()
            return resp.json()
    except Exception:
        return None


async def deploy(version: str, faulty: bool) -> dict | None:
    """Used by the demo trigger to ship a bad build before a Keeper run."""
    if not settings.victim_base_url:
        return None
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(
                f"{settings.victim_base_url}/admin/deploy",
                json={"version": version, "faulty": faulty},
            )
            resp.raise_for_status()
            return resp.json()
    except Exception:
        return None
