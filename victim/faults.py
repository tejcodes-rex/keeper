"""Fault injection for the World Cup Fan Gateway.

When the current deploy is marked faulty the three data endpoints degrade in a
realistic way: most requests get slow, a few stay normal, and a slice of
requests fail outright with a 500. The goal is a p95 latency around
900-1500ms and an error rate around 20-30 percent, which is what the Keeper
agent learns to detect and diagnose through Dynatrace.
"""

from __future__ import annotations

import asyncio
import random

# Healthy latency windows per endpoint, in seconds. Tuned to the spec:
# tickets/stream sit at roughly 40-90ms, score is a touch faster at 30-70ms.
HEALTHY_LATENCY_S: dict[str, tuple[float, float]] = {
    "/api/tickets": (0.040, 0.090),
    "/api/stream": (0.040, 0.090),
    "/api/score": (0.030, 0.070),
}

# Probability that a faulty request fails with a 500.
FAULTY_ERROR_RATE = 0.25

# Probability that a faulty request still runs at normal speed. The rest get
# the slow path, which is what pushes p95 into the 900-1500ms band.
FAULTY_FAST_FRACTION = 0.15

# Slow path latency window, in seconds.
FAULTY_SLOW_LATENCY_S = (0.850, 1.500)


def _healthy_window(endpoint: str) -> tuple[float, float]:
    return HEALTHY_LATENCY_S.get(endpoint, (0.040, 0.090))


async def apply_healthy_latency(endpoint: str) -> None:
    """Sleep for a normal, fast amount of time."""
    low, high = _healthy_window(endpoint)
    await asyncio.sleep(random.uniform(low, high))


async def apply_faulty_latency(endpoint: str) -> None:
    """Sleep for the degraded amount of time.

    Most requests take the slow path, a small fraction stay fast. This mix is
    what produces a believable p95 spike rather than a flat slowdown.
    """
    if random.random() < FAULTY_FAST_FRACTION:
        await apply_healthy_latency(endpoint)
        return
    low, high = FAULTY_SLOW_LATENCY_S
    await asyncio.sleep(random.uniform(low, high))


def should_error() -> bool:
    """True when a faulty request should fail with a 500."""
    return random.random() < FAULTY_ERROR_RATE
