"""Steady baseline load generator for the World Cup Fan Gateway.

Continuously hits the three data endpoints at a configurable rate so there is
always live traffic and telemetry flowing into Dynatrace. Prints a running
tally of requests, errors, and rolling latency.

Environment:
  BASE_URL   target gateway base URL (default http://localhost:8080)
  RPS        total requests per second across all endpoints (default 5)

Run:
  python loadgen.py
"""

from __future__ import annotations

import asyncio
import os
import random
import time

import httpx

BASE_URL = os.getenv("BASE_URL", "http://localhost:8080").rstrip("/")
RPS = float(os.getenv("RPS", "5"))

ENDPOINTS = ["/api/tickets", "/api/stream", "/api/score"]


class Tally:
    def __init__(self) -> None:
        self.total = 0
        self.ok = 0
        self.errors = 0
        self.latency_sum_ms = 0.0
        self.started = time.perf_counter()

    def record(self, status: int, latency_ms: float) -> None:
        self.total += 1
        self.latency_sum_ms += latency_ms
        if 200 <= status < 400:
            self.ok += 1
        else:
            self.errors += 1

    def line(self) -> str:
        elapsed = max(time.perf_counter() - self.started, 0.001)
        avg = self.latency_sum_ms / self.total if self.total else 0.0
        err_pct = (self.errors / self.total * 100.0) if self.total else 0.0
        return (
            f"reqs={self.total} ok={self.ok} err={self.errors} "
            f"({err_pct:4.1f}%) avg={avg:6.1f}ms rate={self.total / elapsed:4.1f}/s"
        )


async def _worker(client: httpx.AsyncClient, tally: Tally, interval: float) -> None:
    while True:
        endpoint = random.choice(ENDPOINTS)
        start = time.perf_counter()
        try:
            resp = await client.get(f"{BASE_URL}{endpoint}")
            status = resp.status_code
        except Exception:
            status = 0
        latency_ms = (time.perf_counter() - start) * 1000.0
        tally.record(status, latency_ms)
        await asyncio.sleep(interval)


async def _reporter(tally: Tally) -> None:
    while True:
        await asyncio.sleep(2.0)
        print(tally.line(), flush=True)


async def main() -> None:
    rps = max(RPS, 0.1)
    # Spread the requested rate across a small pool of workers.
    workers = max(1, min(20, int(rps)))
    interval = workers / rps

    print(
        f"loadgen -> {BASE_URL} target={rps}/s workers={workers} "
        f"endpoints={ENDPOINTS}",
        flush=True,
    )

    tally = Tally()
    async with httpx.AsyncClient(timeout=httpx.Timeout(5.0)) as client:
        tasks = [
            asyncio.create_task(_worker(client, tally, interval))
            for _ in range(workers)
        ]
        tasks.append(asyncio.create_task(_reporter(tally)))
        try:
            await asyncio.gather(*tasks)
        except asyncio.CancelledError:  # pragma: no cover
            pass


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\nloadgen stopped.")
