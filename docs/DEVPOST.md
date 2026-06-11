# Devpost submission copy

Paste each section into the matching field on the Devpost form. Track: Dynatrace.

---

## Project name
Keeper

## Tagline
The goalkeeper for your production. An autonomous Site Reliability Engineer that detects, diagnoses, and fixes incidents in under a minute, with a human in control.

## Elevator pitch
Keeper is an agent that does the on-call job end to end. It watches a live service through Dynatrace, catches an incident the moment it starts, finds the root cause, measures the business damage in real time, proposes a fix for a human to approve, executes it, verifies that the service truly recovered, and writes the postmortem. The reasoning runs on Gemini 3.1 Pro through the Google Agent Development Kit. The eyes and the hands are Dynatrace, through its Model Context Protocol server.

## Inspiration
Production does not break politely. It breaks at the worst possible moment, like the minute four million fans hit a World Cup platform at kickoff and a bad deploy starts dropping requests. In that moment a human has to notice the problem, dig through dashboards to find the cause, weigh the blast radius, decide on a fix, run it, watch to see if it worked, and then write it all up. That loop takes a skilled engineer many minutes, and every minute is lost revenue and lost trust. We wanted to see if an agent could run that entire loop in under a minute without ever taking a risky action on its own.

## What it does
Keeper runs the full incident response loop as a team of focused agents:

- Sentinel watches a Dynatrace Grail query and opens an incident when latency and error rate break threshold.
- Diagnostician pulls the change timeline and failing signals from Grail, asks Davis CoPilot to correlate, and ties the spike to the deploy that caused it, with evidence and a confidence score.
- Strategist measures live business impact, fans affected and revenue at risk and error budget burned, then builds the safest remediation plan.
- Keeper then stops and hands the plan to a human. Nothing changes in production until you click Approve.
- Operator rolls back the bad deploy and records the action as a Dynatrace event and a Slack message.
- Verifier re-queries Grail to confirm the service actually recovered, and escalates instead of trusting the fix blindly.
- Scribe writes a blameless postmortem and files it back into Dynatrace as a notebook.

The whole run streams live into Mission Control, a console that shows the agents reasoning, the impact climbing, the approval gate, and the recovery in real time.

## How we built it
The reasoning runs on Gemini 3.1 Pro on Vertex AI. The multi-agent system is built on the Google Agent Development Kit, with each agent given a narrow role and the right tools. Dynatrace is integrated through the official Dynatrace MCP server, which Keeper uses for both observation and action: Grail queries through execute_dql for detection and verification, Davis CoPilot for correlation, send_event and send_slack_message for the action, and create_dynatrace_notebook for the postmortem. The backend is FastAPI with Server-Sent Events streaming every step to the frontend, which is React, TypeScript, and Tailwind. A demo World Cup fan gateway, instrumented to push telemetry to Dynatrace, plays the role of the protected service so the whole loop is real and reproducible. All three services run on Cloud Run.

## Challenges we ran into
The hardest design choice was reliability versus authenticity. We wanted real Gemini reasoning over real Dynatrace data, but a live tenant can be slow at exactly the wrong moment. We solved it by splitting the work: deterministic steps like detection, the rollback, and verification call the MCP tools programmatically for predictable results, while diagnosis and the postmortem are genuine Gemini reasoning over live Grail data. Every live step degrades gracefully, so the story always reaches a clean resolution, and a fully scripted mode guarantees a flawless demo.

## Accomplishments that we're proud of
Keeper closes the loop. Most automation stops at detection or at firing an alert. Keeper goes all the way to verifying that its own fix worked and rolling forward again if it did not. It also speaks the language of the business, translating latency and errors into fans and dollars and error budget, and it keeps a human firmly in control of every change.

## What we learned
An agent earns trust by what it refuses to do on its own. Putting a hard approval gate in the middle of the pipeline, and a verification step at the end, made Keeper feel less like a risky robot and more like a teammate. We also learned how much an MCP server can carry: with Dynatrace as both the eyes and the hands, a small set of tools covered the entire incident lifecycle.

## What's next
Watching many services at once, learning the right remediation per failure class from history, gating deploys before they ship, and a fuller catalog of safe actions beyond rollback, such as scaling, feature flags, and traffic shifting, each behind the same human approval gate.

## Built With
gemini, google-agent-development-kit, vertex-ai, google-cloud, cloud-run, dynatrace, model-context-protocol, python, fastapi, react, typescript, tailwindcss, server-sent-events

## Links
- Live demo: <ADD_HOSTED_URL>
- Source code: <ADD_GITHUB_URL>
- Demo video: <ADD_VIDEO_URL>
