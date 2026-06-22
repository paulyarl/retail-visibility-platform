#!/bin/bash
# Test script for Phase 1 CRM persistent read state
# Tenant: tid-jcvzufq2
#
# Usage:
#   ./scripts/test-crm-read-state.sh

set -euo pipefail

TENANT_ID="tid-jcvzufq2"
API_URL="${API_URL:-http://localhost:4000}"
AUTH0_EMAIL="${AUTH0_EMAIL:-yarlmoment@gmail.com}"
AUTH0_ID="${AUTH0_ID:-google-oauth2|101197082777619041667}"

if ! command -v jq >/dev/null 2>&1; then
  echo "ERROR: jq is required but not installed." >&2
  exit 1
fi

COMMON_HEADERS=(
  -H "Content-Type: application/json"
  -H "x-auth0-email: $AUTH0_EMAIL"
  -H "x-auth0-id: $AUTH0_ID"
  -H "X-Tenant-ID: $TENANT_ID"
)

echo "=== CRM Read State Test: $TENANT_ID ==="
echo "API URL: $API_URL"
echo "Auth0 email: $AUTH0_EMAIL"
echo ""

echo "1. Get stats (initial)"
curl -s "$API_URL/api/tenant/crm/stats" "${COMMON_HEADERS[@]}" | jq .
echo ""

echo "2. Get read state (initial)"
curl -s "$API_URL/api/tenant/crm/read-state" "${COMMON_HEADERS[@]}" | jq .
echo ""

echo "3. Mark activity feed read"
curl -s -X PUT "$API_URL/api/tenant/crm/read-state" \
  "${COMMON_HEADERS[@]}" \
  -d '{"scope":"activity_feed"}' | jq .
echo ""

echo "4. Get read state after marking read"
curl -s "$API_URL/api/tenant/crm/read-state" "${COMMON_HEADERS[@]}" | jq .
echo ""

echo "5. Get stats after marking read (expect unread_activity_count = 0)"
curl -s "$API_URL/api/tenant/crm/stats" "${COMMON_HEADERS[@]}" | jq .
echo ""

echo "6. Mark alert feed read"
curl -s -X PUT "$API_URL/api/tenant/crm/read-state" \
  "${COMMON_HEADERS[@]}" \
  -d '{"scope":"alert_feed"}' | jq .
echo ""

echo "7. Get stats after marking alerts read (expect unread_alert_count = 0)"
curl -s "$API_URL/api/tenant/crm/stats" "${COMMON_HEADERS[@]}" | jq .
echo ""

echo "=== Test complete ==="
