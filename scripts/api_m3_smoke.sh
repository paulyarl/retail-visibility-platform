#!/usr/bin/env bash
# Simple Git Bash/Unix smoke test for M3 category endpoints
# Usage:
#   export TOKEN='YOUR_ADMIN_JWT'
#   export BASE_URL='https://aps.visibleshelf.store'
#   export TENANT_ID='tenant_...' # optional for tenant/mirror tests
#   bash scripts/api_m3_smoke.sh

set -euo pipefail

: "${TOKEN:?TOKEN env is required}"
BASE_URL="${BASE_URL:-https://aps.visibleshelf.store}"
TENANT_ID="${TENANT_ID:-}"

hr() { printf '%*s\n' "$(tput cols 2>/dev/null || echo 80)" '' | tr ' ' '-'; }
step() { echo; hr; echo "[STEP] $*"; hr; }
# Pretty-print helper (jq optional)
HAS_JQ="false"
if command -v jq >/dev/null 2>&1; then HAS_JQ="true"; fi
pp() { if [ "$HAS_JQ" = "true" ]; then jq .; else cat; fi }

echo "BASE_URL=${BASE_URL}"
echo "TENANT_ID=${TENANT_ID:-<none>}"

curl_json() {
  local method="$1"; shift
  local url="$1"; shift
  local data="${1-}"
  if [[ -n "${data}" ]]; then
    curl -sS -X "${method}" \
      -H "Authorization: Bearer ${TOKEN}" \
      -H "Content-Type: application/json" \
      -d "${data}" \
      "${url}"
  else
    curl -sS -X "${method}" \
      -H "Authorization: Bearer ${TOKEN}" \
      "${url}"
  fi
}

step "GET platform categories"
curl_json GET "${BASE_URL}/api/platform/categories" | pp

if [[ -n "${TENANT_ID}" ]]; then
  step "GET tenant categories"
  curl_json GET "${BASE_URL}/api/tenant/${TENANT_ID}/categories" | pp

  step "POST mirror (dryRun=true) platform_to_gbp"
  curl_json POST "${BASE_URL}/api/categories/mirror" "{\"strategy\":\"platform_to_gbp\",\"tenantId\":\"${TENANT_ID}\",\"dryRun\":true}" | pp

  echo "Note: Mirror endpoint has a 60s cooldown per {strategy,tenant}. Running again immediately may be skipped."
  # Allow the worker a moment to update the run summary
  sleep 2
  
  step "GET admin last-run summary"
  curl_json GET "${BASE_URL}/api/admin/mirror/last-run?tenantId=${TENANT_ID}&strategy=platform_to_gbp" | pp

  # Optional: run a write-mode mirror to populate GBP state
  if [[ "${RUN_WRITE:-0}" == "1" ]]; then
    step "POST mirror (dryRun=false) platform_to_gbp [WRITE MODE]"
    curl_json POST "${BASE_URL}/api/categories/mirror" "{\"strategy\":\"platform_to_gbp\",\"tenantId\":\"${TENANT_ID}\",\"dryRun\":false}" | pp
    echo "Note: Cooldown applies per {strategy,tenant}; this may be skipped if run within 60s."
    sleep 2

    step "GET admin last-run summary (after write)"
    curl_json GET "${BASE_URL}/api/admin/mirror/last-run?tenantId=${TENANT_ID}&strategy=platform_to_gbp" | pp
  fi
else
  echo "TENANT_ID not set; skipping tenant list and mirror tests"
fi

step "Done"
