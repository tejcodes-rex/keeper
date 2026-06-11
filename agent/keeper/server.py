"""FastAPI surface for Keeper: start a run, stream it, and approve the plan."""

from __future__ import annotations

import asyncio

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel

from .config import settings
from .orchestrator import keeper
from .sse import bus, sse_format

app = FastAPI(title="Keeper", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class RunRequest(BaseModel):
    inject: bool = False


class ApproveRequest(BaseModel):
    plan_id: str
    decision: str


@app.get("/")
async def root():
    return {"name": "Keeper", "status": "ok", "health": "/api/health"}


@app.get("/api/health")
async def health():
    return {
        "status": "ok",
        "mode": "live" if settings.live else "demo",
        "model": settings.model,
        "service": settings.service_name,
        "running": keeper.running,
    }


@app.post("/api/run")
async def run(req: RunRequest):
    if keeper.running:
        return JSONResponse(
            {"started": False, "reason": "a run is already active"}, status_code=409
        )
    asyncio.create_task(keeper.run(inject=req.inject))
    return {"started": True}


@app.post("/api/approve")
async def approve(req: ApproveRequest):
    accepted = keeper.submit_decision(req.plan_id, req.decision)
    return {"accepted": accepted}


@app.get("/api/stream")
async def stream(request: Request):
    async def gen():
        queue = await bus.subscribe()
        try:
            yield ": connected\n\n"
            while True:
                if await request.is_disconnected():
                    break
                try:
                    event = await asyncio.wait_for(queue.get(), timeout=15)
                    yield sse_format(event)
                except asyncio.TimeoutError:
                    yield ": keepalive\n\n"
        finally:
            bus.unsubscribe(queue)

    headers = {
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no",
    }
    return StreamingResponse(
        gen(), media_type="text/event-stream", headers=headers
    )
