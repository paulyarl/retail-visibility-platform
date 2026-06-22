# Test script for Phase 1 CRM persistent read state
# Tenant: tid-jcvzufq2
#
# Usage:
#   .\scripts\test-crm-read-state.ps1

param(
  [string]$TenantId = "tid-jcvzufq2",
  [string]$ApiUrl = "http://localhost:4000",
  [string]$Auth0Email = $env:AUTH0_EMAIL,
  [string]$Auth0Id = $env:AUTH0_ID
)

if (-not $Auth0Email) {
  $Auth0Email = "yarlmoment@gmail.com"
}

if (-not $Auth0Id) {
  $Auth0Id = "google-oauth2|101197082777619041667"
}

$headers = @{
  "Content-Type" = "application/json"
  "x-auth0-email" = $Auth0Email
  "x-auth0-id" = $Auth0Id
  "X-Tenant-ID" = $TenantId
}

function Invoke-Test {
  param([string]$Label, [string]$Method, [string]$Path, [string]$Body = $null)
  Write-Host "=== $Label ==="
  $uri = "$ApiUrl$Path"
  if ($Body) {
    $response = Invoke-RestMethod -Uri $uri -Method $Method -Headers $headers -Body $Body
  } else {
    $response = Invoke-RestMethod -Uri $uri -Method $Method -Headers $headers
  }
  $response | ConvertTo-Json -Depth 10
  Write-Host ""
}

Write-Host "=== CRM Read State Test: $TenantId ==="
Write-Host "API URL: $ApiUrl"
Write-Host "Auth0 email: $Auth0Email"
Write-Host ""

Invoke-Test -Label "1. Get stats (initial)" -Method GET -Path "/api/tenant/crm/stats"
Invoke-Test -Label "2. Get read state (initial)" -Method GET -Path "/api/tenant/crm/read-state"
Invoke-Test -Label "3. Mark activity feed read" -Method PUT -Path "/api/tenant/crm/read-state" -Body '{"scope":"activity_feed"}'
Invoke-Test -Label "4. Get read state after marking read" -Method GET -Path "/api/tenant/crm/read-state"
Invoke-Test -Label "5. Get stats after marking read (expect unread_activity_count = 0)" -Method GET -Path "/api/tenant/crm/stats"
Invoke-Test -Label "6. Mark alert feed read" -Method PUT -Path "/api/tenant/crm/read-state" -Body '{"scope":"alert_feed"}'
Invoke-Test -Label "7. Get stats after marking alerts read (expect unread_alert_count = 0)" -Method GET -Path "/api/tenant/crm/stats"

Write-Host "=== Test complete ==="
