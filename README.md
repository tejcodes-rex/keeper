# Keeper

**The goalkeeper for your production. An autonomous Site Reliability Engineer that keeps your service alive on match day.**

Keeper is an agent that does the on-call job end to end. It watches a live
service through Dynatrace, detects when it starts to fail, finds the root cause,
measures the business damage in real time, proposes a fix for a human to
approve, executes it, verifies that the service actually recovered, and writes
the postmortem. The reasoning runs on Gemini 3.1 Pro through the Google Agent
Development Kit. The eyes and the hands are Dynatrace, through its Model Context
Protocol server.

- **Live demo:** https://keeper-mission-control-plsrofw5mq-uc.a.run.app
- **Demo video:** <ADD_VIDEO_URL>
- **Track:** Dynatrace

---

## The problem

When a service breaks in production, a human has to notice, dig through
dashboards to find the cause, weigh the blast radius, decide on a fix, run it,
watch to see if it worked, and then write it all up. That loop takes a skilled
engineer many minutes, and minutes are exactly what you do not have when four
million fans hit a World Cup fan platform at kickoff and a bad deploy starts
dropping requests.

Keeper runs that entire loop in under a minute, and it never touches production
without your approval.

## What Keeper does

```
Detect  ->  Diagnose  ->  Strategize  ->  [ you approve ]  ->  Remediate  ->  Verify  ->  Report
```

1. **Detect.** Sentinel runs a Dynatrace Grail query and compares live latency
   and error rate against the baseline. When it breaks threshold it opens an
   incident.
2. **Diagnose.** Diagnostician pulls the change timeline and failing signals
   from Grail, asks Davis CoPilot to correlate, and ties the spike to the deploy
   that shipped seconds earlier, with evidence and a confidence score.
3. **Strategize.** Strategist measures the live business impact, fans affected
   and revenue at risk and error budget burned, then builds the safest
   remediation plan.
4. **Approve.** Keeper stops and hands the plan to a human. Nothing changes in
   production until you click Approve. This is the control point, made literal.
5. **Remediate.** Operator rolls back the bad deploy and posts the action to
   Dynatrace and Slack.
6. **Verify.** Verifier re-queries Grail to confirm the service truly recovered.
   If it did not, it escalates instead of trusting the fix blindly.
7. **Report.** Scribe writes a full postmortem and files it back into Dynatrace
   as a notebook, where the on-call team works.

## Why Dynatrace is the heart of this, not a bolt-on

Every phase of Keeper calls the Dynatrace MCP server. Detection is a Grail
query. Diagnosis is Grail plus Davis CoPilot. Action is `send_event` and
`send_slack_message`. The postmortem is a Dynatrace notebook. Observe and act
both run through the partner. Remove the MCP server and there is no agent.

## Built with

- **Gemini 3.1 Pro** on Vertex AI for the reasoning.
- **Google Agent Development Kit (ADK)** for the multi-agent system.
- **Dynatrace** through the official `@dynatrace-oss/dynatrace-mcp-server`.
- **FastAPI** and Server-Sent Events for the live backend.
- **React, TypeScript, Tailwind** for the Mission Control console.
- **Cloud Run** for hosting all three services.

## Architecture

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the full system map, the six
agents, and the shared contracts. In short:

```
Mission Control (web)  <- SSE -  Keeper backend (ADK + Gemini 3.1)  - MCP ->  Dynatrace
                                          |                                       ^
                                          | rollback                              | telemetry
                                          v                                       |
                               World Cup fan gateway (the protected service)  ----+
```

## Run it locally in demo mode

Demo mode replays a complete, realistic incident with no cloud credentials, so
you can see the whole loop in two minutes.

Backend:

```
cd agent
pip install -r requirements.txt
KEEPER_DEMO=1 KEEPER_AUTO_APPROVE=0 uvicorn keeper.server:app --port 8000
```

Frontend (in a second terminal):

```
cd web
npm install
VITE_KEEPER_URL=http://localhost:8000 npm run dev
```

Open the printed URL, click Start Run, and approve the plan when Keeper asks.
You can also run the frontend fully standalone with `VITE_MOCK=1 npm run dev`.

## Deploy and wire the real Dynatrace integration

Everything you need is in [docs/RUNBOOK.md](docs/RUNBOOK.md): create the
Dynatrace trial, mint the tokens with the right scopes, and deploy all three
services to Cloud Run with one script.

## Repository layout

```
agent/     Keeper backend: ADK multi-agent system, Dynatrace MCP, FastAPI SSE
victim/    World Cup fan gateway, the service Keeper protects
web/        Mission Control, the live operations console
deploy/    One-shot Cloud Run deploy script
docs/       Architecture, runbook, demo script, submission notes
```

## License

Released under the MIT License. See [LICENSE](LICENSE).
