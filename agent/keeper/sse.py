"""A tiny in-process event bus that fans Keeper run events out to SSE clients.

One run is active at a time, which is all the demo needs. Late subscribers get
the run history replayed so a viewer who opens Mission Control mid-incident
still sees the full story.
"""

from __future__ import annotations

import asyncio
import json
import time


def now_ms() -> int:
    return int(time.time() * 1000)


class EventBus:
    def __init__(self) -> None:
        self._subscribers: set[asyncio.Queue] = set()
        self._history: list[dict] = []

    async def publish(self, event: dict) -> None:
        event.setdefault("ts", now_ms())
        self._history.append(event)
        for queue in list(self._subscribers):
            queue.put_nowait(event)

    async def subscribe(self) -> asyncio.Queue:
        queue: asyncio.Queue = asyncio.Queue()
        for event in self._history:
            queue.put_nowait(event)
        self._subscribers.add(queue)
        return queue

    def unsubscribe(self, queue: asyncio.Queue) -> None:
        self._subscribers.discard(queue)

    def reset(self) -> None:
        """Clear history at the start of a new run."""
        self._history.clear()


def sse_format(event: dict) -> str:
    return f"data: {json.dumps(event)}\n\n"


# Shared singleton for the process.
bus = EventBus()
