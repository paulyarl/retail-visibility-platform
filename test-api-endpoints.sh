#!/bin/bash
# API Endpoint Testing Script for Digital Products
# Tests all download and digital asset endpoints
# Requires: curl, jq (optional for JSON formatting)

# Configuration - Update these values for your environment
BASE_URL="http://localhost:4000"
TENANT_ID="tid-fjwr30ib"
AUTH0_EMAIL="yarlmoment@gmail.com"
AUTH0_ID="google-oauth2|101197082777619041667"
ACCESS_TOKEN="test_access_token"  # For public download endpoints
ORDER_ID="order_123"
ASSET_ID=""
ITEM_ID="item_123"

echo ""
echo "========================================"
echo "Digital Products API Endpoint Tests"
echo "========================================"
echo "Base URL: $BASE_URL"
echo "Tenant ID: $TENANT_ID"
echo ""

# Check if server is running
echo "[CHECK] Testing server availability..."
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/health" 2>/dev/null)

if [ "$STATUS" != "200" ]; then
    echo "[WARN] Server may not be running. Start with: pnpm dev"
    echo ""
fi

# ============================================
# Public Download Endpoints (no auth required)
# ============================================
echo ""
echo "========================================"
echo "PUBLIC DOWNLOAD ENDPOINTS"
echo "========================================"

echo ""
echo "[TEST 1] GET /api/download/:accessToken"
echo "Testing: Download via access token (public)"
curl -s -X GET "$BASE_URL/api/download/$ACCESS_TOKEN" -H "Content-Type: application/json" | jq . 2>/dev/null || curl -s -X GET "$BASE_URL/api/download/$ACCESS_TOKEN"
echo ""

echo ""
echo "[TEST 2] GET /api/download/:accessToken/info"
echo "Testing: Get download info without triggering download (public)"
curl -s -X GET "$BASE_URL/api/download/$ACCESS_TOKEN/info" -H "Content-Type: application/json" | jq . 2>/dev/null || curl -s -X GET "$BASE_URL/api/download/$ACCESS_TOKEN/info"
echo ""

echo ""
echo "[TEST 3] GET /api/download/orders/:orderId/downloads"
echo "Testing: Get all downloads for an order (public)"
curl -s -X GET "$BASE_URL/api/download/orders/$ORDER_ID/downloads" -H "Content-Type: application/json" | jq . 2>/dev/null || curl -s -X GET "$BASE_URL/api/download/orders/$ORDER_ID/downloads"
echo ""

# ============================================
# Digital Asset Singleton Endpoints (requires Auth0)
# ============================================
echo ""
echo "========================================"
echo "DIGITAL ASSET SINGLETON ENDPOINTS"
echo "========================================"

echo ""
echo "[TEST 4] POST /api/digital-asset-singleton/upload"
echo "Testing: Upload digital asset (requires Auth0)"
curl -s -X POST "$BASE_URL/api/digital-asset-singleton/upload" \
  -H "Content-Type: application/json" \
  -H "x-auth0-email: ${AUTH0_EMAIL}" \
  -H "x-auth0-id: ${AUTH0_ID}" \
  -d "{\"tenantId\":\"$TENANT_ID\",\"productId\":\"$ITEM_ID\",\"fileName\":\"test.pdf\",\"mimeType\":\"application/pdf\",\"file\":\"dGVzdCBmaWxlIGNvbnRlbnQ=\",\"description\":\"Test file\"}" | jq . 2>/dev/null || curl -s -X POST "$BASE_URL/api/digital-asset-singleton/upload" \
  -H "Content-Type: application/json" \
  -H "x-auth0-email: ${AUTH0_EMAIL}" \
  -H "x-auth0-id: ${AUTH0_ID}" \
  -d "{\"tenantId\":\"$TENANT_ID\",\"productId\":\"$ITEM_ID\",\"fileName\":\"test.pdf\",\"mimeType\":\"application/pdf\",\"file\":\"dGVzdCBmaWxlIGNvbnRlbnQ=\",\"description\":\"Test file\"}"
echo ""

echo ""
echo "[TEST 5] GET /api/digital-asset-singleton/asset/:assetId"
echo "Testing: Get asset by ID (requires Auth0)"
if [ -z "$ASSET_ID" ]; then
    echo "[SKIP] Set ASSET_ID variable to test this endpoint"
else
    curl -s -X GET "$BASE_URL/api/digital-asset-singleton/asset/$ASSET_ID" \
      -H "Content-Type: application/json" \
      -H "x-auth0-email: ${AUTH0_EMAIL}" \
      -H "x-auth0-id: ${AUTH0_ID}" | jq . 2>/dev/null || curl -s -X GET "$BASE_URL/api/digital-asset-singleton/asset/$ASSET_ID" \
      -H "Content-Type: application/json" \
      -H "x-auth0-email: ${AUTH0_EMAIL}" \
      -H "x-auth0-id: ${AUTH0_ID}"
fi
echo ""

echo ""
echo "[TEST 6] GET /api/digital-asset-singleton/assets/:tenantId"
echo "Testing: List assets for tenant (requires Auth0)"
curl -s -X GET "$BASE_URL/api/digital-asset-singleton/assets/$TENANT_ID" \
  -H "Content-Type: application/json" \
  -H "x-auth0-email: ${AUTH0_EMAIL}" \
  -H "x-auth0-id: ${AUTH0_ID}" | jq . 2>/dev/null || curl -s -X GET "$BASE_URL/api/digital-asset-singleton/assets/$TENANT_ID" \
  -H "Content-Type: application/json" \
  -H "x-auth0-email: ${AUTH0_EMAIL}" \
  -H "x-auth0-id: ${AUTH0_ID}"
echo ""

echo ""
echo "========================================"
echo "Test Complete"
echo "========================================"
echo ""
echo "NOTE: Download endpoints (1-3) use access tokens from orders."
echo "      Asset endpoints (4-6) require Auth0 headers."
echo "      Tests that return 404 may need valid IDs."
echo "      Set ACCESS_TOKEN, ORDER_ID, and ASSET_ID for full testing."
echo ""
