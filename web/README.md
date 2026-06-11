# Keeper Mission Control

The live operations console for **Keeper**, an autonomous Site Reliability
Engineer. Mission Control visualizes Keeper detecting, diagnosing, and fixing a
production incident on a 2026 World Cup fan platform during a match-day traffic
surge: the incident timeline, a recovery graph, the live business impact, the
human approval gate, and the filed postmortem.

Built with Vite, React, TypeScript, and Tailwind CSS.

## What it does

- Calls `POST {VITE_KEEPER_URL}/api/run` to start a run, then subscribes to
  `GET {VITE_KEEPER_URL}/api/stream` over Server-Sent Events and renders every
  event live. Reconnects automatically if the stream drops.
- Renders each SSE event by its `type`: phase, log, incident, rootcause,
  impact, plan, awaiting_approval, remediation, verify, postmortem, done.
- On `awaiting_approval`, surfaces prominent Approve / Reject controls. Approve
  sends `POST {VITE_KEEPER_URL}/api/approve` with
  `{ plan_id, decision: "approve" }`; Reject sends `"reject"`.
- Ships a self-contained **mock mode** that replays a cinematic, World Cup
  themed incident on timers with no backend, for the demo video.

## Prerequisites

- Node.js 20 or newer
- npm 10 or newer

## Run in development

```bash
npm install
npm run dev
```

Open the printed local URL (default http://localhost:5173). With no backend
running you will see the standby screen; use mock mode below to see a full run.

## Run in mock mode

Mock mode replays the full scripted incident (roughly 60-90 seconds once you
approve) and is fully re-runnable. No backend is contacted.

Two ways to enable it:

```bash
# 1) Env var: set VITE_MOCK=1
VITE_MOCK=1 npm run dev          # macOS / Linux
```

On Windows PowerShell:

```powershell
$env:VITE_MOCK = "1"; npm run dev
```

```bash
# 2) Query param at runtime (no rebuild needed)
#    visit  http://localhost:5173/?mock=1
```

Click **Start Run**, watch the team work, then click **Approve rollback** when
the human gate appears to drive the remediation, verification, and postmortem.

## Environment variables

Copy `.env.example` to `.env` and adjust. Only `VITE_*` vars are exposed to the
client, and they are inlined at build time.

| Variable          | Default                  | Purpose                                            |
|-------------------|--------------------------|----------------------------------------------------|
| `VITE_KEEPER_URL` | `http://localhost:8000`  | Base URL of the Keeper backend (no trailing slash). |
| `VITE_MOCK`       | `0`                      | Set to `1` to replay the scripted incident with no backend. |

## Build

```bash
npm run build      # type-checks then produces dist/
npm run preview    # serves the production build locally on :8080
```

## Docker

The image builds the static site and serves it with nginx. It listens on
`$PORT` (Cloud Run injects this; defaults to 8080).

```bash
# Build (mock mode baked in by default, runs standalone)
docker build -t keeper-mission-control ./web

# Build wired to a live backend
docker build \
  --build-arg VITE_MOCK=0 \
  --build-arg VITE_KEEPER_URL=https://keeper-backend.example.run.app \
  -t keeper-mission-control ./web

# Run locally
docker run --rm -p 8080:8080 keeper-mission-control
# open http://localhost:8080
```

Because `VITE_*` values are inlined at build time, pass the backend URL as a
build arg when you want the live wiring baked into the image.

## Project layout

```
web/
  Dockerfile            node build stage -> nginx serve
  nginx.conf            SPA serving, listens on ${PORT}
  index.html
  package.json
  tailwind.config.js
  vite.config.ts
  src/
    App.tsx             three-column console layout
    main.tsx
    types.ts            types matching the SSE contract
    index.css           theme, atmosphere, animations
    hooks/
      useKeeperRun.ts   SSE client + run state reducer
      useCountUp.ts     animated metric counter
    lib/
      config.ts         env + query-param resolution
      format.ts         number / time formatting
      mockEngine.ts     scripted incident replay
    components/         top bar, stepper, feed, incident, graph,
                        root cause, impact, plan, verify, postmortem
```
