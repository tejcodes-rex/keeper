# World Cup Fan Gateway

The production service that the Keeper agent protects. It sells tickets,
streams matches, and serves live scores for the 2026 World Cup. On command it
can ship a bad deploy that injects latency and errors, and it can be rolled
back to the last good build. Every data request and every deploy emits
telemetry to Dynatrace so an external agent can detect and diagnose problems
through Grail.

## Run locally

Requires Python 3.12.

```
pip install -r requirements.txt
uvicorn app:app --reload --port 8080
```

Then open http://localhost:8080 for the branded status page.

With no Dynatrace configuration the service runs in OFFLINE mode: everything
works and telemetry calls become local log lines instead of network calls. It
never crashes because telemetry failed.

## Environment variables

| Variable         | Purpose                                                        | Default        |
|------------------|----------------------------------------------------------------|----------------|
| `DT_INGEST_BASE` | Dynatrace tenant base URL, e.g. `https://abc12345.live.dynatrace.com` | unset (offline) |
| `DT_API_TOKEN`   | Dynatrace API token with log and event ingest scope            | unset (offline) |
| `PORT`           | Port for uvicorn in the container (Cloud Run convention)       | `8080`         |

If either `DT_INGEST_BASE` or `DT_API_TOKEN` is missing the service is in
offline mode.

## Endpoints

| Method | Path             | Purpose                                                       |
|--------|------------------|---------------------------------------------------------------|
| GET    | `/`              | Branded HTML status page.                                     |
| GET    | `/api/health`    | `{ "status": "ok", "version": ..., "faulty": ... }`.          |
| GET    | `/api/tickets`   | Ticket purchase payload (normal latency ~40-90ms).            |
| GET    | `/api/stream`    | Streaming session handshake payload (normal latency ~40-90ms).|
| GET    | `/api/score`     | Live score payload (normal latency ~30-70ms).                 |
| POST   | `/admin/deploy`  | Body `{ "version": str, "faulty": bool }`. Ships a build.     |
| POST   | `/admin/rollback`| Reverts to the last good version and clears the fault.        |

### Fault behavior

State is in-memory: `current_version` (default `v1.0.0`), `faulty` (default
`false`), `last_good_version` (default `v1.0.0`). When `faulty` is true the
three data endpoints degrade: most requests get slow (p95 roughly
900-1500ms), some stay fast, and about 20-30 percent return HTTP 500 with a
JSON error body. When not faulty they are fast and always return 200.

### Examples

Ship a bad build:

```
curl -X POST http://localhost:8080/admin/deploy \
  -H "Content-Type: application/json" \
  -d '{"version":"v1.1.0","faulty":true}'
```

Roll back to the last good version:

```
curl -X POST http://localhost:8080/admin/rollback
```

## Telemetry

On every request to the data endpoints the service fires a structured log line
to the Dynatrace Log Ingest API (`/api/v2/logs/ingest`) as a background task.
Each record carries `service.name`, `endpoint`, `http.status_code`,
`duration_ms`, `deploy.version`, `log.level`, and `timestamp`, so an agent can
run a DQL query such as:

```
fetch logs
| filter service.name == "worldcup-fan-gateway"
| summarize p95 = percentile(duration_ms, 95)
```

On every deploy and rollback the service emits a Dynatrace event to
`/api/v2/events/ingest` describing the change.

## Load generator

`loadgen.py` drives steady baseline traffic against the three data endpoints
so there is always telemetry flowing.

```
BASE_URL=http://localhost:8080 RPS=5 python loadgen.py
```

It prints a running tally of requests, errors, and rolling latency.

## Container

```
docker build -t worldcup-fan-gateway .
docker run -p 8080:8080 \
  -e DT_INGEST_BASE=https://abc12345.live.dynatrace.com \
  -e DT_API_TOKEN=your-token \
  worldcup-fan-gateway
```

The image runs uvicorn on `$PORT` (default 8080), matching the Cloud Run
convention.
