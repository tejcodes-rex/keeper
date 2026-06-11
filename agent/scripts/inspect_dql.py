"""Dump raw execute_dql output to a UTF-8 file so we can see the exact format."""

import asyncio
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from keeper.config import settings  # noqa: E402
from keeper.dynatrace import DETECTION_DQL, call_tool  # noqa: E402

QUERIES = {
    "detection": DETECTION_DQL.format(service=settings.service_name),
    "raw_logs": (
        'fetch logs, from: -24h | filter service.name == "worldcup-fan-gateway" '
        '| fields timestamp, content, duration_ms, "http.status_code" | limit 5'
    ),
}


async def main() -> None:
    lines = []
    for label, dql in QUERIES.items():
        lines.append(f"===== {label} =====")
        lines.append(f"DQL: {dql}")
        try:
            out = await call_tool("execute_dql", {"dqlStatement": dql}, timeout=180)
            lines.append("RESULT:")
            lines.append(out or "<empty>")
        except Exception as exc:  # noqa: BLE001
            lines.append(f"ERROR: {exc}")
        lines.append("")
    with open(os.path.join(os.path.dirname(__file__), "dql_out.txt"), "w", encoding="utf-8") as fh:
        fh.write("\n".join(lines))
    print("written dql_out.txt")


if __name__ == "__main__":
    asyncio.run(main())
