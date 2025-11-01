param(
  [string]$TenantId = $env:TEST_TENANT_ID,
  [string]$ApiUrl = "http://localhost:4000"
)

if (-not $TenantId -or [string]::IsNullOrWhiteSpace($TenantId)) {
  Write-Host "`nUsage: .\test-day45.ps1 -TenantId <tenant-id> [-ApiUrl http://localhost:4000]`n" -ForegroundColor Yellow
  exit 1
}

Write-Host "`n🧪 Day 4-5 Test Runner" -ForegroundColor Cyan
Write-Host ("=" * 60)
Write-Host "API: $ApiUrl" -ForegroundColor Gray
Write-Host "Tenant: $TenantId`n" -ForegroundColor Gray

# 1) Taxonomy sync
Write-Host "1) Running taxonomy sync..." -ForegroundColor Yellow
$sync = & "$PSScriptRoot\test-taxonomy-sync.ps1" -ApiUrl $ApiUrl

# 2) Tenant categories tests
Write-Host "`n2) Running tenant categories tests..." -ForegroundColor Yellow
& "$PSScriptRoot\test-tenant-categories.ps1" -TenantId $TenantId -ApiUrl $ApiUrl

Write-Host "`n$("="*60)" -ForegroundColor DarkGray
Write-Host "🎉 Day 4-5 Test Runner completed." -ForegroundColor Cyan
