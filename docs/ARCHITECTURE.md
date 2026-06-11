# Keeper Architecture

Keeper is an autonomous Site Reliability Engineer. It watches a live production
service, detects when it starts to fail, finds the root cause, measures the
business damage in real time, proposes a fix for a human to approve, executes
the fix, verifies that the service actually recovered, and writes the
postmortem. The whole loop runs on Google Agent Development Kit with Gemini 3.1
Pro doing the reasoning, and Dynatrace as both the eyes and the hands through
its Model Context Protocol server.

The reference scenario is the 2026 World Cup. The protected service is a fan
gateway that sells tickets, streams matches, and serves live scores. At kickoff
the traffic surges, a bad deploy ships, latency climbs, and Keeper has to keep
the goal clean.

## System map

```
                          ┌──────────────────────────────────────────┐
                          │            Mission Control (web)          │
                          │  live timeline · incident card · impact   │
                          │  meter · approve / reject · postmortem    │
                          └───────────────▲───────────────┬──────────┘
                                          │ SSE            │ POST /approve
                                          │ events         │ POST /run
                          ┌───────────────┴───────────────▼──────────┐
                          │           Keeper backend (FastAPI)        │
                          │                                           │
                          │   ADK orchestrator (Gemini 3.1 Pro)       │
                          │   ┌─────────┐ ┌────────────┐ ┌─────────┐  │
                          │   │Sentinel │ │Diagnostician│ │Strategist│ │
                          │   └─────────┘ └────────────┘ └─────────┘  │
                          │   ┌─────────┐ ┌──────────┐ ┌──────────┐   │
                          │   │Operator │ │ Verifier │ │  Scribe  │   │
                          │   └────┬────┘ └────┬─────┘ └────┬─────┘   │
                          └────────┼───────────┼────────────┼─────────┘
                  MCP (stdio)      │           │            │  MCP
              ┌──────────────────┐ │           │            │
              │ Dynatrace MCP    │◄┘           │            └──► create notebook,
              │ execute_dql      │             │                 send_slack, send_event
              │ list_problems    │             │
              │ chat_with_davis  │             │ verify via DQL
              │ send_slack/email │             │
              │ create_notebook  │             │
              └────────▲─────────┘             │
                       │ Grail (logs/spans)    │ rollback
              ┌────────┴──────────┐    POST /admin/rollback
              │  Dynatrace SaaS   │◄───────────┐
              └────────▲──────────┘            │
                       │ OTLP + log/event ingest
              ┌────────┴──────────────────────┴───────────┐
              │   World Cup fan gateway (victim service)   │
              │   /tickets /stream /score                  │
              │   /admin/deploy  (ship good or bad build)  │
              │   /admin/rollback (revert to last good)    │
              └────────────────────────────────────────────┘
```

## The six agents

Keeper is a multi-agent system. Each agent has one job and a narrow tool set.
The orchestrator runs them as a pipeline with a human gate in the middle.

1. **Sentinel** watches. It runs a Dynatrace DQL query through MCP on a short
   interval, comparing live p95 latency and error rate against the rolling
   baseline. When the live numbers break the threshold it opens an incident and
   wakes the rest of the team.
2. **Diagnostician** root-causes. It pulls the recent change timeline and the
   failing spans and logs from Grail, asks Davis CoPilot to correlate, and
   produces a ranked hypothesis with evidence and a confidence score. In the
   reference scenario it ties the latency spike to the deploy that shipped
   seconds before.
3. **Strategist** decides and quantifies. It builds a ranked remediation plan,
   predicts the blast radius and recovery time, and measures the live business
   impact: fans affected per minute, revenue at risk, and SLO error budget
   burned. It stops and hands the plan to the human.
4. **Operator** acts, only after approval. It executes the chosen remediation
   (a rollback of the bad deploy), and posts the action to Dynatrace as an event
   and to Slack through MCP so the on-call humans see it.
5. **Verifier** confirms. It re-queries Grail after the fix and checks whether
   latency and error rate returned under threshold. If the service did not
   recover it escalates and triggers an automatic second remediation, closing
   the loop instead of trusting the first action blindly.
6. **Scribe** documents. It writes a full postmortem (timeline, root cause,
   action taken, impact, prevention) and files it back into Dynatrace as a
   notebook through MCP, so the record lives where the on-call team works.

## Human in control

Keeper never executes a change on its own. The pipeline pauses at
`await_approval` and the run only proceeds when a human clicks Approve in
Mission Control. Reject ends the run and logs the decision. This is the
"keep you in control" requirement, made literal.

## Why the Dynatrace integration is central, not bolted on

Keeper cannot function without Dynatrace. Every phase calls the MCP server:
detection is a DQL query, diagnosis is Grail plus Davis CoPilot, action is
`send_event` and `send_slack_message`, and the postmortem is a Dynatrace
notebook. Observe and act both run through the partner. Remove the MCP server
and there is no agent.

## Shared contracts

These contracts are the integration glue. Every component is built against them.

### Keeper backend HTTP API

| Method | Path           | Purpose                                            |
|--------|----------------|----------------------------------------------------|
| GET    | /api/health    | Liveness.                                          |
| POST   | /api/run       | Start a Keeper run (kick the detection loop now).  |
| GET    | /api/stream    | Server-Sent Events feed of the live run.           |
| POST   | /api/approve   | Body `{ "plan_id": str, "decision": "approve"|"reject" }`. |

### SSE event envelope

Each SSE `data:` line is one JSON object with a `type` field:

```
{ "type": "phase",      "phase": "detect|diagnose|strategize|await_approval|remediate|verify|report", "ts": <epoch_ms> }
{ "type": "log",        "agent": "Sentinel|Diagnostician|Strategist|Operator|Verifier|Scribe", "level": "info|warn|act", "message": str, "ts": <epoch_ms> }
{ "type": "incident",   "data": { "id": str, "title": str, "service": str, "metric": str, "p95_ms": num, "error_rate": num, "baseline_ms": num, "severity": "high|critical" } }
{ "type": "rootcause",  "data": { "summary": str, "change": str, "evidence": [str], "confidence": num } }
{ "type": "impact",     "data": { "fans_affected": int, "revenue_per_min": num, "est_total_loss": num, "slo_burn_pct": num } }
{ "type": "plan",       "data": { "id": str, "title": str, "steps": [str], "risk": "low|medium|high", "predicted_recovery_s": int, "requires_approval": true } }
{ "type": "awaiting_approval", "plan_id": str }
{ "type": "remediation","data": { "action": str, "status": "running|done|failed", "detail": str } }
{ "type": "verify",     "data": { "recovered": bool, "p95_ms": num, "error_rate": num, "checks": [ { "name": str, "ok": bool } ] } }
{ "type": "postmortem", "data": { "url": str, "title": str, "markdown": str } }
{ "type": "done",       "outcome": "resolved|rolled_back|escalated" }
```

### Victim service HTTP API

| Method | Path             | Purpose                                                        |
|--------|------------------|----------------------------------------------------------------|
| GET    | /api/tickets     | Buy or list tickets (normal traffic).                          |
| GET    | /api/stream      | Stream session handshake (normal traffic).                     |
| GET    | /api/score       | Live score (normal traffic).                                   |
| GET    | /api/health      | Liveness and current deployed version.                         |
| POST   | /admin/deploy    | Body `{ "version": str, "faulty": bool }`. Ships a build. A faulty build injects latency and errors and emits the change event to Dynatrace. |
| POST   | /admin/rollback  | Revert to the last good version and clear the fault. Called by Keeper Operator as the remediation. |

The victim service emits structured logs and a deployment event to Dynatrace on
every request and every deploy, so Sentinel can detect the spike through Grail
and Diagnostician can correlate it to the change.

## Tech stack

- Reasoning: Gemini 3.1 Pro on Vertex AI.
- Agent framework: Google Agent Development Kit (ADK), multi-agent pipeline.
- Partner: Dynatrace, integrated through the official Dynatrace MCP server over stdio.
- Backend: Python, FastAPI, SSE.
- Demo service: Python, FastAPI, OpenTelemetry, Dynatrace log and event ingest.
- Frontend: Vite, React, TypeScript, Tailwind.
- Hosting: Cloud Run for all three services.
