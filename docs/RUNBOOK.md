# Runbook: the few things only you can do

The code is done and verified. This is the short list of actions that need your
identity: creating the Dynatrace trial, minting tokens, pushing the repo,
deploying, recording, and submitting. Budget about 60 to 90 minutes.

Work top to bottom. Every command is copy and paste.

---

## 1. Create the Dynatrace trial (about 5 minutes)

1. Go to `https://www.dynatrace.com/trial` and sign up. No credit card. Pick the
   SaaS option and let it provision your environment.
2. When it is ready, note two URLs from the browser address bar and the
   deploy page:
   - **Platform URL**, looks like `https://abc12345.apps.dynatrace.com`. This is `DT_ENVIRONMENT`.
   - **Live URL**, looks like `https://abc12345.live.dynatrace.com`. This is `DT_INGEST_BASE`.
   The eight character id (`abc12345`) is the same in both.

## 2. Mint the Platform Token for Keeper (about 5 minutes)

Keeper authenticates to the Dynatrace MCP server with a platform token.

1. In Dynatrace, open the menu and search for **Platform tokens** (also found
   under Settings, Access tokens). Create a new token named `keeper-mcp`.
2. Give it these scopes (paste the names into the scope search as you add each):
   ```
   app-engine:apps:run
   storage:buckets:read
   storage:logs:read
   storage:metrics:read
   storage:spans:read
   storage:entities:read
   storage:events:read
   storage:system:read
   storage:smartscape:read
   storage:events:write
   document:documents:read
   document:documents:write
   email:emails:send
   davis-copilot:conversations:execute
   davis:analyzers:execute
   app-settings:objects:read
   ```
3. Copy the token value. This is `DT_PLATFORM_TOKEN`. You will not see it again.

## 3. Mint the API Token for the fan gateway (about 3 minutes)

The World Cup fan gateway pushes its telemetry to Dynatrace so Keeper can see it.

1. In Dynatrace, open **Access tokens** (the classic one), create a token named
   `keeper-ingest`.
2. Give it these scopes:
   ```
   logs.ingest
   events.ingest
   metrics.ingest
   ```
3. Copy the token value. This is `DT_API_TOKEN`.

## 4. Push the repository to GitHub (about 5 minutes)

The repo already has the MIT `LICENSE` file at the root, so GitHub will detect
and show it in the About panel, which the rules require.

From this project folder on your machine:

```
git init
git add .
git commit -m "Keeper: autonomous SRE agent for the Dynatrace track"
git branch -M main
git remote add origin https://github.com/<your-user>/keeper.git
git push -u origin main
```

Create the empty `keeper` repo on GitHub first and make it **public**. Confirm
the About panel on the repo page shows "MIT License".

## 5. Deploy everything to Cloud Run (about 15 minutes)

Use **Google Cloud Shell**, it already has gcloud and Docker. Open
`https://shell.cloud.google.com`, then:

```
git clone https://github.com/<your-user>/keeper.git
cd keeper

export PROJECT_ID="<your-gcp-project-id>"
export REGION="us-central1"
export DT_ENVIRONMENT="https://abc12345.apps.dynatrace.com"
export DT_PLATFORM_TOKEN="<paste platform token>"
export DT_INGEST_BASE="https://abc12345.live.dynatrace.com"
export DT_API_TOKEN="<paste api token>"

bash deploy/deploy.sh
```

The script enables the APIs, deploys the fan gateway, deploys Keeper wired to it,
grants Vertex AI access to the runtime service account, then builds and deploys
Mission Control pointed at Keeper. It prints three URLs at the end. The Mission
Control URL is your hosted project URL for the submission.

## 6. Prime the data and rehearse the run (about 10 minutes)

1. Open the **fan gateway** URL to confirm the status page loads.
2. Generate a minute of baseline traffic so Grail has a healthy baseline. In
   Cloud Shell:
   ```
   pip install --quiet httpx
   BASE_URL="<fan gateway url>" RPS=8 python victim/loadgen.py
   ```
   Let it run for a minute, then stop it with Ctrl C.
3. Open **Mission Control**. Click **Start Run**. Keeper ships a simulated bad
   deploy, detects the spike, diagnoses it, and pauses for your approval. Click
   **Approve**, then watch it remediate, verify recovery, and file the
   postmortem. Confirm the postmortem notebook appears in Dynatrace.
4. If the live tenant is ever slow during recording, you have two safety nets:
   set `KEEPER_DEMO=1` on the Keeper service for a scripted backend run, or open
   Mission Control with `?mock=1` for a fully self-contained replay. Both look
   identical on screen.

## 7. Record the 3 minute video

Follow [docs/DEMO_SCRIPT.md](DEMO_SCRIPT.md) shot by shot. Keep it close to three
minutes. Upload to YouTube as unlisted or public and copy the link.

## 8. Fill in the Devpost submission

Open [docs/DEVPOST.md](DEVPOST.md) and paste each section into the matching
Devpost field. Select the **Dynatrace** track. Add the hosted Mission Control
URL, the public GitHub URL, and the video URL.

## 9. Submit before the deadline

Deadline is Jun 12, 2026 at 2:30am GMT+5:30. Submit with time to spare. After
submitting, paste the live URLs back into the repository `README.md` where it
says `<ADD_HOSTED_URL>` and `<ADD_VIDEO_URL>`, then push again.

---

### Quick reference: the environment values you collected

| Variable             | Where it came from                         |
|----------------------|--------------------------------------------|
| `PROJECT_ID`         | your Google Cloud project                  |
| `DT_ENVIRONMENT`     | Dynatrace platform url (apps)              |
| `DT_INGEST_BASE`     | Dynatrace live url                         |
| `DT_PLATFORM_TOKEN`  | platform token `keeper-mcp`                |
| `DT_API_TOKEN`       | API token `keeper-ingest`                  |
