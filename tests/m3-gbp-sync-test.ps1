# M3 GBP Category Sync - Automated Test Script (PowerShell)
# Tests out-of-sync detection, sync logs API, and admin dashboard integration
# Usage: .\tests\m3-gbp-sync-test.ps1

param(
    [string]$ApiBaseUrl = $env:API_BASE_URL ?? "http://localhost:4000",
    [string]$WebBaseUrl = $env:WEB_BASE_URL ?? "http://localhost:3000",
    [string]$AdminToken = $env:ADMIN_TOKEN ?? "",
    [string]$TestTenantId = $env:TEST_TENANT_ID ?? ""
)

# Colors
$Red = "Red"
$Green = "Green"
$Yellow = "Yellow"
$Blue = "Cyan"

function Print-Test {
    param([string]$Message)
    Write-Host "[TEST] $Message" -ForegroundColor $Yellow
}

function Print-Success {
    param([string]$Message)
    Write-Host "[PASS] $Message" -ForegroundColor $Green
}

function Print-Error {
    param([string]$Message)
    Write-Host "[FAIL] $Message" -ForegroundColor $Red
}

function Print-Info {
    param([string]$Message)
    Write-Host "[INFO] $Message" -ForegroundColor $Blue
}

Write-Host "========================================" -ForegroundColor $Blue
Write-Host "M3 GBP Category Sync Test Suite" -ForegroundColor $Blue
Write-Host "========================================" -ForegroundColor $Blue
Write-Host ""

# Check prerequisites
Print-Info "Checking prerequisites..."

if ([string]::IsNullOrEmpty($AdminToken)) {
    Print-Error "ADMIN_TOKEN not set. Please set it in your environment"
    Write-Host "Example: `$env:ADMIN_TOKEN = 'your-admin-jwt-token'" -ForegroundColor $Yellow
    exit 1
}

Print-Success "Admin token found"
Print-Info "API Base URL: $ApiBaseUrl"
Print-Info "Web Base URL: $WebBaseUrl"

# Test 1: Verify API is running
Print-Test "Test 1: Verify API is running"
try {
    $healthResponse = Invoke-WebRequest -Uri "$ApiBaseUrl/health" -Method Get -UseBasicParsing -ErrorAction Stop
    Print-Success "API is running at $ApiBaseUrl"
} catch {
    Print-Error "API is not responding at $ApiBaseUrl"
    Write-Host $_.Exception.Message -ForegroundColor $Red
    exit 1
}

# Test 2: Get sync stats endpoint
Print-Test "Test 2: GET /api/admin/sync-stats"
try {
    $headers = @{
        "Authorization" = "Bearer $AdminToken"
    }
    
    $statsResponse = Invoke-RestMethod -Uri "$ApiBaseUrl/api/admin/sync-stats" -Method Get -Headers $headers -ErrorAction Stop
    Print-Success "Sync stats endpoint returned 200"
    
    $statsResponse | ConvertTo-Json -Depth 5
    
    $totalRuns = $statsResponse.stats.totalRuns ?? 0
    $successRate = $statsResponse.stats.successRate ?? 0
    $outOfSync = $statsResponse.stats.outOfSyncCount ?? 0
    
    Print-Info "Total Runs (24h): $totalRuns"
    Print-Info "Success Rate: ${successRate}%"
    Print-Info "Out of Sync Count: $outOfSync"
} catch {
    Print-Error "Sync stats endpoint failed"
    Write-Host $_.Exception.Message -ForegroundColor $Red
}

# Test 3: Get sync logs endpoint
Print-Test "Test 3: GET /api/admin/sync-logs"
try {
    $logsResponse = Invoke-RestMethod -Uri "$ApiBaseUrl/api/admin/sync-logs?limit=5" -Method Get -Headers $headers -ErrorAction Stop
    Print-Success "Sync logs endpoint returned 200"
    
    $logCount = $logsResponse.data.Count
    Print-Info "Retrieved $logCount sync logs"
    
    if ($logCount -gt 0) {
        $logsResponse.data[0] | ConvertTo-Json -Depth 3
    }
} catch {
    Print-Error "Sync logs endpoint failed"
    Write-Host $_.Exception.Message -ForegroundColor $Red
}

# Test 4: Get last mirror run
Print-Test "Test 4: GET /api/admin/mirror/last-run"
try {
    $lastRunResponse = Invoke-RestMethod -Uri "$ApiBaseUrl/api/admin/mirror/last-run?strategy=platform_to_gbp" -Method Get -Headers $headers -ErrorAction Stop
    Print-Success "Last run endpoint returned 200"
    $lastRunResponse | ConvertTo-Json -Depth 3
} catch {
    Print-Error "Last run endpoint failed"
    Write-Host $_.Exception.Message -ForegroundColor $Red
}

# Test 5: Trigger dry-run sync
Print-Test "Test 5: POST /api/categories/mirror (dry-run)"
try {
    $body = @{
        strategy = "platform_to_gbp"
        dryRun = $true
    } | ConvertTo-Json
    
    $mirrorResponse = Invoke-RestMethod -Uri "$ApiBaseUrl/api/categories/mirror" -Method Post -Headers $headers -Body $body -ContentType "application/json" -ErrorAction Stop
    Print-Success "Mirror endpoint accepted dry-run job (202)"
    
    $jobId = $mirrorResponse.jobId ?? "unknown"
    Print-Info "Job ID: $jobId"
    $mirrorResponse | ConvertTo-Json -Depth 3
    
    # Wait for job to complete
    Print-Info "Waiting 3 seconds for job to complete..."
    Start-Sleep -Seconds 3
    
    # Check logs again
    Print-Test "Verifying job appears in logs"
    $logsCheck = Invoke-RestMethod -Uri "$ApiBaseUrl/api/admin/sync-logs?limit=1" -Method Get -Headers $headers -ErrorAction Stop
    
    $latestJob = $logsCheck.data[0].jobId ?? "none"
    if ($latestJob -eq $jobId) {
        Print-Success "Job found in sync logs"
    } else {
        Print-Error "Job not found in sync logs (expected: $jobId, got: $latestJob)"
    }
} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    if ($statusCode -eq 409) {
        Print-Error "Feature disabled - check FF_CATEGORY_MIRRORING flag"
    } else {
        Print-Error "Mirror endpoint failed (Status: $statusCode)"
    }
    Write-Host $_.Exception.Message -ForegroundColor $Red
}

# Test 6: Verify out-of-sync metric emission
Print-Test "Test 6: Check for out-of-sync detection in logs"
Print-Info "This requires checking API logs for '[GBP_SYNC] OUT-OF-SYNC detected' messages"
Print-Info "Manual verification needed - check your API console/logs"

# Test 7: Feature flag verification
Print-Test "Test 7: Verify feature flags"
Print-Info "Checking required feature flags..."
Print-Info "Required flags for M3:"
Print-Info "  - FF_CATEGORY_MIRRORING (controls mirror endpoint)"
Print-Info "  - FF_TENANT_PLATFORM_CATEGORY (enables tenant categories)"
Print-Info "  - FF_TENANT_GBP_CATEGORY_SYNC (worker + dashboard visibility)"

# Test 8: Database verification
Print-Test "Test 8: Verify categoryMirrorRun table exists"
Print-Info "This requires database access - manual verification needed"
Print-Info "Check that table 'categoryMirrorRun' exists with columns:"
Print-Info "  - id, tenantId, strategy, dryRun"
Print-Info "  - created, updated, deleted, skipped, reason, error"
Print-Info "  - jobId, startedAt, completedAt"

# Summary
Write-Host ""
Write-Host "========================================" -ForegroundColor $Blue
Write-Host "Test Summary" -ForegroundColor $Blue
Write-Host "========================================" -ForegroundColor $Blue
Write-Host ""
Write-Host "Automated Tests Completed" -ForegroundColor $Green
Write-Host ""
Write-Host "Manual Verification Needed:"
Write-Host "  1. Navigate to $WebBaseUrl/settings/admin"
Write-Host "     - Verify 'GBP Category Sync' tile appears"
Write-Host "     - Check success rate displays correctly"
Write-Host ""
Write-Host "  2. Navigate to $WebBaseUrl/settings/admin/gbp-sync"
Write-Host "     - Verify 4 stat cards load"
Write-Host "     - Test 'Trigger Manual Sync' button"
Write-Host "     - Check sync logs table populates"
Write-Host ""
Write-Host "  3. Check API logs for telemetry:"
Write-Host "     - Look for '[GBP_SYNC] OUT-OF-SYNC detected' messages"
Write-Host "     - Verify metric emission if METRICS_DEBUG=true"
Write-Host ""
Write-Host "========================================" -ForegroundColor $Blue
Write-Host "M3 Testing Complete!" -ForegroundColor $Green
Write-Host "========================================" -ForegroundColor $Blue
