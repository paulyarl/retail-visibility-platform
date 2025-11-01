# ISR Revalidation Test Script
# Usage: powershell -ExecutionPolicy Bypass -File .\scripts\test_revalidate.ps1

# -------- Config --------
$WEB = $env:WEB_URL
if (-not $WEB -or $WEB -eq "") { $WEB = "http://localhost:3000" }
$TENANT = "cmhe0edxg0002g8s8bba4j2s0"   # change if needed
$SECRET = "$env:REVALIDATE_SECRET"

function Show-Section($t){Write-Host "`n=== $t ===" -ForegroundColor Cyan}

Show-Section "Revalidate"
if (-not $SECRET -or $SECRET -eq "") {
  Write-Host "REVALIDATE_SECRET not set in env. Set via Doppler: doppler secrets set REVALIDATE_SECRET=<secret>" -ForegroundColor Yellow
}

$headers = @{ "x-revalidate-secret" = $SECRET; "Content-Type" = "application/json" }
$bodyObj = @{ tenantId = $TENANT }
$body = $bodyObj | ConvertTo-Json

try {
  $resp = Invoke-RestMethod -Uri "$WEB/api/revalidate" -Method POST -Headers $headers -Body $body -ErrorAction Stop
  Write-Host "Status: OK" -ForegroundColor Green
  $resp | Format-List | Out-String | Write-Host
} catch {
  $code = $_.Exception.Response.StatusCode.value__
  Write-Host "Request failed with status $code" -ForegroundColor Red
  try {
    $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
    $text = $reader.ReadToEnd()
    Write-Host $text
  } catch {}
}
