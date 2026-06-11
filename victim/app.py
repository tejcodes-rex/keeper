"""World Cup Fan Gateway (victim service).

A small but realistic FastAPI service that sells tickets, streams matches, and
serves live scores for the 2026 World Cup. It is the production service that
the Keeper agent protects. On command it can ship a bad deploy that injects
latency and errors, and it can be rolled back to the last good build. Every
data request and every deploy emits telemetry to Dynatrace so an external
agent can detect and diagnose problems through Grail.
"""

from __future__ import annotations

import logging
import random
import time
import uuid
from contextlib import asynccontextmanager
from typing import Any

from fastapi import BackgroundTasks, FastAPI, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, JSONResponse
from pydantic import BaseModel

import faults
import telemetry

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)
logger = logging.getLogger("worldcup.app")


# --------------------------------------------------------------------------
# In-memory deploy state
# --------------------------------------------------------------------------
class State:
    """Mutable in-memory state for the current deploy."""

    def __init__(self) -> None:
        self.current_version: str = "v1.0.0"
        self.faulty: bool = False
        self.last_good_version: str = "v1.0.0"


state = State()


# --------------------------------------------------------------------------
# Request / response models
# --------------------------------------------------------------------------
class DeployRequest(BaseModel):
    version: str
    faulty: bool = False


class GatewayState(BaseModel):
    version: str
    faulty: bool
    last_good_version: str


# --------------------------------------------------------------------------
# Static demo content
# --------------------------------------------------------------------------
TEAMS = [
    ("Brazil", "Argentina"),
    ("France", "Spain"),
    ("England", "Germany"),
    ("Portugal", "Netherlands"),
    ("USA", "Mexico"),
    ("Japan", "Morocco"),
]

SECTIONS = ["North Stand", "South Stand", "East Wing", "West Wing", "VIP Box"]
CDN_EDGES = ["edge-iad", "edge-fra", "edge-gru", "edge-sin", "edge-lhr"]
BITRATES = ["1080p60", "1080p", "720p", "4K"]


# --------------------------------------------------------------------------
# App lifecycle
# --------------------------------------------------------------------------
@asynccontextmanager
async def lifespan(app: FastAPI):
    mode = "OFFLINE (no Dynatrace config)" if telemetry.is_offline() else "ONLINE"
    logger.info("World Cup Fan Gateway starting up. Telemetry mode: %s", mode)
    yield
    await telemetry.aclose()
    logger.info("World Cup Fan Gateway shutting down.")


app = FastAPI(title="World Cup Fan Gateway", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --------------------------------------------------------------------------
# Shared data-endpoint helper
# --------------------------------------------------------------------------
async def _serve_data_endpoint(
    endpoint: str,
    payload_factory,
    background: BackgroundTasks,
) -> Response:
    """Run the common path for the three data endpoints.

    Applies latency (healthy or faulty), maybe returns a 500 when faulty, and
    schedules a fire-and-forget structured log to Dynatrace. The telemetry is
    always a background task so it can never slow or block the response.
    """
    start = time.perf_counter()

    if state.faulty:
        await faults.apply_faulty_latency(endpoint)
        if faults.should_error():
            duration_ms = (time.perf_counter() - start) * 1000.0
            background.add_task(
                telemetry.send_log,
                endpoint=endpoint,
                status_code=500,
                duration_ms=duration_ms,
                version=state.current_version,
                level="ERROR",
                message=(
                    f"{telemetry.SERVICE_NAME} {endpoint} -> 500 in "
                    f"{round(duration_ms, 2)}ms (version={state.current_version}) "
                    f"fault injected"
                ),
            )
            return JSONResponse(
                status_code=500,
                content={
                    "error": "internal_error",
                    "detail": "Upstream dependency failed while handling the request.",
                    "endpoint": endpoint,
                    "version": state.current_version,
                },
            )
    else:
        await faults.apply_healthy_latency(endpoint)

    payload = payload_factory()
    duration_ms = (time.perf_counter() - start) * 1000.0

    background.add_task(
        telemetry.send_log,
        endpoint=endpoint,
        status_code=200,
        duration_ms=duration_ms,
        version=state.current_version,
        level="INFO",
    )

    return JSONResponse(status_code=200, content=payload)


# --------------------------------------------------------------------------
# Payload factories
# --------------------------------------------------------------------------
def _tickets_payload() -> dict[str, Any]:
    home, away = random.choice(TEAMS)
    section = random.choice(SECTIONS)
    row = random.randint(1, 40)
    seat = random.randint(1, 30)
    return {
        "order_id": f"ORD-{uuid.uuid4().hex[:10].upper()}",
        "match": f"{home} vs {away}",
        "section": section,
        "seat": f"{section[:1]}{row:02d}-{seat:02d}",
        "price": {"amount": random.choice([95, 120, 175, 240, 480]), "currency": "USD"},
        "status": "confirmed",
        "version": state.current_version,
    }


def _stream_payload() -> dict[str, Any]:
    home, away = random.choice(TEAMS)
    return {
        "session_id": f"SES-{uuid.uuid4().hex[:12]}",
        "match": f"{home} vs {away}",
        "cdn_edge": random.choice(CDN_EDGES),
        "bitrate": random.choice(BITRATES),
        "protocol": "HLS",
        "token_expires_in_s": 3600,
        "version": state.current_version,
    }


def _score_payload() -> dict[str, Any]:
    home, away = random.choice(TEAMS)
    home_goals = random.randint(0, 4)
    away_goals = random.randint(0, 4)
    return {
        "match": f"{home} vs {away}",
        "home": {"team": home, "goals": home_goals},
        "away": {"team": away, "goals": away_goals},
        "score": f"{home_goals}-{away_goals}",
        "minute": random.randint(1, 90),
        "status": "live",
        "version": state.current_version,
    }


# --------------------------------------------------------------------------
# Data endpoints
# --------------------------------------------------------------------------
@app.get("/api/tickets")
async def get_tickets(background: BackgroundTasks) -> Response:
    return await _serve_data_endpoint("/api/tickets", _tickets_payload, background)


@app.get("/api/stream")
async def get_stream(background: BackgroundTasks) -> Response:
    return await _serve_data_endpoint("/api/stream", _stream_payload, background)


@app.get("/api/score")
async def get_score(background: BackgroundTasks) -> Response:
    return await _serve_data_endpoint("/api/score", _score_payload, background)


# --------------------------------------------------------------------------
# Health
# --------------------------------------------------------------------------
@app.get("/api/health")
async def health() -> dict[str, Any]:
    return {
        "status": "ok",
        "version": state.current_version,
        "faulty": state.faulty,
    }


# --------------------------------------------------------------------------
# Admin: deploy and rollback
# --------------------------------------------------------------------------
@app.post("/admin/deploy")
async def deploy(req: DeployRequest, background: BackgroundTasks) -> GatewayState:
    state.current_version = req.version
    state.faulty = req.faulty
    if not req.faulty:
        state.last_good_version = req.version

    build_kind = "faulty" if req.faulty else "healthy"
    title = f"Deploy {req.version} ({build_kind})"
    background.add_task(
        telemetry.send_event,
        title=title,
        version=req.version,
        faulty=req.faulty,
        deployment_name=f"worldcup-fan-gateway {req.version}",
    )
    logger.info("Deployed %s faulty=%s", req.version, req.faulty)

    return GatewayState(
        version=state.current_version,
        faulty=state.faulty,
        last_good_version=state.last_good_version,
    )


@app.post("/admin/rollback")
async def rollback(background: BackgroundTasks) -> GatewayState:
    target = state.last_good_version
    state.current_version = target
    state.faulty = False

    title = f"Rollback to {target}"
    background.add_task(
        telemetry.send_event,
        title=title,
        version=target,
        faulty=False,
        deployment_name=f"worldcup-fan-gateway rollback {target}",
    )
    logger.info("Rolled back to %s", target)

    return GatewayState(
        version=state.current_version,
        faulty=state.faulty,
        last_good_version=state.last_good_version,
    )


# --------------------------------------------------------------------------
# Branded status page
# --------------------------------------------------------------------------
@app.get("/", response_class=HTMLResponse)
async def index() -> HTMLResponse:
    health_label = "Degraded" if state.faulty else "Healthy"
    health_color = "#d64545" if state.faulty else "#1f9d55"
    note = (
        "A bad build is live. Latency and errors are elevated."
        if state.faulty
        else "All systems nominal. Fans are being served."
    )

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>World Cup Fan Gateway</title>
  <style>
    :root {{
      --pitch: #0b6b3a;
      --pitch-dark: #074a28;
      --line: #f4fbf6;
    }}
    * {{ box-sizing: border-box; }}
    body {{
      margin: 0;
      min-height: 100vh;
      font-family: -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #0c2a18;
      background:
        repeating-linear-gradient(
          90deg,
          var(--pitch) 0,
          var(--pitch) 60px,
          var(--pitch-dark) 60px,
          var(--pitch-dark) 120px
        );
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
    }}
    .card {{
      width: 100%;
      max-width: 560px;
      background: #ffffff;
      border-radius: 18px;
      box-shadow: 0 24px 60px rgba(0, 0, 0, 0.35);
      overflow: hidden;
    }}
    .banner {{
      background: var(--pitch-dark);
      color: var(--line);
      padding: 28px 32px;
      border-bottom: 4px solid #ffd400;
    }}
    .banner h1 {{
      margin: 0;
      font-size: 26px;
      letter-spacing: 0.3px;
    }}
    .banner p {{
      margin: 6px 0 0;
      opacity: 0.85;
      font-size: 14px;
    }}
    .body {{ padding: 28px 32px 32px; }}
    .row {{
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 14px 0;
      border-bottom: 1px solid #eef3ef;
    }}
    .row:last-child {{ border-bottom: none; }}
    .label {{ color: #5b6b61; font-size: 14px; }}
    .value {{ font-weight: 600; font-size: 16px; }}
    .pill {{
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 6px 14px;
      border-radius: 999px;
      color: #fff;
      font-weight: 600;
      font-size: 14px;
      background: {health_color};
    }}
    .dot {{
      width: 9px; height: 9px; border-radius: 50%;
      background: #fff; opacity: 0.9;
    }}
    .note {{
      margin-top: 20px;
      background: #f1f8f3;
      border-left: 4px solid var(--pitch);
      padding: 14px 16px;
      border-radius: 8px;
      font-size: 14px;
      color: #2a4034;
    }}
    .foot {{
      margin-top: 22px;
      font-size: 12px;
      color: #8a978f;
      text-align: center;
    }}
  </style>
</head>
<body>
  <div class="card">
    <div class="banner">
      <h1>World Cup Fan Gateway</h1>
      <p>Tickets, live streams, and scores for the 2026 World Cup</p>
    </div>
    <div class="body">
      <div class="row">
        <span class="label">Deployed version</span>
        <span class="value">{state.current_version}</span>
      </div>
      <div class="row">
        <span class="label">Health</span>
        <span class="pill"><span class="dot"></span>{health_label}</span>
      </div>
      <div class="row">
        <span class="label">Last good version</span>
        <span class="value">{state.last_good_version}</span>
      </div>
      <div class="note">{note}</div>
      <div class="foot">Status refreshed on load</div>
    </div>
  </div>
</body>
</html>"""
    return HTMLResponse(content=html)
