#!/usr/bin/env bash
#
# One-shot deploy of all three Keeper services to Cloud Run.
# Run this in Google Cloud Shell (it has gcloud and docker ready).
#
# Required environment variables (export them before running):
#   PROJECT_ID            your Google Cloud project id
#   DT_ENVIRONMENT        Dynatrace platform url, e.g. https://abc12345.apps.dynatrace.com
#   DT_PLATFORM_TOKEN     Dynatrace platform token (scopes in docs/RUNBOOK.md)
#   DT_INGEST_BASE        Dynatrace live url, e.g. https://abc12345.live.dynatrace.com
#   DT_API_TOKEN          Dynatrace API token with logs/events/metrics ingest
# Optional:
#   REGION                default us-central1
#   KEEPER_MODEL          default gemini-3.1-pro-preview
#   DT_SLACK_CONNECTION_ID  if you want live Slack posts
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(dirname "$SCRIPT_DIR")"

PROJECT_ID="${PROJECT_ID:?set PROJECT_ID}"
REGION="${REGION:-us-central1}"
DT_ENVIRONMENT="${DT_ENVIRONMENT:?set DT_ENVIRONMENT}"
DT_PLATFORM_TOKEN="${DT_PLATFORM_TOKEN:?set DT_PLATFORM_TOKEN}"
DT_INGEST_BASE="${DT_INGEST_BASE:?set DT_INGEST_BASE}"
DT_API_TOKEN="${DT_API_TOKEN:?set DT_API_TOKEN}"
DT_SLACK_CONNECTION_ID="${DT_SLACK_CONNECTION_ID:-}"
MODEL="${KEEPER_MODEL:-gemini-3.1-pro-preview}"
SERVICE="${KEEPER_TARGET_SERVICE:-worldcup-fan-gateway}"

gcloud config set project "$PROJECT_ID"

echo "==> Enabling APIs"
gcloud services enable \
  run.googleapis.com \
  aiplatform.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com

echo "==> [1/3] Deploying the World Cup fan gateway (protected service)"
gcloud run deploy "$SERVICE" \
  --source "$ROOT/victim" \
  --region "$REGION" \
  --allow-unauthenticated \
  --set-env-vars "DT_INGEST_BASE=$DT_INGEST_BASE,DT_API_TOKEN=$DT_API_TOKEN" \
  --quiet
VICTIM_URL="$(gcloud run services describe "$SERVICE" --region "$REGION" --format='value(status.url)')"
echo "    gateway: $VICTIM_URL"

echo "==> [2/3] Deploying the Keeper agent (ADK + Gemini 3.1 Pro + Dynatrace MCP)"
gcloud run deploy keeper-agent \
  --source "$ROOT/agent" \
  --region "$REGION" \
  --allow-unauthenticated \
  --memory 2Gi --cpu 2 --timeout 900 \
  --set-env-vars "GOOGLE_CLOUD_PROJECT=$PROJECT_ID,GOOGLE_CLOUD_LOCATION=$REGION,GOOGLE_GENAI_USE_VERTEXAI=TRUE,KEEPER_MODEL=$MODEL,DT_ENVIRONMENT=$DT_ENVIRONMENT,DT_PLATFORM_TOKEN=$DT_PLATFORM_TOKEN,VICTIM_BASE_URL=$VICTIM_URL,KEEPER_TARGET_SERVICE=$SERVICE,DT_SLACK_CONNECTION_ID=$DT_SLACK_CONNECTION_ID,KEEPER_PACE_SECONDS=1.6" \
  --quiet
AGENT_URL="$(gcloud run services describe keeper-agent --region "$REGION" --format='value(status.url)')"
echo "    keeper: $AGENT_URL"

echo "==> Granting Vertex AI access to the Cloud Run runtime service account"
PROJECT_NUMBER="$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')"
RUNTIME_SA="$PROJECT_NUMBER-compute@developer.gserviceaccount.com"
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member "serviceAccount:$RUNTIME_SA" \
  --role roles/aiplatform.user --quiet >/dev/null || true

echo "==> [3/3] Building and deploying Mission Control (frontend wired to Keeper)"
REPO="keeper"
gcloud artifacts repositories create "$REPO" \
  --repository-format=docker --location "$REGION" --quiet 2>/dev/null || true
gcloud auth configure-docker "$REGION-docker.pkg.dev" --quiet
IMAGE="$REGION-docker.pkg.dev/$PROJECT_ID/$REPO/mission-control:latest"
docker build \
  --build-arg VITE_KEEPER_URL="$AGENT_URL" \
  --build-arg VITE_MOCK=0 \
  -t "$IMAGE" "$ROOT/web"
docker push "$IMAGE"
gcloud run deploy keeper-mission-control \
  --image "$IMAGE" \
  --region "$REGION" \
  --allow-unauthenticated \
  --quiet
WEB_URL="$(gcloud run services describe keeper-mission-control --region "$REGION" --format='value(status.url)')"

echo ""
echo "============================================================"
echo " Keeper is live."
echo "   Mission Control : $WEB_URL"
echo "   Keeper agent    : $AGENT_URL"
echo "   Fan gateway     : $VICTIM_URL"
echo "============================================================"
echo " Use $WEB_URL as the hosted project URL in your submission."
echo " To run the full live story, open Mission Control and click Start Run,"
echo " or trigger it directly:"
echo "   curl -X POST $AGENT_URL/api/run -H 'Content-Type: application/json' -d '{\"inject\": true}'"
