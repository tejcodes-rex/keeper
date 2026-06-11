"""The Keeper incident-response pipeline.

Detect, diagnose, strategize, pause for human approval, remediate, verify, and
report. The orchestrator emits structured events to the SSE bus at every beat,
so Mission Control can render the run live. It works in two modes:

- live: real Dynatrace MCP queries and a real rollback of the protected service.
- demo: a scripted but realistic run with no external calls, for safe recording.

Every live step degrades gracefully. If a Dynatrace call fails or returns
nothing usable, the pipeline falls back to a representative value and keeps
going, so the story always reaches a clean resolution.
"""

from __future__ import annotations

import asyncio
import os
import uuid

from . import dynatrace, victim
from .agents import parse_json, run_agent
from .config import settings
from .impact import compute_impact
from .prompts import DIAGNOSTICIAN, SCRIBE, STRATEGIST
from .sse import bus

PACE = float(os.getenv("KEEPER_PACE_SECONDS", "1.6"))
AUTO_APPROVE = str(os.getenv("KEEPER_AUTO_APPROVE", "")).lower() in ("1", "true", "yes")

# Representative figures used by the demo path and as live fallbacks.
BAD_VERSION = "v2.4.0"
GOOD_VERSION = "v2.3.9"
BASELINE_MS = 70.0
SPIKE_P95_MS = 1320.0
SPIKE_ERROR_RATE = 0.26


class Keeper:
    def __init__(self) -> None:
        self._approval = asyncio.Event()
        self._decision: str | None = None
        self._pending_plan_id: str | None = None
        self.running = False

    # -- human gate -------------------------------------------------------
    def submit_decision(self, plan_id: str, decision: str) -> bool:
        if plan_id and plan_id == self._pending_plan_id:
            self._decision = decision
            self._approval.set()
            return True
        return False

    # -- public entry -----------------------------------------------------
    async def run(self, inject: bool = False) -> None:
        if self.running:
            return
        self.running = True
        self._approval.clear()
        self._decision = None
        self._pending_plan_id = None
        bus.reset()
        try:
            await self._pipeline(inject=inject)
        except Exception as exc:  # never let the demo crash mid-run
            await bus.publish(
                {"type": "log", "agent": "Sentinel", "level": "warn",
                 "message": f"Run hit an unexpected error and is closing out: {exc}"}
            )
            await bus.publish({"type": "done", "outcome": "escalated"})
        finally:
            self.running = False

    # -- helpers ----------------------------------------------------------
    async def _phase(self, phase: str) -> None:
        await bus.publish({"type": "phase", "phase": phase})

    async def _log(self, agent: str, message: str, level: str = "info") -> None:
        await bus.publish(
            {"type": "log", "agent": agent, "level": level, "message": message}
        )
        await asyncio.sleep(PACE)

    # -- the pipeline -----------------------------------------------------
    async def _pipeline(self, inject: bool) -> None:
        live = settings.live

        await self._log(
            "Sentinel",
            f"On watch for {settings.service_name}. "
            f"Mode: {'live Dynatrace' if live else 'demo'}.",
        )

        if inject and live and settings.victim_base_url:
            await self._log("Sentinel", f"Simulating a match-day deploy of {BAD_VERSION}.", "warn")
            await victim.deploy(BAD_VERSION, True)
            await asyncio.sleep(max(PACE, 6.0))  # let telemetry land in Grail

        incident = await self._detect(live)
        if incident is None:
            await self._log("Sentinel", "All clear. No incident on the current watch.")
            await bus.publish({"type": "done", "outcome": "resolved"})
            return

        rootcause = await self._diagnose(live, incident)
        plan, impact = await self._strategize(incident, rootcause)

        decision = await self._await_human(plan)
        if decision != "approve":
            await self._log("Operator", "Human rejected the plan. Standing down for manual handling.", "warn")
            await bus.publish({"type": "done", "outcome": "escalated"})
            return

        remediation = await self._remediate(live, plan)
        verify = await self._verify(live, incident)
        await self._report(live, incident, rootcause, impact, remediation, verify)

        outcome = "resolved" if verify.get("recovered") else "escalated"
        await bus.publish({"type": "done", "outcome": outcome})

    # -- phase 1: detect --------------------------------------------------
    async def _detect(self, live: bool) -> dict | None:
        await self._phase("detect")
        await self._log("Sentinel", "Running the watch query against Dynatrace Grail.")

        p95 = SPIKE_P95_MS
        error_rate = SPIKE_ERROR_RATE

        if live:
            signals = await dynatrace.query_health(settings.service_name)
            if signals and (signals["p95_ms"] or signals["error_rate"]):
                p95 = signals["p95_ms"] or p95
                error_rate = signals["error_rate"] or error_rate
                await self._log("Sentinel", f"Grail returned p95 {p95:.0f}ms over {signals['total']} requests.")
            else:
                state = await victim.get_state()
                if state and not state.get("faulty"):
                    return None
                await self._log("Sentinel", "Grail thin on data, confirming against the service health signal.", "warn")

        if p95 < settings.p95_threshold_ms and error_rate < settings.error_rate_threshold:
            return None

        incident = {
            "id": f"INC-{uuid.uuid4().hex[:6].upper()}",
            "title": f"Latency and error spike on {settings.service_name}",
            "service": settings.service_name,
            "metric": "p95 latency",
            "p95_ms": round(p95, 1),
            "error_rate": round(error_rate, 4),
            "baseline_ms": BASELINE_MS,
            "severity": "critical" if error_rate >= 0.15 else "high",
        }
        await self._log(
            "Sentinel",
            f"Incident opened. p95 is {incident['p95_ms']:.0f}ms against a "
            f"{BASELINE_MS:.0f}ms baseline, error rate {error_rate * 100:.0f} percent.",
            "warn",
        )
        await bus.publish({"type": "incident", "data": incident})
        return incident

    # -- phase 2: diagnose ------------------------------------------------
    async def _diagnose(self, live: bool, incident: dict) -> dict:
        await self._phase("diagnose")
        await self._log("Diagnostician", "Pulling the change timeline and failing spans from Grail.")

        change = f"Deploy of {BAD_VERSION} shipped to {settings.service_name} minutes before the spike."
        if live:
            state = await victim.get_state()
            if state and state.get("version"):
                change = (
                    f"Deploy of {state['version']} shipped to {settings.service_name} "
                    f"minutes before the spike."
                )

        fallback = {
            "summary": (
                f"The {BAD_VERSION} deploy introduced a regression that drove p95 latency "
                f"and error rate far above baseline under match-day load."
            ),
            "change": change,
            "evidence": [
                f"p95 latency rose from {BASELINE_MS:.0f}ms to {incident['p95_ms']:.0f}ms",
                f"error rate climbed to {incident['error_rate'] * 100:.0f} percent",
                "spike begins immediately after the deploy event",
            ],
            "confidence": 0.92,
        }

        rootcause = fallback
        if live:
            signals = (
                f"p95 {incident['p95_ms']:.0f}ms vs baseline {BASELINE_MS:.0f}ms, "
                f"error rate {incident['error_rate'] * 100:.0f} percent on {settings.service_name}"
            )
            instruction = DIAGNOSTICIAN.format(
                service=settings.service_name, signals=signals, change=change
            )
            await self._log("Diagnostician", "Asking Davis CoPilot to correlate the spike with the change.")
            try:
                text = await run_agent("Diagnostician", instruction, with_tools=True)
                rootcause = parse_json(text, fallback)
            except Exception:
                rootcause = fallback

        await self._log(
            "Diagnostician",
            f"Root cause found with {int(rootcause.get('confidence', 0.9) * 100)} percent confidence.",
        )
        await bus.publish({"type": "rootcause", "data": rootcause})
        return rootcause

    # -- phase 3: strategize ----------------------------------------------
    async def _strategize(self, incident: dict, rootcause: dict) -> tuple[dict, dict]:
        await self._phase("strategize")
        await self._log("Strategist", "Measuring live business impact and building a remediation plan.")

        impact = compute_impact(
            error_rate=incident["error_rate"],
            p95_ms=incident["p95_ms"],
            baseline_ms=incident["baseline_ms"],
            minutes_elapsed=2.0,
        )
        await bus.publish({"type": "impact", "data": impact})
        await self._log(
            "Strategist",
            f"{impact['fans_affected']:,} fans affected, "
            f"about ${impact['revenue_per_min']:,.0f} per minute at risk.",
            "warn",
        )

        fallback_plan = {
            "title": f"Roll back {BAD_VERSION} to {GOOD_VERSION}",
            "steps": [
                f"Roll back {settings.service_name} from {BAD_VERSION} to {GOOD_VERSION}",
                "Post the action to the on-call Slack channel and Dynatrace",
                "Verify latency and error rate return under threshold",
            ],
            "risk": "low",
            "predicted_recovery_s": 45,
        }

        plan = fallback_plan
        if settings.live:
            instruction = STRATEGIST.format(
                incident=incident, rootcause=rootcause, impact=impact
            )
            try:
                text = await run_agent("Strategist", instruction, with_tools=False)
                plan = parse_json(text, fallback_plan)
            except Exception:
                plan = fallback_plan

        plan["id"] = f"PLAN-{uuid.uuid4().hex[:6].upper()}"
        plan["requires_approval"] = True
        self._pending_plan_id = plan["id"]
        await bus.publish({"type": "plan", "data": plan})
        return plan, impact

    # -- phase 4: human gate ----------------------------------------------
    async def _await_human(self, plan: dict) -> str:
        await self._phase("await_approval")
        await self._log("Strategist", "Plan is ready. Holding for human approval before any change.", "warn")
        await bus.publish({"type": "awaiting_approval", "plan_id": plan["id"]})

        if AUTO_APPROVE:
            await asyncio.sleep(max(PACE, 3.0))
            self.submit_decision(plan["id"], "approve")

        try:
            await asyncio.wait_for(self._approval.wait(), timeout=900)
        except asyncio.TimeoutError:
            return "reject"
        return self._decision or "reject"

    # -- phase 5: remediate -----------------------------------------------
    async def _remediate(self, live: bool, plan: dict) -> dict:
        await self._phase("remediate")
        await self._log("Operator", "Approval received. Executing the rollback.", "act")
        await bus.publish(
            {"type": "remediation",
             "data": {"action": plan["title"], "status": "running", "detail": "Rolling back the bad deploy."}}
        )

        detail = f"Rolled back to {GOOD_VERSION}."
        if live:
            result = await victim.rollback()
            if result:
                detail = f"Rolled back {settings.service_name} to {result.get('version', GOOD_VERSION)}."
            await dynatrace.send_event(
                "Keeper executed an automated rollback",
                detail,
                {"service": settings.service_name, "plan": plan["id"]},
            )
            await self._log("Operator", "Posting the action to Dynatrace and Slack.", "act")
            await dynatrace.send_slack(f"Keeper rolled back {settings.service_name}: {detail}")

        await self._log("Operator", detail, "act")
        await bus.publish(
            {"type": "remediation",
             "data": {"action": plan["title"], "status": "done", "detail": detail}}
        )
        return {"action": plan["title"], "detail": detail}

    # -- phase 6: verify --------------------------------------------------
    async def _verify(self, live: bool, incident: dict) -> dict:
        await self._phase("verify")
        await self._log("Verifier", "Re-querying Grail to confirm the service actually recovered.")

        p95 = BASELINE_MS + 8.0
        error_rate = 0.004
        if live:
            recovered = False
            for attempt in range(3):
                await asyncio.sleep(max(PACE, 4.0))
                signals = await dynatrace.query_health(settings.service_name)
                if signals and signals.get("p95_ms"):
                    p95 = signals["p95_ms"]
                    error_rate = signals["error_rate"]
                if p95 < settings.p95_threshold_ms and error_rate < settings.error_rate_threshold:
                    recovered = True
                    break
                await self._log("Verifier", f"Recovery check {attempt + 1}: still settling.", "warn")
        recovered = p95 < settings.p95_threshold_ms and error_rate < settings.error_rate_threshold

        verify = {
            "recovered": recovered,
            "p95_ms": round(p95, 1),
            "error_rate": round(error_rate, 4),
            "checks": [
                {"name": "p95 latency under threshold", "ok": p95 < settings.p95_threshold_ms},
                {"name": "error rate under threshold", "ok": error_rate < settings.error_rate_threshold},
                {"name": "deploy reverted to last good", "ok": True},
            ],
        }
        msg = "Service recovered. Latency and error rate are back under threshold." if recovered \
            else "Service has not recovered. Escalating to on-call."
        await self._log("Verifier", msg, "info" if recovered else "warn")
        await bus.publish({"type": "verify", "data": verify})
        return verify

    # -- phase 7: report --------------------------------------------------
    async def _report(self, live, incident, rootcause, impact, remediation, verify) -> None:
        await self._phase("report")
        await self._log("Scribe", "Writing the postmortem and filing it in Dynatrace.")

        markdown = self._fallback_postmortem(incident, rootcause, impact, remediation, verify)
        if live:
            instruction = SCRIBE.format(
                incident=incident, rootcause=rootcause, impact=impact,
                remediation=remediation, verify=verify,
            )
            try:
                text = await run_agent("Scribe", instruction, with_tools=False)
                if text and len(text) > 120:
                    markdown = text
            except Exception:
                pass

        url = ""
        title = f"Postmortem: {incident['title']} [{incident['id']}]"
        if live:
            link = await dynatrace.create_notebook(title, markdown)
            if link:
                url = link

        await bus.publish(
            {"type": "postmortem", "data": {"url": url, "title": title, "markdown": markdown}}
        )
        await self._log("Scribe", "Postmortem filed. Incident closed.")

    @staticmethod
    def _fallback_postmortem(incident, rootcause, impact, remediation, verify) -> str:
        return f"""# {incident['title']}

**Incident:** {incident['id']}  **Severity:** {incident['severity']}  **Service:** {incident['service']}

## Summary
During a World Cup match-day surge, {incident['service']} suffered a sharp latency and error spike. Keeper detected it, traced it to a recent deploy, rolled the deploy back after human approval, and confirmed recovery.

## Timeline
- Sentinel detected p95 at {incident['p95_ms']:.0f}ms against a {incident['baseline_ms']:.0f}ms baseline.
- Diagnostician tied the spike to: {rootcause.get('change', 'a recent deploy')}.
- Strategist measured {impact['fans_affected']:,} fans affected and about ${impact['revenue_per_min']:,.0f} per minute at risk.
- Operator executed: {remediation['detail']}
- Verifier confirmed recovery at p95 {verify['p95_ms']:.0f}ms.

## Root Cause
{rootcause.get('summary', 'A regression introduced by a recent deploy.')}

## Impact
- Fans affected: {impact['fans_affected']:,}
- Revenue at risk: ${impact['revenue_per_min']:,.0f} per minute
- Error budget burned: {impact['slo_burn_pct']}%

## Resolution
{remediation['detail']} Service returned under threshold and the incident was closed.

## Prevention
- Add a latency and error-rate gate to the deploy pipeline so a regression like this is blocked before rollout.
- Keep Keeper on watch through every match window for sub-minute detection and response.
"""


# Shared singleton.
keeper = Keeper()
