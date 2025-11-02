# GBP Business Hours Mirror Test Script (flag-gated)
# Usage: powershell -ExecutionPolicy Bypass -File .\scripts\test_hours.ps1

# -------- Config --------
$API = $env:API_BASE_URL
if (-not $API -or $API -eq "") { $API = "http://localhost:4000" }
$TENANT = "cmhe0edxg0002g8s8bba4j2s0"   # change if needed
$TOKEN = "$env:ACCESS_TOKEN"          # optional Authorization

function Show-Section($t){Write-Host "`n=== $t ===" -ForegroundColor Cyan}

$headers = @{ "Content-Type" = "application/json" }
if ($TOKEN) { $headers["Authorization"] = "Bearer $TOKEN" }

Show-Section "Check Flag"
Write-Host "Ensure FF_TENANT_GBP_HOURS_SYNC=true in API env (Doppler) then restart."

Show-Section "GET business-hours (default)"
try {
  $r = Invoke-RestMethod -Uri "$API/api/tenant/$TENANT/business-hours" -Headers $headers -Method GET -ErrorAction Stop
  $r | Format-List | Out-String | Write-Host
} catch { Write-Host "GET business-hours failed" -ForegroundColor Red }

Show-Section "PUT business-hours (set timezone + one period)"
$putBody = @{ timezone = "America/New_York"; periods = @(@{ day = "MONDAY"; open = "09:00"; close = "17:00" }) } | ConvertTo-Json -Depth 4
try {
  Invoke-RestMethod -Uri "$API/api/tenant/$TENANT/business-hours" -Headers $headers -Method PUT -Body $putBody -ErrorAction Stop | Out-Null
  Write-Host "Updated"
} catch { Write-Host "PUT business-hours failed" -ForegroundColor Red }

Show-Section "PUT special-hours (holiday)"
$hol = @{ overrides = @(@{ date = (Get-Date).AddDays(30).ToString('yyyy-MM-dd'); open = "10:00"; close = "14:00"; note = "Holiday" }) } | ConvertTo-Json -Depth 4
try {
  Invoke-RestMethod -Uri "$API/api/tenant/$TENANT/business-hours/special" -Headers $headers -Method PUT -Body $hol -ErrorAction Stop | Out-Null
  Write-Host "Special hours updated"
} catch { Write-Host "PUT special-hours failed" -ForegroundColor Red }

Show-Section "Mirror to GBP (enqueue)"
try {
  Invoke-RestMethod -Uri "$API/api/tenant/$TENANT/gbp/hours/mirror" -Headers $headers -Method POST -ErrorAction Stop | Out-Null
  Write-Host "Mirror enqueued (202)"
} catch { Write-Host "POST mirror failed" -ForegroundColor Red }

Start-Sleep -Seconds 1
Show-Section "Mirror status"
try {
  $s = Invoke-RestMethod -Uri "$API/api/tenant/$TENANT/gbp/hours/status" -Headers $headers -Method GET -ErrorAction Stop
  $s | Format-List | Out-String | Write-Host
} catch { Write-Host "GET status failed" -ForegroundColor Red }
