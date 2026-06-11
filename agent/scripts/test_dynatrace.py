"""Validate the live Dynatrace connection: platform token via MCP, and a DQL call.

Run from the agent/ directory:
    python scripts/test_dynatrace.py
"""

import asyncio
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from keeper.dynatrace import call_tool  # noqa: E402


async def main() -> None:
    query = "fetch dt.system.events | limit 1"
    last_error = None
    for argname in ("dqlStatement", "query"):
        try:
            out = await call_tool("execute_dql", {argname: query}, timeout=180)
            print(f"PLATFORM TOKEN OK via execute_dql ({argname}).")
            print("Sample response:", (out or "<empty result, auth succeeded>")[:400])
            return
        except Exception as exc:  # noqa: BLE001
            last_error = exc
            print(f"  attempt with '{argname}' failed: {exc}")
    print("PLATFORM TOKEN TEST FAILED:", last_error)
    raise SystemExit(1)


if __name__ == "__main__":
    asyncio.run(main())
