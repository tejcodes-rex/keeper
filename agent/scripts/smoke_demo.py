"""Drive a full Keeper run in demo mode and assert the event sequence.

Run from the agent/ directory:
    python scripts/smoke_demo.py
"""

import asyncio
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

os.environ.setdefault("KEEPER_DEMO", "1")
os.environ.setdefault("KEEPER_AUTO_APPROVE", "1")
os.environ.setdefault("KEEPER_PACE_SECONDS", "0")

from keeper.orchestrator import keeper  # noqa: E402
from keeper.sse import bus  # noqa: E402


async def main() -> None:
    queue = await bus.subscribe()
    task = asyncio.create_task(keeper.run(inject=False))

    seen: list[str] = []
    while True:
        event = await asyncio.wait_for(queue.get(), timeout=30)
        etype = event.get("type")
        if etype == "phase":
            seen.append(f"phase:{event.get('phase')}")
        else:
            seen.append(etype)
        if etype == "done":
            break

    await task

    print("EVENT SEQUENCE:")
    for item in seen:
        print("  ", item)

    required = ["incident", "rootcause", "impact", "plan",
                "awaiting_approval", "remediation", "verify", "postmortem", "done"]
    missing = [r for r in required if r not in seen]
    if missing:
        raise SystemExit(f"FAIL missing events: {missing}")
    print("\nSMOKE TEST PASSED: full incident loop emitted every expected event.")


if __name__ == "__main__":
    asyncio.run(main())
