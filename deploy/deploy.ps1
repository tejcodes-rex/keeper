# Windows deploy runner for Keeper. Deploys all three services to Cloud Run.
# Reads PROJECT_ID and the DT_* values from the environment.
$env:Path = "$env:LOCALAPPDATA\Google\Cloud SDK\google-cloud-sdk\bin;$env:Path"
function Die($m) { Write-Host "DEPLOY_FAILED: $m"; exit 1 }

$PROJECT_ID = $env:PROJECT_ID; if (-not $PROJECT_ID) { Die "PROJECT_ID not set" }
$REGION = if ($env:REGION) { $env:REGION } else { "us-central1" }
$VLOC = if ($env:VERTEX_LOCATION) { $env:VERTEX_LOCATION } else { "global" }
$MODEL = if ($env:KEEPER_MODEL) { $env:KEEPER_MODEL } else { "gemini-3.1-pro-preview" }
$SERVICE = "worldcup-fan-gateway"
$ROOT = Split-Path -Parent $PSScriptRoot

gcloud config set project $PROJECT_ID | Out-Null

Write-Host "==> Enabling APIs"
gcloud services enable run.googleapis.com aiplatform.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com
if ($LASTEXITCODE -ne 0) { Die "enable services" }
gcloud config set builds/timeout 1200 | Out-Null

Write-Host "==> [1/3] Deploying World Cup fan gateway"
gcloud run deploy $SERVICE --source "$ROOT\victim" --region $REGION --allow-unauthenticated --set-env-vars="DT_INGEST_BASE=$($env:DT_INGEST_BASE),DT_API_TOKEN=$($env:DT_API_TOKEN)" --quiet
if ($LASTEXITCODE -ne 0) { Die "victim deploy" }
$VICTIM_URL = (gcloud run services describe $SERVICE --region $REGION --format="value(status.url)")
Write-Host "VICTIM_URL=$VICTIM_URL"

Write-Host "==> [2/3] Deploying Keeper agent"
$envvars = "GOOGLE_CLOUD_PROJECT=$PROJECT_ID,GOOGLE_CLOUD_LOCATION=$VLOC,GOOGLE_GENAI_USE_VERTEXAI=TRUE,KEEPER_MODEL=$MODEL,DT_ENVIRONMENT=$($env:DT_ENVIRONMENT),DT_PLATFORM_TOKEN=$($env:DT_PLATFORM_TOKEN),VICTIM_BASE_URL=$VICTIM_URL,KEEPER_TARGET_SERVICE=$SERVICE,KEEPER_PACE_SECONDS=1.6"
gcloud run deploy keeper-agent --source "$ROOT\agent" --region $REGION --allow-unauthenticated --memory 2Gi --cpu 2 --timeout 900 --set-env-vars="$envvars" --quiet
if ($LASTEXITCODE -ne 0) { Die "agent deploy" }
$AGENT_URL = (gcloud run services describe keeper-agent --region $REGION --format="value(status.url)")
Write-Host "AGENT_URL=$AGENT_URL"

Write-Host "==> Granting Vertex AI access to runtime service account"
$PNUM = (gcloud projects describe $PROJECT_ID --format="value(projectNumber)")
gcloud projects add-iam-policy-binding $PROJECT_ID --member="serviceAccount:$PNUM-compute@developer.gserviceaccount.com" --role="roles/aiplatform.user" --quiet | Out-Null

Write-Host "==> [3/3] Building and deploying Mission Control"
gcloud artifacts repositories create keeper --repository-format=docker --location $REGION --quiet 2>$null
$IMAGE = "$REGION-docker.pkg.dev/$PROJECT_ID/keeper/mission-control:latest"
gcloud builds submit "$ROOT\web" --config "$ROOT\web\cloudbuild.yaml" --substitutions "_KEEPER_URL=$AGENT_URL,_IMAGE=$IMAGE" --quiet
if ($LASTEXITCODE -ne 0) { Die "web build" }
gcloud run deploy keeper-mission-control --image $IMAGE --region $REGION --allow-unauthenticated --quiet
if ($LASTEXITCODE -ne 0) { Die "web deploy" }
$WEB_URL = (gcloud run services describe keeper-mission-control --region $REGION --format="value(status.url)")

Write-Host "============================================================"
Write-Host "MISSION_CONTROL=$WEB_URL"
Write-Host "KEEPER_AGENT=$AGENT_URL"
Write-Host "FAN_GATEWAY=$VICTIM_URL"
Write-Host "DEPLOY_DONE"
